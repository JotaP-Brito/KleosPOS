const express = require("express");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const admin = require("../middlewares/adminMiddleware");

const router = express.Router();
let active = process.env.WHATSAPP_TRACKING_MODE === "true";

router.get("/", isVerifiedUser, admin, (req, res) => res.json({ active, description: active ? "Rastreia pedidos sem responder ao cliente." : "Bot responde normalmente aos clientes." }));
router.post("/toggle", isVerifiedUser, admin, (req, res) => {
  if (typeof req.body.active !== "boolean") return res.status(400).json({ error: "Field 'active' must be boolean" });
  active = req.body.active;
  res.json({ active, description: active ? "Rastreia pedidos sem responder ao cliente." : "Bot responde normalmente aos clientes." });
});
router.isTrackingModeActive = () => active;

module.exports = router;
