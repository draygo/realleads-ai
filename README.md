# RealLeads.ai

**Voice-first, AI-native CRM for real estate follow-up and relationship management**

RealLeads.ai is a headless-first CRM that you control via natural language (WhatsApp voice/text). It features autonomous follow-up orchestration with GPT-4o, HNW (High Net Worth) approval workflows, and multi-channel messaging.

## 🎯 Core Features

- **Voice-First Interface**: Interact with your CRM via WhatsApp voice messages
- **Natural Language Commands**: Query and manage leads using plain English
- **HNW Protection**: High Net Worth leads require manual approval for all outbound messages
- **Multi-Channel Messaging**: SMS, WhatsApp, Email (via Mailchimp & Mandrill)
- **Autonomous Follow-Ups**: Smart scheduler with cadence management
- **Admin Dashboard**: React UI for data inspection, approvals, and command console
- **Daily/Weekly Digests**: Automated KPI reports delivered to your inbox

## 📁 Project Structure

```
realleads-ai/
├── backend/              # Node/TypeScript Express API
│   ├── src/
│   │   ├── server.ts             # Main Express app
│   │   ├── orchestrator/         # GPT-4o integration
│   │   ├── executor/             # Action validation & execution
│   │   ├── integrations/         # Twilio, Mailchimp, Mandrill, Whisper
│   │   ├── routes/               # API endpoints
│   │   ├── scheduler/            # Cron jobs (follow-ups, digests)
│   │   ├── middleware/           # Auth, logging, error handling
│   │   └── db/                   # Supabase client & queries
│   └── scripts/                  # Seed data, test utilities
├── web/                  # React/Vite admin UI
│   ├── src/
│   │   ├── components/           # Leads, Pending, Console, etc.
│   │   ├── pages/                # Main views
│   │   ├── hooks/                # API hooks
│   │   └── lib/                  # Utils, API client
│   └── ...
├── migrations/           # Supabase SQL migrations
│   ├── 001_initial_schema.sql    # 7 core tables + account_id
│   ├── 002_indexes.sql           # Performance indexes
│   └── 003_rls_policies.sql      # RLS policies (commented, future use)
├── shared/               # Shared TypeScript types
│   └── types.ts
├── docs/                 # Detailed documentation
│   ├── SETUP.md                  # Complete setup guide
│   ├── INTEGRATIONS.md           # Service-by-service config
│   ├── ORCHESTRATOR.md           # Prompt engineering guide
│   └── N8N.md                    # n8n webhook specs
└── .env.example          # Environment variables template
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- A Supabase account (free tier works)
- OpenAI API key (for GPT-4o and Whisper)
- Twilio account (for SMS/WhatsApp)
- Mailchimp account (for campaigns)
- Mandrill account (for transactional email)
- Google Cloud project (for OAuth)

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd realleads-ai

# Install dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install web dependencies
cd web && npm install && cd ..
```

### 2. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and fill in your actual values
# See INTEGRATIONS.md for detailed setup instructions
```

**Critical environment variables:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from Supabase dashboard)
- `OPENAI_API_KEY` (from OpenAI platform)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (from Twilio console)
- `MAILCHIMP_API_KEY`, `MANDRILL_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (for OAuth)

### 3. Run Database Migrations

```bash
# In Supabase SQL Editor, run migrations in order:
# 1. migrations/001_initial_schema.sql
# 2. migrations/002_indexes.sql
# (Skip 003_rls_policies.sql for now - RLS not enabled yet)

# Create a default account ID (generate a UUID)
# Update .env with: ACCOUNT_ID_DEFAULT=<your-uuid>
```

### 4. Start the Application

```bash
# Development mode (runs backend + frontend concurrently)
npm run dev

# Backend will run on http://localhost:3000
# Frontend will run on http://localhost:5173
```

### 5. Test Integration Status

Visit `http://localhost:3000/health/integrations` to see which services are connected.

---

## 📖 Detailed Setup Guides

### [Complete Setup Guide](docs/SETUP.md)
Step-by-step instructions for:
- Supabase project creation
- Google OAuth configuration
- (Optional / future) GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (for custom OAuth flows; **not required when using Supabase Auth providers**).
- Twilio Sandbox enablement
- Mailchimp audience setup
- Mandrill DNS/DKIM/SPF verification

### [Integrations Guide](docs/INTEGRATIONS.md)
Service-by-service configuration:
- Supabase Auth & Database
- Twilio WhatsApp Sandbox → Business account migration
- OpenAI API (GPT-4o, Whisper)
- Mailchimp campaigns
- Mandrill transactional email
- Zenlist listings provider

### [Orchestrator Guide](docs/ORCHESTRATOR.md)
Understanding the AI orchestration layer:
- System prompt and tone adaptation
- Required fields enforcement
- HNW (High Net Worth) rule logic
- Action types and validation
- UI rendering contracts

### [n8n Integration Guide](docs/N8N.md)
Webhook endpoints for n8n automation:
- Lead intake webhook
- Content ingestion → campaign staging
- Approval notifications
- Reply handlers

---

## 🎮 Usage Examples

### Command Console (Natural Language Queries)

```
"Show me all HNW leads in San Francisco not contacted in 14+ days"
"Create a new lead: Anna K, email anna@example.com, interested in a 2BR condo in Pacific Heights under $1.5M"
"What are my top 3 opportunities this week?"
"Draft a follow-up text for lead <id> with 3 similar listings"
"Approve pending message <id>"
```

### WhatsApp Voice/Text

1. Join Twilio WhatsApp Sandbox (see INTEGRATIONS.md)
2. Send voice message: "Show me my hot leads in Marin"
3. System transcribes → interprets → responds with summary + data
4. Send text command: "Add Anna to my HNW segment"

