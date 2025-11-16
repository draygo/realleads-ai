# RealLeads.ai

## Overview

RealLeads.ai is a voice-first, AI-native CRM system designed specifically for real estate professionals. The platform enables users to manage leads and follow-ups through natural language commands via WhatsApp voice messages and text. It features autonomous follow-up orchestration powered by GPT-4o, high-net-worth (HNW) lead protection workflows, multi-channel messaging (SMS, WhatsApp, Email), and an admin dashboard for data inspection and approvals.

The system is built as a monorepo with a Node.js/TypeScript Express backend and a planned React/Vite admin UI. It leverages Supabase for database and authentication, OpenAI for natural language processing and voice transcription, Twilio for messaging, and Mailchimp/Mandrill for email campaigns.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Database Layer
- **Supabase (PostgreSQL)**: Primary data store with 7 core tables (agents, leads, communications, pending_messages, mailchimp_campaigns, audit_log, and one additional table)
- **Account-based multi-tenancy**: All tables include `account_id` for tenant isolation
- **Row Level Security (RLS)**: Policies documented but not yet enforced, prepared for future implementation
- **Automated timestamps**: Database triggers maintain `updated_at` fields automatically
- **Performance indexes**: Pre-configured indexes on frequently queried columns (status, market_area, segments, dates)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js 18+
- **API Structure**: RESTful routes organized by domain (leads, communications, campaigns, pending-messages, audit-log, health)
- **Middleware Stack**:
  - Environment variable validation on startup
  - Global error handling with structured error responses
  - Request logging with colorized console output
  - CORS configuration for frontend integration
- **Orchestrator Pattern**: GPT-4o integration for natural language command processing and action planning
- **Executor Pattern**: Validates and executes actions determined by the orchestrator
- **Scheduler System**: Node-cron for autonomous follow-ups and digest generation

### AI/ML Integration
- **OpenAI GPT-4o**: Primary orchestrator for parsing natural language commands and generating contextual responses
- **Whisper API**: Speech-to-text transcription for voice messages received via WhatsApp
- **Prompt Engineering**: System prompts guide the orchestrator's understanding of CRM context, lead statuses, and available actions

### Messaging Architecture
- **Multi-channel support**: SMS, WhatsApp, and Email through unified interfaces
- **Pending message queue**: HNW leads require manual approval before message send
- **Twilio Integration**: Handles SMS and WhatsApp message delivery with webhook support for incoming messages
- **Message tracking**: All communications logged to `communications` table with timestamps and delivery status

### Type Safety
- **Shared TypeScript types**: Common type definitions in `/shared/types.ts` used by both backend and frontend
- **Strict TypeScript**: Compiler configured with strict mode, declaration maps, and source maps
- **Zod validation**: Runtime schema validation for API inputs and external data

### Security Model
- **Service Role Key**: Backend uses Supabase service role key (bypasses RLS) - trusted server-side only
- **Environment validation**: Required credentials checked on application startup
- **HNW Protection**: High-net-worth leads flagged for manual approval before outbound contact
- **Future Auth**: Google OAuth prepared for admin dashboard authentication

### Deployment Strategy
- **Replit-first**: Configured for Replit deployment with `.replit` configuration
- **Monorepo workspace**: NPM workspaces for backend and web packages
- **Concurrent development**: Scripts run backend and frontend dev servers simultaneously
- **Build pipeline**: TypeScript compilation to `/dist` directory for production

## External Dependencies

### Core Infrastructure
- **Supabase**
  - PostgreSQL database hosting
  - Authentication service (prepared, not yet implemented)
  - Service role and anonymous keys for data access
  - Migrations stored in `/migrations` directory

### AI/ML Services
- **OpenAI**
  - GPT-4o for natural language orchestration
  - Whisper API for voice transcription
  - API key authentication
  - Model selection via environment variable

### Communication Services
- **Twilio**
  - SMS message delivery
  - WhatsApp Business API integration
  - Messaging Service SID for unified sending
  - Webhook receiver for incoming messages
  - Account SID and Auth Token for API access

### Email Services
- **Mailchimp**
  - Marketing campaign management
  - Audience/list management
  - API key with server prefix
  - Default audience ID for lead syncing

- **Mandrill (Mailchimp Transactional)**
  - Transactional email delivery
  - Daily/weekly digest emails
  - Configurable from address and reply-to
  - Separate API key from Mailchimp

### Third-party Data
- **Zenlist** (prepared interface, not yet implemented)
  - Real estate listings provider
  - Property data integration

### Development Tools
- **ts-node-dev**: Development server with hot reload
- **concurrently**: Parallel script execution for monorepo
- **dotenv**: Environment variable management
- **axios**: HTTP client for external API calls
- **form-data**: Multipart form uploads for audio files

### Validation & Utilities
- **Zod**: Runtime type validation
- **node-cron**: Scheduled task execution
- **cors**: Cross-origin resource sharing middleware