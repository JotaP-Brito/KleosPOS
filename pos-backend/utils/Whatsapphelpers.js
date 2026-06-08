// utils/whatsappHelpers.js
const { ADDITION_ALIAS_MAP } = require("./keywordParser");

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
  if (
    /(vou|vo)\s*(busca|buscar|retira|retirar|levanta|levantar|pega|pegar|passa|passar|busc)\b/.test(lower) ||
    lower.includes("vou buscar") ||
    lower.includes("vou pegar") ||
    lower.includes("pra retirar") ||
    lower.includes("pra buscar") ||
    lower.includes("buscar ai") ||
    lower.includes("buscar ahi") ||
    lower.includes("vou la buscar") ||
    lower.includes("levar") ||
    lower.includes("takeaway") ||
    lower.includes("retirada") ||
    lower.includes("vou retirar")
  ) return "Takeaway";
  if (
    lower.includes("entrega") || lower.includes("delivery") ||
    lower.includes("entregar") || lower.includes("entregar")
  ) return "Delivery";
  if (lower.includes("local") || lower.includes("mesa") || lower.includes("pe"))
    return "Dine-in";
  return null;
}

// ─────────────────────────────────────────────
// Payment detection
// ─────────────────────────────────────────────
function extractPayment(msg) {
  const lower = norm(msg);
  if (lower.includes("pix")) return "Pix";
  if (
    lower.includes("cartao") || lower.includes("cartão") ||
    lower.includes("credito") || lower.includes("debito") ||
    lower.includes("maquina") || lower.includes("maquininha")
  ) return "Cartão";
  if (lower.includes("dinheiro") || lower.includes("especie") || lower.includes("espécie"))
    return "Dinheiro";
  return null;
}

// ─────────────────────────────────────────────
// Address extraction
// ─────────────────────────────────────────────
function extractAddress(msg) {
  const text = msg.trim();

  // Pattern 1: street type + name + number (most reliable — requires a house number)
  const withNumber = text.match(
    /(?:rua|avenida|av\.|travessa|trv\.|alameda|rodovia|estrada|beco)\s+[\w\s\-]{2,40?},?\s*\d+[\w\s,.-]*/i
  );
  if (withNumber) return withNumber[0].trim();

  // Pattern 2: street type + name, stopping at a comma or end-of-string
  // Use a non-greedy match capped at 50 chars to prevent swallowing subsequent text.
  const withoutNumber = text.match(
    /(?:rua|avenida|av\.)\s+[\w\s\-]{2,40}?(?=,|$)/i
  );
  if (withoutNumber) return withoutNumber[0].trim();

  // Pattern 3: apartment / house complement only (fallback when no street keyword is present)
  const complement = text.match(/\b(?:casa|apto|apartamento|bloco|bl|fundos|lote)\s*[\w\d]+/i);
  if (complement) return complement[0].trim();

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
  const size = /\b(p|g)\b/.test(lower) ? lower.match(/\b(p|g|grande|pequeno|Grande|Pequeno)\b/)[0] : null;
  return { type, size };
}

// ─────────────────────────────────────────────
// Step-based classifier
// ─────────────────────────────────────────────
function classifyStep(step, message) {
  const msg = norm(message);

  switch (step) {
    case "PERGUNTAR_TIPO":
      if (msg === "1" || msg.includes("levar") || msg.includes("buscar") || msg.includes("retirar") || msg.includes("takeaway") || msg.includes("retirada"))
        return { tipo: "Takeaway" };
      if (msg === "2" || msg.includes("entrega") || msg.includes("delivery") || msg.includes("entregar"))
        return { tipo: "Delivery" };
      if (msg === "3" || msg.includes("local") || msg.includes("mesa") || msg.includes("pe") || msg.includes("comer ai"))
        return { tipo: "Dine-in" };
      return null;

    case "PERGUNTAR_PAGAMENTO":
      if (msg === "1" || msg.includes("dinheiro") || msg.includes("cash") || msg.includes("especie"))
        return { pagamento: "Dinheiro" };
      if (msg === "2" || msg.includes("cartao") || msg.includes("credito") || msg.includes("debito") || msg.includes("maquina"))
        return { pagamento: "Cartão" };
      if (msg === "3" || msg.includes("pix"))
        return { pagamento: "Pix" };
      return null;

    case "CONFIRMAR": {
      const positive = ["sim", "s", "ok", "confirmo", "pode", "fechado", "quero", "isso", "isso mesmo", "confirmar", "vai", "bora"];
      const negative = ["nao", "n", "cancelar", "cancela", "errado", "alterar", "mudar", "trocar"];
      if (positive.some((p) => msg === p || msg.includes(p))) return { confirmado: true };
      if (negative.some((n) => msg === n || msg.includes(n))) return { confirmado: false };
      return null;
    }

    default:
      return null;
  }
}

