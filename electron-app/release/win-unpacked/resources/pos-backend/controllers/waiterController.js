const crypto = require("crypto");
const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const Table = require("../models/tableModel");
const Product = require("../models/Product");
const Addition = require("../models/Addition");

const MAX_ITEMS = 40;

const keysMatch = (received, expected) => {
  const given = Buffer.from(received || "", "utf8");
  const configured = Buffer.from(expected || "", "utf8");
  return given.length === configured.length && crypto.timingSafeEqual(given, configured);
};

const requireWaiterKey = (req, res, next) => {
  const key = process.env.WAITER_APP_KEY;
  if (!key) return next(createHttpError(503, "O pareamento do aplicativo de garçom ainda não foi configurado."));
  if (!keysMatch(req.get("X-Waiter-Key"), key)) return next(createHttpError(401, "Dispositivo não pareado."));
  next();
};

const getMenu = async (req, res, next) => {
  try {
    const [products, additions] = await Promise.all([
      Product.find({}).sort({ category: 1, name: 1 }),
      Addition.find({ type: "extra" }).sort({ name: 1 }),
    ]);
    const categoryNames = [...new Set(products.map((product) => product.category))];
    const categories = categoryNames.map((name) => ({
      id: name.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"),
      name,
      items: products.filter((product) => product.category === name).map((product) => ({
        id: product._id.toString(), name: product.name, price: product.price, isAvailable: product.isAvailable,
      })),
    }));
    res.json({ success: true, categories, additions: additions.map((addition) => ({
      id: addition._id.toString(), name: addition.name, price: addition.price,
    })) });
  } catch (error) {
    next(error);
  }
};

const normalizeItems = async (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > MAX_ITEMS) {
    throw createHttpError(400, "Inclua pelo menos um item válido.");
  }
  const productIds = rawItems.map((item) => item.productId);
  const additionIds = rawItems.flatMap((item) => Array.isArray(item.additionIds) ? item.additionIds : []);
  const [products, additions] = await Promise.all([
    Product.find({ _id: { $in: productIds }, isAvailable: true }),
    Addition.find({ _id: { $in: additionIds }, type: "extra" }),
  ]);
  const productsById = new Map(products.map((product) => [product._id.toString(), product]));
  const additionsById = new Map(additions.map((addition) => [addition._id.toString(), addition]));

  return rawItems.map((rawItem) => {
    const product = productsById.get(String(rawItem.productId));
    if (!product) throw createHttpError(400, "Um dos itens não está disponível para venda.");
    const quantity = Number(rawItem.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30) {
      throw createHttpError(400, `Quantidade inválida para ${product.name}.`);
    }
    const ids = Array.isArray(rawItem.additionIds) ? rawItem.additionIds : [];
    if (ids.length > 15) throw createHttpError(400, "Quantidade de adicionais inválida.");
    const itemAdditions = ids.map((id) => {
      const addition = additionsById.get(String(id));
      if (!addition) throw createHttpError(400, "Adicional inválido.");
      return { name: addition.name, price: addition.price };
    });
    return {
      menuId: product._id.toString(),
      name: product.name,
      price: product.price,
      quantity,
      additions: itemAdditions,
      observation: typeof rawItem.observation === "string" ? rawItem.observation.trim().slice(0, 240) : "",
    };
  });
};

const createOrder = async (req, res, next) => {
  try {
    const orderType = req.body.orderType || "Dine-in";
    if (!["Dine-in", "Takeaway", "Delivery"].includes(orderType)) {
      throw createHttpError(400, "Tipo de pedido inválido.");
    }
    const items = await normalizeItems(req.body.items);
    const total = items.reduce((sum, item) => sum + (item.price + item.additions.reduce((extra, addition) => extra + addition.price, 0)) * item.quantity, 0);
    const customerName = typeof req.body.customerName === "string" ? req.body.customerName.trim().slice(0, 120) : "";
    const customerPhone = typeof req.body.customerPhone === "string" ? req.body.customerPhone.trim().slice(0, 40) : "";
    const deliveryAddress = typeof req.body.deliveryAddress === "string" ? req.body.deliveryAddress.trim().slice(0, 300) : "";
    let table = null;

    if (orderType === "Dine-in") {
      const tableNo = Number(req.body.tableNo);
      if (!Number.isInteger(tableNo) || tableNo < 1 || tableNo > 999) throw createHttpError(400, "Informe uma mesa válida.");
      table = await Table.findOne({ tableNo });
      if (!table) table = await Table.create({ tableNo, seats: 4, status: "Occupied" });
    }
    if (orderType === "Delivery" && !deliveryAddress) throw createHttpError(400, "Informe o endereço de entrega.");

    const defaultName = orderType === "Dine-in" ? `Mesa ${table.tableNo}` : orderType === "Delivery" ? "Pedido delivery" : "Pedido para retirada";
    const order = await Order.create({
      customerDetails: { name: customerName || defaultName, phone: customerPhone || `WAITER-${Date.now()}`, guests: Number(req.body.guests) || 1 },
      orderType,
      deliveryAddress: orderType === "Delivery" ? deliveryAddress : "",
      deliveryFee: orderType === "Delivery" ? Number(req.body.deliveryFee) || 0 : 0,
      orderStatus: "Pending",
      bills: { total, tax: 0, totalWithTax: total + (orderType === "Delivery" ? Number(req.body.deliveryFee) || 0 : 0) },
      items,
      table: table?._id || null,
      paymentStatus: "Pending",
      paymentMethod: typeof req.body.paymentMethod === "string" ? req.body.paymentMethod.slice(0, 40) : "",
    });
    if (table) {
      table.status = "Occupied";
      table.currentOrder = order._id;
      await table.save();
    }
    res.status(201).json({ success: true, message: "Pedido enviado para a cozinha.", data: { orderId: order._id, total: order.bills.totalWithTax, orderType } });
  } catch (error) {
    next(error);
  }
};

module.exports = { requireWaiterKey, getMenu, createOrder };
