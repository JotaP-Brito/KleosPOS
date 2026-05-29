// routes/botStatusRoute.js
const express = require("express");
const router = express.Router();

// Global flag – set to true by default
let botActive = true;

// GET current status
router.get("/", (req, res) => {
  res.json({ active: botActive });
});

// POST to toggle
router.post("/toggle", (req, res) => {
  const { active } = req.body;   // true or false
  if (typeof active !== "boolean") {
    return res.status(400).json({ error: "Field 'active' must be boolean" });
  }
  botActive = active;
  console.log(`🟢 Bot status changed to: ${botActive ? "ON" : "OFF"}`);
  res.json({ active: botActive });
});

// Export a helper so the webhook can read the value
router.isBotActive = () => botActive;

module.exports = router;