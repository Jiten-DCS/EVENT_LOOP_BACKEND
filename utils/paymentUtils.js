const razorpay = require('../config/razorpay');

exports.createRazorpayOrder = async (vendorId, amount) => {
  const options = {
    amount: amount * 100, // amount in the smallest currency unit (paise)
    currency: 'INR',
    receipt: `order_${Date.now()}`,
    payment_capture: 1
  };

  const order = await razorpay.orders.create(options);
  return order;
};

exports.verifyRazorpaySignature = (body, secret) => {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
    .digest('hex');

  return expectedSignature === body.razorpay_signature;
};