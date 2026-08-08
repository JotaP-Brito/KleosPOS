const cron = require("node-cron");
const Customer = require("../models/Customer");
const sendWhatsAppMessage = require("./sendWhatsAppMessage");

const INACTIVE_DAYS = 0; // change as needed
const PROMO_MSG = "🍔 Saudades! Ganhe 10% de desconto no seu próximo pedido com o cupom VOLTE10. Faça já o seu pedido!";

async function sendInactivePromos() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS);

  const inactive = await Customer.find({
    lastOrderDate: { $lt: cutoff },
    optedOut: false,
    whatsappChatId: { $exists: true, $ne: "" },
  });

  console.log(`Found ${inactive.length} inactive customers.`);

  for (const cust of inactive) {
    try {
      await sendWhatsAppMessage(cust.whatsappChatId, PROMO_MSG);
      console.log(`Promo sent to ${cust.phone}`);
    } catch (err) {
      console.error(`Failed to send promo to ${cust.phone}:`, err.message);
    }
    // avoid rate‑limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Run every day at 10:00 (Brasília time)
cron.schedule("0 10 * * *", () => {
  console.log("Running inactivity promo job...");
  sendInactivePromos().catch(console.error);
}, {
  timezone: "America/Sao_Paulo"
});

module.exports = { sendInactivePromos };