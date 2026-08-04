const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    paymentStatus: {
    type: String,
    enum: ["Pending", "PendingDeliveryFee", "PartiallyPaid", "Paid"],
    default: "Pending",
  },

  splits: [
    {
      name: { type: String, required: true },
      amount: { type: Number, required: true },
      items: [
        {
          name: String,
          price: Number,
          quantity: Number,
          additions: [],
          observation: String,
        },
      ],
      paymentStatus: {
        type: String,
        enum: ["Pending", "Paid"],
        default: "Pending",
      },
    },
  ],
    customerDetails: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        guests: { type: Number, default: 1 },
    },
    orderType: {
        type: String,
        enum: ["Dine-in", "Takeaway", "Delivery"],
        default: "Dine-in",
        required: true,
    },
    deliveryAddress: {
        type: String,
        default: "",
    },
    // ✅ Delivery fee set by employee in POS
    deliveryFee: {
        type: Number,
        default: 0,
    },
    // ✅ NEW: troco information
    changeNeeded: {
        type: Boolean,
        default: false,
    },
    changeFor: {
        type: Number,
        default: 0,
    },
    orderStatus: {
        type: String,
        required: true,
    },
    orderDate: {
        type: Date,
        default: Date.now,
    },
    readyAt: {
        type: Date,
        default: null,
    },
    bills: {
        total: { type: Number, required: true },
        tax: { type: Number, required: true },
        totalWithTax: { type: Number, required: true },
    },
    items: [],
    table: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table",
        default: null,
    },
    isStanding: {
        type: Boolean,
        default: false,
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "PendingDeliveryFee", "Paid"],
        default: "Pending",
    },
    paymentMethod: String,
    whatsappChatId: {
        type: String,
        default: "",
    },
    paymentData: {
        razorpay_order_id: String,
        razorpay_payment_id: String,
    },
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);