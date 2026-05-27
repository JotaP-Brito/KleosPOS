const { generateAliases } = require("./orderNormalizer");

function parseOrderByKeywords(messageText, menuItems, additions) {
  if (!messageText || !menuItems.length) return null;

  // Normalize the message first
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
    "un", "unid", "unidade", "unidades", "x", "de", "com", "mais", "sem", "para",
    "quero", "pedido", "pedir", "vou", "vamos", "ai", "aí", "no", "na", "faz", "fazer"
  ]);

  // ---- Quantity detection from surrounding words ----
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

  // 1. Multi‑word phrase matching using aliases
  for (const [product, aliases] of productAliases) {
    for (const alias of aliases) {
      const aliasWords = alias.split(" ");
      if (aliasWords.length >= 2) {
        for (let i = 0; i <= words.length - aliasWords.length; i++) {
          const slice = words.slice(i, i + aliasWords.length).join(" ");
          if (slice === alias) {
            // Found a match – determine quantity
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
            break; // go to next product
          }
        }
      }
      if (foundItems.some(item => item.name === product.name)) break;
    }
  }

  // 2. Single‑token matching using aliases
  for (const [product, aliases] of productAliases) {
    if (foundItems.some(item => item.name === product.name)) continue;
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

  // ---- Observations: "sem X" ----
  const obsMatches = normalizedMsg.match(/sem\s+(\w+)/gi);
  if (obsMatches) {
    for (const match of obsMatches) {
      const parts = match.split(/\s+/);
      if (parts.length >= 2) {
        const term = parts.slice(1).join(" ");
        // Find nearest preceding item (simple: attach to first item, you may improve)
        foundItems[0].observation = `Sem ${term}`;
      }
    }
  }

  // Clean up indices
  const cleanedItems = foundItems.map(({ indices, ...item }) => item);
  return { order: true, items: cleanedItems };
}

module.exports = { parseOrderByKeywords };