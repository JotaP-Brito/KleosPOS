// routes/advancedMarketingRoute.js
const express = require("express");
const router = express.Router();
const cron = require("node-cron");
const Customer = require("../models/Customer");
const Order = require("../models/orderModel");
const sendWhatsAppMessage = require("../utils/sendWhatsAppMessage");
const crossSellUpsellConfig = require("../config/crossSellUpsell");


const ADMIN_SECRET = process.env.ADMIN_SECRET || "admin123";

// ─────────────────────────────────────────────────────────
// 1. HELPER: get customer's favourite item (last 30 days)
// ─────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────
// 2. CAMPAIGN: Personalised favourite reminder
// ─────────────────────────────────────────────────────────
async function runFavouriteReminder() {
  const customers = await Customer.find({
    optedOut: false,
    whatsappChatId: { $exists: true, $ne: "" },
    lastOrderDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  });
  console.log(`Favourite reminder – found ${customers.length} eligible customers`);
  for (const cust of customers) {
    const fav = await getFavouriteItem(cust.phone);
    if (fav) {
      cust.favouriteItem = fav;
      await cust.save();
      const msg = `Oi ${cust.name || "cliente"}! Seu favorito, ${fav}, está te esperando… Peça agora e ganhe 10% de desconto com o cupom FAV10. 🍔`;
      try {
        await sendWhatsAppMessage(cust.whatsappChatId, msg);
        console.log(`Favourite sent to ${cust.phone}`);
      } catch (err) { console.error(`Err ${cust.phone}: ${err.message}`); }
    }
    await new Promise(r => setTimeout(r, 500)); // avoid rate limits
  }
}

// ─────────────────────────────────────────────────────────
// 3. CAMPAIGN: Win-back drip sequence (escalating offers)
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
  console.log(`Winback – found ${customers.length} total customers`);
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
        } catch (err) { console.error(`Err ${cust.phone}: ${err.message}`); }
        break; // only one message per day
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

// ─────────────────────────────────────────────────────────
// 4. CAMPAIGN: Happy hour (9 PM, free batata frita)
// ─────────────────────────────────────────────────────────
async function runHappyHour() {
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const customers = await Customer.find({
    lastOrderDate: { $gte: sevenDaysAgo },
    optedOut: false,
    whatsappChatId: { $exists: true, $ne: "" },
  });
  console.log(`Happy hour – found ${customers.length} customers`);
  const msg = "🍟 HAPPY HOUR! Peça agora e ganhe uma batata frita grátis! Basta mencionar 'HAPPY'. Válido hoje das 21h às 23h. ⚡";
  for (const cust of customers) {
    try {
      await sendWhatsAppMessage(cust.whatsappChatId, msg);
      console.log(`Happy hour sent to ${cust.phone}`);
    } catch (err) { console.error(`Err ${cust.phone}: ${err.message}`); }
    await new Promise(r => setTimeout(r, 500));
  }
}

