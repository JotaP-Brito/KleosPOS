const mongoose = require("mongoose");

const dailySummarySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true },
    orderCount: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
    averageTimeMinutes: { type: Number, default: 0 },
    // Novos campos para métodos de pagamento
    cashCount: { type: Number, default: 0 },
    cardCount: { type: Number, default: 0 },
    pixCount:  { type: Number, default: 0 },
    resetAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DailySummary", dailySummarySchema);