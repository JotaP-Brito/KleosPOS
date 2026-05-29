// utils/orderNormalizer.js
// Pre‑processes user message to normalise slang, quantity words, sizes, etc.

function normalizeOrderText(text) {
  if (!text) return "";

  let result = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  // ---------- common abbreviations ----------
  result = result.replace(/\bmac\b/g, "macarrao");   // "mac" → "macarrao"

  // ---------- size abbreviations ----------
  result = result
    .replace(/\bgrande\b/g, "g")
    .replace(/\bgrandão\b/g, "g")
    .replace(/\bgrandao\b/g, "g")
    .replace(/\bgigante\b/g, "g")
    .replace(/\bpequeno\b/g, "p")
    .replace(/\bpequena\b/g, "p")
    .replace(/\bpequenino\b/g, "p");

  // ---------- remove filler prepositions for pasta ----------
  result = result
    .replace(/\b(macarrao)\s+(na|a|ao)\s+(chapa)\b/gi, "$1 $3")
    .replace(/\b(macarrao)\s+(na|a|ao)\s+(bolonhesa)\b/gi, "$1 $3");

  // ❌ NO default size – we want explicit sizes only

  // ---------- product slang ----------
  result = result
    .replace(/\bxtudo\b/g, "x-tudo")
    .replace(/\bxburguer\b/g, "x-burger")
    .replace(/\bxsalada\b/g, "x-salada")
    .replace(/\bxegg\b/g, "x-egg");

  // ---------- quantity words ----------
  result = result
    .replace(/\buma\b/g, "1")
    .replace(/\bum\b/g, "1")
    .replace(/\bduas\b/g, "2")
    .replace(/\bdois\b/g, "2")
    .replace(/\btres\b/g, "3")
    .replace(/\bquatro\b/g, "4")
    .replace(/\bcinco\b/g, "5");

  // ---------- clean punctuation & extra spaces ----------
  result = result
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return result;
}

/**
 * Generates possible aliases for a product name.
 * E.g. "X-Tudo" → ["x-tudo", "xtudo", "x tudo", "tudo"]
 */
function generateAliases(productName) {
  const name = productName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliases = new Set();
  aliases.add(name);
  aliases.add(name.replace(/\s+/g, ""));
  aliases.add(name.replace(/\s+/g, "-"));
  aliases.add(name.replace(/[-]/g, " "));

  const parts = name.split(" ");
  if (parts.length > 1) {
    aliases.add(parts[parts.length - 1]);
  }

  return [...aliases];
}

module.exports = { normalizeOrderText, generateAliases };