### Admin UI

- **Leads Table**: Filter by segment, status, market area, last contact date
- **Pending Approvals**: Review HNW messages before sending
- **Command Console**: Type natural language queries
- **Communications Log**: Timeline of all interactions
- **Audit Trail**: Full system action history

---

## 🔒 Security & Data Protection

### HNW (High Net Worth) Rule
- If `segments` includes `'High Net Worth'`, **no automated sends**
- All messages go to `pending_messages` table for explicit approval
- Approval workflow tracked in `audit_log`

### Required Fields Gate
Before any lead write or follow-up plan:
- `first_name` AND
- One of `{email, phone}` AND
- One of `{property_address, (neighborhood AND beds AND baths)}` AND
- `budget_max` OR `price_range` (or confirm "subject price ±$200k")

If missing → returns `clarification_needed` with a single concise question.

### Multi-Tenancy (Future)
- All tables include `account_id` for future multi-tenant support
- RLS policies documented in `migrations/003_rls_policies.sql` (not enabled yet)
- See [SETUP.md](docs/SETUP.md) for migration path

---

## 🤖 Orchestrator Architecture

### How It Works

1. **Input**: User sends natural language command (voice/text via WhatsApp or UI console)
2. **Transcription**: Voice → Whisper → text transcript
3. **Orchestration**: GPT-4o receives:
   - System prompt with rules (HNW, required fields, tone guidelines)
   - User command
   - Returns structured JSON (never SQL)
4. **Validation**: Action Executor validates JSON against Zod schemas
5. **Execution**: Parameterized queries execute actions safely
6. **Logging**: All actions logged to `audit_log`
7. **Response**: UI-friendly summary + data (table/cards/graphs)

### Orchestrator Modes

**Clarification Needed:**
```json
{
  "mode": "clarification_needed",
  "explanation": "I need a bit more info...",
  "missing_fields": ["phone_or_email", "budget_max"],
  "follow_up_question": "What's the best phone or email for Anna, and should I use the subject property price ±$200k?"
}
```

**Execute:**
```json
{
  "mode": "execute",
  "explanation": "Creating Anna as a new lead and drafting initial follow-up...",
  "actions": [
    {
      "type": "create_lead",
      "payload": { ... }
    },
    {
      "type": "draft_initial_followup",
      "payload": { ... }
    }
  ],
  "ui": {
    "render": "notice",
    "summary": "Created Anna K and queued HNW approval for initial text."
  }
}
```

---

## 📊 Daily & Weekly Digests

### Daily Digest (7:00am PT)
- Yesterday's new leads (by source/segment)
- Outbound messages by channel
- HNW pending/approved/rejected count
- Reply rate
- Top 3 opportunities
- Today's due follow-ups

### Weekly Digest (Monday 7:00am PT)
- Week-over-week deltas (leads, messages, reply rate)
- Best-performing segment
- Top message templates by reply rate
- Delivery issues (bounces, errors)
- Links to filtered UI views

Delivered via Mandrill to `DIGEST_RECIPIENT_EMAIL`.

---

## 🛠 Development

### Running Tests

```bash
# Test integration status
npm run test:integrations

# Seed test data
npm run seed
```

### Local WhatsApp Testing with ngrok

```bash
# Install ngrok
npm install -g ngrok

# Expose local backend
ngrok http 3000

# Copy the HTTPS URL and configure in Twilio Sandbox:
# https://<random>.ngrok.io/twilio/whatsapp-webhook
```

### Building for Production

```bash
# Build backend + frontend
npm run build

# Start production server
cd backend && npm start
```

---

## 🐛 Troubleshooting

### "Integration disconnected" errors
- Check `/health/integrations` endpoint
- Verify all required env vars are set
- See [INTEGRATIONS.md](docs/INTEGRATIONS.md) for service-specific setup

### WhatsApp webhook not receiving messages
- Ensure ngrok (local) or Replit URL is configured in Twilio
- Verify `TWILIO_WEBHOOK_SECRET` if using signature validation
- Check backend logs for errors

### Clarification loop (orchestrator keeps asking questions)
- Ensure you're providing all required fields
- See [ORCHESTRATOR.md](docs/ORCHESTRATOR.md) for field requirements
- Check `audit_log` table for exact missing fields

### RLS errors after enabling multi-tenancy
- See `migrations/003_rls_policies.sql` comments
- Ensure Supabase Auth JWT includes `account_id` claim
- Test policies before enabling in production

---

## 📚 Additional Documentation

- **[SETUP.md](docs/SETUP.md)**: Complete setup instructions
- **[INTEGRATIONS.md](docs/INTEGRATIONS.md)**: Service configuration guides
- **[ORCHESTRATOR.md](docs/ORCHESTRATOR.md)**: AI orchestration details
- **[N8N.md](docs/N8N.md)**: n8n webhook specifications

---

## 🤝 Contributing

This is currently a personal project for David Raygorodsky at Vanguard Properties. If you'd like to use this system, please fork the repository and configure it for your own use.

---

## 📝 License

Private - All Rights Reserved

---

## 🙏 Acknowledgments

Built with:
- [Supabase](https://supabase.com/) - Database & Auth
- [OpenAI](https://openai.com/) - GPT-4o & Whisper
- [Twilio](https://twilio.com/) - SMS & WhatsApp
- [Mailchimp](https://mailchimp.com/) - Email campaigns
- [Mandrill](https://mandrillapp.com/) - Transactional email
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) - Admin UI

---

## 📞 Support

For questions or issues:
- Check the docs/ directory
- Review `/health/integrations` endpoint
- Inspect `audit_log` table for debugging

---

**Built with ❤️ for real estate professionals who value relationships over transactions.**
