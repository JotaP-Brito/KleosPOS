const express = require('express');
const Category = require('../models/Category');
const { isVerifiedUser } = require('../middlewares/tokenVerification');
const admin = require('../middlewares/adminMiddleware');

const router = express.Router();

// @desc    Get all categories
// @route   GET /api/category
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.find({}).lean();
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create a category
// @route   POST /api/category
// @access  Private/Admin
router.post('/', isVerifiedUser, admin, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const category = await Category.create({ name, description });
    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
