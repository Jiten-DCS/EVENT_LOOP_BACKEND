const Review = require('../models/Review');
const Service = require('../models/Service');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all reviews for a service
// @route   GET /api/reviews/service/:serviceId
// @access  Public
exports.getServiceReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ service: req.params.serviceId })
      .populate('user', 'name profilePhoto')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all reviews for a vendor
// @route   GET /api/reviews/vendor/:vendorId
// @access  Public
exports.getVendorReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ vendor: req.params.vendorId })
      .populate('user', 'name profilePhoto')
      .populate('service', 'title')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add review
// @route   POST /api/reviews
// @access  Private (User only)
exports.addReview = async (req, res, next) => {
  try {
    const { serviceId, rating, comment } = req.body;

    // Check if user has booked this service
    const hasBooked = await Booking.exists({
      user: req.user.id,
      service: serviceId,
      status: 'completed'
    });

    if (!hasBooked && req.user.role !== 'admin') {
      return next(
        new ErrorResponse('You can only review services you have booked', 400)
      );
    }

    // Get service to get vendor info
    const service = await Service.findById(serviceId);
    if (!service) {
      return next(new ErrorResponse('Service not found', 404));
    }

    const review = await Review.create({
      user: req.user.id,
      service: serviceId,
      vendor: service.vendor,
      rating,
      comment
    });

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private (User only)
exports.updateReview = async (req, res, next) => {
  try {
    let review = await Review.findById(req.params.id);

    if (!review) {
      return next(new ErrorResponse('Review not found', 404));
    }

    // Make sure review belongs to user or user is admin
    if (
      review.user.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(new ErrorResponse('Not authorized to update this review', 401));
    }

    review = await Review.findByIdAndUpdate(
      req.params.id,
      { rating: req.body.rating, comment: req.body.comment },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private (User or Admin)
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return next(new ErrorResponse('Review not found', 404));
    }

    // Make sure review belongs to user or user is admin
    if (
      review.user.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return next(new ErrorResponse('Not authorized to delete this review', 401));
    }

    await review.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};