// Sentinel returned by getCasualReply when the bot should send the menu image.
// Use `reply === SEND_MENU` in callers instead of comparing to a raw string.
const SEND_MENU = Symbol("SEND_MENU");

// ─────────────────────────────────────────────
// Casual / greeting replies
// ─────────────────────────────────────────────
function getCasualReply(msg) {
  const lower = norm(msg);

  // "Tem refri lata?" / "tem X?" → drink inquiry
  if (
    (lower.includes("tem ") || lower.includes("voces tem") || lower.includes("tem como")) &&
    (lower.includes("refri") || lower.includes("refrigerante") || lower.includes("bebida") || lower.includes("suco") || lower.includes("lata"))
  ) return "Temos: Coca-Cola lata, Guaraná lata, Fanta laranja lata e Sprite lata! 🥤 Qual prefere?";

  // 🆕 Delivery inquiry – only if the message looks like a question
  if (
    (lower.includes("?") || lower.includes("??")) &&
    (lower.includes("entrega") || lower.includes("delivery") || lower.includes("entregam") || lower.includes("fazem") || lower.includes("fazendo"))
  ) return "Sim, fazemos entrega! 🛵 Envie seu endereço completo e o pedido que logo chegamos aí. 😊";

  // Price inquiry
  if (
    (lower.includes("quanto") || lower.includes("preco") || lower.includes("valor") || lower.includes("custa")) &&
    !lower.includes("troco")
  ) return SEND_MENU;

  // Menu requests
  if (lower.includes("cardapio") || lower.includes("menu") || lower.includes("tem como mandar o cardapio"))
    return SEND_MENU;

  // Hours / open status
  if (
    lower.includes("horario") || lower.includes("abre") || lower.includes("fecha") ||
    lower.includes("aberto") || lower.includes("fechado") || lower.includes("atendendo") ||
    lower.includes("funcionando") || lower.includes("abertos") || lower.includes("ainda atendendo")
  ) return "Estamos abertos de segunda à sexta das 18h às 23h. 🕕";

  // How are you / greetings
  if (lower.includes("como") && /(vai|esta|estas|ta|tas|tao|vao|passando|passa|anda)\b/.test(lower))
    return "Tudo ótimo, obrigado! 🍔 Envie seu pedido em uma única mensagem e eu anoto tudo!";
  if (lower.match(/tudo bem|tudo certo|tudo joia|tranquilo|beleza|salve|fala/))
    return "Tudo ótimo! 🍔 Envie seu pedido em uma única mensagem e eu anoto tudo!";

  // Simple greetings — only return casual reply if message is JUST a greeting (no order content)
  if (lower.match(/^(bom dia|boa tarde|boa noite|oi|ola|oii|hey|ola|olá)[\s!.]*$/))
    return "Olá! 🍔 Envie seu pedido em uma única mensagem e eu anoto tudo!";

  return null;
}

