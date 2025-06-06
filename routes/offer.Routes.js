const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadSingleImage } = require('../middleware/uploadMiddleware');
const { createOffer, getMyOffers, updateOffer, deleteOffer, toggleOfferStatus } = require('../controllers/vendor.Controller');

// All routes require authentication and vendor role
router.use(protect);
router.use(authorize('vendor'));

router.route('/')
  .post(uploadSingleImage, createOffer);

router.get('/my-offers', getMyOffers);

router.route('/:id')
  .put(uploadSingleImage, updateOffer)
  .delete(deleteOffer);

router.put('/:id/toggle-status', toggleOfferStatus);

module.exports = router;