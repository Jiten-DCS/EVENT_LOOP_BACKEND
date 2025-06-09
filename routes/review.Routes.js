const express = require('express');
const router = express.Router();
const {
  getServiceReviews,
  getVendorReviews,
  addReview,
  updateReview,
  deleteReview
} = require('../controllers/review.Controller');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/service/:serviceId', getServiceReviews);
router.get('/vendor/:vendorId', getVendorReviews);
router.post('/', protect, authorize('user', 'admin'), addReview);
router.put('/:id', protect, authorize('user', 'admin'), updateReview);
router.delete('/:id', protect, authorize('user', 'admin'), deleteReview);

module.exports = router;