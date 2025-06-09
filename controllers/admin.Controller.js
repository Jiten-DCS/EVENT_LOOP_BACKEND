const User = require('../models/User');
const Category = require('../models/Category');
const Offer = require('../models/Offer');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/emailSender');

// @desc    Get all vendors (for admin)
// @route   GET /api/admin/vendors
// @access  Private (Admin only)
exports.getVendors = async (req, res, next) => {
  try {
    const vendors = await User.find({ role: 'vendor' }).select('-password');

    res.status(200).json({
      success: true,
      count: vendors.length,
      data: vendors
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Approve/reject vendor
// @route   PUT /api/admin/vendors/:id/approve
// @access  Private (Admin only)
exports.approveVendor = async (req, res, next) => {
  try {
    const { isApproved } = req.body;

    const vendor = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved },
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!vendor || vendor.role !== 'vendor') {
      return next(new ErrorResponse('Vendor not found', 404));
    }

    // Send notification email to vendor
    const message = `Your vendor account has been ${isApproved ? 'approved' : 'rejected'} by the admin.`;
    await sendEmail({
      email: vendor.email,
      subject: 'Vendor Account Status Update',
      message
    });

    res.status(200).json({
      success: true,
      data: vendor
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create category
// @route   POST /api/admin/categories
// @access  Private (Admin only)
exports.createCategory = async (req, res, next) => {
  try {
    const { title } = req.body;

    // Ensure subCategories is an array
    let subCategories = req.body.subCategories;
    if (!subCategories) subCategories = [];
    else if (typeof subCategories === 'string') {
      // Try parsing JSON array format, e.g. '["a","b"]'
      try {
        const parsed = JSON.parse(subCategories);
        subCategories = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Fallback: comma-separated string
        subCategories = subCategories.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    console.log({ title, subCategories });

    // Check for uploaded image
    if (!req.file) {
      return next(new ErrorResponse('Please upload a category image', 400));
    }

    const category = await Category.create({
      title,
      subCategories,
      image: req.file.path
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (err) {
    next(err);
  }
};


// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Public
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all offers
// @route   GET /api/admin/offers
// @access  Public
exports.getOffers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, active } = req.query;
    
    let filter = {};
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }
    
    // Only show offers that are still valid
    filter.validTill = { $gte: new Date() };

    const offers = await Offer.find(filter)
      .populate('vendor', 'name email')
      .populate('service', 'title category location')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Offer.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: offers.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: offers
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single offer
// @route   GET /api/admin/offers/:id
// @access  Public
exports.getOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate('vendor', 'name email phone')
      .populate('service', 'title description category subCategory location phone images');

    if (!offer) {
      return next(new ErrorResponse('Offer not found', 404));
    }

    res.status(200).json({
      success: true,
      data: offer
    });
  } catch (err) {
    next(err);
  }
};