// backend/twilio-whatsapp-test.js
// Sends a WhatsApp message via Twilio Sandbox and then polls Twilio
// for the final delivery status to debug any delivery issues.

const path = require("path");
const dotenv = require("dotenv");
const twilio = require("twilio");

// Load root .env
const envPath = path.resolve(__dirname, "..", ".env");
console.log("[wa-test] Using env file:", envPath);
dotenv.config({ path: envPath });

console.log("[wa-test] TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID);
console.log("[wa-test] TWILIO_WHATSAPP_FROM (raw):", process.env.TWILIO_WHATSAPP_FROM);

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

// Your WhatsApp number, must have joined the sandbox
const to = "whatsapp:+16175386748";

async function main() {
  console.log("[wa-test] From:", whatsappFrom);
  console.log("[wa-test] To:", to);

  if (!accountSid || !authToken) {
    console.error("❌ Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
    process.exit(1);
  }

  if (!whatsappFrom) {
    console.error("❌ Missing TWILIO_WHATSAPP_FROM");
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);

  try {
    const message = await client.messages.create({
      from: whatsappFrom,
      to,
      body: "WhatsApp test from RealLeads via Twilio Sandbox 👋",
    });

    console.log("✅ WA message created!");
    console.log("Initial SID:", message.sid);
    console.log("Initial Status:", message.status);

    // Wait a few seconds and then fetch latest status
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const fetched = await client.messages(message.sid).fetch();

    console.log("📡 Fetched final status from Twilio:");
    console.log("Status:", fetched.status);
    console.log("Error code:", fetched.errorCode);
    console.log("Error message:", fetched.errorMessage);
  } catch (err) {
    console.error("❌ Error sending WhatsApp message:", err);
  }
}

main();
