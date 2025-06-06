const express = require('express');
const router = express.Router();
const {
  createService,
  getVendorServices,
  updateService,
  deleteService,
  getServicesByCategory,
  searchServices
} = require('../controllers/service.Controller');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadMultipleImages } = require('../middleware/uploadMiddleware');

router.post(
  '/', 
  protect, 
  authorize('vendor'), 
  uploadMultipleImages, 
  createService
);
router.get('/vendor/:vendorId', getVendorServices);
router.put(
  '/:id', 
  protect, 
  authorize('vendor'), 
  uploadMultipleImages, 
  updateService
);
router.delete('/:id', protect, authorize('vendor'), deleteService);
router.get('/category/:category', getServicesByCategory);
router.get('/search', searchServices);

module.exports = router;