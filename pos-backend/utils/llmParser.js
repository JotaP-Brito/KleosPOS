const axios = require("axios");

const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL = "phi3:mini";

// Helper: normalize possible key spelling mistakes
function normalizeKeys(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  const newObj = {};
  for (const key of Object.keys(obj)) {
    const fixedKey = key
      .replace("nameharmony", "name")
      .replace("quantidade", "quantity");
    newObj[fixedKey] = normalizeKeys(obj[key]);   // always use fixedKey
  }
  return newObj;
}

// Simple fallback parser (used if LLM fails completely)
function simpleParseOrder(messageText, menuItems) {
  const msg = messageText.toLowerCase();
  const items = [];
  for (const product of menuItems) {
    if (msg.includes(product.name.toLowerCase())) {
      const regex = new RegExp(`(\\d+)\\s*${product.name.toLowerCase()}`);
      const match = msg.match(regex);
      const quantity = match ? parseInt(match[1]) : 1;
      items.push({ name: product.name, quantity, observation: "", additions: [] });
    }
  }
  if (items.length > 0) {
    return { order: true, items };
  }
  return null;
}

// Main LLM-based item extraction (fallback only)
async function parseWhatsAppOrderWithLLM(messageText, menuItems, additions) {
  // Build dynamic menu and additions strings
  const menuList = menuItems
    .map(i => `${i.name} (R$${i.price.toFixed(2)})`)
    .join(" | ");
  const additionsList = additions
    .map(a => `${a.name} (${a.type === "extra" ? `R$${a.price.toFixed(2)}` : "grátis"})`)
    .join(" | ");

  // Strict prompt: only orders, no chat, no extra fields
  const systemPrompt = `You are a JSON order extractor for a restaurant.

RULES:
- If the message contains a food order, output: {"order":true,"items":[{"name":"exact product name","quantity":1}]}
- If the message does NOT contain a food order (greeting, question, etc.), output: {"order":false}
- NEVER output a "reply" field, NEVER chat.
- Use exact product names from the menu provided.
- Quantities default to 1 if not specified.
- Do NOT add delivery, address, payment, or observation fields.
- Respond ONLY with a raw JSON object – no markdown, no explanation.`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Menu: ${menuList}\nAvailable additions (for context only): ${additionsList}\n\nAnalyze this message: "${messageText}"`
    }
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);   // 2-second timeout

  try {
    const response = await axios.post(
      OLLAMA_URL,
      {
        model: MODEL,
        messages,
        stream: false,
        options: { temperature: 0.0, num_predict: 150 }
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    let text = response.data.message.content.trim();
    console.log("LLM raw output:", text);

    // Remove possible markdown fences
    text = text.replace(/```json|```/gi, "").trim();

    // Extract JSON: find first { and last }
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

    // Try to parse
    try {
      return normalizeKeys(JSON.parse(text));
    } catch (firstError) {
      console.log("First JSON parse failed, attempting repairs...");
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        let jsonText = match[0]
          .replace(/,(\s*[}\]])/g, "$1")   // trailing commas
          .replace(/,\s*,/g, ",");         // double commas
        try {
          return normalizeKeys(JSON.parse(jsonText));
        } catch (secondError) {
          console.error("JSON repair failed:", secondError.message);
        }
      }
    }
  } catch (error) {
    clearTimeout(timeout);
    console.error("LLM HTTP error:", error.message);
  }

  // If everything fails, fallback to simple parser
  console.log("LLM failed, trying simple keyword parser...");
  const fallback = simpleParseOrder(messageText, menuItems);
  if (fallback) return fallback;

  // Absolute last resort – not an order
  return { order: false };
}

module.exports = { parseWhatsAppOrderWithLLM };