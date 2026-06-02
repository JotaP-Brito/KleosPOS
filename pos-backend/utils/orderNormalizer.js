// utils/orderNormalizer.js

function normalizeOrderText(text) {
  if (!text) return "";

  let result = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  // ---------- filler phrases (strip before parsing) ----------
  result = result
    .replace(/\bfaz\s+para\s+mim\b/g, "")
    .replace(/\bpode\s+me\s+mandar\b/g, "")
    .replace(/\bmanda\s+pra\s+mim\b/g, "")
    .replace(/\bgostaria\s+de\s+pedir\b/g, "")
    .replace(/\bgostaria\s+de\b/g, "")
    .replace(/\bpoderia\s+entregar\b/g, "")
    .replace(/\bpor\s+favor\b/g, "")
    .replace(/\bpor\s+gentileza\b/g, "")
    .replace(/\bgentileza\b/g, "")
    .replace(/\bvou\s+querer\b/g, "")
    .replace(/\bquero\s+pedir\b/g, "")
    .replace(/\bperdao\b/g, "")
    .replace(/\bperdao,?\s*/g, "")
    .replace(/\bpor\s+favor,?\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // ---------- common abbreviations ----------
  result = result.replace(/\bmac\b/g, "macarrao");

  // ---------- espaguete / spaghetti → macarrao ----------
  result = result
    .replace(/\bespaguete\b/g, "macarrao")
    .replace(/\bspaghetti\b/g, "macarrao")
    .replace(/\bespagueti\b/g, "macarrao")
    .replace(/\bmassa\b/g, "macarrao");

  // ---------- pasta preposition normalization ----------
  result = result
    .replace(/\b(macarrao)\s+(na|a|ao)\s+(chapa)\b/gi, "$1 $3")
    .replace(/\b(macarrao)\s+(na|a|ao|a\s+la)\s+(bolonhesa)\b/gi, "$1 $3");

  // ---------- size abbreviations ----------
  result = result
    .replace(/(?<!\d\s)\bgrande\b(?!\s*\d)/g, "g")
    .replace(/\bgrandao\b/g, "g")
    .replace(/\bgigante\b/g, "g")
    .replace(/(?<!\d\s)\bpequeno\b(?!\s*\d)/g, "p")
    .replace(/(?<!\d\s)\bpequena\b(?!\s*\d)/g, "p")
    .replace(/\bpequenino\b/g, "p");

  // ---------- "outro/outra P/G" shorthand ----------
  result = result.replace(/\boutro\s+(p|g)\b/g, "macarrao bolonhesa $1");
  result = result.replace(/\boutra\s+(p|g)\b/g, "macarrao bolonhesa $1");

  // ---------- product slang ----------
  result = result
    .replace(/\bxtudo\b/g, "x-tudo")
    .replace(/\bxburguer\b/g, "x-burger")
    .replace(/\bxsalada\b/g, "x-salada")
    .replace(/\bxegg\b/g, "x-egg")
    .replace(/\bxbacon\b/g, "x-bacon")
    .replace(/\bxpicanha\b/g, "x-picanha")
    .replace(/\bxgalinha\b/g, "x-galinha")
    .replace(/\bgalinha\b/g, "x-galinha");

  // ---------- drink brand normalization ----------
  result = result
    .replace(/\b(guarana)\s+antartica\s+(lata|2l|1l|600ml|350ml|litro|litros)\b/g, "$1 $2")
    .replace(/\bantartica\s+(guarana)\b/g, "$1");

  result = result
    .replace(/\bcoca\b(?!\s*cola)/gi, "coca cola")
    .replace(/\bsuco\b(?!\s*del\s+vale)/gi, "suco del vale");

  result = result
    .replace(/\b(coca cola)\b(?!\s+(lata|2l|1l|600ml|350ml|litro))/gi, "$1 lata")
    .replace(/\b(guarana)\b(?!\s+(lata|2l|1l|600ml|350ml|litro))/gi, "$1 lata");

  // ---------- addition trigger normalisation ----------
  // All of these mean "I want to add something" → normalise to "com"
  result = result
    .replace(/\bacrescimo\s+de\b/g, "com")
    .replace(/\bacrescimo\b/g, "com")
    .replace(/\badicional\s+de\b/g, "com")
    .replace(/\badicional\b/g, "com")
    .replace(/\badicione\b/g, "com")
    .replace(/\badicionando\b/g, "com")
    .replace(/\bcoloca\b/g, "com")
    .replace(/\bcoloque\b/g, "com")
    .replace(/\btambem\b/g, "e")      // "também catupiry" → "e catupiry"
    .replace(/\be\s+mais\b/g, "e")    // "e mais bacon" → "e bacon"
    .replace(/\bpor\s+cima\b/g, "")   // filler after addition name
    .replace(/\bno\s+lanche\b/g, ""); // filler

  // ---------- quantity words ----------
  result = result
    .replace(/\buma\b/g, "1")
    .replace(/\bum\b/g, "1")
    .replace(/\bduas\b/g, "2")
    .replace(/\bdois\b/g, "2")
    // "tres" intentionally NOT replaced here to protect street names
    .replace(/\bquatro\b/g, "4")
    .replace(/\bcinco\b/g, "5")
    .replace(/\bseis\b/g, "6");

  // ---------- clean punctuation & extra spaces ----------
  result = result
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return result;
}

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