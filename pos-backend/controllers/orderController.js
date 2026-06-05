const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");
const axios = require("axios");   // ← added for WhatsApp notification

// ─────────────────────────────────────────────────────────────────
// Helper: send WhatsApp text message via OpenWA
// ─────────────────────────────────────────────────────────────────
const OPENWA_BASE = process.env.OPENWA_URL || "http://localhost:2785";
const OPENWA_KEY  = process.env.OPENWA_API_KEY || "dev-admin-key";

async function sendWhatsAppMessage(chatId, text, sessionId) {
  if (!chatId) return; // silently ignore if we don't have a chatId
  const sid = sessionId || process.env.OPENWA_SESSION_ID || "default";
  try {
    await axios.post(
      `${OPENWA_BASE}/api/sessions/${sid}/messages/send-text`,
      { chatId, text },
      { headers: { "X-API-Key": OPENWA_KEY } }
    );
    console.log(`✅ WhatsApp notification sent to ${chatId}`);
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp message to ${chatId}:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// Send a friendly "ready" message based on order type
// ─────────────────────────────────────────────────────────────────
async function notifyCustomerOrderReady(order) {
  const chatId = order.whatsappChatId;
  if (!chatId) {
    console.log(`⚠️  Order ${order._id} has no whatsappChatId – cannot send ready notification`);
    return;
  }

  let message = "";
  switch (order.orderType) {
    case "Takeaway":
      message = "🛍️ Seu pedido está pronto para retirada! Pode vir buscar. 😋";
      break;
    case "Delivery":
      message = "🛵 Seu pedido está pronto e logo vai estar a caminho! 🚀";
      break;
    case "Dine-in":
      message = "🍽️ Seu pedido está pronto! Bom apetite! 😋👨‍🍳";
      break;
    default:
      message = "🔔 Seu pedido está pronto! 😋";
      break;
  }

  await sendWhatsAppMessage(chatId, message, process.env.OPENWA_SESSION_ID);
}

// ─────────────────────────────────────────────────────────────────
// Existing CRUD functions (unchanged except updateOrder)
// ─────────────────────────────────────────────────────────────────

const addOrder = async (req, res, next) => {
  try {
    console.log("📦 Received order payload:", JSON.stringify(req.body, null, 2));
    const order = new Order(req.body);
    await order.save();
    console.log("✅ Order saved:", order._id);
    res.status(201).json({ success: true, message: "Order created!", data: order });
  } catch (error) {
    console.error("❌ Order creation failed:", error.message);
    if (error.name === "ValidationError") {
      console.error("Validation errors:", Object.keys(error.errors).map(k => `${k}: ${error.errors[k].message}`));
    }
    if (error.name === "CastError") {
      console.error("Cast error:", error.path, error.value);
    }
    console.error("Full error:", error);
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(404, "Invalid id!"));
    }
    const order = await Order.findById(id);
    if (!order) {
      return next(createHttpError(404, "Order not found!"));
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().populate("table");
    res.status(200).json({ data: orders });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "ID inválido"));
    }

    // If the new status is "Ready", record the time (if not already set)
    if (updates.orderStatus === "Ready") {
      const existingOrder = await Order.findById(id);
      if (existingOrder && !existingOrder.readyAt) {
        updates.readyAt = new Date();
      }
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: false }
    );

    if (!order) {
      return next(createHttpError(404, "Pedido não encontrado"));
    }

    // 🔔 Send WhatsApp notification if the order just moved to "Ready"
    if (updates.orderStatus === "Ready") {
      await notifyCustomerOrderReady(order).catch(err =>
        console.error("Error sending ready notification:", err.message)
      );
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const updateOrderPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentMethod } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "ID inválido"));
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { paymentStatus, paymentMethod },
      { new: true, runValidators: true }
    );

    if (!order) {
      return next(createHttpError(404, "Pedido não encontrado"));
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  updateOrderPayment,
};