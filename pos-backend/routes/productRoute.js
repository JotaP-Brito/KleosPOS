const express = require('express');
const Product = require('../models/Product');
const { isVerifiedUser } = require('../middlewares/tokenVerification');
const admin = require('../middlewares/adminMiddleware');

const router = express.Router();

console.log('✅ productRoute.js loaded');
console.log('Product model type:', typeof Product);
console.log('isVerifiedUser type:', typeof isVerifiedUser);
console.log('admin type:', typeof admin);

// @desc    Get all products
// @route   GET /api/product
// @access  Public
router.get('/', async (req, res, next) => {
  console.log('🔥 GET /api/product hit');
  try {
    const products = await Product.find({});
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create a new product
// @route   POST /api/product
// @access  Private/Admin
// TEMPORARILY remove middleware for testing
router.post('/', /* isVerifiedUser, admin, */ async (req, res, next) => {
  console.log('🔥 POST /api/product hit');
  console.log('Request body:', req.body);
  try {
    const { name, price, category, description, image } = req.body;

    const product = await Product.create({
      name,
      price,
      category,
      description,
      image,
    });

    console.log('✅ Product created:', product);
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('❌ Error creating product:', error.message);
    next(error);
  }
});

// Optional: PUT and DELETE routes (also bypass middleware for testing)
router.put('/:id', /* isVerifiedUser, admin, */ async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', /* isVerifiedUser, admin, */ async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, message: 'Product removed' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;