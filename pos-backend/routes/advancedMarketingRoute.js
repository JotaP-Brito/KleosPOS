// routes/advancedMarketingRoute.js
const express = require("express");
const router = express.Router();
const cron = require("node-cron");
const Customer = require("../models/Customer");
const Order = require("../models/orderModel");
const sendWhatsAppMessage = require("../utils/sendWhatsAppMessage");
const crossSellUpsellConfig = require("../config/crossSellUpsell");
const { getLeastActiveDay, getFavouriteItem } = require("../utils/customerInsights");

const ADMIN_SECRET = process.env.ADMIN_SECRET || "admin123";

// ─────────────────────────────────────────────────────────
// 1. Update favourite day and item for all customers (weekly)
// ─────────────────────────────────────────────────────────
async function updateCustomerInsights() {
  const customers = await Customer.find({ optedOut: false, whatsappChatId: { $exists: true, $ne: "" } });
  for (const cust of customers) {
    try {
      cust.favouriteItem = await getFavouriteItem(cust.phone);
      cust.favouriteReminderDay = await getLeastActiveDay(cust.phone);
      await cust.save();
    } catch (e) { console.error(`Insight update failed for ${cust.phone}:`, e.message); }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log("Customer insights updated.");
}

// Run every Monday at 3 AM
cron.schedule("0 3 * * 1", updateCustomerInsights, { timezone: "America/Sao_Paulo" });

// ─────────────────────────────────────────────────────────
// 2. Favourite reminder – send on customer's least active day
// ─────────────────────────────────────────────────────────
async function runFavouriteReminder() {
  const today = new Date().getDay(); // 0-6
  const customers = await Customer.find({
    optedOut: false,
    favouriteReminderDay: today,
    whatsappChatId: { $exists: true, $ne: "" },
    lastOrderDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    favouriteItem: { $exists: true, $ne: null },
  });
  console.log(`Favourite reminder – ${customers.length} customers today`);
  for (const cust of customers) {
    const msg = `Oi ${cust.name || "cliente"}! Seu favorito, ${cust.favouriteItem}, está te esperando… Peça agora e ganhe 10% de desconto com o cupom FAV10. 🍔`;
    try {
      await sendWhatsAppMessage(cust.whatsappChatId, msg);
      console.log(`Favourite sent to ${cust.phone}`);
    } catch (err) { console.error(`Err ${cust.phone}: ${err.message}`); }
    await new Promise(r => setTimeout(r, 500));
  }
}

// Run daily at 10 AM
cron.schedule("0 10 * * *", runFavouriteReminder, { timezone: "America/Sao_Paulo" });

// ─────────────────────────────────────────────────────────
// 3. Happy hour – 10% discount, 9 PM daily
// ─────────────────────────────────────────────────────────
async function runHappyHour() {
  const customers = await Customer.find({
    optedOut: false,
    whatsappChatId: { $exists: true, $ne: "" },
    lastOrderDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  });
  const msg = "🍟 HAPPY HOUR! 10% de desconto em todo o pedido das 21h às 23h. Use o cupom HAPPY10. Peça já! ⚡";
  for (const cust of customers) {
    try {
      await sendWhatsAppMessage(cust.whatsappChatId, msg);
      console.log(`Happy hour sent to ${cust.phone}`);
    } catch (err) { console.error(err.message); }
    await new Promise(r => setTimeout(r, 500));
  }
}

cron.schedule("0 21 * * *", runHappyHour, { timezone: "America/Sao_Paulo" });

// ─────────────────────────────────────────────────────────
// 4. Upsell (product upgrade) – with price difference
// ─────────────────────────────────────────────────────────
async function runUpsell() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const customers = await Customer.find({
    optedOut: false,
    whatsappChatId: { $exists: true, $ne: "" },
    lastOrderDate: { $gte: sevenDaysAgo },
  });
  console.log(`Upsell – checking ${customers.length} customers`);
  for (const cust of customers) {
    const orders = await Order.find({
      "customerDetails.phone": cust.phone,
      orderDate: { $gte: sevenDaysAgo },
    });
    const orderedProducts = new Set();
    orders.forEach(o => o.items.forEach(i => orderedProducts.add(i.name)));
    for (const product of orderedProducts) {
      const mapping = crossSellUpsellConfig.upsellMap[product];
      if (mapping) {
        const diff = mapping.priceDiff.toFixed(2);
        const msg = `🔥 ${product}? Por apenas R$ ${diff} a mais, você leva um ${mapping.upgrade}! Use UP10 e ganhe 10% off.`;
        try {
          await sendWhatsAppMessage(cust.whatsappChatId, msg);
          console.log(`Upsell sent to ${cust.phone} (${product} → ${mapping.upgrade})`);
          break;
        } catch (err) { console.error(err.message); }
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

cron.schedule("0 11 * * 4", runUpsell, { timezone: "America/Sao_Paulo" });

// ─────────────────────────────────────────────────────────
// 5. Addition upsell (weekly cron)
// ─────────────────────────────────────────────────────────
async function runAdditionUpsell() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const customers = await Customer.find({
    optedOut: false,
    whatsappChatId: { $exists: true, $ne: "" },
    lastOrderDate: { $gte: sevenDaysAgo },
  });
  console.log(`Addition Upsell – checking ${customers.length} customers`);
  for (const cust of customers) {
    const orders = await Order.find({
      "customerDetails.phone": cust.phone,
      orderDate: { $gte: sevenDaysAgo },
    });
    const orderedAdditions = new Set();
    orders.forEach(o => o.items.forEach(i => (i.additions || []).forEach(a => orderedAdditions.add(a.name))));
    const hasMain = orders.some(o =>
      o.items.some(i => i.name.includes("X-") || i.name === "Hamburguer" || i.name === "Hambúrguer Especial" || i.name.includes("Macarrão"))
    );
    if (!hasMain) continue;
    for (const add of crossSellUpsellConfig.popularAdditions) {
      if (!orderedAdditions.has(add.name)) {
        try {
          await sendWhatsAppMessage(cust.whatsappChatId, add.msg);
          console.log(`Addition upsell "${add.name}" sent to ${cust.phone}`);
          break;
        } catch (err) { console.error(err.message); }
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

cron.schedule("0 11 * * 3", runAdditionUpsell, { timezone: "America/Sao_Paulo" });

// ─────────────────────────────────────────────────────────
// 6. Win-back drip (unchanged)
// ─────────────────────────────────────────────────────────
const WINBACK_STEPS = [
  { daysAfter: 3,  code: "VOLTE10", discount: 10, msg: (name) => `Oi ${name}! Que saudade! Volte e ganhe 10% de desconto com o cupom VOLTE10. 🍔` },
  { daysAfter: 7,  code: "VOLTE20", discount: 20, msg: (name) => `Ei ${name}, 20% de desconto só hoje! Use VOLTE20. 😋` },
  { daysAfter: 14, code: "VOLTE25", discount: 25, msg: (name) => `Última chance, ${name}! 25% off com VOLTE25 + brinde surpresa. 🎁` },
  { daysAfter: 30, code: "VOLTE30", discount: 30, msg: (name) => `Sentimos sua falta, ${name}! Volte com 30% de desconto usando VOLTE30. ❤️` },
];

async function runWinbackCampaign() {
  const now = new Date();
  const customers = await Customer.find({
    optedOut: false,
    whatsappChatId: { $exists: true, $ne: "" },
  });
  for (const cust of customers) {
    if (!cust.lastOrderDate) continue;
    const daysSince = Math.floor((now - cust.lastOrderDate) / (1000 * 60 * 60 * 24));
    const currentStep = cust.lastWinbackSequence || 0;
    for (let i = currentStep; i < WINBACK_STEPS.length; i++) {
      if (daysSince >= WINBACK_STEPS[i].daysAfter) {
        const msg = WINBACK_STEPS[i].msg(cust.name || "cliente");
        try {
          await sendWhatsAppMessage(cust.whatsappChatId, msg);
          cust.lastWinbackSequence = i + 1;
          cust.lastWinbackDate = new Date();
          await cust.save();
          console.log(`Winback step ${i+1} sent to ${cust.phone}`);
        } catch (err) { console.error(err.message); }
        break;
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

cron.schedule("0 10 * * *", runWinbackCampaign, { timezone: "America/Sao_Paulo" });

// ── Test endpoints ──────────────────────────────
router.post("/run-favourite", async (req, res) => {
  if (req.body.secret !== ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });
  await runFavouriteReminder();
  res.json({ status: "ok" });
});
router.post("/run-winback", async (req, res) => {
  if (req.body.secret !== ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });
  await runWinbackCampaign();
  res.json({ status: "ok" });
});
router.post("/run-happyhour", async (req, res) => {
  if (req.body.secret !== ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });
  await runHappyHour();
  res.json({ status: "ok" });
});
router.post("/run-upsell", async (req, res) => {
  if (req.body.secret !== ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });
  await runUpsell();
  res.json({ status: "ok" });
});
router.post("/run-addition-upsell", async (req, res) => {
  if (req.body.secret !== ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });
  await runAdditionUpsell();
  res.json({ status: "ok" });
});

module.exports = router;