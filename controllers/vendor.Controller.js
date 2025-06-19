const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { cloudinary } = require('../config/cloudinary');
const Offer = require('../models/Offer');
const Service = require('../models/Service');

// @desc    Get all approved vendors
// @route   GET /api/vendors
// @access  Public
exports.getVendors = async (req, res, next) => {
  console.log("getVendors")
  try {
    const vendors = await User.find({ 
      role: 'vendor', 
      isApproved: true 
    }).select('-password');


    res.status(200).json({
      success: true,
      count: vendors.length,
      data: vendors
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single vendor
// @route   GET /api/vendors/:id
// @access  Public
exports.getVendor = async (req, res, next) => {
  try {
    const vendor = await User.findById(req.params.id)
      .select('-password')
      .populate('services');

    if (!vendor || vendor.role !== 'vendor' || !vendor.isApproved) {
      return next(new ErrorResponse('Vendor not found', 404));
    }

    res.status(200).json({
      success: true,
      data: vendor
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update vendor profile
// @route   PUT /api/vendors/:id
// @access  Private (Vendor only)
exports.updateVendor = async (req, res, next) => {
  try {
    // Check if user is the owner of the profile
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to update this profile', 403));
    }

    const { name, description, category } = req.body;

    const vendor = await User.findByIdAndUpdate(
      req.params.id,
      { name, description, category },
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: vendor
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload vendor gallery images
// @route   POST /api/vendors/:id/gallery
// @access  Private (Vendor only)
exports.uploadGalleryImages = async (req, res, next) => {
  try {
    // Check if user is the owner of the profile
    if (req.user.id !== req.params.id) {
      return next(new ErrorResponse('Not authorized to update this profile', 403));
    }

    if (!req.files) {
      return next(new ErrorResponse('Please upload images', 400));
    }

    const vendor = await User.findById(req.params.id);

    // Upload images to Cloudinary
    const uploadPromises = req.files.map(file => {
      return cloudinary.uploader.upload(file.path, {
        folder: 'event-manager/gallery'
      });
    });

    const results = await Promise.all(uploadPromises);
    const images = results.map(result => result.secure_url);

    // Add images to vendor gallery
    vendor.galleryImages = [...vendor.galleryImages, ...images];
    await vendor.save();

    res.status(200).json({
      success: true,
      data: vendor.galleryImages
    });
  } catch (err) {
    next(err);
  }
};


// @desc    Create new offer
// @route   POST /api/offers
// @access  Private (Vendor only)
exports.createOffer = async (req, res, next) => {
  try {
    const {
      service,
      title,
      description,
      originalPrice,
      discountPercentage,
      validFrom,
      validTill
    } = req.body;

    // Check if image was uploaded
    if (!req.file) {
      return next(new ErrorResponse('Please upload an offer banner image', 400));
    }

    // Verify service belongs to the vendor
    const serviceDoc = await Service.findById(service);
    if (!serviceDoc) {
      return next(new ErrorResponse('Service not found', 404));
    }

    if (serviceDoc.vendor.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized to create offer for this service', 401));
    }

    // Deactivate all existing offers for this service
    const deactivatedOffers = await Offer.updateMany(
      { 
        service: service,
        vendor: req.user.id,
        isActive: true 
      },
      { 
        isActive: false,
        updatedAt: new Date()
      }
    );

    if (deactivatedOffers.modifiedCount > 0) {
      console.log(`Deactivated ${deactivatedOffers.modifiedCount} existing offer(s) for service ${service}`);
    }

    // Calculate discounted price
const discountedPrice = Math.round(originalPrice * (1 - discountPercentage / 100));


    // Create the new offer
    const offer = await Offer.create({
      vendor: req.user.id,
      service,
      title,
      description,
      bannerImage: req.file.path, // Cloudinary URL
      originalPrice,
      discountedPrice,
      discountPercentage,
      validFrom,
      validTill,
      isActive: true // Explicitly set as active
    });

    res.status(201).json({
      success: true,
      message: deactivatedOffers.modifiedCount > 0 
        ? `Previous ${deactivatedOffers.modifiedCount} offer(s) deactivated and new offer created` 
        : 'Offer created successfully',
      data: offer
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get vendor's offers
// @route   GET /api/offers/my-offers
// @access  Private (Vendor only)
exports.getMyOffers = async (req, res, next) => {
  try {
    const offers = await Offer.find({ vendor: req.user.id })
      .populate('service', 'title category')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: offers.length,
      data: offers
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update offer
// @route   PUT /api/offers/:id
// @access  Private (Vendor only)
exports.updateOffer = async (req, res, next) => {
  try {
    let offer = await Offer.findById(req.params.id);

    if (!offer) {
      return next(new ErrorResponse('Offer not found', 404));
    }

    // Ensure only the vendor who created the offer can update it
    if (offer.vendor.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this offer', 401));
    }

    // If a new image was uploaded, include it
    if (req.file) {
      req.body.bannerImage = req.file.path;
    }

    // Validate dates
    const validFrom = req.body.validFrom ? new Date(req.body.validFrom) : offer.validFrom;
    const validTill = req.body.validTill ? new Date(req.body.validTill) : offer.validTill;
    if (validTill <= validFrom) {
      return next(new ErrorResponse('End date must be after start date', 400));
    }

    // Resolve prices
    const originalPrice = req.body.originalPrice || offer.originalPrice;
    const discountPercentage = req.body.discountPercentage || offer.discountPercentage;

    // Calculate and set discountedPrice
    const discountedPrice = Math.round(originalPrice * (1 - discountPercentage / 100));

    if (discountedPrice >= originalPrice) {
      return next(new ErrorResponse('Discounted price must be less than original price', 400));
    }

    req.body.discountedPrice = discountedPrice;

    // Proceed with update
    offer = await Offer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      message: 'Offer updated successfully',
      data: offer
    });

  } catch (err) {
    next(err);
  }
};


// @desc    Delete offer
// @route   DELETE /api/offers/:id
// @access  Private (Vendor only)
exports.deleteOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return next(new ErrorResponse('Offer not found', 404));
    }

    // Make sure user is offer owner
    if (offer.vendor.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this offer', 401));
    }

    await offer.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle offer status
// @route   PUT /api/offers/:id/toggle-status
// @access  Private (Vendor only)
exports.toggleOfferStatus = async (req, res, next) => {
  try {
    let offer = await Offer.findById(req.params.id);

    if (!offer) {
      return next(new ErrorResponse('Offer not found', 404));
    }

    // Make sure user is offer owner
    if (offer.vendor.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this offer', 401));
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    res.status(200).json({
      success: true,
      data: offer
    });
  } catch (err) {
    next(err);
  }
};