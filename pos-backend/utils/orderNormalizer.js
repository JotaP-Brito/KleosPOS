// utils/orderNormalizer.js
// Pre‑processes user message to normalise slang, quantity words, etc.

function normalizeOrderText(text) {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bxtudo\b/g, "x-tudo")
    .replace(/\bxburguer\b/g, "x-burger")
    .replace(/\bxsalada\b/g, "x-salada")
    .replace(/\bxegg\b/g, "x-egg")
    // quantity words
    .replace(/\buma\b/g, "1")
    .replace(/\bum\b/g, "1")
    .replace(/\bduas\b/g, "2")
    .replace(/\bdois\b/g, "2")
    .replace(/\btres\b/g, "3")
    .replace(/\bquatro\b/g, "4")
    .replace(/\bcinco\b/g, "5")
    // remove punctuation
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates possible aliases for a product name.
 * E.g. "X-Tudo" → ["x-tudo", "xtudo", "x tudo", "tudo"]
 * This is used to match slang variations without DB changes.
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
  aliases.add(name); // original normalised name
  aliases.add(name.replace(/\s+/g, "")); // no spaces
  aliases.add(name.replace(/\s+/g, "-")); // dashes
  aliases.add(name.replace(/[-]/g, " ")); // dashes -> spaces

  // If multi‑word, also add the last word as a standalone alias
  const parts = name.split(" ");
  if (parts.length > 1) {
    aliases.add(parts[parts.length - 1]); // e.g. "tudo"
  }

  return [...aliases];
}

module.exports = { normalizeOrderText, generateAliases };