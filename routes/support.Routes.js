const express = require('express');
const router = express.Router();
const {
  createTicket,
  getTickets,
  getTicket,
  updateTicketStatus,
  getTicketCategories
} = require('../controllers/support.Controller');
const { protect, authorize } = require('../middleware/authMiddleware');

// Create ticket (protected)
router.post('/', protect, createTicket);

// Get ticket categories (if needed)
// router.get('/categories', protect, getTicketCategories); 

// Get all tickets (admin only)
router.get('/', protect, authorize('admin'), getTickets);

// Get specific ticket
router.get('/:id', protect, getTicket);

// Update ticket status (admin only)
router.put('/:id/status', protect, authorize('admin'), updateTicketStatus);

module.exports = router;
