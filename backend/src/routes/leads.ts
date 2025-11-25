/**
 * Leads Routes - REST API for Lead Management
 * 
 * This file provides REST endpoints for CRUD operations on leads.
 * 
 * DEPENDENCIES:
 * - backend/src/db/queries.ts: Database operations
 * - backend/src/middleware/logger.ts: Logging
 * 
 * ENDPOINTS:
 * - GET /api/leads: List leads with filters
 * - GET /api/leads/:id: Get single lead
 * - POST /api/leads: Create lead
 * - PUT /api/leads/:id: Update lead
 * - DELETE /api/leads/:id: Soft delete lead
 */

import { Router, Request, Response } from 'express';
import { getLeads, getLeadById, createLead, updateLead } from '../db/queries';
import { logger } from '../middleware/logger';

export const leadsRouter = Router();

/**
 * GET /api/leads
 * List leads with optional filters
 */
leadsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const agentId = (req.query.agent_id as string) || process.env.ACCOUNT_ID_DEFAULT;
    
    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing agent ID',
      });
    }

    const filters = {
      status: req.query.status as string | undefined,
      segments: req.query.segments ? (req.query.segments as string).split(',') : undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const leads = await getLeads(agentId, filters);

    res.json({
      success: true,
      leads,
      count: leads.length,
    });
  } catch (error) {
    logger.error('Error fetching leads', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads',
    });
  }
});

/**
 * GET /api/leads/:id
 * Get single lead by ID
 */
leadsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await getLeadById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
    }

    res.json({
      success: true,
      lead,
    });
  } catch (error) {
    logger.error('Error fetching lead', {
      id: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead',
    });
  }
});

/**
 * POST /api/leads
 * Create a new lead
 */
leadsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const agentId = req.body.agent_id || process.env.ACCOUNT_ID_DEFAULT;
    
    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing agent ID',
      });
    }

    const leadData = {
      ...req.body,
      agent_id: agentId,
    };

    const lead = await createLead(leadData);

    logger.info('Lead created via REST API', {
      leadId: lead.id,
      agentId,
    });

    res.status(201).json({
      success: true,
      lead,
    });
  } catch (error) {
    logger.error('Error creating lead', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create lead',
    });
  }
});

/**
 * PUT /api/leads/:id
 * Update an existing lead
 */
leadsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await updateLead(req.params.id, req.body);

    logger.info('Lead updated via REST API', {
      leadId: lead.id,
    });

    res.json({
      success: true,
      lead,
    });
  } catch (error) {
    logger.error('Error updating lead', {
      id: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update lead',
    });
  }
});

/**
 * DELETE /api/leads/:id
 * Soft delete a lead (set status to 'deleted')
 */
leadsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await updateLead(req.params.id, { status: 'deleted' });

    logger.info('Lead deleted via REST API', {
      leadId: lead.id,
    });

    res.json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting lead', {
      id: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete lead',
    });
  }
});
