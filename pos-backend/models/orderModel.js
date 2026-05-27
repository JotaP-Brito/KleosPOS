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
        enum: ["Pending", "Paid"],
        default: "Pending",
    },
    paymentMethod: String,
    paymentData: {
        razorpay_order_id: String,
        razorpay_payment_id: String,
    },
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);