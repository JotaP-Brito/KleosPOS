// utils/whatsappHelpers.js
// All classification and extraction helpers for the WhatsApp flow.
// Previously scattered inline in whatsappRoute.js.

// ─────────────────────────────────────────────
// Text normalizer (strip accents, lowercase)
// ─────────────────────────────────────────────
function norm(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// ─────────────────────────────────────────────
// Order type detection
// ─────────────────────────────────────────────
function extractOrderType(msg) {
  const lower = norm(msg);
  if (/(vou|vo|vo|vou)\s*(busca|buscar|retira|retirar|levanta|levantar|pega|pegar|passa|passar)\b/.test(lower))
    return "Takeaway";
  if (lower.includes("entrega") || lower.includes("delivery") || lower.includes("entregar"))
    return "Delivery";
  if (lower.includes("levar") || lower.includes("takeaway"))
    return "Takeaway";
  if (lower.includes("local") || lower.includes("mesa") || lower.includes("pe"))
    return "Dine-in";
  return null;
}

// ─────────────────────────────────────────────
// Payment detection
// ─────────────────────────────────────────────
function extractPayment(msg) {
  const lower = norm(msg);
  if (lower.includes("pix")) return "Pix" ;
  if (lower.includes("cartao") || lower.includes("cartão")) return "Cartão";
  if (lower.includes("dinheiro")) return "Dinheiro";
  return null;
}

// ─────────────────────────────────────────────
// Address extraction
// ─────────────────────────────────────────────
function extractAddress(msg) {
  const text = msg.trim();
  const patterns = [
    /(?:rua|avenida|av\.|travessa|trv\.|alameda|rodovia|estrada)\s+[\w\s\-]+?,?\s*\d+/i,
    /(?:rua|avenida|av\.)\s+[\w\s\-]+/i,
    /\b(?:casa|apto|apartamento|bloco|bl|fundos|lote)\s*\w+/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

function isWeakAddress(addr) {
  if (!addr) return true;
  const normalized = addr.toLowerCase();
  if (normalized.length < 10) return true;
  if (!/\d/.test(normalized)) return true;
  return false;
}

// ─────────────────────────────────────────────
// Macarrão-specific extraction
// ─────────────────────────────────────────────
function extractMacarraoParts(msg) {
  const lower = norm(msg);
  const type = lower.includes("chapa")
    ? "chapa"
    : lower.includes("bolonhesa")
      ? "bolonhesa"
      : null;
  const size = /\b(p|g)\b/.test(lower) ? lower.match(/\b(p|g)\b/)[0] : null;
  return { type, size };
}

// ─────────────────────────────────────────────
// Step-based classifier (replaces duplicate simpleClassify + classifyMessage)
// ─────────────────────────────────────────────
function classifyStep(step, message) {
  const msg = norm(message);

  switch (step) {
    case "PERGUNTAR_TIPO":
      if (msg === "1" || msg.includes("levar") || msg.includes("buscar") || msg.includes("retirar") || msg.includes("takeaway"))
        return { tipo: "Takeaway" };
      if (msg === "2" || msg.includes("entrega") || msg.includes("delivery") || msg.includes("entregar"))
        return { tipo: "Delivery" };
      if (msg === "3" || msg.includes("local") || msg.includes("mesa") || msg.includes("pe") || msg.includes("comer ai"))
        return { tipo: "Dine-in" };
      return null;

    case "PERGUNTAR_PAGAMENTO":
      if (msg === "1" || msg.includes("dinheiro") || msg.includes("cash"))
        return { pagamento: "Dinheiro" };
      if (msg === "2" || msg.includes("cartao") || msg.includes("credito") || msg.includes("debito"))
        return { pagamento: "Cartão" };
      if (msg === "3" || msg.includes("pix"))
        return { pagamento: "Pix" };
      return null;

    case "CONFIRMAR": {
      const positive = ["sim", "s", "ok", "confirmo", "pode", "fechado", "quero", "isso", "isso mesmo", "confirmar", "vai", "bora"];
      const negative = ["nao", "nao", "n", "cancelar", "cancela", "errado", "alterar", "mudar", "trocar"];
      if (positive.some((p) => msg === p || msg.includes(p))) return { confirmado: true };
      if (negative.some((n) => msg === n || msg.includes(n))) return { confirmado: false };
      return null;
    }

    default:
      return null;
  }
}

// ─────────────────────────────────────────────
// Casual / greeting replies
// ─────────────────────────────────────────────
function getCasualReply(msg) {
  const lower = norm(msg);
  if (lower.includes("como") && /(vai|esta|estas|ta|tas|tao|vao|passando|passa|anda)\b/.test(lower))
    return "Estou ótimo, obrigado! 🍔Envie seu pedido em uma única mensagem e eu anoto tudo!";
  if (lower.match(/tudo bem|tudo certo|tudo joia|tranquilo|beleza|salve|fala/))
    return "Estou ótimo, obrigado! 🍔Envie seu pedido em uma única mensagem e eu anoto tudo!";
  if (lower.includes("cardapio") || lower.includes("menu")) return "cardapio";
  if (lower.includes("preco") || lower.includes("quanto") || lower.includes("custa"))
    return "cardapio";
  if (lower.includes("horario") || lower.includes("abre") || lower.includes("fecha"))
    return "Estamos abertos de segunda à sexta das 18h às 23h.";
  if (lower.match(/bom dia|boa tarde|boa noite|oi|ola|oii|hey/))
    return "Olá! 🍔 Envie seu pedido em uma única mensagem e eu anoto tudo!";
  return null;
}

// ─────────────────────────────────────────────
// Extract a whole number from a message (for troco value)
// ─────────────────────────────────────────────
function extractNumber(text) {
  const cleaned = text.replace(/[.,]/g, "");   // remove dots/commas
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}
// ─────────────────────────────────────────────
// Addition aliases – map vague words to concrete addition options
// ─────────────────────────────────────────────
const ADDITION_ALIASES = {
  bife: {
    category: "carne",
    options: [
      { name: "Carne 120g Picanha", price: 12.0 },   // use the actual prices from your DB
      { name: "Carne 90g", price: 8.0 }
    ]
  },
  // Add more aliases here as needed, e.g.:
  // 'cheddar': { category: 'queijo', options: [...] }
};

/**
 * Checks if a word (after normalization) is an addition alias.
 * Returns the alias info (category, options) or null.
 */
function getAdditionAlias(word) {
  const normalized = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ADDITION_ALIASES[normalized] || null;
}

/**
 * Scans the raw message for any word that matches an addition alias
 * and has NOT already been consumed (i.e., not part of a product or a known addition).
 * Returns the first alias info found, or null.
 */
function detectUnknownAddition(rawMessage, usedWordsSet) {
  const words = rawMessage
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  for (const word of words) {
    if (usedWordsSet && usedWordsSet.has(word)) continue;
    const alias = getAdditionAlias(word);
    if (alias) {
      return { aliasWord: word, ...alias };
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// Order summary builder (used in CONFIRMAR + PERGUNTAR_PAGAMENTO)
// ✅ NOW INCLUDES OBSERVATION TEXT
// ─────────────────────────────────────────────
function buildOrderSummary(sess) {
  const total = sess.items.reduce((sum, item) => {
    const addPrice = (item.additions || []).reduce((s, a) => s + (a.price || 0), 0);
    return sum + (item.price + addPrice) * (item.quantity || 1);
  }, 0);

  const tipo =
    sess.orderType === "Dine-in"
      ? "No local (Em pé)"
      : sess.orderType === "Delivery"
        ? `Entrega em ${sess.address || "?"}`
        : "Para levar";

  const itens = sess.items
    .map((i) => {
      let line = `${i.quantity}x ${i.name}`;
      if (i.additions?.length) line += ` (+ ${i.additions.map((a) => a.name).join(", ")})`;
      // 🆕 Show observation (e.g. "sem salada") if present
      if (i.observation) line += ` [${i.observation}]`;
      return line;
    })
    .join("\n");

  // Include troco info if applicable
  let trocoLine = "";
  if (sess.changeNeeded && sess.changeFor > 0) {
    trocoLine = `\n🪙 Troco para: R$ ${sess.changeFor.toFixed(2)}`;
  }

  return { total, tipo, itens: itens + trocoLine };
}

module.exports = {
  norm,
  extractOrderType,
  extractPayment,
  extractAddress,
  isWeakAddress,
  extractMacarraoParts,
  classifyStep,
  getCasualReply,
  buildOrderSummary,
  extractNumber,
  getAdditionAlias,
  detectUnknownAddition,
  ADDITION_ALIASES,   
};