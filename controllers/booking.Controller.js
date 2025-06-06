const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/emailSender');

// @desc    Create booking
// @route   POST /api/bookings
// @access  Private
exports.createBooking = async (req, res, next) => {
  try {
    const { vendorId, serviceId, message, date } = req.body;

    // Get service to get price
    const service = await Service.findById(serviceId);
    if (!service) {
      return next(new ErrorResponse('Service not found', 404));
    }

    // Check if vendor exists and is approved
    const vendor = await User.findById(vendorId);
    if (!vendor || vendor.role !== 'vendor' || !vendor.isApproved) {
      return next(new ErrorResponse('Vendor not found', 404));
    }

    // Create booking
    const booking = await Booking.create({
      user: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      vendor: vendorId,
      service: serviceId,
      message,
      date,
      amount: service.price
    });

    // Send notification email to vendor
    const messageToVendor = `You have a new booking request from ${req.user.name} for ${service.title} on ${date}.`;
    await sendEmail({
      email: vendor.email,
      subject: 'New Booking Request',
      message: messageToVendor
    });

    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get vendor's bookings
// @route   GET /api/bookings/vendor/:id
// @access  Private (Vendor only)
exports.getVendorBookings = async (req, res, next) => {
  try {
    // Check if vendor is the owner of the bookings
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to access these bookings', 403));
    }

    const bookings = await Booking.find({ vendor: req.params.id })
      .populate('user', 'name email')
      .populate('service', 'title price');

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user's bookings
// @route   GET /api/bookings/user/:id
// @access  Private (User only)
exports.getUserBookings = async (req, res, next) => {
  try {
    // Check if user is the owner of the bookings
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to access these bookings', 403));
    }

    const bookings = await Booking.find({ user: req.params.id })
      .populate('vendor', 'name email')
      .populate('service', 'title price');

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update booking status
// @route   PUT /api/bookings/:id/status
// @access  Private (Vendor only)
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return next(new ErrorResponse('Booking not found', 404));
    }

    // Check if vendor is the owner of the booking
    if (booking.vendor.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to update this booking', 403));
    }

    booking.status = status;
    await booking.save();

    // Send notification email to user
    const messageToUser = `Your booking status has been updated to ${status} by ${req.user.name}.`;
    await sendEmail({
      email: booking.userEmail,
      subject: 'Booking Status Update',
      message: messageToUser
    });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    next(err);
  }
};