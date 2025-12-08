// backend/twilio-test.js
// Sends a simple SMS to verify Twilio works, then polls Twilio for final status.
// Run: node backend/twilio-test.js

const path = require("path");
const dotenv = require("dotenv");
const twilio = require("twilio");

// Explicitly load .env from the project root (../.env)
dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
});

console.log("[twilio-test] Loaded env from:", path.resolve(__dirname, "..", ".env"));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from =
  process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_SMS_NUMBER;

// ⚠️ Must be a VERIFIED recipient on a trial account
const to = "+16175386748";

async function main() {
  console.log("[twilio-test] SID prefix:", accountSid && accountSid.slice(0, 4));
  console.log("[twilio-test] From:", from);
  console.log("[twilio-test] To:", to);

  if (!accountSid || !authToken) {
    console.error("❌ Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
    process.exit(1);
  }

  if (!from) {
    console.error("❌ Missing TWILIO_FROM_NUMBER or TWILIO_SMS_NUMBER");
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);

  try {
    const message = await client.messages.create({
      from,
      to,
      body: "Test from RealLeads via Twilio trial. Did you get this?",
    });

    console.log("✅ SMS created!");
    console.log("Initial SID:", message.sid);
    console.log("Initial Status:", message.status);

    // Wait a few seconds, then fetch the latest status from Twilio.
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const fetched = await client.messages(message.sid).fetch();

    console.log("📡 Fetched final status from Twilio:");
    console.log("Status:", fetched.status);
    console.log("Error code:", fetched.errorCode);
    console.log("Error message:", fetched.errorMessage);
  } catch (err) {
    console.error("❌ Error sending SMS:", err);
  }
}

main();
