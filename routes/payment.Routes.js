const express = require('express');
const router = express.Router();
const {
  createRazorpayOrder,
  verifyPayment
} = require('../controllers/payment.Controller');
const { protect } = require('../middleware/authMiddleware');

router.post('/create-order', protect, createRazorpayOrder);
router.post('/verify', protect, verifyPayment);

module.exports = router;