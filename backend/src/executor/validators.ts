/**
 * Executor Validators - Action Parameter Validation
 * 
 * This file provides validation schemas for action parameters using Zod.
 * Each action type has a corresponding schema that validates its parameters.
 * 
 * DEPENDENCIES:
 * - zod: Schema validation library
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/executor/actions/*.ts
 * - Used by: backend/src/executor/index.ts
 * 
 * VALIDATION APPROACH:
 * - Use Zod schemas to define expected parameters for each action
 * - Catch errors early before database operations
 * - Provide clear error messages for invalid parameters
 */

import { z } from 'zod';

// ============================================================================
// Custom Validators
// ============================================================================

/**
 * Phone number validator
 * - Accepts: 5551234567, 555-123-4567, (555) 123-4567, etc.
 * - Validates: Must be exactly 10 digits
 * - Transforms to: xxx-xxx-xxxx format
 */
const phoneSchema = z
  .string()
  .transform((val) => {
    // Remove all non-digit characters
    const digitsOnly = val.replace(/\D/g, '');
    return digitsOnly;
  })
  .refine((val) => val.length === 10, {
    message: 'Phone number must be exactly 10 digits (including area code)',
  })
  .transform((val) => {
    // Format as xxx-xxx-xxxx
    return `${val.slice(0, 3)}-${val.slice(3, 6)}-${val.slice(6, 10)}`;
  });

/**
 * Email validator
 * - Must contain @ symbol
 * - Must have . after the @
 * - Uses standard email validation
 */
const emailSchema = z
  .string()
  .email('Invalid email format')
  .refine(
    (email) => {
      const atIndex = email.indexOf('@');
      const dotAfterAt = email.indexOf('.', atIndex);
      return atIndex > 0 && dotAfterAt > atIndex;
    },
    {
      message: 'Email must contain @ symbol and a domain with a period (.)',
    }
  );

// ============================================================================
// Lead Action Validators
// ============================================================================

/**
 * Validator for create_lead action
 * Ensures all required fields are present and valid
 */
export const CreateLeadSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  property_address: z.string().optional(),
  neighborhood: z.string().optional(),
  beds: z.number().int().positive().optional(),
  baths: z.number().positive().optional(), // Can be decimal (e.g., 1.5)
  price_range: z.string().optional(),
  budget_min: z.number().positive().optional(),
  budget_max: z.number().positive().optional(),
  source: z.string().optional(),
  status: z.enum(['New', 'Nurture', 'Hot', 'Closed', 'Lost']).optional(),
  segments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

/**
 * Validator for get_leads action
 * Allows filtering by various criteria
 */
export const GetLeadsSchema = z.object({
  status: z.enum(['New', 'Nurture', 'Hot', 'Closed', 'Lost']).optional(),
  segments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  email: z.string().optional(), // Filter by exact email
  phone: z.string().optional(), // Filter by phone
  neighborhood: z.string().optional(), // Filter by neighborhood
  search: z.string().optional(), // Search in name, email, phone
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});
/**
 * Validator for update_lead action
 * Similar to create but requires lead_id
 */
export const UpdateLeadSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID format'),
  first_name: z.string().min(1).optional(),
  last_name: z.string().optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  property_address: z.string().optional(),
  neighborhood: z.string().optional(),
  beds: z.number().int().positive().optional(),
  baths: z.number().positive().optional(),
  price_range: z.string().optional(),
  budget_max: z.number().positive().optional(),
  source: z.string().optional(),
  status: z.enum(['New', 'Nurture', 'Hot', 'Closed', 'Lost']).optional(),
  segments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

/**
 * Validator for enrich_property_for_lead action
 * Enriches a subject property for a lead based on address or URL
 */
export const EnrichPropertyForLeadSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID format'),
  raw_input: z.string().min(1, 'raw_input is required and must be non-empty'),
});

// ============================================================================
// Communication Action Validators
// ============================================================================

/**
 * Validator for get_communications action
 */
export const GetCommunicationsSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID format'),
  channel: z.enum(['email', 'sms', 'whatsapp', 'phone']).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

/**
 * Validator for draft_initial_followup action
 */
