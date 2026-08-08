const axios = require("axios");
const { levenshtein } = require("./stringUtils");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.LLM_MODEL || "qwen2.5:1.5b-instruct-q4_K_M";

function buildSystemPrompt(products, additions) {
  const productList = products.map((p) => p.name).join(", ");
  const additionList = additions.map((a) => a.name).join(", ");
  return `Você extrai pedidos de hambúrguer. Cardápio: ${productList}. Adicionais: ${additionList}.
Responda APENAS com JSON compacto em uma linha, sem espaços ou quebras de linha, neste formato exato:
{"items":[{"name":"X","quantity":1,"observation":"","additions":["Y"]}]}
Se nada do cardápio for identificado: {"items":[]}`;
}

async function parseWhatsAppOrderWithLLM(rawMessage, products, additions) {
  const systemPrompt = buildSystemPrompt(products, additions);

  const { data } = await axios.post(
    `${OLLAMA_URL}/api/chat`,
    {
      model: MODEL,
      stream: false,
      format: "json",
      keep_alive: "30m",
      options: {
        num_ctx: 1024,
        num_predict: 256,
        num_thread: 4,
        temperature: 0.1,
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawMessage },
      ],
    },
    { timeout: 15000 }
  );

  let parsed;
  try {
    parsed = JSON.parse(data.message.content);
  } catch {
    return null;
  }

  if (!parsed.items || parsed.items.length === 0) return null;

  const validatedItems = [];
  for (const item of parsed.items) {
    const match =
      products.find((p) => p.name.toLowerCase() === (item.name || "").toLowerCase()) ||
      products.find((p) => levenshtein(p.name.toLowerCase(), (item.name || "").toLowerCase()) <= 2);
    if (!match) continue;

    validatedItems.push({
      name: match.name,
      price: match.price,
      quantity: item.quantity > 0 ? item.quantity : 1,
      observation: item.observation || "",
      additions: (item.additions || [])
        .map((addName) => additions.find((a) => a.name.toLowerCase() === addName.toLowerCase()))
        .filter(Boolean)
        .map((a) => ({ name: a.name, price: a.price })),
    });
  }

  if (validatedItems.length === 0) return null;
  return { order: true, items: validatedItems, byKeyword: false };
}

module.exports = { parseWhatsAppOrderWithLLM };