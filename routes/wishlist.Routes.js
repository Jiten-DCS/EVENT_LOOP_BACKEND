const express = require('express');
const router = express.Router();
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist
} = require('../controllers/wishlist.Controller');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getWishlist);
router.post('/:serviceId', protect, addToWishlist);
router.delete('/:serviceId', protect, removeFromWishlist);

module.exports = router;