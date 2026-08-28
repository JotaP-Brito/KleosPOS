const express = require("express");
const { getPinStatus, setupPin, login, getUserData, logout } = require("../controllers/userController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();


// Single-admin PIN authentication
router.route("/pin-status").get(getPinStatus);
router.route("/setup-pin").post(setupPin);
router.route("/login").post(login);
router.route("/logout").post(isVerifiedUser, logout)

router.route("/").get(isVerifiedUser , getUserData);
router.route("/kitchen-auth").post(require("../controllers/userController").kitchenAuth);

module.exports = router;
