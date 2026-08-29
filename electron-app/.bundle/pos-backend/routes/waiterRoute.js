const express = require("express");
const { requireWaiterKey, getMenu, createOrder } = require("../controllers/waiterController");

const router = express.Router();
router.use(requireWaiterKey);
router.get("/menu", getMenu);
router.post("/orders", createOrder);

module.exports = router;
