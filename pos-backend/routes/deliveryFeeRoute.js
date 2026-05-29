// routes/deliveryFeeRoute.js
const express = require("express");
const router = express.Router();
const Order = require("../models/orderModel");
const axios = require("axios");

const OPENWA_BASE = () => process.env.OPENWA_URL || "http://localhost:2785";
const OPENWA_KEY  = () => process.env.OPENWA_API_KEY || "dev-admin-key";

// ✅ chatId is now passed as-is from order.whatsappChatId (e.g. "351912345678@lid")
async function sendWhatsAppMessage(chatId, text, sessionId) {
  const sid = sessionId || process.env.OPENWA_SESSION_ID || "default";
  try {
    await axios.post(
      `${OPENWA_BASE()}/api/sessions/${sid}/messages/send-text`,
      { chatId, text },
      { headers: { "X-API-Key": OPENWA_KEY() } }
    );
    console.log(`✅ WhatsApp message sent to ${chatId}`);
  } catch (err) {
    console.error(`❌ OpenWA error body:`, err.response?.data);
    console.error(`❌ Failed to send WhatsApp message to ${chatId}:`, err.message);
  }
}

// PATCH /api/order/:id/delivery-fee
// Body: { deliveryFee: 3 }
router.patch("/:id/delivery-fee", async (req, res) => {
  try {
    const { deliveryFee } = req.body;
    const fee = parseFloat(deliveryFee);

    if (isNaN(fee) || fee < 0) {
      return res.status(400).json({ success: false, message: "Taxa de entrega inválida" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Pedido não encontrado" });
    }
    if (order.orderType !== "Delivery") {
      return res.status(400).json({ success: false, message: "Pedido não é do tipo Delivery" });
    }

    // Update totals with the fee
    const baseTotal          = order.bills.total;
    const newTotal           = baseTotal + fee;
    order.deliveryFee        = fee;
    order.bills.total        = newTotal;
    order.bills.totalWithTax = newTotal;
    order.paymentStatus      = "Pending";
    await order.save();

    // Build item list for the WhatsApp message
    const itemLines = order.items
      .map((i) => {
        let line = `${i.quantity || 1}x ${i.name}`;
        if (i.additions?.length) line += ` (+ ${i.additions.map((a) => a.name).join(", ")})`;
        return line;
      })
      .join("\n");

    const message =
      `📝 Resumo final do pedido:\n\n` +
      `${itemLines}\n\n` +
      `🏠 Entrega em: ${order.deliveryAddress || "endereço registado"}\n` +
      `💳 Pagamento: ${order.paymentMethod || "a definir"}\n` +
      `🛵 Taxa de entrega: R$ ${fee.toFixed(2)}\n` +
      `💰 Total: R$ ${newTotal.toFixed(2)}\n\n` +
      `Confirma? (sim / não)`;

    // ✅ Use the saved chatId (exact format OpenWA expects), fallback to @c.us just in case
    const chatId = order.whatsappChatId || `${order.customerDetails.phone}@c.us`;
    await sendWhatsAppMessage(chatId, message, process.env.OPENWA_SESSION_ID);

    // Move in-memory session to CONFIRMAR so customer's reply is handled correctly
    try {
      const { updateSession } = require("../utils/sessionManager");
      updateSession(order.customerDetails.phone, { step: "CONFIRMAR" });
      console.log(`📱 Session for ${order.customerDetails.phone} moved to CONFIRMAR`);
    } catch (e) {
      console.warn("Could not update in-memory session:", e.message);
    }

    return res.json({
      success: true,
      message: "Taxa aplicada e mensagem enviada ao cliente",
      data: { orderId: order._id, deliveryFee: fee, newTotal },
    });
  } catch (err) {
    console.error("Erro ao definir taxa de entrega:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;