# RealLeads.ai Backend - Integration Guide

This guide will help you merge your Cursor (local) codebase with your Replit codebase and get everything running.

## 📋 Overview

You now have two codebases that need to be merged:

1. **Replit**: Has Supabase setup, OAuth working, and web frontend
2. **Cursor (Local)**: Has the orchestrator "brain" with OpenAI integration

This integration brings them together into one cohesive system.

---

## 🗂️ Project Structure

```
realleads-ai/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── client.ts           # Supabase Postgres connection
│   │   │   └── queries.ts          # Typed database queries
│   │   ├── executor/
│   │   │   ├── actions/
│   │   │   │   ├── create-lead.ts  # Create lead action
│   │   │   │   └── get-leads.ts    # Get leads action
│   │   │   ├── index.ts            # Executor coordinator
│   │   │   └── validators.ts       # Parameter validation
│   │   ├── integrations/
│   │   │   └── openai.ts           # OpenAI API client
│   │   ├── middleware/
│   │   │   ├── env-validator.ts    # Environment validation
│   │   │   ├── error-handler.ts    # Error handling
│   │   │   └── logger.ts           # Winston logging
│   │   ├── orchestrator/
│   │   │   ├── index.ts            # Main orchestrator
│   │   │   ├── parser.ts           # Response parser
│   │   │   └── prompts.ts          # System prompts
│   │   ├── routes/
│   │   │   ├── auth.ts             # Auth & user provisioning
│   │   │   ├── command.ts          # Natural language commands
│   │   │   ├── health.ts           # Health checks
│   │   │   └── leads.ts            # Leads REST API
│   │   └── server.ts               # Express app setup
│   ├── migrations/
│   │   └── 000_create_agents_table.sql
│   ├── package.json
│   └── tsconfig.json
├── web/                            # Your React frontend (already exists)
└── .env                            # Environment variables (create this)
```

---

## 🚀 Step-by-Step Integration

### Step 1: Copy Files to Replit

Copy all the files I've provided into your Replit project:

```bash
# In your Replit workspace
# Make sure you're in the root directory

# The files should be placed exactly as shown in the structure above
# backend/src/db/client.ts
# backend/src/db/queries.ts
# backend/src/orchestrator/index.ts
# ... etc
```

### Step 2: Install Dependencies

In Replit, open the Shell and run:

```bash
cd backend
npm install
```

This will install all the packages listed in `package.json`:
- `express`, `cors`, `helmet`: Web server
- `@supabase/supabase-js`: Supabase client
- `pg`: PostgreSQL client
- `openai`: OpenAI API client
- `winston`: Logging
- `zod`: Schema validation

### Step 3: Set Up Environment Variables

In Replit, go to the **Secrets** tab (🔒 icon in left sidebar) and add these secrets:

**Required Secrets:**
```
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=sk-your-openai-key
```

**Optional Secrets (for SMS/Email later):**
```
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
MANDRILL_API_KEY=your-mandrill-key
MANDRILL_FROM_EMAIL=your-email@example.com
```

**Where to find these:**

- `DATABASE_URL`: Supabase Dashboard → Settings → Database → Connection string (Direct connection)
- `SUPABASE_URL`: Supabase Dashboard → Settings → API → Project URL
- `SUPABASE_ANON_KEY`: Supabase Dashboard → Settings → API → Project API keys → anon public
- `SUPABASE_JWT_SECRET`: Supabase Dashboard → Settings → API → JWT Secret
- `OPENAI_API_KEY`: https://platform.openai.com/api-keys

### Step 4: Run Database Migrations

In Supabase SQL Editor, run the migration:

```sql
-- Run the contents of backend/migrations/000_create_agents_table.sql
-- This creates the agents table that links Supabase auth to your internal system
```

### Step 5: Update Your Existing Code

#### If you have an existing `backend/src/server.ts`:
- Replace it with the new `server.ts` I provided
- Or merge the routes carefully

#### If you have existing database queries:
- Update them to use the new `db/client.ts` and `db/queries.ts`
- Make sure table names match your migrations

### Step 6: Start the Backend

In Replit Shell:

```bash
cd backend
npm run dev
```

You should see:
```
[INFO] Logger initialized
[INFO] Environment validation passed
[INFO] OpenAI client initialized
[INFO] Server started successfully { port: 3001 }
```

### Step 7: Test the Integration

#### Test 1: Health Check
```bash
curl http://localhost:3001/health
```

Should return: `{"status":"healthy","timestamp":"...","uptime":...}`

#### Test 2: Auth Provision

From your React app, after Google login:

```javascript
// In AuthCallback.tsx
const { data: { session }, error } = await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: refreshToken
});

// Call your backend
const response = await fetch('http://localhost:3001/api/auth/provision', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const data = await response.json();
console.log('User provisioned:', data.user);
```

#### Test 3: Natural Language Command

```bash
curl -X POST http://localhost:3001/command \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Show me all my leads"
  }'
```

---

## 🔧 Configuration Details

