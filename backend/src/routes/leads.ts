/**
 * Leads REST API Routes
 * 
 * This file provides RESTful API endpoints for lead management.
 * These complement the /command natural language interface.
 * 
 * DEPENDENCIES:
 * - backend/src/db/queries.ts: Database operations
 * - backend/src/executor/actions/get-leads.ts: Get leads action
 * - backend/src/db/client.ts: Auth verification
 * - backend/src/middleware/logger.ts: Logging
 * - backend/src/middleware/error-handler.ts: Error handling
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/server.ts
 * - Called by: Frontend dashboard (for displaying leads table)
 * 
 * ENDPOINTS:
 * - GET /api/leads: Get all leads for current agent (with filters)
 * - GET /api/leads/:id: Get a single lead
 * - POST /api/leads: Create a new lead manually
 * - PUT /api/leads/:id: Update a lead
 * - DELETE /api/leads/:id: Delete a lead (soft delete)
 */

import { Router, Request, Response } from 'express';
import {
  getLeadsByAgent,
  getLeadById,
  createLead,
  updateLead,
} from '../db/queries';
import { verifySupabaseToken } from '../db/client';
import { logger } from '../middleware/logger';
import {
  asyncHandler,
  AuthError,
  ValidationError,
  NotFoundError,
} from '../middleware/error-handler';

const router = Router();

// ============================================================================
// Auth Middleware
// ============================================================================

/**
 * Middleware to verify auth and attach agent info
 * Reusable across all routes
 */
async function authMiddleware(req: Request, res: Response, next: any) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Authorization header missing or invalid');
    }

    const accessToken = authHeader.substring(7);
    const authResult = await verifySupabaseToken(accessToken);

    if (!authResult || !authResult.isValid) {
      throw new AuthError('Invalid or expired token');
    }

    // Get internal agent
    const { db } = await import('../db/client');
    const agentQuery = `
      SELECT id, email, display_name, role
      FROM agents
      WHERE supabase_user_id = $1
    `;

    const agentResult = await db.query(agentQuery, [authResult.userId]);

    if (agentResult.rows.length === 0) {
      throw new AuthError('User not found');
    }

    (req as any).agent = agentResult.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/leads
 * 
 * Get all leads for the current agent with optional filters
 * 
 * QUERY PARAMETERS:
 * - status: Filter by status (new, contacted, qualified, closed, lost)
 * - segments: Filter by segments (comma-separated, e.g., "High Net Worth,First Time Buyer")
 * - tags: Filter by tags (comma-separated)
 * - search: Text search in name, email, phone
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Pagination offset
 * 
 * RETURNS:
 * - 200: { leads: Lead[], count: number }
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const agent = (req as any).agent;

    // Parse query parameters
    const filters: any = {};

    if (req.query.status) {
      filters.status = req.query.status as string;
    }

    if (req.query.segments) {
      filters.segments = (req.query.segments as string).split(',').map(s => s.trim());
    }

    if (req.query.tags) {
      filters.tags = (req.query.tags as string).split(',').map(t => t.trim());
    }

    if (req.query.search) {
      filters.search = req.query.search as string;
    }

    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit as string, 10);
      if (filters.limit > 100) filters.limit = 100; // Cap at 100
    }

    if (req.query.offset) {
      filters.offset = parseInt(req.query.offset as string, 10);
    }

    logger.debug('Fetching leads', {
      agentId: agent.id,
      filters,
    });

    // Get leads from database
    const leads = await getLeadsByAgent(agent.id, filters);

    res.json({
      leads,
      count: leads.length,
    });
  })
);

/**
 * GET /api/leads/:id
 * 
 * Get a single lead by ID
 * 
 * RETURNS:
 * - 200: { lead: Lead }
 * - 404: { error: { message: "Lead not found" } }
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const agent = (req as any).agent;
    const leadId = req.params.id;

    logger.debug('Fetching lead', {
      agentId: agent.id,
      leadId,
    });

    const lead = await getLeadById(leadId, agent.id);

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    res.json({ lead });
  })
);

/**
 * POST /api/leads
 * 
 * Create a new lead manually (not via natural language command)
 * 
 * BODY:
 * - first_name: string (required)
 * - last_name: string (optional)
 * - email: string (optional, but recommended)
 * - phone: string (optional)
 * - property_address: string (optional)
 * - neighborhood: string (optional)
 * - beds: number (optional)
 * - baths: number (optional)
 * - price_range: string (optional)
 * - budget_max: number (optional)
 * - source: string (optional)
 * - status: string (optional, default: 'New')
 * - segments: string[] (optional)
 * - tags: string[] (optional)
 * - notes: string (optional)
 * 
 * RETURNS:
 * - 201: { lead: Lead, message: string }
 * - 400: { error: { message: "Validation error" } }
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const agent = (req as any).agent;
    const leadData = req.body;

    // Validate required fields
    if (!leadData.first_name) {
      throw new ValidationError('first_name is required');
    }

    logger.info('Creating lead', {
      agentId: agent.id,
      first_name: leadData.first_name,
    });

    // Auto-detect HNW
    const segments = leadData.segments || [];
    if (leadData.budget_max && leadData.budget_max > 3_000_000) {
      if (!segments.includes('High Net Worth')) {
        segments.push('High Net Worth');
      }
    }

    // Create lead
    const lead = await createLead({
      agent_id: agent.id,
      first_name: leadData.first_name,
      last_name: leadData.last_name,
      email: leadData.email,
      phone: leadData.phone,
      property_address: leadData.property_address,
      neighborhood: leadData.neighborhood,
      beds: leadData.beds,
      baths: leadData.baths,
      price_range: leadData.price_range,
      budget_max: leadData.budget_max,
      source: leadData.source || 'manual',
      status: leadData.status || 'New',
      segments,
      tags: leadData.tags,
      notes: leadData.notes,
    });

    logger.info('Lead created', {
      agentId: agent.id,
      leadId: lead.id,
    });

    res.status(201).json({
      lead,
      message: 'Lead created successfully',
    });
  })
);

/**
 * PUT /api/leads/:id
 * 
 * Update an existing lead
 * 
 * BODY: Partial lead data (only fields you want to update)
 * 
 * RETURNS:
 * - 200: { lead: Lead, message: string }
 * - 404: { error: { message: "Lead not found" } }
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const agent = (req as any).agent;
    const leadId = req.params.id;
    const updates = req.body;

    logger.info('Updating lead', {
      agentId: agent.id,
      leadId,
      updates: Object.keys(updates),
    });

    // Update lead
    const lead = await updateLead(leadId, agent.id, updates);

    res.json({
      lead,
      message: 'Lead updated successfully',
    });
  })
);

/**
 * DELETE /api/leads/:id
 * 
 * Soft delete a lead (set status to 'lost' or add 'deleted' tag)
 * 
 * RETURNS:
 * - 200: { message: string }
 * - 404: { error: { message: "Lead not found" } }
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const agent = (req as any).agent;
    const leadId = req.params.id;

    logger.info('Deleting lead', {
      agentId: agent.id,
      leadId,
    });

    // Soft delete by setting status to 'lost'
    await updateLead(leadId, agent.id, {
      status: 'lost',
      tags: ['deleted'],
    });

    res.json({
      message: 'Lead deleted successfully',
    });
  })
);

// ============================================================================
// Export Router
// ============================================================================

export default router;
