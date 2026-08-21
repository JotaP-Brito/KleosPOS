const express = require("express");
const Order = require("../models/orderModel");
const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/userModel");
const Table = require("../models/tableModel");
const DailySummary = require("../models/DailySummary");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const admin = require("../middlewares/adminMiddleware");

const router = express.Router();

// @desc    Get dashboard metrics (absolute totals for today – no subtraction)
// @route   GET /api/summary/metrics
router.get("/metrics", async (req, res, next) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const nonCancelledToday = { orderDate: { $gte: startOfToday }, orderStatus: { $ne: "Cancelled" } };
    // These are independent read operations. Running them together avoids serial
    // database latency every time the dashboard refreshes.
    const [
      ordersToday,
      revenueData,
      completedToday,
      activeOrders,
      ordersReady,
      avgTimeData,
      totalCustomers,
      totalCategories,
      totalDishes,
    ] = await Promise.all([
      Order.countDocuments(nonCancelledToday),
      Order.aggregate([
        { $match: nonCancelledToday },
        { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
      ]),
      Order.countDocuments({ orderStatus: "Completed", updatedAt: { $gte: startOfToday } }),
      Order.countDocuments({ orderStatus: { $nin: ["Completed", "Cancelled"] } }),
      Order.countDocuments({ orderStatus: "Ready" }),
      Order.aggregate([
        { $match: { readyAt: { $gte: startOfToday, $ne: null }, orderStatus: { $ne: "Cancelled" } } },
        { $project: { timeDiff: { $subtract: ["$readyAt", "$orderDate"] } } },
        { $group: { _id: null, average: { $avg: "$timeDiff" } } },
      ]),
      User.countDocuments(),
      Category.countDocuments(),
      Product.countDocuments(),
    ]);
    const revenueToday = revenueData[0]?.total || 0;
    const averageTime = avgTimeData.length ? Math.round(avgTimeData[0].average / 60000) : 0;

    res.status(200).json({
      success: true,
      data: {
        ordersToday,
        activeOrders,
        ordersReady,
        completedToday,
        averageTime,
        revenue: revenueToday,
        customers: totalCustomers,
        categories: totalCategories,
        dishes: totalDishes,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get daily history
// @route   GET /api/summary/history
router.get("/history", async (req, res, next) => {
  try {
    const history = await DailySummary.find().sort({ date: -1 }).limit(30).lean();
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

// @desc    Get item sales report for a specific day
// @route   GET /api/summary/items-report?date=YYYY-MM-DD
router.get("/items-report", async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: "Data não fornecida" });
    }

    // LOCAL midnight (no 'Z') → matches restaurant timezone
    const start = new Date(date + "T00:00:00.000");
    const end = new Date(date + "T23:59:59.999");

    const report = await Order.aggregate([
      { $match: { orderDate: { $gte: start, $lt: end }, orderStatus: { $ne: "Cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          quantidade: { $sum: { $ifNull: ["$items.quantity", 1] } },
          receita: {
            $sum: {
              $multiply: [
                "$items.price",
                { $ifNull: ["$items.quantity", 1] }
              ]
            }
          }
        }
      },
      { $sort: { quantidade: -1 } }
    ]);

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

// @desc    Manual reset (admin)
// @route   POST /api/summary/reset
// @access  Private/Admin
router.post("/reset", isVerifiedUser, admin, async (req, res, next) => {
  try {
    const today = new Date();
    const dateStr = getLocalDateStr(today);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const nonCancelledPeriod = { orderDate: { $gte: start, $lt: end }, orderStatus: { $ne: "Cancelled" } };
    const [orderCount, revenueData, completedCount, cashCount, cardCount, pixCount, avgTimeData] = await Promise.all([
      Order.countDocuments(nonCancelledPeriod),
      Order.aggregate([
        { $match: nonCancelledPeriod },
        { $group: { _id: null, total: { $sum: "$bills.totalWithTax" } } },
      ]),
      Order.countDocuments({ orderStatus: "Completed", updatedAt: { $gte: start, $lt: end } }),
      Order.countDocuments({ ...nonCancelledPeriod, paymentStatus: "Paid", paymentMethod: "Dinheiro" }),
      Order.countDocuments({ ...nonCancelledPeriod, paymentStatus: "Paid", paymentMethod: "Cartão" }),
      Order.countDocuments({ ...nonCancelledPeriod, paymentStatus: "Paid", paymentMethod: "Pix" }),
      Order.aggregate([
        { $match: { readyAt: { $gte: start, $lt: end, $ne: null }, orderStatus: { $ne: "Cancelled" } } },
        { $project: { timeDiff: { $subtract: ["$readyAt", "$orderDate"] } } },
        { $group: { _id: null, average: { $avg: "$timeDiff" } } },
      ]),
    ]);
    const revenue = revenueData[0]?.total || 0;
    const averageTimeMinutes = avgTimeData.length
      ? Math.round(avgTimeData[0].average / 60000)
      : 0;

    await DailySummary.findOneAndUpdate(
      { date: dateStr },
      {
        orderCount,
        revenue,
        completedCount,
        averageTimeMinutes,
        cashCount,
        cardCount,
        pixCount,
        resetAt: new Date(),
      },
      { upsert: true }
    );

    res.status(200).json({ success: true, message: "Dia encerrado! Métricas guardadas." });
  } catch (error) {
    next(error);
  }
});

// @desc    Tables status
// @route   GET /api/summary/tables-status
router.get("/tables-status", async (req, res, next) => {
  try {
    const total = await Table.countDocuments();
    const available = await Table.countDocuments({ status: "Available" });
    res.status(200).json({ success: true, data: { total, available } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
