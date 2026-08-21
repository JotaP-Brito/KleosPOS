const Product = require("../models/Product");
const Addition = require("../models/Addition");

let cachedProducts = [];
let cachedAdditions = [];
let lastLoad = 0;

async function getMenuData() {
  const now = Date.now();
  if (now - lastLoad > 60000) {   // 60-second cache
    cachedProducts = await Product.find({ isAvailable: true }).select("name price").lean();
    cachedAdditions = await Addition.find({}).lean();
    lastLoad = now;
  }
  return { products: cachedProducts, additions: cachedAdditions };
}

module.exports = { getMenuData };
