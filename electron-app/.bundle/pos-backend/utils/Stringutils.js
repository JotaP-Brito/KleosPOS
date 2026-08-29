// utils/stringUtils.js
// Shared string utilities used across multiple modules.

/**
 * Classic dynamic-programming Levenshtein distance.
 * Single canonical implementation — import from here, don't copy-paste.
 */
function levenshtein(a, b) {
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
}

module.exports = { levenshtein };