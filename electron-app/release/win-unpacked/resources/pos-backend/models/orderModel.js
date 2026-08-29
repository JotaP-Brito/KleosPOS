const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
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
    deliveryFee: {
        type: Number,
        default: 0,
    },
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
        enum: ["Pending", "PendingDeliveryFee", "PartiallyPaid", "Paid"],
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
    // 🆕 Itens já cobrados (índices)
    paidItems: {
        type: [Number],
        default: [],
    },
}, { timestamps: true });

// Covers the order board, dashboard, customer history, and daily-summary queries.
orderSchema.index({ orderDate: -1 });
orderSchema.index({ orderStatus: 1, orderDate: -1 });
orderSchema.index({ "customerDetails.phone": 1, orderDate: -1 });
orderSchema.index({ paymentStatus: 1, paymentMethod: 1, orderDate: -1 });
orderSchema.index({ readyAt: 1, orderStatus: 1 });

module.exports = mongoose.model("Order", orderSchema);
