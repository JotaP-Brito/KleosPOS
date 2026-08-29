const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");
const axios = require("axios");

// ─────────────────────────────────────────────────────────────────
// WhatsApp helpers (mantidos exatamente como antes)
// ─────────────────────────────────────────────────────────────────
const OPENWA_BASE = process.env.OPENWA_URL || "http://localhost:2785";
const OPENWA_KEY  = process.env.OPENWA_API_KEY || "dev-admin-key";

async function sendWhatsAppMessage(chatId, text, sessionId) {
  if (!chatId) return;
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

async function notifyDeliveryEmployee(order) {
  const deliveryPhone = process.env.DELIVERY_PHONE;
  if (!deliveryPhone) {
    console.log(`⚠️  DELIVERY_PHONE not set – skipping employee notification for order ${order._id}`);
    return;
  }

  const itemLines = order.items.map((item) => {
    let line = `• ${item.quantity || 1}x ${item.name}`;
    if (item.additions?.length) {
      line += ` (+ ${item.additions.map((a) => a.name).join(", ")})`;
    }
    if (item.observation) {
      line += ` [${item.observation}]`;
    }
    return line;
  }).join("\n");

  const total = order.bills?.totalWithTax || order.bills?.total || 0;

  const message = [
    "🛵 *Nova entrega pronta!*",
    "",
    `📦 Pedido #${String(order._id).slice(-6)}`,
    `👤 Cliente: ${order.customerDetails?.name || "N/D"}`,
    "",
    "📋 Itens:",
    itemLines,
    "",
    `🏠 Endereço: ${order.deliveryAddress || "N/D"}`,
    `💰 Total: R$ ${total.toFixed(2)}`,
    `💳 Pagamento: ${order.paymentMethod || "a definir"}`,
    order.changeNeeded ? `🪙 Troco para: R$ ${Number(order.changeFor).toFixed(2)}` : "",
    "",
    "🏍️ Pode iniciar a entrega! 🚀",
  ].filter(Boolean).join("\n");

  await sendWhatsAppMessage(deliveryPhone, message, process.env.OPENWA_SESSION_ID);
  console.log(`📤 Delivery notification sent to ${deliveryPhone} for order ${order._id}`);
}

// ─────────────────────────────────────────────────────────────────
// CRUD functions (originais, completas)
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
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(404, "Invalid id!"));
    }
    const order = await Order.findById(id).lean();
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
    const activeOnly = req.query.active === "true";
    const filter = activeOnly
      ? { orderStatus: { $nin: ["Completed", "Cancelled"] } }
      : {};

    const orders = await Order.find(filter)
      .sort({ orderDate: -1 })
      .populate("table", "tableNo status seats")
      .lean();
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

    if (updates.orderStatus === "Ready") {
      await notifyCustomerOrderReady(order).catch(err =>
        console.error("Error sending customer ready notification:", err.message)
      );

      if (order.orderType === "Delivery") {
        await notifyDeliveryEmployee(order).catch(err =>
          console.error("Error sending delivery employee notification:", err.message)
        );
      }
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

// ─────────────────────────────────────────────────────────────────
// 🆕 Nova função: cobrar itens selecionados
// ─────────────────────────────────────────────────────────────────
const chargeOrderItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { itemIndexes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "ID do pedido inválido"));
    }

    const order = await Order.findById(id);
    if (!order) {
      return next(createHttpError(404, "Pedido não encontrado"));
    }

    const currentPaid = order.paidItems || [];
    const newPaid = [...new Set([...currentPaid, ...itemIndexes])];
    order.paidItems = newPaid;

    if (newPaid.length === 0) {
      order.paymentStatus = "Pending";
    } else if (newPaid.length === order.items.length) {
      order.paymentStatus = "Paid";
    } else {
      order.paymentStatus = "PartiallyPaid";
    }

    await order.save();
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────
module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  updateOrderPayment,
  chargeOrderItems,
};
