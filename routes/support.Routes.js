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

router.post('/',protect, createTicket);
// router.get('/categories',protect, getTicketCategories); 

// Protected routes
router.use(protect);

router.get('/',protect, authorize('admin'), getTickets);
router.get('/:id',protect, getTicket);
router.put('/:id/status',protect, authorize('admin'), updateTicketStatus);

module.exports = router;