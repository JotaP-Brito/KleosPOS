const express = require("express");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const {
  getAdditions,
  createAddition,
  updateAddition,
  deleteAddition,
} = require("../controllers/additionController");
const router = express.Router();

router.route("/")
  .get(getAdditions)
  .post(isVerifiedUser, createAddition);

router.route("/:id")
  .put(isVerifiedUser, updateAddition)
  .delete(isVerifiedUser, deleteAddition);

module.exports = router;