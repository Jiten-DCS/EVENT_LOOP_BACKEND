const SupportTicket = require('../models/SupportTicket');
const Category = require('../models/Category');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/emailSender');

// @desc    Create new support ticket
// @route   POST /api/support
// @access  Public
exports.createTicket = async (req, res, next) => {
  try {
    const { name, email, phone, subject, category, description } = req.body;

    // Verify category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return next(new ErrorResponse('Invalid category', 400));
    }

    const ticket = await SupportTicket.create({
      name,
      email,
      phone,
      subject,
      category,
      description,
      user: req.user?.id // Optional - if user is logged in
    });

    // Send confirmation email
    const message = `Your support ticket #${ticket._id} has been received. We'll get back to you soon.`;
    await sendEmail({
      email: ticket.email,
      subject: `Support Ticket Created: ${ticket.subject}`,
      message
    });

    res.status(201).json({
      success: true,
      data: ticket
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all support tickets (admin only)
// @route   GET /api/support
// @access  Private (Admin)
exports.getTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find()
      .populate('category', 'title')
      .populate('user', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single ticket
// @route   GET /api/support/:id
// @access  Private
exports.getTicket = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('category', 'title')
      .populate('user', 'name email');

    if (!ticket) {
      return next(new ErrorResponse('Ticket not found', 404));
    }

    // Only allow admin or ticket owner to view
    if (
      req.user.role !== 'admin' && 
      (!ticket.user || ticket.user._id.toString() !== req.user.id)
    ) {
      return next(new ErrorResponse('Not authorized to view this ticket', 401));
    }

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update ticket status (admin only)
// @route   PUT /api/support/:id/status
// @access  Private (Admin)
exports.updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { status },
      {
        new: true,
        runValidators: true
      }
    ).populate('user', 'name email');

    if (!ticket) {
      return next(new ErrorResponse('Ticket not found', 404));
    }

    // Send status update email if user exists
    if (ticket.user) {
      const message = `Your support ticket #${ticket._id} status has been updated to ${status}.`;
      await sendEmail({
        email: ticket.user.email,
        subject: `Support Ticket Update: ${ticket.subject}`,
        message
      });
    }

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get ticket categories
// @route   GET /api/support/categories
// @access  Public
exports.getTicketCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().select('title slug');

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (err) {
    next(err);
  }
};