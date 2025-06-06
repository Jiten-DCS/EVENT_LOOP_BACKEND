const express = require('express');
const router = express.Router();
const {
  getVendors,
  approveVendor,
  createCategory,
  getCategories,
  getOffers,
  getOffer
} = require('../controllers/admin.Controller');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadSingleImage } = require('../middleware/uploadMiddleware');

router.get('/vendors', protect, authorize('admin'), getVendors);
router.put('/vendors/:id/approve', protect, authorize('admin'), approveVendor);

// Category routes with image upload
router.post('/categories', protect, authorize('admin'), uploadSingleImage, createCategory);
router.get('/categories', getCategories);

// Offer routes
router.get('/offers', getOffers);
router.get('/offers/:id', getOffer);

module.exports = router;