### Environment Variables Explained

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | Postgres connection to Supabase | ✅ Yes |
| `SUPABASE_URL` | Supabase project URL | ✅ Yes |
| `SUPABASE_ANON_KEY` | For auth verification | ✅ Yes |
| `SUPABASE_JWT_SECRET` | For token verification | ✅ Yes |
| `OPENAI_API_KEY` | For orchestrator | ✅ Yes |
| `ORCHESTRATOR_MODEL` | GPT model to use | No (default: gpt-4o) |
| `PORT` | Backend server port | No (default: 3001) |
| `CORS_ORIGIN` | Allowed origins | No (default: http://localhost:5173) |

### TypeScript Configuration

The `tsconfig.json` is configured for:
- ES2020 target
- Strict type checking
- Source maps for debugging
- Output to `dist/` folder

### NPM Scripts

- `npm run dev`: Development with hot reload
- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Run compiled JavaScript
- `npm run lint`: Check code style
- `npm run typecheck`: TypeScript type checking

---

## 🛠️ How It Works

### Authentication Flow

1. User clicks "Sign in with Google" on frontend
2. Supabase handles OAuth, returns access token
3. Frontend calls `POST /api/auth/provision` with token
4. Backend verifies token with Supabase
5. Backend creates/updates `agents` table row
6. Backend returns internal user object
7. Frontend stores session and redirects to dashboard

### Command Processing Flow

1. User sends natural language command to `POST /command`
2. **Orchestrator** interprets command → structured actions
3. If clarification needed → return follow-up question
4. If ready to execute:
   - **Executor** runs actions (database operations)
   - Returns results
5. Frontend displays results to user

### Database Architecture

```
Supabase:
  auth.users (managed by Supabase)
  ↓ (linked by supabase_user_id)
  agents (your internal table)
  ↓ (linked by agent_id)
  leads, communications, pending_messages, etc.
```

---

## 📝 API Endpoints

### Health & Status
- `GET /health`: Basic health check
- `GET /health/detailed`: Detailed component health

### Authentication
- `POST /api/auth/provision`: Create/update internal user
- `GET /api/auth/me`: Get current user info
- `POST /api/auth/logout`: Logout (logging only)

### Natural Language Interface
- `POST /command`: Process natural language command
- `POST /api/command`: Alternative path

### REST API
- `GET /api/leads`: Get all leads (with filters)
- `GET /api/leads/:id`: Get single lead
- `POST /api/leads`: Create lead
- `PUT /api/leads/:id`: Update lead
- `DELETE /api/leads/:id`: Soft delete lead

---

## 🐛 Troubleshooting

### "Environment validation failed"
- Check that all required secrets are set in Replit
- Make sure there are no typos in secret names
- Restart the backend after adding secrets

### "Database connection failed"
- Verify `DATABASE_URL` is correct
- Check Supabase project is running
- Ensure IP whitelist allows Replit (or use `0.0.0.0/0` for testing)

### "OpenAI API call failed"
- Verify `OPENAI_API_KEY` is correct
- Check OpenAI account has credits
- Ensure API key has not been rate limited

### "Invalid or expired token"
- Frontend needs to refresh Supabase token
- Check token is being sent in Authorization header
- Verify `SUPABASE_JWT_SECRET` matches your project

### CORS errors
- Check `CORS_ORIGIN` includes your frontend URL
- In Replit, make sure to use the deployment URLs, not localhost

---

## 🔐 Security Notes

1. **Never commit `.env` or secrets** to git
2. **Use Supabase RLS policies** for multi-tenant security
3. **Always validate auth tokens** on backend
4. **Use parameterized queries** to prevent SQL injection (already done)
5. **Rotate API keys** regularly

---

## 🚀 Next Steps

1. ✅ Get backend running with orchestrator
2. ✅ Test auth flow end-to-end
3. ✅ Test command processing
4. ⏭️ Implement remaining actions:
   - `draft_initial_followup`
   - `create_pending_message`
   - `send_sms` / `send_whatsapp` / `send_email`
5. ⏭️ Build out frontend dashboard to display leads
6. ⏭️ Add WhatsApp webhook integration
7. ⏭️ Implement campaigns and content features

---

## 📚 Key Files Reference

**Start here when debugging:**
- `backend/src/server.ts`: Main entry point
- `backend/src/routes/command.ts`: Natural language processing
- `backend/src/orchestrator/index.ts`: AI orchestration logic
- `backend/src/executor/index.ts`: Action execution
- `.env.example`: All required environment variables

**When adding new actions:**
- `backend/src/executor/actions/`: Add new action files here
- `backend/src/executor/validators.ts`: Add parameter schemas
- `backend/src/executor/index.ts`: Register action in switch statement
- `backend/src/orchestrator/prompts.ts`: Update system prompt

**When adding new routes:**
- `backend/src/routes/`: Add new route files here
- `backend/src/server.ts`: Mount routes in Express app

---

## 💬 Questions?

If you encounter issues:
1. Check the logs in Replit console
2. Verify all environment variables are set
3. Test each component in isolation (health → auth → command)
4. Check Supabase logs for database errors

---

Made with ❤️ for real estate agents who want to build better relationships with their clients.
