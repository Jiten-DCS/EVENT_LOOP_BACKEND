const User = require('../models/User');
const Service = require('../models/Service');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
exports.getWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('wishlist');
    
    res.status(200).json({
      success: true,
      data: user.wishlist
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add service to wishlist
// @route   POST /api/wishlist/:serviceId
// @access  Private
exports.addToWishlist = async (req, res, next) => {
  try {
    // Check if service exists
    const service = await Service.findById(req.params.serviceId);
    if (!service) {
      return next(new ErrorResponse('Service not found', 404));
    }

    // Check if already in wishlist
    const user = await User.findById(req.user.id);
    if (user.wishlist.includes(req.params.serviceId)) {
      return next(new ErrorResponse('Service already in wishlist', 400));
    }

    // Add to wishlist
    user.wishlist.push(req.params.serviceId);
    await user.save();

    res.status(200).json({
      success: true,
      data: user.wishlist
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove service from wishlist
// @route   DELETE /api/wishlist/:serviceId
// @access  Private
exports.removeFromWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Check if service is in wishlist
    if (!user.wishlist.includes(req.params.serviceId)) {
      return next(new ErrorResponse('Service not in wishlist', 400));
    }

    // Remove from wishlist
    user.wishlist = user.wishlist.filter(
      serviceId => serviceId.toString() !== req.params.serviceId
    );
    await user.save();

    res.status(200).json({
      success: true,
      data: user.wishlist
    });
  } catch (err) {
    next(err);
  }
};