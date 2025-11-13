# RealLeads.ai - Complete Setup Guide

This guide will walk you through setting up RealLeads.ai from scratch, including all required third-party services.

## Table of Contents
1. [GitHub Repository Setup](#1-github-repository-setup)
2. [Supabase Setup](#2-supabase-setup)
3. [Google OAuth Setup](#3-google-oauth-setup)
4. [Twilio Setup](#4-twilio-setup)
5. [OpenAI Setup](#5-openai-setup)
6. [Mailchimp Setup](#6-mailchimp-setup)
7. [Mandrill Setup](#7-mandrill-setup)
8. [Replit Deployment](#8-replit-deployment)
9. [First Run Validation](#9-first-run-validation)

---

## 1. GitHub Repository Setup

### Create Repository

```bash
# Initialize git
cd realleads-ai
git init

# Create GitHub repository (via GitHub.com or CLI)
gh repo create realleads-ai --private --source=. --remote=origin

# Add all files
git add .
git commit -m "Initial commit: RealLeads.ai CRM system"
git push -u origin main
```

### Repository Settings

1. Go to your GitHub repository settings
2. Under "Secrets and variables" → "Actions":
   - Add all environment variables from `.env.example` as secrets
   - These will be used for CI/CD if you set it up later

---

## 2. Supabase Setup

### Create Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in:
   - **Name**: `realleads-ai` (or your choice)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to San Francisco (e.g., `us-west-1`)
4. Wait for project to be created (~2 minutes)

### Get API Credentials

1. In your project dashboard, go to **Settings** → **API**
2. Copy these values to your `.env` file:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

### Run Database Migrations

1. In Supabase dashboard, go to **SQL Editor**
2. Create a new query
3. Copy/paste `migrations/001_initial_schema.sql` → Run
4. Create another query
5. Copy/paste `migrations/002_indexes.sql` → Run
6. ✅ Your database is now set up!

### Generate Default Account ID

```bash
# Generate a UUID (on Mac/Linux)
uuidgen

# Or use online generator: https://www.uuidgenerator.net/

# Add to .env:
ACCOUNT_ID_DEFAULT=<your-generated-uuid>
```

### Verify Tables

In Supabase dashboard → **Table Editor**, you should see:
- `agents`
- `leads`
- `communications`
- `pending_messages`
- `campaigns`
- `campaign_recipients`
- `audit_log`
- `content_library`

---

## 3. Google OAuth Setup

### Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
   - Name: `RealLeads CRM`
3. Enable Google+ API:
   - Go to **APIs & Services** → **Library**
   - Search for "Google+ API"
   - Click **Enable**
4. Configure OAuth consent screen:
   - Go to **APIs & Services** → **OAuth consent screen**
   - User Type: **External** (for personal use) or **Internal** (for organization)
   - Fill in required fields:
     - App name: `RealLeads CRM`
     - User support email: your email
     - Developer contact: your email
   - Scopes: Add `./auth/userinfo.email` and `./auth/userinfo.profile`
   - Save
5. Create OAuth Client ID:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth Client ID**
   - Application type: **Web application**
   - Name: `RealLeads Web App`
   - **Authorized redirect URIs** - Add ALL of these:
     ```
     http://localhost:5173/auth/callback
     http://localhost:3000/auth/callback
     https://<your-supabase-project>.supabase.co/auth/v1/callback
     https://<your-repl-name>.<your-username>.repl.co/auth/callback
     ```
   - Click **Create**
6. Copy credentials to `.env`:
   - **Client ID** → `GOOGLE_CLIENT_ID`
   - **Client secret** → `GOOGLE_CLIENT_SECRET`

### Configure in Supabase

1. In Supabase dashboard → **Authentication** → **Providers**
2. Find **Google** provider
3. Toggle **Enable**
4. Paste your **Client ID** and **Client Secret**
5. Click **Save**

---

## 4. Twilio Setup

### Create Account

1. Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up (you'll get $15 free credit)
3. Verify your phone number

### Get Account Credentials

1. From Twilio Console home, copy:
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`

### Set Up WhatsApp Sandbox

1. In Twilio Console → **Messaging** → **Try it out** → **Send a WhatsApp message**
2. You'll see a sandbox number and a join code
3. Send WhatsApp message to that number: `join <code>`
4. Copy the sandbox number → `TWILIO_WHATSAPP_NUMBER`
   - Format: `whatsapp:+14155238886`

### Configure Webhook

1. In WhatsApp Sandbox settings → **Sandbox Configuration**
2. **When a message comes in**:
   ```
   https://<your-repl-name>.<your-username>.repl.co/twilio/whatsapp-webhook
   ```
   - Method: `POST`
3. Save

### Create Messaging Service (for SMS)

1. Go to **Messaging** → **Services**
2. Click **Create Messaging Service**
3. Friendly name: `RealLeads SMS`
4. Use case: **Notify my users**
5. Click **Create**
6. Copy **Messaging Service SID** → `TWILIO_MESSAGING_SERVICE_SID`
7. Add a sender phone number:
   - Click **Add Senders**
   - Buy a phone number ($1/month)
   - Select it and save

### Upgrade to Business (Later)

For production WhatsApp:
1. Go to **Messaging** → **WhatsApp** → **Senders**
2. Click **Request to Enable My Business Profile**
3. Follow Meta Business verification process (takes 1-2 weeks)
4. Once approved, update webhook URL to production

---

## 5. OpenAI Setup

### Get API Key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create account or sign in
3. Click **Create new secret key**
4. Name: `RealLeads CRM`
5. Copy key → `OPENAI_API_KEY`
   - ⚠️ Save it immediately - you can't see it again!

### Add Billing

1. Go to **Settings** → **Billing**
2. Add payment method
3. Set up usage limits (recommended: $50/month to start)

### Verify Models Available

Ensure you have access to:
- `gpt-4o` (for orchestrator)
- `whisper-1` (for voice transcription)

Most accounts have both by default.

---

## 6. Mailchimp Setup

### Create Account

1. Go to [mailchimp.com](https://mailchimp.com)
2. Sign up for free (up to 500 contacts free)
3. Verify your email

### Get API Key

1. Click profile icon → **Account & billing**
2. Go to **Extras** → **API keys**
3. Click **Create A Key**
4. Name: `RealLeads CRM`
5. Copy key → `MAILCHIMP_API_KEY`
6. Note the server prefix in the key (e.g., `us1`, `us2`)
   - Add to `.env` as `MAILCHIMP_SERVER_PREFIX`

### Create Audience

1. Go to **Audience** → **All contacts**
2. Click **Create Audience**
3. Fill in required fields:
   - Audience name: `RealLeads CRM Contacts`
   - Default from email: your email
   - Default from name: your name
4. Click **Save**
5. Go to **Settings** → copy the **Audience ID**
   - Add to `.env` as `MAILCHIMP_AUDIENCE_ID_DEFAULT`

---

## 7. Mandrill Setup

### Activate Mandrill

1. From Mailchimp, go to **Integrations** → **Mandrill**
2. Click **Activate Mandrill** (requires paid Mailchimp plan OR standalone Mandrill account)
3. Verify your email

### Get API Key

1. In Mandrill dashboard → **Settings**
2. Click **+ New API Key**
3. Label: `RealLeads CRM`
4. Copy key → `MANDRILL_API_KEY`

### Configure Sender Email

#### Option 1: Use Gmail (Easiest)

```env
MANDRILL_FROM_MODE=gmail
MANDRILL_FROM_EMAIL=notifications@realleads.ai
MANDRILL_REPLY_TO=draygo@gmail.com
```

**Limitation**: "From" will show as `notifications@realleads.ai via mandrillapp.com`

#### Option 2: Use Vanguard Properties Email (Requires DNS Access)

```env
MANDRILL_FROM_MODE=vanguard
MANDRILL_FROM_EMAIL=david.raygorodsky@vanguardproperties.com
MANDRILL_REPLY_TO=david.raygorodsky@vanguardproperties.com
```

**Required**: Add these DNS records to `vanguardproperties.com`:

1. In Mandrill → **Settings** → **Sending Domains**
2. Click **+ Add Sending Domain**
3. Enter: `vanguardproperties.com`
4. Mandrill will show required DNS records:

```
SPF Record:
Type: TXT
Host: vanguardproperties.com
Value: v=spf1 include:spf.mandrillapp.com ?all

DKIM Record:
Type: TXT
Host: mandrill._domainkey.vanguardproperties.com
Value: <long-key-provided-by-mandrill>
```

5. Add these records in your domain registrar (GoDaddy, Namecheap, etc.)
6. Wait 24-48 hours for DNS propagation
7. In Mandrill, click **Test DNS Settings**
8. Once verified, you can send from `@vanguardproperties.com`

#### Option 3: Use realleads.ai Domain (If You Own It)

Same process as Option 2, but with `realleads.ai` domain.

---

## 8. Replit Deployment

### Import to Replit

1. Go to [replit.com](https://replit.com)
2. Click **Create Repl**
3. Choose **Import from GitHub**
4. Paste your repository URL
5. Click **Import from GitHub**

### Configure Secrets

1. In Replit, click **Secrets** (lock icon in sidebar)
2. Add ALL environment variables from your `.env` file
3. ⚠️ DO NOT commit `.env` to Git - use Replit Secrets

### Update URLs in Secrets

Replace placeholder URLs:
```env
APP_BASE_URL=https://<your-repl-name>.<your-username>.repl.co
CORS_ORIGIN=https://<your-repl-name>.<your-username>.repl.co
```

### Run the App

1. Click **Run** button
2. Replit will automatically:
   - Install dependencies
   - Start backend on port 3000
   - Start frontend on port 5173
3. Check console for:
   ```
   🚀 RealLeads.ai Backend running on port 3000
   ⏰ Schedulers started
   ```

### Configure Always On (Optional)

1. Go to Replit plan settings
2. Enable **Always On** to keep app running 24/7
3. Cost: $7/month (Hacker plan)

---

## 9. First Run Validation

### Check Integration Status

Visit: `https://<your-repl>.repl.co/health/integrations`

You should see:
```json
{
  "status": "healthy",
  "integrations": [
    { "name": "Supabase", "status": "connected" },
    { "name": "OpenAI", "status": "connected" },
    { "name": "Twilio", "status": "connected" },
    { "name": "Mailchimp", "status": "connected" },
    { "name": "Mandrill", "status": "connected" }
  ]
}
```

### Test WhatsApp Webhook

1. Send WhatsApp message to your Twilio sandbox number: `Hello!`
2. Check backend logs in Replit for:
   ```
   📥 Received WhatsApp message from +1234567890
   ```
3. You should receive a reply

### Test Voice Transcription

1. Send voice note to WhatsApp sandbox number
2. System should:
   - Download audio
   - Transcribe with Whisper
   - Process command
   - Reply with result

### Test Admin UI

1. Visit: `https://<your-repl>.repl.co`
2. Click **Sign in with Google**
3. Should redirect to Google OAuth
4. After auth, should see Admin Dashboard

### Test Command Console

In the UI Command Console, try:
```
Create a test lead: John Doe, email john@example.com, interested in a 3BR house in San Francisco under $2M
```

Expected response:
- ≤100 word explanation
- Confirmation that lead was created
- OR clarification question if missing required fields

### Verify Database

In Supabase Table Editor:
- Check `leads` table for new record
- Check `audit_log` for command entry

---

## 🎉 Setup Complete!

Your RealLeads.ai CRM is now fully operational!

### Next Steps

1. **Create your first real lead** via WhatsApp voice or UI
2. **Test HNW approval workflow**: Add segment "High Net Worth" to a lead, try to send message
3. **Configure digest schedule**: Digests run at 7am PT (daily) and Mon 7am PT (weekly)
4. **Explore Command Console**: Try natural language queries
5. **Review docs**:
   - `docs/ORCHESTRATOR.md` - Understanding AI commands
   - `docs/N8N.md` - Optional automation setup

### Common Issues

**"Integration disconnected"**
- Double-check environment variables
- Ensure no typos in API keys
- Verify services are active (not suspended)

**WhatsApp not receiving messages**
- Verify webhook URL in Twilio sandbox settings
- Ensure Replit is running (not paused)
- Check CORS_ORIGIN matches your Replit URL

**Google OAuth error**
- Verify redirect URIs in Google Cloud Console
- Ensure Supabase Auth has Google provider enabled
- Check client ID/secret match

**Database connection failed**
- Verify Supabase project is active
- Check service role key (not anon key)
- Ensure migrations were run successfully

---

## 📞 Support

If you encounter issues:
1. Check `/health/integrations` endpoint
2. Review backend logs in Replit console
3. Inspect `audit_log` table in Supabase for error details
4. Refer to `docs/INTEGRATIONS.md` for service-specific troubleshooting

**Built for real estate professionals by real estate professionals.** 🏡
