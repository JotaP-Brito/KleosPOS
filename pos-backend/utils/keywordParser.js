const { generateAliases } = require("./orderNormalizer");

function parseOrderByKeywords(messageText, menuItems, additions) {
  if (!messageText || !menuItems.length) return null;

  const normalizedMsg = messageText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalizedMsg.split(" ");
  const foundItems = [];
  const usedIndices = new Set();

  const stopWords = new Set([
    "lata", "litro", "litros", "ml", "l", "2l", "1l", "600ml", "350ml",
    "un", "unid", "unidade", "unidades", "x", "de", "com", "sem", "para",
    "quero", "pedido", "pedir", "vou", "vamos", "ai", "aí", "no", "na", "faz", "fazer"
  ]);

  const quantityMap = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3,
    quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10
  };

  // Build alias map for all products
  const productAliases = new Map();
  for (const product of menuItems) {
    const aliases = generateAliases(product.name);
    productAliases.set(product, aliases);
  }

  // ✅ FIX 1: Pre‑scan for "sem <potential product word>" and mark both as used
  const productWordSet = new Set();
  for (const product of menuItems) {
    const name = product.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .trim();
    name.split(" ").forEach(w => productWordSet.add(w));
  }

  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === "sem" && productWordSet.has(words[i + 1])) {
      usedIndices.add(i);
      usedIndices.add(i + 1);
    }
  }

  // Sort products by longest normalized name first
  const sortedProducts = [...menuItems].sort((a, b) => {
    const aName = a.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const bName = b.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    return bName.length - aName.length;
  });

  // 1. Multi‑word phrase matching
  for (const product of sortedProducts) {
    const aliases = productAliases.get(product);
    for (const alias of aliases) {
      const aliasWords = alias.split(" ");
      if (aliasWords.length >= 2) {
        for (let i = 0; i <= words.length - aliasWords.length; i++) {
          if (aliasWords.some((_, idx) => usedIndices.has(i + idx))) continue;
          const slice = words.slice(i, i + aliasWords.length).join(" ");
          if (slice === alias) {
            let quantity = 1;
            if (i > 0) {
              const prev = words[i - 1];
              if (/^\d+$/.test(prev)) {
                quantity = parseInt(prev, 10);
                usedIndices.add(i - 1);
              } else if (quantityMap[prev]) {
                quantity = quantityMap[prev];
                usedIndices.add(i - 1);
              }
            }
            for (let j = i; j < i + aliasWords.length; j++) usedIndices.add(j);
            foundItems.push({
              name: product.name,
              price: product.price,
              quantity,
              observation: "",
              additions: [],
              indices: Array.from({ length: aliasWords.length }, (_, k) => i + k)
            });
            break;
          }
        }
      }
      if (foundItems.some(item => item.name === product.name)) break;
    }
  }

  // 2. Single‑token matching
  for (const product of sortedProducts) {
    if (foundItems.some(item => item.name === product.name)) continue;
    const aliases = productAliases.get(product);
    for (const alias of aliases) {
      const aliasWords = alias.split(" ");
      if (aliasWords.length === 1) {
        const singleAlias = aliasWords[0];
        for (let i = 0; i < words.length; i++) {
          if (usedIndices.has(i)) continue;
          if (words[i] === singleAlias) {
            let quantity = 1;
            if (i > 0) {
              const prev = words[i - 1];
              if (/^\d+$/.test(prev)) {
                quantity = parseInt(prev, 10);
                usedIndices.add(i - 1);
              } else if (quantityMap[prev]) {
                quantity = quantityMap[prev];
                usedIndices.add(i - 1);
              }
            }
            usedIndices.add(i);
            foundItems.push({
              name: product.name,
              price: product.price,
              quantity,
              observation: "",
              additions: [],
              indices: [i]
            });
            break;
          }
        }
      }
      if (foundItems.some(item => item.name === product.name)) break;
    }
  }

  if (foundItems.length === 0) return null;

  // ✅ FIX 2: Attach "sem X" observations to the correct product
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] !== "sem") continue;
    const obsWord = words[i + 1];
    let closestItem = null;
    let closestDist = Infinity;
    for (const item of foundItems) {
      const lastIdx = Math.max(...item.indices);
      if (lastIdx < i) {
        const dist = i - lastIdx;
        if (dist < closestDist) {
          closestDist = dist;
          closestItem = item;
        }
      }
    }
    if (closestItem) {
      const observation = `Sem ${obsWord}`;
      if (!closestItem.observation) {
        closestItem.observation = observation;
      } else if (!closestItem.observation.includes(observation)) {
        closestItem.observation += `, ${observation}`;
      }
      usedIndices.add(i);
      usedIndices.add(i + 1);
    }
  }

  // ✅ FIX 3: Additions – skip if the token was already consumed, and use expanded synonyms
  const allProductNames = menuItems.map(p =>
    p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
  );
  const levenshtein = (a, b) => {
    const an = a.length, bn = b.length;
    const m = Array.from({ length: an + 1 }, () => Array(bn + 1).fill(0));
    for (let i = 0; i <= an; i++) m[i][0] = i;
    for (let j = 0; j <= bn; j++) m[0][j] = j;
    for (let i = 1; i <= an; i++) {
      for (let j = 1; j <= bn; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
      }
    }
    return m[an][bn];
  };
  const synonyms = { "ovo": "egg", "egg": "ovo", "queijo": "cheese", "cheese": "queijo", "bacon": "bacon", "presunto": "ham", "ham": "presunto" };
  const expandedProductNames = allProductNames.flatMap(name => {
    const words = name.split(" ");
    const syns = words.map(w => synonyms[w] || w);
    return [name, ...syns.join(" ")];
  });

  for (const add of additions) {
    const addNorm = add.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (foundItems.some(item => (item.additions || []).some(a => a.name === add.name))) continue;

    // Use expandedProductNames for implication check
    if (expandedProductNames.some(name => name.includes(addNorm))) {
      console.log(`Skipping addition "${add.name}" – already implied by product`);
      continue;
    }

    // Find best token match among **unused** words
    let bestTokenIndex = -1, bestDist = Infinity;
    for (let i = 0; i < words.length; i++) {
      if (usedIndices.has(i)) continue;       // skip words already assigned to products or observations
      const token = words[i];
      if (token.length < 3) continue;
      const dist = levenshtein(token, addNorm);
      if (dist <= 2 && dist < bestDist) { bestDist = dist; bestTokenIndex = i; }
    }
    if (bestTokenIndex < 0) continue;
    if (bestTokenIndex > 0 && words[bestTokenIndex - 1] === "sem") continue;

    let closestItem = null;
    for (const item of foundItems) {
      const itemNorm = item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      const itemWords = itemNorm.split(" ");
      let lastIdx = -1;
      for (let i = 0; i < bestTokenIndex; i++) { if (words[i] === itemWords[0]) lastIdx = i; }
      if (lastIdx >= 0 && (closestItem === null || (bestTokenIndex - lastIdx) < (closestItem._dist || Infinity))) {
        closestItem = item;
        closestItem._dist = bestTokenIndex - lastIdx;
      }
    }
    if (closestItem) {
      delete closestItem._dist;
      if (!closestItem.additions) closestItem.additions = [];
      closestItem.additions.push({ name: add.name, price: add.price });
    }
  }

  const cleanedItems = foundItems.map(({ indices, ...item }) => item);
  return { order: true, items: cleanedItems };
}

module.exports = { parseOrderByKeywords };