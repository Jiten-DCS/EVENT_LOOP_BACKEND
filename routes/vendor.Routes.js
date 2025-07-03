const express = require('express');
const router = express.Router();
const {
  getVendors,
  getVendor,
  updateVendor,
  uploadGalleryImages,
  deleteGalleryImage
} = require('../controllers/vendor.Controller');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadMultipleImages } = require('../middleware/uploadMiddleware');

// Get all vendors (public)
router.get('/', getVendors);

// Get specific vendor (public)
router.get('/:id', getVendor);

// Update vendor (protected)
router.put('/:id', protect, authorize('vendor', 'admin'), updateVendor);

// Upload gallery images (protected)
router.post(
  '/:id/gallery',
  protect,
  authorize('vendor'),
  uploadMultipleImages,
  uploadGalleryImages
);

// Delete gallery image (protected)
router.delete('/:id/gallery/delete', protect, authorize('vendor'), deleteGalleryImage);

module.exports = router;
