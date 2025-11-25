// Import the Supabase client instance for database interactions
import { supabase } from './client';

// Import the Lead type definition
import { Lead } from '../../../shared/types';

// Re-export Lead type for convenience
export type { Lead };

/**
 * Fetches leads from the database for a specific agent, optionally filtering by status, segments, tags, search, and more.
 * @param agentId ID of the agent whose leads to fetch.
 * @param filters Optional filters to query leads table.
 * @returns Promise resolving to an array of Lead objects.
 */
export async function getLeads(
  agentId: string,
  filters?: {
    status?: string;
    segments?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<Lead[]> {
  // Begin query from the leads table, selecting all columns
  let query = supabase
    .from('leads')
    .select('*')
    .eq('owner_agent_id', agentId);

  // Apply filters dynamically if provided
  if (filters) {
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.segments && filters.segments.length > 0) {
      // Filter by segments array (contains any of the specified segments)
      query = query.contains('segments', filters.segments);
    }
    if (filters.search) {
      // Search in first_name, last_name, email, or phone
      query = query.or(
        `first_name.ilike.%${filters.search}%,` +
        `last_name.ilike.%${filters.search}%,` +
        `email.ilike.%${filters.search}%,` +
        `phone.ilike.%${filters.search}%`
      );
    }
    if (filters.offset && typeof filters.offset === 'number') {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    } else if (filters.limit && typeof filters.limit === 'number') {
      query = query.limit(filters.limit);
    }
  }

  // Perform query execution and handle errors
  const { data, error } = await query;
  if (error) {
    throw new Error(`Error fetching leads: ${error.message}`);
  }
  // Return the fetched leads, or empty array if none found
  return data as Lead[] || [];
}

/**
 * Fetches a single lead from the database by its ID.
 * @param id ID of the lead to fetch.
 * @returns Promise resolving to the Lead object or null if not found.
 */
export async function getLeadById(id: string): Promise<Lead | null> {
  // Query the leads table by primary key (assumed to be 'id')
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === "PGRST116" || error.details?.includes('No rows')) {
      // Not found: return null
      return null;
    }
    throw new Error(`Error fetching lead by id: ${error.message}`);
  }
  return data as Lead;
}

/**
 * Creates a new lead in the database.
 * @param data Partial Lead object containing properties to insert.
 * @returns Promise resolving to the newly created Lead.
 */
export async function createLead(data: Partial<Lead>): Promise<Lead> {
  // Insert new lead in the leads table and get the inserted row
  const { data: inserted, error } = await supabase
    .from('leads')
    .insert([data])
    .select('*')
    .single();

  if (error) {
    throw new Error(`Error creating lead: ${error.message}`);
  }
  if (!inserted) {
    throw new Error('Failed to create lead: No data returned');
  }
  return inserted as Lead;
}

/**
 * Updates an existing lead record by its ID.
 * @param id ID of the lead to update.
 * @param updates Partial Lead containing the fields to update.
 * @returns Promise resolving to the updated Lead.
 */
export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
  // Update the lead with provided fields
  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Error updating lead: ${error.message}`);
  }
  if (!data) {
    throw new Error('Failed to update lead: No data returned');
  }
  return data as Lead;
}

