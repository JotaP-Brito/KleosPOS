const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: String,
  whatsappChatId: String,          // e.g. "5511999999999@c.us"
  lastOrderDate: Date,
  orderCount: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  optedOut: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Customer", customerSchema);