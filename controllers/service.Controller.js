const Service = require("../models/Service");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const { cloudinary } = require("../config/cloudinary");
const Category = require("../models/Category");
const mongoose = require("mongoose");
const Offer = require("../models/Offer");
const ServiceVariant = require("../models/ServiceVariant");

// Replace all variants for a service with the new list
const syncVariants = async (serviceId, rawVariants = []) => {
  if (!Array.isArray(rawVariants)) return;

  // Remove old ones
  await ServiceVariant.deleteMany({ service: serviceId });

  // Insert new ones
  const variants = rawVariants.map((v) => ({
    service: serviceId,
    name: v.name,
    unit: v.unit,
    price: Number(v.price),
    minQty: Number(v.minQty) || 1,
    maxQty: v.maxQty ? Number(v.maxQty) : undefined,
    isActive: true,
  }));

  if (variants.length) await ServiceVariant.insertMany(variants);
};

// @desc    Create new service
// @route   POST /api/services
// @access  Private (Vendor only)
exports.createService = async (req, res, next) => {
  try {
    // Check if vendor is approved
    if (!req.user.isApproved) {
      return next(new ErrorResponse("Vendor not approved by admin yet", 403));
    }

    const {
      title,
      description,
      minPrice,
      maxPrice,
      category,
      subCategory,
      location,
      phone,
      website,
      socialLinks,
      details,
      faqs, // <-- NEW
    } = req.body;

    let tags = req.body.tags;

    // Validate images
    if (!req.files || req.files.length === 0) {
      return next(new ErrorResponse("Please upload at least one image", 400));
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return next(new ErrorResponse("Invalid category", 400));
    }

    if (!categoryExists.subCategories.includes(subCategory)) {
      return next(
        new ErrorResponse("Invalid sub-category for selected category", 400)
      );
    }

    // 🏷️ Handle tags
    if (!tags) tags = [];
    else if (typeof tags === "string") {
      try {
        const parsed = JSON.parse(tags);
        tags = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        tags = tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
      }
    }

    // 🔍 Parse details if it's a string
    let parsedDetails = {};
    if (typeof details === "string") {
      try {
        parsedDetails = JSON.parse(details);
      } catch {
        return next(new ErrorResponse("Invalid details format", 400));
      }
    } else if (typeof details === "object" && details !== null) {
      parsedDetails = details;
    }

    // 🔍 Parse faqs if it's a string
    let parsedFaqs = [];
    if (typeof faqs === "string") {
      try {
        parsedFaqs = JSON.parse(faqs);
      } catch {
        return next(new ErrorResponse("Invalid FAQ format", 400));
      }
    } else if (Array.isArray(faqs)) {
      parsedFaqs = faqs;
    }

    // Images are already uploaded by multer-storage-cloudinary
    // req.files contains the array of uploaded file objects, file.path is the Cloudinary URL
    const images = req.files.map((file) => file.path);

    // ✅ Validate each FAQ object
    const isValidFaqs = parsedFaqs.every(
      (faq) =>
        faq.question &&
        faq.answer &&
        typeof faq.question === "string" &&
        typeof faq.answer === "string"
    );
    if (!isValidFaqs) {
      return next(
        new ErrorResponse(
          "Each FAQ must have a valid 'question' and 'answer'",
          400
        )
      );
    }

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
      socialLinks,
      details: parsedDetails,
      faqs: parsedFaqs, // <-- SAVE HERE
    });

    // ➕  NEW
    if (req.body.variants) await syncVariants(service._id, req.body.variants);

    await User.findByIdAndUpdate(req.user.id, {
      $push: { services: service._id },
    });

    await User.findByIdAndUpdate(req.user.id, {
      $push: { services: service._id },
    });

    res.status(201).json({
      success: true,
      data: service,
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
    // Step 1: Fetch services created by the vendor
    const services = await Service.find({ vendor: req.params.vendorId })
      .populate("category", "title")
      .lean();

    const serviceIds = services.map((service) => service._id);

    // Step 2: Fetch active offers for these services
    const offers = await Offer.find({
      service: { $in: serviceIds },
      isActive: true,
      validFrom: { $lte: new Date() },
      validTill: { $gte: new Date() },
    })
      .select("service discountedPrice discountPercentage bannerImage")
      .lean();

    // Step 3: Create offer map
    const offerMap = new Map();
    offers.forEach((offer) => {
      offerMap.set(offer.service.toString(), offer);
    });

    // Step 4: Attach offer to each service
    const enrichedServices = services.map((service) => ({
      ...service,
      offer: offerMap.get(service._id.toString()) || null,
    }));

    // Step 5: Return response
    res.status(200).json({
      success: true,
      count: enrichedServices.length,
      data: enrichedServices,
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
      return next(new ErrorResponse("Service not found", 404));
    }

    if (service.vendor.toString() !== req.user.id) {
      return next(
        new ErrorResponse("Not authorized to update this service", 403)
      );
    }

    // Normalize tags if present
    if (req.body.tags) {
      if (typeof req.body.tags === "string") {
        try {
          const parsed = JSON.parse(req.body.tags);
          req.body.tags = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          req.body.tags = req.body.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
        }
      }
    }

    // Validate subCategory if category/subCategory updated
    if (req.body.category || req.body.subCategory) {
      const categoryId = req.body.category || service.category;
      const subCategoryToCheck = req.body.subCategory || service.subCategory;

      const category = await Category.findById(categoryId);
      if (!category) {
        return next(new ErrorResponse("Invalid category", 400));
      }

      if (!category.subCategories.includes(subCategoryToCheck)) {
        return next(
          new ErrorResponse("Invalid sub-category for selected category", 400)
        );
      }
    }

    // Handle image uploads
    let images = service.images;
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => file.path);
      images = [...images, ...newImages];

      if (images.length > 6) {
        return next(
          new ErrorResponse(
            "Cannot have more than 6 images. New images were uploaded but not saved due to limit.",
            400
          )
        );
      }
    }

    // Convert price to numbers
    if (req.body.minPrice) req.body.minPrice = Number(req.body.minPrice);
    if (req.body.maxPrice) req.body.maxPrice = Number(req.body.maxPrice);

    // Parse details if provided
    if (req.body.details) {
      if (typeof req.body.details === "string") {
        try {
          req.body.details = JSON.parse(req.body.details);
        } catch {
          return next(new ErrorResponse("Invalid details format", 400));
        }
      }

      if (typeof service.details === "object") {
        req.body.details = {
          ...service.details,
          ...req.body.details,
        };
      }
    }

    // ✅ Parse and merge FAQs if provided
    if (req.body.faqs) {
      let parsedFaqs = [];

      if (typeof req.body.faqs === "string") {
        try {
          parsedFaqs = JSON.parse(req.body.faqs);
        } catch {
          return next(new ErrorResponse("Invalid FAQ format", 400));
        }
      } else if (Array.isArray(req.body.faqs)) {
        parsedFaqs = req.body.faqs;
      }

      const isValidFaqs = parsedFaqs.every(
        (faq) =>
          faq.question &&
          faq.answer &&
          typeof faq.question === "string" &&
          typeof faq.answer === "string"
      );

      if (!isValidFaqs) {
        return next(
          new ErrorResponse(
            "Each FAQ must have a valid 'question' and 'answer'",
            400
          )
        );
      }

      req.body.faqs = parsedFaqs; // Replace entire FAQ set (or merge logic could be added)
    }

    // Prevent vendor field from being modified
    delete req.body.vendor;

    // Final update
    service.set({ ...req.body, images });

    await service.save();

    // ➕  NEW
    if (req.body.variants) await syncVariants(service._id, req.body.variants);


    res.status(200).json({
      success: true,
      data: service,
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
      return next(new ErrorResponse("Service not found", 404));
    }

    // Check if service belongs to the vendor
    if (service.vendor.toString() !== req.user.id) {
      return next(
        new ErrorResponse("Not authorized to delete this service", 403)
      );
    }

    // Delete images from Cloudinary
    const deletePromises = service.images.map((image) => {
      const publicId = image.split("/").pop().split(".")[0];
      return cloudinary.uploader.destroy(`event-manager/services/${publicId}`);
    });

    await Promise.all(deletePromises);

    await service.deleteOne();
    await ServiceVariant.deleteMany({ service: service._id }); // ➕ NEW

    // Remove service from vendor's services array
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { services: service._id },
    });

    res.status(200).json({
      success: true,
      data: {},
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
      query.location = new RegExp(location, "i");
    }

    // Add text search if provided
    if (search) {
      query.$text = { $search: search };
    }

    // Step 1: Find services based on filters
    const services = await Service.find(query)
      .populate("vendor", "name profilePhoto")
      .populate("category", "title")
      .lean();

    // Step 2: Extract service IDs
    const serviceIds = services.map((service) => service._id);

    // Step 3: Find active offers for the fetched services
    const offers = await Offer.find({
      service: { $in: serviceIds },
      isActive: true,
      validFrom: { $lte: new Date() },
      validTill: { $gte: new Date() },
    })
      .select("service discountedPrice discountPercentage bannerImage")
      .lean();

    // Step 4: Create a map to attach offers
    const offerMap = new Map();
    offers.forEach((offer) => {
      offerMap.set(offer.service.toString(), offer);
    });

    // Step 5: Attach offer to each service
    const enrichedServices = services.map((service) => ({
      ...service,
      offer: offerMap.get(service._id.toString()) || null,
    }));

    // Step 6: Respond
    res.status(200).json({
      success: true,
      count: enrichedServices.length,
      data: enrichedServices,
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

    // Text search
    if (q) {
      query.$text = { $search: q };
    }

    // Location filter with RegExp escape
    if (location) {
      const escapeRegExp = (string) =>
        string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedLocation = escapeRegExp(String(location));
      query.location = new RegExp(escapedLocation, "i");
    }

    // Category filter by ObjectId
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = new mongoose.Types.ObjectId(category);
    }

    console.log(query);

    // Step 1: Find services matching query
    const services = await Service.find(query)
      .populate("vendor", "name profilePhoto")
      .populate("category", "title")
      .lean();

    // Step 2: Find active offers for found services
    const serviceIds = services.map((service) => service._id);
    const offers = await Offer.find({
      service: { $in: serviceIds },
      isActive: true,
      validFrom: { $lte: new Date() },
      validTill: { $gte: new Date() },
    })
      .select("service discountedPrice discountPercentage bannerImage")
      .lean();

    // Step 3: Map offers to services
    const offerMap = new Map();
    offers.forEach((offer) => {
      offerMap.set(offer.service.toString(), offer);
    });

    // Step 4: Attach offers to each service
    const enrichedServices = services.map((service) => ({
      ...service,
      offer: offerMap.get(service._id.toString()) || null,
    }));

    // Step 5: Respond
    res.status(200).json({
      success: true,
      count: enrichedServices.length,
      data: enrichedServices,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all services with optional offers
// @route   GET /api/services
// @access  Public
exports.getAllServices = async (req, res, next) => {
  try {
    // Step 1: Get all services
    const services = await Service.find()
      .populate("vendor", "name profilePhoto")
      .populate("category", "title")
      .lean(); // lean() for better performance and ability to modify result

    // Step 2: Fetch offers for services
    const serviceIds = services.map((s) => s._id);
    const offers = await Offer.find({
      service: { $in: serviceIds },
      isActive: true,
      validFrom: { $lte: new Date() },
      validTill: { $gte: new Date() },
    })
      .select("service discountedPrice discountPercentage")
      .lean();

    const offerMap = new Map();
    offers.forEach((offer) => {
      offerMap.set(offer.service.toString(), {
        discountedPrice: offer.discountedPrice,
        discountPercentage: offer.discountPercentage,
      });
    });

    // Step 3: Attach offer info to services
    const enrichedServices = services.map((service) => {
      const offer = offerMap.get(service._id.toString());
      return {
        ...service,
        offer: offer || null,
      };
    });

    // Step 4: Respond
    res.status(200).json({
      success: true,
      count: enrichedServices.length,
      data: enrichedServices,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get a single service by id (from query params)
// @route   GET /api/services/getServices?id=serviceId
// @access  Public
exports.getService = async (req, res, next) => {
  try {
    const { id } = req.params;          // ← changed from req.params
    if (!id) {
      return next(new ErrorResponse("Please provide a service id", 400));
    }

    // Step 1: Get service + vendor + category + variants
    const service = await Service.findById(id)
      .populate("vendor", "name profilePhoto")
      .populate("category", "title")
      .lean();

    if (!service) {
      return next(new ErrorResponse("Service not found", 404));
    }

    // Step 2: Attach variants
    const variants = await ServiceVariant.find({ service: id, isActive: true })
      .select("-service -createdAt -updatedAt -__v")
      .lean();
    service.variants = variants;

    // Step 3: Attach active offer
    const offer = await Offer.findOne({
      service: id,
      isActive: true,
      validFrom: { $lte: new Date() },
      validTill: { $gte: new Date() },
    }).select("discountedPrice discountPercentage bannerImage validTill");

    service.offer = offer || null;

    // Step 4: Send response
    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (err) {
    next(err);
  }
};
