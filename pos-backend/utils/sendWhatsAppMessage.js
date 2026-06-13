const axios = require("axios");

const OPENWA_BASE = process.env.OPENWA_URL || "http://localhost:2785";
const OPENWA_KEY  = process.env.OPENWA_API_KEY || "dev-admin-key";

async function sendWhatsAppMessage(chatId, text, sessionId) {
  if (!chatId) return;
  const sid = sessionId || process.env.OPENWA_SESSION_ID || "default";
  try {
    await axios.post(
      `${OPENWA_BASE}/api/sessions/${sid}/messages/send-text`,
      { chatId, text },
      { headers: { "X-API-Key": OPENWA_KEY } }
    );
    console.log(`✅ WhatsApp message sent to ${chatId}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp message to ${chatId}:`, err.message);
    return false;
  }
}

module.exports = sendWhatsAppMessage;