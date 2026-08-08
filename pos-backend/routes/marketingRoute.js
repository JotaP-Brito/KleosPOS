const express = require("express");
const router = express.Router();
const { sendInactivityPromos } = require("../utils/marketingScheduler");

// POST /api/marketing/send-inactive-promos
router.post("/send-inactive-promos", async (req, res) => {
  try {
    await sendInactivityPromos();
    res.json({ status: "ok", message: "Inactive customer promos sent" });
  } catch (err) {
    console.error("Error sending promos:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;