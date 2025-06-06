const Service = require('../models/Service');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { cloudinary } = require('../config/cloudinary');
const Category = require('../models/Category');

// @desc    Create new service
// @route   POST /api/services
// @access  Private (Vendor only)
exports.createService = async (req, res, next) => {
  try {
    // Check if vendor is approved
    if (!req.user.isApproved) {
      return next(new ErrorResponse('Vendor not approved by admin yet', 403));
    }

    const { 
      title, 
      description, 
      minPrice, 
      maxPrice, 
      category, 
      subCategory, 
      tags, 
      location, 
      phone, 
      website,
      socialLinks 
    } = req.body;

    // Validate images
    if (!req.files || req.files.length === 0) {
      return next(new ErrorResponse('Please upload at least one image', 400));
    }

     const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return next(new ErrorResponse('Invalid category', 400));
    }

    // Verify subCategory is valid for this category
    if (!categoryExists.subCategories.includes(subCategory)) {
      return next(new ErrorResponse('Invalid sub-category for selected category', 400));
    }

    // Images are already uploaded by multer-storage-cloudinary
    // req.files contains the array of uploaded file objects, file.path is the Cloudinary URL
    const images = req.files.map(file => file.path);

    const service = await Service.create({
      vendor: req.user.id,
      title,
      description,
      minPrice,
      maxPrice,
      category,
      subCategory,
      tags,
      images,
      location,
      phone,
      website,
      socialLinks
    });

    // Add service to vendor's services array
    await User.findByIdAndUpdate(req.user.id, {
      $push: { services: service._id }
    });

    res.status(201).json({
      success: true,
      data: service
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get vendor's services
// @route   GET /api/services/vendor/:vendorId
// @access  Public
exports.getVendorServices = async (req, res, next) => {
  try {
    const services = await Service.find({ vendor: req.params.vendorId });

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private (Vendor only)
exports.updateService = async (req, res, next) => {
  try {
    let service = await Service.findById(req.params.id);

    if (!service) {
      return next(new ErrorResponse('Service not found', 404));
    }

    // Check if service belongs to the vendor
    if (service.vendor.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this service', 403));
    }

    // Handle image updates if any
    let images = service.images;
    if (req.files && req.files.length > 0) {
      // New images are already uploaded by multer-storage-cloudinary
      // file.path is the Cloudinary URL
      const newImages = req.files.map(file => file.path);
      images = [...service.images, ...newImages];
      
      // Validate total images don't exceed 6
      if (images.length > 6) {
        // It might be better to also remove the newly uploaded images from Cloudinary if this validation fails
        // For now, just returning an error.
        return next(new ErrorResponse('Cannot have more than 6 images. New images were uploaded but not saved to service due to limit.', 400));
      }
    }

    service = await Service.findByIdAndUpdate(
      req.params.id,
      { ...req.body, images },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private (Vendor only)
exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return next(new ErrorResponse('Service not found', 404));
    }

    // Check if service belongs to the vendor
    if (service.vendor.toString() !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this service', 403));
    }

    // Delete images from Cloudinary
    const deletePromises = service.images.map(image => {
      const publicId = image.split('/').pop().split('.')[0];
      return cloudinary.uploader.destroy(`event-manager/services/${publicId}`);
    });

    await Promise.all(deletePromises);

    await service.remove();

    // Remove service from vendor's services array
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { services: service._id }
    });

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get services by category
// @route   GET /api/services/category/:category
// @access  Public
exports.getServicesByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { location, search } = req.query;

    let query = { category };

    // Add location filter if provided
    if (location) {
      query.location = new RegExp(location, 'i');
    }

    // Add text search if provided
    if (search) {
      query.$text = { $search: search };
    }

    const services = await Service.find({ category })
      .populate('vendor', 'name profilePhoto')
      .populate('category', 'title');

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Search services
// @route   GET /api/services/search
// @access  Public
exports.searchServices = async (req, res, next) => {
  try {
    const { q, location, category } = req.query;

    let query = {};

    if (q) {
      query.$text = { $search: q };
    }

    if (location) {
      query.location = new RegExp(location, 'i');
    }

    if (category) {
      query.category = category;
    }

    const services = await Service.find(query)
      .populate('vendor', 'name profilePhoto');

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (err) {
    next(err);
  }
};