const mongoose = require("mongoose");

const trackedOrderSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  customerName: String,
  items: [{ name: String, price: Number, quantity: Number, observation: String, additions: [] }],
  orderType: { type: String, enum: ["Dine-in", "Takeaway", "Delivery"] },
  deliveryAddress: String,
  paymentMethod: String,
  total: Number,
  originalMessage: String,
  parsedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("TrackedOrder", trackedOrderSchema);