// utils/keywordParser.js
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

  const quantityMap = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3,
    quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  };

  // Build alias map for all products
  const productAliases = new Map();
  for (const product of menuItems) {
    const aliases = generateAliases(product.name);
    productAliases.set(product, aliases);
  }

  // 1. Multi-word phrase matching
  for (const [product, aliases] of productAliases) {
    for (const alias of aliases) {
      const aliasWords = alias.split(" ");
      if (aliasWords.length >= 2) {
        for (let i = 0; i <= words.length - aliasWords.length; i++) {
          const slice = words.slice(i, i + aliasWords.length).join(" ");
          if (slice === alias) {
            let quantity = 1;
            if (i > 0) {
              const prev = words[i - 1];
              if (/^\d+$/.test(prev)) { quantity = parseInt(prev, 10); usedIndices.add(i - 1); }
              else if (quantityMap[prev]) { quantity = quantityMap[prev]; usedIndices.add(i - 1); }
            }
            for (let j = i; j < i + aliasWords.length; j++) usedIndices.add(j);
            foundItems.push({
              name: product.name,
              price: product.price,
              quantity,
              observation: "",
              additions: [],
              startIndex: i,  // ← track position for observation matching
            });
            break;
          }
        }
      }
      if (foundItems.some((item) => item.name === product.name)) break;
    }
  }

  // 2. Single-token matching
  for (const [product, aliases] of productAliases) {
    if (foundItems.some((item) => item.name === product.name)) continue;
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
              if (/^\d+$/.test(prev)) { quantity = parseInt(prev, 10); usedIndices.add(i - 1); }
              else if (quantityMap[prev]) { quantity = quantityMap[prev]; usedIndices.add(i - 1); }
            }
            usedIndices.add(i);
            foundItems.push({
              name: product.name,
              price: product.price,
              quantity,
              observation: "",
              additions: [],
              startIndex: i,  // ← track position
            });
            break;
          }
        }
      }
      if (foundItems.some((item) => item.name === product.name)) break;
    }
  }

  if (foundItems.length === 0) return null;

  // ---- FIX: Attach "sem X" observation to the NEAREST PRECEDING item ----
  // Previously always attached to foundItems[0], which was wrong.
  const obsRegex = /sem\s+(\w+(?:\s+\w+)?)/gi;
  let obsMatch;
  while ((obsMatch = obsRegex.exec(normalizedMsg)) !== null) {
    const obsIndex = normalizedMsg.slice(0, obsMatch.index).split(" ").length - 1;
    const term = obsMatch[1].trim();

    // Find the item whose startIndex is closest and before the "sem"
    let nearestItem = null;
    let smallestGap = Infinity;
    for (const item of foundItems) {
      if (item.startIndex <= obsIndex) {
        const gap = obsIndex - item.startIndex;
        if (gap < smallestGap) {
          smallestGap = gap;
          nearestItem = item;
        }
      }
    }

    // Fallback: if no item precedes it, attach to the first item
    const target = nearestItem || foundItems[0];
    const existing = target.observation ? target.observation + ", " : "";
    target.observation = `${existing}Sem ${term}`;
  }

  // Clean up the internal startIndex before returning
  const cleanedItems = foundItems.map(({ startIndex, ...item }) => item);
  return { order: true, items: cleanedItems };
}

module.exports = { parseOrderByKeywords };