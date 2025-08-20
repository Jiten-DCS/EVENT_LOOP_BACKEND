const express = require('express');
const router = express.Router();
const {
  createBooking,
  getVendorBookings,
  getUserBookings,
  updateBookingStatus,
  checkAvailability
} = require('../controllers/booking.Controller');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, createBooking);
router.get("/checkAvailability", checkAvailability);
router.get('/vendor/:id', protect, authorize('vendor', 'admin'), getVendorBookings);
router.get('/user/:id', protect, authorize('user', 'admin'), getUserBookings);
router.put('/:id/status', protect, authorize('vendor', 'admin'), updateBookingStatus);

module.exports = router;