// ─────────────────────────────────────────────
// Extract a number from a message (for troco value)
// ─────────────────────────────────────────────
function extractNumber(text) {
  const cleaned = text.replace(/[.,]/g, "");
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

// ─────────────────────────────────────────────
// Addition aliases
// ─────────────────────────────────────────────
//
// ADDITION_ALIAS_MAP (from keywordParser) is the single source of truth.
// Here we derive the ADDITION_ALIASES shape that detectUnknownAddition needs:
// { word → { category, options: [{ name, price }] } }
//
// Because ADDITION_ALIAS_MAP maps word → { name, price } (flat), we derive
// "options" by grouping all entries that share the same DB name and category.
// Category is inferred from the DB name (same heuristic the old table used).

function _inferCategory(dbName) {
  const n = dbName.toLowerCase();
  if (n.includes("carne") || n.includes("picanha")) return "carne";
  if (n.includes("cheddar") || n.includes("catupiry") || n.includes("mussarela") || n.includes("queijo")) return "queijo";
  return "adicional";
}

// Build a derived ADDITION_ALIASES map on first use (lazy, but effectively module-init).
const ADDITION_ALIASES = (() => {
  const result = {};
  for (const [word, { name, price }] of Object.entries(ADDITION_ALIAS_MAP)) {
    const category = _inferCategory(name);
    if (!result[word]) {
      result[word] = { category, options: [] };
    }
    // Only push if this exact DB name isn't already listed
    if (!result[word].options.some(o => o.name === name)) {
      result[word].options.push({ name, price });
    }
  }
  return result;
})();

function getAdditionAlias(word) {
  const normalized = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ADDITION_ALIASES[normalized] || null;
}

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
    if (alias) return { aliasWord: word, ...alias };
  }
  return null;
}

// ─────────────────────────────────────────────
// Order summary builder
// ─────────────────────────────────────────────
function buildOrderSummary(sess) {
  const total = sess.items.reduce((sum, item) => {
    const addPrice = (item.additions || []).reduce((s, a) => s + (a.price || 0), 0);
    return sum + (item.price + addPrice) * (item.quantity || 1);
  }, 0);

  const tipo =
    sess.orderType === "Dine-in"
      ? "No local"
      : sess.orderType === "Delivery"
        ? `Entrega em ${sess.address || "?"}`
        : "Para levar";

  const itens = sess.items
    .map((i) => {
      let line = `${i.quantity}x ${i.name}`;
      if (i.additions?.length) line += ` (+ ${i.additions.map((a) => a.name).join(", ")})`;
      if (i.observation) line += ` [${i.observation}]`;
      return line;
    })
    .join("\n");

  let trocoLine = "";
  if (sess.changeNeeded && sess.changeFor > 0) {
    trocoLine = `\n🪙 Troco para: R$ ${Number(sess.changeFor).toFixed(2)}`;
  }

  return { total, tipo, itens: itens + trocoLine };
}

// ─────────────────────────────────────────────
// Drink disambiguation helpers
// ─────────────────────────────────────────────

// Generic words a customer might say instead of a full product name.
// Normalised (no accents, lowercase) so comparison is straightforward.
const GENERIC_DRINK_WORDS = new Set([
  "coca", "cola", "fanta", "guarana", "sprite",
  "mate", "suco", "agua",
]);

// Return all products whose name contains the generic word.
function getDrinkOptions(genericWord, products) {
  const normWord = (genericWord || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return products.filter(p => {
    const pName = p.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return pName.includes(normWord);
  });
}

// Returns true when the raw message contains genericWord but NO size qualifier,
// meaning the customer's intent is ambiguous and we need to ask which product.
function needsDrinkDisambiguation(rawMessage, genericWord) {
  const lower = (rawMessage || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!lower.includes(genericWord)) return false;
  const explicitMarkers = [
    "lata", "2l", "1l", "600ml", "350ml", "500ml",
    "zero", "litro", "litros", "lts", "lt",
  ];
  return !explicitMarkers.some(marker => lower.includes(marker));
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
  SEND_MENU,
  buildOrderSummary,
  extractNumber,
  getAdditionAlias,
  detectUnknownAddition,
  ADDITION_ALIASES,
  GENERIC_DRINK_WORDS,
  getDrinkOptions,
  needsDrinkDisambiguation,
};