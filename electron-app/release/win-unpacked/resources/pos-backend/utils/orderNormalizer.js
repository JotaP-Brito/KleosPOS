// utils/orderNormalizer.js

function normalizeOrderText(text) {
  if (!text) return "";

  let result = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  // ---------- well-known multi-word observations → single token ----------
  result = result
    .replace(/\bcheiro verde\b/gi, "cheiroverde")
    .replace(/\bcheiro-verde\b/gi, "cheiroverde");


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

  // Chapa/bolonhesa bare patterns — handled in second-pass AFTER size abbreviation below

  // ---------- pasta preposition normalization ----------
  result = result
    .replace(/\b(macarrao)\s+(na|a|ao)\s+(chapa)\b/gi, "$1 $3")
    .replace(/\b(macarrao)\s+(na|a|ao|a\s+la)\s+(bolonhesa)\b/gi, "$1 $3");

  // ---------- size abbreviations ----------
  // Deduplicate repeated size words first ("pequeno pequeno" → "pequeno")
  result = result
    .replace(/\b(grande|grandao|gigante|pequeno|pequena|pequenino)\s+\1\b/gi, "$1")
    .replace(/\bp\s+p\b/g, "p")   // "p p" (already abbreviated duplicates)
    .replace(/\bg\s+g\b/g, "g");
  result = result
    .replace(/(?<!\d\s)\bgrande\b(?!\s*\d)/g, "g")
    .replace(/\bgrandao\b/g, "g")
    .replace(/\bgigante\b/g, "g")
    .replace(/(?<!\d\s)\bpequeno\b(?!\s*\d)/g, "p")
    .replace(/(?<!\d\s)\bpequena\b(?!\s*\d)/g, "p")
    .replace(/\bpequenino\b/g, "p");

  // Second-pass: fix "p/g na chapa" that appears AFTER size abbreviation runs
  result = result
    .replace(/\bp\s+na\s+chapa\b/gi, "macarrao chapa p")
    .replace(/\bg\s+na\s+chapa\b/gi, "macarrao chapa g")
    .replace(/\bp\s+(?:macarrao\s+)?chapa\b/gi, "macarrao chapa p")
    .replace(/\bg\s+(?:macarrao\s+)?chapa\b/gi, "macarrao chapa g")
    .replace(/\bp\s+(?:macarrao\s+)?bolonhesa\b/gi, "macarrao bolonhesa p")
    .replace(/\bg\s+(?:macarrao\s+)?bolonhesa\b/gi, "macarrao bolonhesa g")
    .replace(/\bchapa\s+(g|p)\b/gi, "macarrao chapa $1")
    .replace(/\bbolonhesa\s+(g|p)\b/gi, "macarrao bolonhesa $1");
  // Deduplicate "macarrao macarrao" artifacts from any double-expansion
  result = result.replace(/\bmacarrao\s+macarrao\b/gi, "macarrao");

  // ---------- "outro/outra P/G" shorthand ----------
  result = result.replace(/\boutro\s+(p|g)\b/g, "macarrao bolonhesa $1");
  result = result.replace(/\boutra\s+(p|g)\b/g, "macarrao bolonhesa $1");

  // ---------- product slang ----------
  result = result
    .replace(/\bxtudo\b/g, "x-tudo")
    .replace(/\bxburguer\b/g, "x-burger")
    .replace(/\bx\s+burguer\b/g, "x-burger")
    .replace(/\bxsalada\b/g, "x-salada")
    .replace(/\bxegg\b/g, "x-egg")
    .replace(/\bxbacon\b/g, "x-bacon")
    .replace(/\bxpicanha\b/g, "x-picanha")
    .replace(/\bxgalinha\b/g, "x-galinha")
    .replace(/\bgalinha\b/g, "x-galinha");

  // ---------- drink brand normalization ----------
  // Strip brand modifiers that are redundant
  result = result
    .replace(/\b(guarana)\s+antartica\s+(lata|2l|1l|600ml|350ml|litro|litros)\b/g, "$1 $2")
    .replace(/\bantartica\s+(guarana)\b/g, "$1");

  // "suco" alone → "suco del vale"
  result = result
    .replace(/\bsuco\b(?!\s*del\s+vale)/gi, "suco del vale");

  // Expand "coca" → "coca cola" (only when not already followed by "cola")
  result = result
    .replace(/\bcoca\b(?!\s*cola)/gi, "coca cola");

  // ---------- size word normalization (litros/litro → l suffix) ----------
  // Must run BEFORE lata injection so "2 litros" → "2l" is recognised as a size.
  // Pattern: digit + space + litros/litro → digit + l
  result = result
    .replace(/\b(\d)\s*litros?\b/gi, "$1l");

  // ---------- inject "lata" only when NO size qualifier follows the brand ----------
  // Size qualifiers: lata, 2l, 1l, 600ml, 350ml, zero (zero has its own products)
  const SIZE_AFTER = /\s+(lata|2l|1l|600ml|350ml|zero)\b/i;

  // coca cola: inject lata only if not followed by a size/variant
  result = result.replace(/\bcoca cola\b(?!\s+(lata|2l|1l|600ml|350ml|zero))/gi, "coca cola lata");

  // guarana: inject lata only if not followed by a size
  result = result.replace(/\bguarana\b(?!\s+(lata|2l|1l|600ml|350ml|zero))/gi, "guarana lata");

  // fanta: inject "lata" only if bare (no size), because "Fanta Lata 350ml" and "Fanta 2L" both exist
  result = result.replace(/\bfanta\b(?!\s+(lata|2l|1l|600ml|350ml))/gi, "fanta lata");

  // sprite: same logic
  result = result.replace(/\bsprite\b(?!\s+(lata|2l|1l|600ml|350ml))/gi, "sprite lata");

  // ---------- product shorthands ----------
  result = result
    .replace(/\brefrigerante\b/g, "")          // "refrigerante guaraná" → "guaraná"
    .replace(/\brefri\b/g, "")                 // "um refri guaraná" → "um guaraná"
    .replace(/\bso\s+com\b/g, "com")          // "só com bacon" → "com bacon"
    .replace(/\bsomente\s+com\b/g, "com")     // "somente com bacon" → "com bacon"
    .replace(/\bapenas\s+com\b/g, "com");     // "apenas com bacon" → "com bacon"

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
  aliases.add(name.replace(/\s+/g, ""));   // "cocacolalata"
  aliases.add(name.replace(/\s+/g, "-")); // "coca-cola-lata"
  aliases.add(name.replace(/[-]/g, " ")); // hyphens → spaces

  const parts = name.split(" ");

  // Single last-word alias only for SHORT single-word or 2-word food products.
  // NEVER add bare generic suffixes (lata, 2l, 1l, 500ml, etc.) as standalone aliases
  // because they match too many products.
  const UNSAFE_SINGLE_ALIASES = new Set([
    "lata", "2l", "1l", "600ml", "350ml", "500ml", "litro", "litros",
    "vale", "zero", "g", "p",
  ]);
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (!UNSAFE_SINGLE_ALIASES.has(last)) {
      aliases.add(last);
    }
  }

  // ── Drink-specific alias expansion ──────────────────────────────────────
  // Bridge the gap between product name format and normalised customer input.

  // Normalise litros ↔ l in the product name itself
  const withL      = name.replace(/\b(\d)\s*litros?\b/gi, "$1l");
  const withLitros = name.replace(/\b(\d)l\b/gi, "$1 litros");
  if (withL      !== name) aliases.add(withL);
  if (withLitros !== name) { aliases.add(withLitros); }

  // "Coca XYZ" products: also add "coca cola XYZ" variants (customer writes "coca cola")
  if (/^coca\b/.test(name) && !/^coca cola/.test(name)) {
    const expanded = name.replace(/^coca\b/, "coca cola");
    aliases.add(expanded);
    aliases.add(expanded.replace(/\b(\d)\s*litros?\b/gi, "$1l"));
    aliases.add(expanded.replace(/\b(\d)l\b/gi, "$1 litros"));
  }

  // "Coca Lata Zero" ↔ customer may say any word order
  if (name === "coca lata zero") {
    aliases.add("coca cola lata zero");
    aliases.add("coca cola zero lata");
    aliases.add("coca zero lata");
    aliases.add("coca cola zero");   // "coca cola zero" with no size = the lata version
    // NOTE: bare "coca zero" intentionally NOT added — ambiguous with Coca Zero 600ml / 2L
  }

  // "Fanta Lata 350ml" — customers say "fanta lata" or "fanta 350ml"
  if (name === "fanta lata 350ml") {
    aliases.add("fanta lata");
    aliases.add("fanta 350ml");
    // NOTE: bare "fanta" intentionally NOT added — ambiguous with "Fanta 2L"
  }

  // "Sprite 2L" — if customer says bare "sprite", match 2L (only Sprite product)
  if (name === "sprite 2l") {
    aliases.add("sprite");
  }

  // "Coca Zero Xsize": also add "coca cola zero Xsize" variants
  if (/^coca zero\b/.test(name)) {
    const withCola = name.replace(/^coca\b/, "coca cola");
    aliases.add(withCola);
    aliases.add(withCola.replace(/\b(\d)\s*litros?\b/gi, "$1l"));
    aliases.add(withCola.replace(/\b(\d)l\b/gi, "$1 litros"));
    // Also the short-l form of the original
    aliases.add(name.replace(/\b(\d)\s*litros?\b/gi, "$1l"));
  }

  // "Água com gás 500ml" should match "agua com gas" (without ml)
  if (name.includes("agua com gas")) {
    aliases.add("agua com gas");
    aliases.add("agua gasosa");
    aliases.add("agua gaseificada");
  }

  // "Mate Couro 1L" — customers usually just say "mate couro"
  if (name.startsWith("mate couro")) {
    aliases.add("mate couro");
    aliases.add("mate");
  }

  // ── Food product shorthand aliases ────────────────────────────────────────
  // "Misto Quente" → also match bare "misto"
  if (name === "misto quente") {
    aliases.add("misto");
  }
  // "X-Burger" → also match "x burguer", "xburguer"
  if (name === "x burger") {
    aliases.add("x burguer");
    aliases.add("xburguer");
    aliases.add("burguer");
  }
  // "Hamburguer Especial" → "hamburguer especial", "especial"
  if (name === "hamburguer especial") {
    aliases.add("hamburguer especial");
    aliases.add("especial");
  }
  // "Macarrao Chapa G/P" → also match bare "chapa g" / "chapa p"
  if (name === "macarrao chapa g") aliases.add("chapa g");
  if (name === "macarrao chapa p") aliases.add("chapa p");
  if (name === "macarrao bolonhesa g") aliases.add("bolonhesa g");
  if (name === "macarrao bolonhesa p") aliases.add("bolonhesa p");

  return [...aliases];
}


module.exports = { normalizeOrderText, generateAliases };