const Order = require("../models/orderModel");

// Returns the day of week (0-6) with the fewest orders in the last 90 days
async function getLeastActiveDay(phone) {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const orders = await Order.find({
    "customerDetails.phone": phone,
    orderDate: { $gte: since },
  });
  const dayCount = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  orders.forEach(o => {
    const day = new Date(o.orderDate).getDay();
    dayCount[day]++;
  });
  // Find day with minimum count (skip days with 0? we want the least active among days they did order, but if a day has 0, that's the least active)
  let minDay = 0;
  for (let i = 1; i < 7; i++) {
    if (dayCount[i] < dayCount[minDay]) minDay = i;
  }
  return minDay; // day with fewest orders
}

// Get most ordered item in last 30 days
async function getFavouriteItem(phone, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const orders = await Order.find({
    "customerDetails.phone": phone,
    orderDate: { $gte: since },
  });
  const tally = {};
  orders.forEach(o => {
    o.items.forEach(item => {
      const name = item.name;
      tally[name] = (tally[name] || 0) + (item.quantity || 1);
    });
  });
  let fav = null, max = 0;
  for (const [name, qty] of Object.entries(tally)) {
    if (qty > max) { max = qty; fav = name; }
  }
  return fav;
}

module.exports = { getLeastActiveDay, getFavouriteItem };