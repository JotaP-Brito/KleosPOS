const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const { default: mongoose } = require("mongoose");
const axios = require("axios");

// Helpers de WhatsApp (mantidos iguais)...
const OPENWA_BASE = process.env.OPENWA_URL || "http://localhost:2785";
const OPENWA_KEY  = process.env.OPENWA_API_KEY || "dev-admin-key";

async function sendWhatsAppMessage(chatId, text, sessionId) { /* igual */ }
async function notifyCustomerOrderReady(order) { /* igual */ }
async function notifyDeliveryEmployee(order) { /* igual */ }

const addOrder = async (req, res, next) => { /* igual */ };

const getOrderById = async (req, res, next) => { /* igual */ };

const getOrders = async (req, res, next) => { /* igual */ };

const updateOrder = async (req, res, next) => { /* igual */ };

const updateOrderPayment = async (req, res, next) => { /* igual */ };

// 🆕 Cobrar itens selecionados
const chargeOrderItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { itemIndexes } = req.body;   // array de índices

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "ID do pedido inválido"));
    }

    const order = await Order.findById(id);
    if (!order) {
      return next(createHttpError(404, "Pedido não encontrado"));
    }

    // Mescla os índices novos com os já existentes (evita duplicados)
    const currentPaid = order.paidItems || [];
    const newPaid = [...new Set([...currentPaid, ...itemIndexes])];
    order.paidItems = newPaid;

    // Atualiza status do pagamento
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

module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  updateOrderPayment,
  chargeOrderItems,   // 🆕
};