// ─────────────────────────────────────────────────────────
// 5. CAMPAIGN: Cross-sell (suggest drinks to burger lovers)
// ─────────────────────────────────────────────────────────
async function runCrossSell() {
  // Find customers who ordered at least one burger but never a drink (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const customers = await Customer.find({
    optedOut: false,
    whatsappChatId: { $exists: true, $ne: "" },
    lastOrderDate: { $gte: thirtyDaysAgo },
  });
  console.log(`Cross-sell – checking ${customers.length} customers`);
  for (const cust of customers) {
    // Get recent orders to analyse
    const orders = await Order.find({
      "customerDetails.phone": cust.phone,
      orderDate: { $gte: thirtyDaysAgo },
    });
    const hasBurger = orders.some(o => o.items.some(i => i.name.toLowerCase().includes("x-") || i.name.toLowerCase().includes("burguer")));
    const hasDrink = orders.some(o => o.items.some(i => /coca|guarana|fanta|sprite|suco|agua|refrigerante/i.test(i.name)));
    if (hasBurger && !hasDrink) {
      const suggestion = crossSellUpsellConfig.crossSellCategories.burger[0]; // e.g., "Coca-Cola Lata"
      const msg = `🍔 Já pensou em completar seu combo? Adicione uma ${suggestion} no seu próximo pedido e ganhe 5% de desconto! Use CROSS5.`;
      try {
        await sendWhatsAppMessage(cust.whatsappChatId, msg);
        console.log(`Cross-sell sent to ${cust.phone}`);
      } catch (err) { console.error(`Err ${cust.phone}: ${err.message}`); }
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

// ─────────────────────────────────────────────────────────
// 6. CAMPAIGN: Upsell (suggest larger version)
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
      if (crossSellUpsellConfig.upsellMap[product]) {
        const { upgrade, message } = crossSellUpsellConfig.upsellMap[product];
        const msg = `🔥 ${message} Peça um ${upgrade} e ganhe 10% de desconto com o cupom UP10.`;
        try {
          await sendWhatsAppMessage(cust.whatsappChatId, msg);
          console.log(`Upsell sent to ${cust.phone} (${product} → ${upgrade})`);
          break; // only one upsell per customer per run
        } catch (err) { console.error(`Err ${cust.phone}: ${err.message}`); }
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
}
// ─────────────────────────────────────────────────────────
// 7. CAMPAIGN: Addition Upsell (popular extras)
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

    // Check if the customer ordered any sandwich/pasta but didn't add a specific popular addition
    const orderedAdditions = new Set();
    orders.forEach(o => o.items.forEach(i => (i.additions || []).forEach(a => orderedAdditions.add(a.name))));

    const hasMain = orders.some(o =>
      o.items.some(i => i.name.includes("X-") || i.name === "Hamburguer" || i.name === "Hambúrguer Especial" || i.name.includes("Macarrão"))
    );
    if (!hasMain) continue;   // only target customers who ordered a main dish

    // Find the first popular addition they didn't order yet
    for (const add of crossSellUpsellConfig.popularAdditions) {
      if (!orderedAdditions.has(add.name)) {
        try {
          await sendWhatsAppMessage(cust.whatsappChatId, add.msg);
          console.log(`Addition upsell "${add.name}" sent to ${cust.phone}`);
          break;   // send only one suggestion per customer per run
        } catch (err) { console.error(`Err ${cust.phone}: ${err.message}`); }
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

// ─────────────────────────────────────────────────────────
// SCHEDULE ALL JOBS
// ─────────────────────────────────────────────────────────
// Daily at 10:00 AM – winback + favourite + VIP (not included here, but you can add)
cron.schedule("0 10 * * *", () => {
  console.log("--- Daily marketing: winback ---");
  runWinbackCampaign().catch(console.error);
}, { timezone: "America/Sao_Paulo" });

// Favourite reminder: every Tuesday at 10:00 AM
cron.schedule("0 10 * * 2", () => {
  console.log("--- Favourite reminder ---");
  runFavouriteReminder().catch(console.error);
}, { timezone: "America/Sao_Paulo" });

// Happy hour: every day at 9:00 PM
cron.schedule("0 21 * * *", () => {
  console.log("--- Happy hour ---");
  runHappyHour().catch(console.error);
}, { timezone: "America/Sao_Paulo" });

// Cross-sell: every Friday at 11:00 AM
cron.schedule("0 11 * * 5", () => {
  console.log("--- Cross-sell ---");
  runCrossSell().catch(console.error);
}, { timezone: "America/Sao_Paulo" });

// Upsell: every Thursday at 11:00 AM
cron.schedule("0 11 * * 4", () => {
  console.log("--- Upsell ---");
  runUpsell().catch(console.error);
}, { timezone: "America/Sao_Paulo" });

// ─────────────────────────────────────────────────────────
// MANUAL TEST ENDPOINTS (protected)
// ─────────────────────────────────────────────────────────
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
router.post("/run-crosssell", async (req, res) => {
  if (req.body.secret !== ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });
  await runCrossSell();
  res.json({ status: "ok" });
});
router.post("/run-upsell", async (req, res) => {
  if (req.body.secret !== ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });
  await runUpsell();
  res.json({ status: "ok" });
});

module.exports = router;