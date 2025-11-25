# RealLeads.ai - Voice-Powered CRM for Realtors

## Overview
RealLeads.ai is a voice-first, AI-native CRM system designed specifically for real estate professionals. The platform enables users to manage leads and follow-ups through natural language commands via WhatsApp voice messages and text.

## Current Status
**Backend**: Running successfully on port 8080
**API URL**: https://realleads-backend.draygo.repl.co

## Project Structure
```
realleads-ai/
├── backend/                    # Express TypeScript API server
│   ├── src/
│   │   ├── server.ts          # Main entry point
│   │   ├── db/
│   │   │   ├── client.ts      # Supabase/Postgres connection
│   │   │   └── queries.ts     # Database query helpers
│   │   ├── middleware/
│   │   │   ├── logger.ts      # Winston logging
│   │   │   ├── error-handler.ts
│   │   │   └── env-validator.ts
│   │   ├── integrations/
│   │   │   └── openai.ts      # GPT-4o orchestrator
│   │   ├── orchestrator/
│   │   │   ├── index.ts       # NL command processing
│   │   │   ├── parser.ts      # Response validation
│   │   │   └── prompts.ts     # System prompts
│   │   ├── executor/
│   │   │   ├── index.ts       # Action execution
│   │   │   ├── validators.ts  # Zod schemas
│   │   │   └── actions/       # Individual actions
│   │   └── routes/
│   │       ├── health.ts
│   │       ├── auth.ts
│   │       ├── command.ts
│   │       └── leads.ts
│   ├── migrations/
│   └── package.json
├── shared/                     # Shared TypeScript types
├── web/                        # Frontend (planned)
├── docs/                       # Documentation
├── migrations/                 # Database migrations
└── start-backend.sh           # Startup script
```

## Technology Stack
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o for natural language orchestration
- **Voice**: Twilio for SMS/WhatsApp
- **Email**: Mailchimp & Mandrill

## API Endpoints

### Health Check
- `GET /health` - Basic health check
- `GET /health/detailed` - Component status check

### Authentication
- `POST /api/auth/provision` - Create/update user after OAuth
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout

### Natural Language Commands
- `POST /command` or `POST /api/command` - Process NL command
  - Body: `{ "input": "Create a lead for John...", "context": {} }`

### Lead Management (REST)
- `GET /api/leads` - List leads with filters
- `GET /api/leads/:id` - Get single lead
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Soft delete lead

## Environment Secrets (Configured)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `ACCOUNT_ID_DEFAULT` - Default account ID
- `OPENAI_API_KEY` - OpenAI API key
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_MESSAGING_SERVICE_SID` - Twilio messaging service
- `MAILCHIMP_API_KEY` - Mailchimp API key
- `MAILCHIMP_SERVER_PREFIX` - Mailchimp server prefix
- `MANDRILL_API_KEY` - Mandrill API key

## Running the Application
The backend runs automatically via the configured workflow on port 8080.

Manual start:
```bash
bash start-backend.sh
```

## GitHub Integration
- Repository: `draygo/realleads-ai`
- Branch: `main`
- Sync: Pull latest from GitHub to update code

## Key Features
- Natural language command processing via GPT-4o
- Lead creation with auto-HNW detection ($3M+ budget)
- HNW lead protection (requires approval for outbound messages)
- Multi-channel messaging (SMS, WhatsApp, Email)
- RESTful API for dashboard integration

## Database Schema Notes
- **Lead Status Values**: 'New' | 'Nurture' | 'Hot' | 'Closed' | 'Lost' (capitalized)
- **Agent ID Column**: Uses `owner_agent_id` (not `agent_id`)
- **Tags Column**: Not present in current schema (filtering by tags removed)

## Recent Changes
- **2025-11-25**: Fixed status enum alignment across validators, shared types, and database queries. Updated agent_id to owner_agent_id. Removed tags filtering to match schema.
- **2025-11-25**: Backend fully operational with all secrets configured
- **2025-11-14**: Initial project setup and GitHub sync configured
