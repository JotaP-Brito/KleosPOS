const express = require("express");
const {
  addOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateOrderPayment,   // 👈 nova função
  saveOrderSplits,
  payOrderSplit,
} = require("../controllers/orderController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();

router.route("/").post(isVerifiedUser, addOrder);
router.route("/").get(isVerifiedUser, getOrders);
router.route("/:id").get(isVerifiedUser, getOrderById);
router.route("/:id").put(isVerifiedUser, updateOrder);
router.route("/:id/payment").put(isVerifiedUser, updateOrderPayment);  // 👈 nova rota
router.route("/:id/splits").put(isVerifiedUser, saveOrderSplits);
router.route("/:id/splits/:splitId/pay").put(isVerifiedUser, payOrderSplit);

module.exports = router;