export const DraftInitialFollowupSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID format'),
  tone: z.enum(['professional', 'casual', 'warm']).optional(),
});

// ============================================================================
// Message Action Validators
// ============================================================================

/**
 * Validator for create_pending_message action
 * Used for HNW leads that require approval
 */
export const CreatePendingMessageSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID format'),
  channel: z.enum(['email', 'sms', 'whatsapp']),
  message_body: z.string().min(1, 'Message body is required'),
  requires_approval: z.boolean(),
});

/**
 * Validator for send_sms action
 * ⚠️ Should never be used for HNW leads
 */
export const SendSmsSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID format'),
  message_body: z.string().min(1, 'Message body is required'),
});

/**
 * Validator for send_whatsapp action
 * ⚠️ Should never be used for HNW leads
 */
export const SendWhatsAppSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID format'),
  message_body: z.string().min(1, 'Message body is required'),
});

/**
 * Validator for send_email action
 * ⚠️ Should never be used for HNW leads
 */
export const SendEmailSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID format'),
  subject: z.string().min(1, 'Email subject is required'),
  body: z.string().min(1, 'Email body is required'),
});

// ============================================================================
// Content & Campaign Validators
// ============================================================================

/**
 * Validator for ingest_content action
 */
export const IngestContentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  content_type: z.enum(['listing', 'market_report', 'newsletter', 'other']).optional(),
});

/**
 * Validator for summarize_content_for_segments action
 */
export const SummarizeContentForSegmentsSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  segments: z.array(z.string()).min(1, 'At least one segment required'),
});

/**
 * Validator for stage_campaign_from_content action
 */
export const StageCampaignFromContentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  target_segments: z.array(z.string()).optional(),
  send_immediately: z.boolean().optional(),
});

// ============================================================================
// Validation Helper Function
// ============================================================================

/**
 * Validate action parameters based on action type
 * 
 * @param actionType - Type of action being executed
 * @param params - Parameters to validate
 * @returns Validated and typed parameters
 * @throws Error if validation fails
 * 
 * @example
 * const validParams = validateActionParams('create_lead', rawParams);
 */
export function validateActionParams(
  actionType: string,
  params: Record<string, any>
): any {
  try {
    switch (actionType) {
      // Lead actions
      case 'create_lead':
        return CreateLeadSchema.parse(params);
      case 'get_leads':
        return GetLeadsSchema.parse(params);
      case 'update_lead':
        return UpdateLeadSchema.parse(params);
      case 'enrich_property_for_lead':
        return EnrichPropertyForLeadSchema.parse(params);

      // Communication actions
      case 'get_communications':
        return GetCommunicationsSchema.parse(params);
      case 'draft_initial_followup':
        return DraftInitialFollowupSchema.parse(params);

      // Message actions
      case 'create_pending_message':
        return CreatePendingMessageSchema.parse(params);
      case 'send_sms':
        return SendSmsSchema.parse(params);
      case 'send_whatsapp':
        return SendWhatsAppSchema.parse(params);
      case 'send_email':
        return SendEmailSchema.parse(params);

      // Content & campaign actions
      case 'ingest_content':
        return IngestContentSchema.parse(params);
      case 'summarize_content_for_segments':
        return SummarizeContentForSegmentsSchema.parse(params);
      case 'stage_campaign_from_content':
        return StageCampaignFromContentSchema.parse(params);

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(
        `Parameter validation failed for ${actionType}: ${errorMessages}`
      );
    }
    throw error;
  }
}

// ============================================================================
// Export All Schemas
// ============================================================================

export default {
  // Lead schemas
  CreateLeadSchema,
  GetLeadsSchema,
  UpdateLeadSchema,
  EnrichPropertyForLeadSchema,

  // Communication schemas
  GetCommunicationsSchema,
  DraftInitialFollowupSchema,

  // Message schemas
  CreatePendingMessageSchema,
  SendSmsSchema,
  SendWhatsAppSchema,
  SendEmailSchema,

  // Content schemas
  IngestContentSchema,
  SummarizeContentForSegmentsSchema,
  StageCampaignFromContentSchema,

  // Validation function
  validateActionParams,
};
