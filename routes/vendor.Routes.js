// routes/vendorRoutes.js
const express = require('express');
const router = express.Router();
const {
  getVendors,
  getVendor,
  updateVendor,
  uploadGalleryImages
} = require('../controllers/vendor.Controller'); // Make sure case matches your file name
const { protect, authorize } = require('../middleware/authMiddleware'); // Correct path
const { uploadMultipleImages } = require('../middleware/uploadMiddleware');

router.get('/', getVendors);
router.get('/:id', getVendor);
router.put('/:id', protect, authorize('vendor', 'admin'), updateVendor);
router.post(
  '/:id/gallery',
  protect,
  authorize('vendor'),
  uploadMultipleImages,
  uploadGalleryImages
);

module.exports = router;