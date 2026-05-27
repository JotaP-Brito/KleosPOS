const mongoose = require("mongoose");

const additionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    price: { type: Number, default: 0 },
    type: { type: String, enum: ["extra", "observation"], default: "extra" },
    // "extra" = item adicional cobrado; "observation" = frase de observação (sem preço)
  },
  { timestamps: true }
);

module.exports = mongoose.model("Addition", additionSchema);