const { generateAliases } = require("./orderNormalizer");
const { levenshtein } = require("./stringUtils");

// ─────────────────────────────────────────────────────────────────────────────
// Addition alias table — maps every word a customer might say to the exact DB name.
// Add new rows here whenever the menu changes.
// ─────────────────────────────────────────────────────────────────────────────
const ADDITION_ALIAS_MAP = {
  // Carne
  "carne":          { name: "Carne 90g",          price: 4.00 },
  "carne normal":   { name: "Carne 90g",          price: 4.00 },
  "carne 90":       { name: "Carne 90g",          price: 4.00 },
  "carne 90g":      { name: "Carne 90g",          price: 4.00 },
  "bife":           { name: "Carne 90g",          price: 4.00 },
  "bifinho":        { name: "Carne 90g",          price: 4.00 },
  "carne picanha":  { name: "Carne 120g Picanha", price: 5.00 },
  "picanha":        { name: "Carne 120g Picanha", price: 5.00 },
  "carne 120":      { name: "Carne 120g Picanha", price: 5.00 },
  "carne 120g":     { name: "Carne 120g Picanha", price: 5.00 },
  // Bacon
  "bacon":          { name: "Bacon",              price: 4.00 },
  // Frango
  "frango":         { name: "Frango Desfiado",    price: 4.00 },
  "frango desfiado":{ name: "Frango Desfiado",    price: 4.00 },
  // Queijos
  "cheddar":        { name: "Cheddar",            price: 4.00 },
  "catupiry":       { name: "Catupiry",           price: 4.00 },
  "requeijao":      { name: "Catupiry",           price: 4.00 }, // customers often say "requeijão"
  "mussarela":      { name: "Mussarela",          price: 2.00 },
  "mussa":          { name: "Mussarela",          price: 2.00 },
  "muzarela":       { name: "Mussarela",          price: 2.00 },
  "queijo":         { name: "Mussarela",          price: 2.00 },
  // Frios
  "presunto":       { name: "Presunto",           price: 2.00 },
  // Ovo
  "ovo":            { name: "Ovo",                price: 2.00 },
  "egg":            { name: "Ovo",                price: 2.00 },
  // Frutas
  "banana":         { name: "Banana",             price: 2.00 },
  "abacaxi":        { name: "Abacaxi",            price: 2.00 },
  // Milho
  "milho":          { name: "Milho",              price: 1.00 },
};

