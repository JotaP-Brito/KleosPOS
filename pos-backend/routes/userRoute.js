const express = require("express");
const { register, login, getUserData, logout } = require("../controllers/userController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();


// Authentication Routes
router.route("/register").post(register);
router.route("/login").post(login);
router.route("/logout").post(isVerifiedUser, logout)

router.route("/").get(isVerifiedUser , getUserData);
router.route("/kitchen-auth").post(require("../controllers/userController").kitchenAuth);

module.exports = router;