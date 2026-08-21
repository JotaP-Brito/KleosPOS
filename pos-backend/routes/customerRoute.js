const express = require("express");
const router = express.Router();
const Order = require("../models/orderModel");

// GET /api/customer/:phone/orders
router.get("/:phone/orders", async (req, res) => {
  try {
    const { phone } = req.params;
    const orders = await Order.find({ "customerDetails.phone": phone })
      .sort({ orderDate: -1 })
      .select("orderDate orderType paymentMethod paymentStatus bills.totalWithTax items.name items.quantity items.additions")
      .limit(50)
      .lean();
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