// Observation quick-map — maps customer words to canonical observation strings
const OBSERVATION_ALIAS_MAP = {
  "salada":     "Sem Salada",
  "tomate":     "Sem Tomate",
  "batata":     "Sem Batata",
  "milho":      "Sem Milho",
  "alface":     "Sem Alface",
  "frango":     "Sem Frango",
  "ketchup":    "Sem Ketchup",
  "maionese":   "Sem Maionese",
  "mostarda":   "Sem Mostarda",
  "cebola":     "Sem Cebola",
  "pimenta":    "Sem Pimenta",
  "molho":      "Sem Molho",
  "cebolinha":  "Sem Cebolinha",
  "cheiroverde": "Sem Cheiro Verde",   // "cheiro verde" pre-normalised to single token
  "salsinha":   "Sem Salsinha",
  "coentro":    "Sem Coentro",
  "pimenta":    "Sem Pimenta",
  "bacon":      "Sem Bacon",
  "ovo":        "Sem Ovo",
  "presunto":   "Sem Presunto",
  "picles":     "Sem Picles",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function _norm(str) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────────
function parseOrderByKeywords(messageText, menuItems, additions) {
  if (!messageText || !menuItems.length) return null;

  const normalizedMsg = _norm(messageText);
  const words = normalizedMsg.split(" ");
  const foundItems = [];
  const usedIndices = new Set();

  // Number words — only used for quantities, never for addition/observation matching
  const quantityWords = new Set([
    "um", "uma", "dois", "duas", "tres", "tres", "quatro", "cinco", "seis",
    "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze",
  ]);
  const quantityMap = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3,
    quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  };

  // Generic stop-words (structural/filler, NOT addition/observation words)
  const stopWords = new Set([
    "lata", "litro", "litros", "ml", "l", "2l", "1l", "600ml", "350ml",
    "un", "unid", "unidade", "unidades", "x", "de", "com", "sem", "para",
    "quero", "pedido", "pedir", "vou", "vamos", "ai", "no", "na", "faz", "fazer",
  ]);

  // Build alias map for all menu products
  const productAliases = new Map();
  for (const product of menuItems) {
    productAliases.set(product, generateAliases(product.name));
  }

  // Word-sets for pre-scan boundary detection
  const productWordSet = new Set();
  for (const product of menuItems) {
    _norm(product.name).split(" ").forEach(w => productWordSet.add(w));
  }

  // All known addition surface forms (for boundary detection only)
  const additionSurfaceWords = new Set();
  for (const key of Object.keys(ADDITION_ALIAS_MAP)) {
    key.split(" ").forEach(w => { if (w.length >= 3) additionSurfaceWords.add(w); });
  }
  // Also from the DB additions array passed in
  for (const add of additions) {
    _norm(add.name).split(" ").forEach(w => { if (w.length >= 3) additionSurfaceWords.add(w); });
  }

  // ── Pre-scan: mark "sem X [Y]" and "com/mais/extra X [Y]" spans as reserved ──
  // These are reserved only to prevent product matching — they are NOT skipped
  // during the additions/observations pass below.
  const ADD_TRIGGERS  = new Set(["com", "mais", "acrescimo", "extra", "adicional", "e", "tambem"]);
  const SKIP_FILLERS  = new Set(["de", "do", "da", "um", "uma", "o", "a", "acrescimo", "extra"]);

  for (let i = 0; i < words.length; i++) {
    // "sem X [Y]"
    if (words[i] === "sem" && i + 1 < words.length) {
      const next = words[i + 1];
      if (productWordSet.has(next) || additionSurfaceWords.has(next) || OBSERVATION_ALIAS_MAP[next]) {
        usedIndices.add(i);
        usedIndices.add(i + 1);
        if (
          i + 2 < words.length &&
          !ADD_TRIGGERS.has(words[i + 2]) &&
          words[i + 2] !== "sem"
        ) {
          usedIndices.add(i + 2);
        }
      }
    }

    // "com/mais/extra/e X [Y]"
    if (ADD_TRIGGERS.has(words[i]) && i + 1 < words.length) {
      let j = i + 1;
      while (j < words.length && SKIP_FILLERS.has(words[j])) j++;
      let reserved = 0;
      while (
        j < words.length &&
        reserved < 3 &&
        !ADD_TRIGGERS.has(words[j]) &&
        words[j] !== "sem"
      ) {
        const isAddWord = additionSurfaceWords.has(words[j]);
        const isProdWord = productWordSet.has(words[j]);
        if (isAddWord) {
          // It's an addition word — reserve it so it can't be mis-matched as a product
          usedIndices.add(i);
          usedIndices.add(j);
          reserved++;
        } else if (isProdWord && !isAddWord) {
          // Pure product word (e.g. "macarrao") — this is a new item, not an addition; stop
          break;
        } else {
          break;
        }
        j++;
      }
    }
  }

  // Sort products: by longest alias word count first, then by name length.
  // This ensures "Coca Lata Zero" (4-word alias "coca cola lata zero") is tried
  // before "Coca Cola Lata" (3-word alias "coca cola lata") at the same position.
  const sortedProducts = [...menuItems].sort((a, b) => {
    const aMaxWords = Math.max(...(productAliases.get(a) || [""]).map(al => al.split(" ").length));
    const bMaxWords = Math.max(...(productAliases.get(b) || [""]).map(al => al.split(" ").length));
    if (bMaxWords !== aMaxWords) return bMaxWords - aMaxWords;
    return _norm(b.name).length - _norm(a.name).length;
  });

  // ── Pass 1: multi-word phrase matching ──
  // Within each product, try aliases sorted by word count desc (longest first).
  for (const product of sortedProducts) {
    const aliases = (productAliases.get(product) || [])
      .slice()
      .sort((a, b) => b.split(" ").length - a.split(" ").length);
    for (const alias of aliases) {
      const aliasWords = alias.split(" ");
      if (aliasWords.length < 2) continue;
      for (let i = 0; i <= words.length - aliasWords.length; i++) {
        if (aliasWords.some((_, idx) => usedIndices.has(i + idx))) continue;
        if (words.slice(i, i + aliasWords.length).join(" ") !== alias) continue;

        let quantity = 1;
        if (i > 0) {
          const prev = words[i - 1];
          if (/^\d+$/.test(prev)) { quantity = parseInt(prev, 10); usedIndices.add(i - 1); }
          else if (quantityMap[prev]) { quantity = quantityMap[prev]; usedIndices.add(i - 1); }
        }
        for (let j = i; j < i + aliasWords.length; j++) usedIndices.add(j);
        foundItems.push({
          name: product.name, price: product.price, quantity,
          observation: "", additions: [],
          indices: Array.from({ length: aliasWords.length }, (_, k) => i + k),
        });
        break;
      }
      if (foundItems.some(it => it.name === product.name)) break;
    }
  }

  // ── Pass 2: single-token matching ──
  for (const product of sortedProducts) {
    if (foundItems.some(it => it.name === product.name)) continue;
    const aliases = productAliases.get(product);
    for (const alias of aliases) {
      const aliasWords = alias.split(" ");
      if (aliasWords.length !== 1) continue;
      for (let i = 0; i < words.length; i++) {
        if (usedIndices.has(i) || words[i] !== aliasWords[0]) continue;

        let quantity = 1;
        if (i > 0) {
          const prev = words[i - 1];
          if (/^\d+$/.test(prev)) { quantity = parseInt(prev, 10); usedIndices.add(i - 1); }
          else if (quantityMap[prev]) { quantity = quantityMap[prev]; usedIndices.add(i - 1); }
        }
        usedIndices.add(i);
        foundItems.push({
          name: product.name, price: product.price, quantity,
          observation: "", additions: [],
          indices: [i],
        });
        break;
      }
      if (foundItems.some(it => it.name === product.name)) break;
    }
  }

  if (foundItems.length === 0) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: find the item that "owns" a modifier at position modPos.
  // Ownership = the item whose last token index is closest to (and before) modPos.
  // ─────────────────────────────────────────────────────────────────────────
  function closestItemBefore(modPos) {
    let best = null, bestDist = Infinity;
    for (const item of foundItems) {
      const lastIdx = Math.max(...item.indices);
      if (lastIdx < modPos) {
        const dist = modPos - lastIdx;
        if (dist < bestDist) { bestDist = dist; best = item; }
      }
    }
    // Fallback: if nothing is strictly before (e.g. modifier appears before first item),
    // assign to the item with the smallest index gap overall.
    if (!best && foundItems.length > 0) {
      for (const item of foundItems) {
        const firstIdx = Math.min(...item.indices);
        const dist = Math.abs(firstIdx - modPos);
        if (dist < bestDist) { bestDist = dist; best = item; }
      }
    }
    return best;
  }

  // ── Pass 3: "sem X [Y]" → observation ──
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== "sem") continue;
    if (i + 1 >= words.length) continue;

    // Collect all contiguous observation words after "sem"
    const obsParts = [];
    let j = i + 1;
    while (j < words.length && !ADD_TRIGGERS.has(words[j]) && words[j] !== "sem") {
      // Stop at a clearly unrelated word (number or another product)
      if (/^\d+$/.test(words[j]) || quantityWords.has(words[j])) break;
      obsParts.push(words[j]);
      j++;
      // Only multi-word obs if explicitly in alias map; otherwise stop at 1
      if (obsParts.length === 1 && !OBSERVATION_ALIAS_MAP[obsParts.join(" ")]) break;
    }
    if (obsParts.length === 0) continue;

    const obsKey   = obsParts.join(" ");
    const obsLabel = OBSERVATION_ALIAS_MAP[obsKey]
      || `Sem ${obsParts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}`;

    const owner = closestItemBefore(i);
    if (!owner) continue;

    if (!owner.observation) {
      owner.observation = obsLabel;
    } else if (!owner.observation.includes(obsLabel)) {
      owner.observation += `, ${obsLabel}`;
    }
    // Mark sem + words as used so they don't confuse addition matching
    usedIndices.add(i);
    for (let k = i + 1; k < i + 1 + obsParts.length; k++) usedIndices.add(k);
  }

  // ── Pass 4: additions ─────────────────────────────────────────────────────
  //
  // Strategy: scan the text for addition triggers ("com", "mais", etc.) and
  // then resolve what follows against ADDITION_ALIAS_MAP (exact > fuzzy).
  // This is far more reliable than the old per-addition Levenshtein loop.
  //
  // We handle two sub-cases:
  //   A) Trigger-based: "com catupiry", "com acréscimo de bacon", "mais um ovo"
  //   B) Inline (no trigger): a bare addition word sitting right after the item
  //      and not already captured — e.g. "X-Egg Bacon" where "bacon" is an addition
  // ─────────────────────────────────────────────────────────────────────────

  // Build a sorted list of alias keys by length desc so multi-word keys match first
  const sortedAliasKeys = Object.keys(ADDITION_ALIAS_MAP).sort((a, b) => b.length - a.length);

  function resolveAdditionAt(startIdx) {
    // Try to match the longest alias key starting at startIdx
    for (const key of sortedAliasKeys) {
      const keyWords = key.split(" ");
      if (startIdx + keyWords.length > words.length) continue;
      const slice = words.slice(startIdx, startIdx + keyWords.length).join(" ");
      if (slice === key) {
        return { match: ADDITION_ALIAS_MAP[key], consumedCount: keyWords.length };
      }
    }
    // Fuzzy single-token fallback (Levenshtein ≤ 1 for short words, ≤ 2 for longer)
    const token = words[startIdx];
    if (!token || token.length < 3 || stopWords.has(token) || quantityWords.has(token) || /^\d+$/.test(token)) {
      return null;
    }
    let bestKey = null, bestDist = Infinity;
    for (const key of sortedAliasKeys) {
      if (key.includes(" ")) continue; // single-token fuzzy only
      const maxDist = key.length <= 5 ? 1 : 2;
      const d = levenshtein(token, key);
      if (d <= maxDist && d < bestDist) { bestDist = d; bestKey = key; }
    }
    if (bestKey) return { match: ADDITION_ALIAS_MAP[bestKey], consumedCount: 1 };
    return null;
  }

  // Sub-case A: trigger-based scanning
  for (let i = 0; i < words.length; i++) {
    if (!ADD_TRIGGERS.has(words[i])) continue;

    // Skip the trigger itself and any fillers
    let j = i + 1;
    while (j < words.length && SKIP_FILLERS.has(words[j])) j++;

    // Parse one or more additions chained after this trigger
    // e.g. "com bacon e cheddar" → two additions
    while (j < words.length) {
      // Skip a bare quantity digit that precedes the addition name ("com 1 ovo" → skip "1")
      if (/^\d+$/.test(words[j])) { j++; continue; }
      // Stop at a new trigger, "sem", a number, or another product
      if (ADD_TRIGGERS.has(words[j]) || words[j] === "sem" || /^\d+$/.test(words[j])) break;
      // Stop at a quantity word that isn't being used as an addition
      if (quantityWords.has(words[j]) && !ADDITION_ALIAS_MAP[words[j]]) break;

      const result = resolveAdditionAt(j);
      if (!result) {
        j++;
        continue;
      }

      const owner = closestItemBefore(j) || foundItems[foundItems.length - 1];
      if (owner) {
        const add = result.match;
        // Deduplicate
        if (!owner.additions.some(a => a.name === add.name)) {
          owner.additions.push({ name: add.name, price: add.price });
        }
        // Mark consumed words as used
        usedIndices.add(i); // trigger
        for (let k = j; k < j + result.consumedCount; k++) usedIndices.add(k);
      }
      j += result.consumedCount;

      // Allow chaining: "e" or "mais" between additions
      if (j < words.length && (words[j] === "e" || words[j] === "mais")) j++;
    }
  }

  // Sub-case B: bare inline additions (no trigger) — word right after item name
  // Only match exact keys (no fuzzy) to avoid false positives
  for (const item of foundItems) {
    const lastItemIdx = Math.max(...item.indices);
    let j = lastItemIdx + 1;
    // Skip filler words right after item
    while (j < words.length && SKIP_FILLERS.has(words[j])) j++;

    while (j < words.length) {
      if (usedIndices.has(j)) { j++; continue; }
      if (ADD_TRIGGERS.has(words[j]) || words[j] === "sem") break;
      if (/^\d+$/.test(words[j]) || quantityWords.has(words[j])) break;

      const result = resolveAdditionAt(j);
      if (!result) break; // no match → stop scanning inline for this item

      const add = result.match;
      if (!item.additions.some(a => a.name === add.name)) {
        item.additions.push({ name: add.name, price: add.price });
      }
      for (let k = j; k < j + result.consumedCount; k++) usedIndices.add(k);
      j += result.consumedCount;
      if (j < words.length && (words[j] === "e" || words[j] === "mais")) j++;
    }
  }

  // ── Cleanup: strip internal tracking field ──
  const cleanedItems = foundItems.map(({ indices, ...item }) => item);
  return { order: true, items: cleanedItems };
}

module.exports = { parseOrderByKeywords, ADDITION_ALIAS_MAP };