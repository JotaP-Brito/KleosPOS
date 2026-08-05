// utils/orderMerge.js

function _normName(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Merge keyword-parser items with LLM items.
 * - Items the keyword parser already found: kept as-is (their additions/observations
 *   were built with more precise positional logic than the LLM's single-shot JSON).
 * - Items the LLM found that the keyword parser missed: appended.
 * - Matching is done by product name (case/accent-insensitive).
 */
function mergeParsedResults(keywordItems, llmItems) {
  const keywordNames = new Set(keywordItems.map((it) => _normName(it.name)));
  const merged = [...keywordItems];

  for (const llmItem of llmItems) {
    if (!keywordNames.has(_normName(llmItem.name))) {
      merged.push(llmItem);
    }
  }

  return merged;
}

module.exports = { mergeParsedResults };