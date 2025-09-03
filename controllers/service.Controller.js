const Service = require("../models/Service");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const { cloudinary } = require("../config/cloudinary");
const Category = require("../models/Category");
const mongoose = require("mongoose");
const Offer = require("../models/Offer");
const ServiceVariant = require("../models/ServiceVariant");
const Booking = require("../models/Booking");

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
            faqs,
            variants: rawVariants,
            isSlotBased,
            slots, // vendor-provided slots [{startTime:"09:00",endTime:"13:00"},...]
        } = req.body;

        let tags = req.body.tags;

        if (!req.files || req.files.length === 0) {
            return next(new ErrorResponse("Please upload at least one image", 400));
        }

        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return next(new ErrorResponse("Invalid category", 400));
        }

        if (!categoryExists.subCategories.includes(subCategory)) {
            return next(new ErrorResponse("Invalid sub-category for selected category", 400));
        }

        // Handle tags
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

        // Parse details
        let parsedDetails = {};
        if (details) {
            if (typeof details === "string") {
                try {
                    parsedDetails = JSON.parse(details);
                } catch {
                    return next(new ErrorResponse("Invalid details format", 400));
                }
            } else if (typeof details === "object" && details !== null) {
                parsedDetails = details;
            }
        }

        // Parse FAQs
        let parsedFaqs = [];
        if (faqs) {
            if (typeof faqs === "string") {
                try {
                    parsedFaqs = JSON.parse(faqs);
                } catch {
                    return next(new ErrorResponse("Invalid FAQ format", 400));
                }
            } else if (Array.isArray(faqs)) {
                parsedFaqs = faqs;
            }
        }

        const isValidFaqs = parsedFaqs.every(
            (faq) =>
                faq.question &&
                faq.answer &&
                typeof faq.question === "string" &&
                typeof faq.answer === "string"
        );
        if (!isValidFaqs && parsedFaqs.length > 0) {
            return next(new ErrorResponse("Each FAQ must have valid question and answer", 400));
        }

        const images = req.files.map((file) => file.path);

        // Handle variants
        let variants = [];
        if (rawVariants) {
            try {
                variants = typeof rawVariants === "string" ? JSON.parse(rawVariants) : rawVariants;
                if (!Array.isArray(variants)) variants = [variants];
            } catch {
                return next(new ErrorResponse("Invalid variants format", 400));
            }
        }

        // Parse slots if slot-based
        let parsedSlots = [];
        const isSlotBasedBool = String(isSlotBased) === "true"; // ✅ normalize

        if (isSlotBasedBool) {
            if (!slots) {
                return next(new ErrorResponse("Slot-based services must provide slots", 400));
            }

            // Parse if JSON string
            parsedSlots = typeof slots === "string" ? JSON.parse(slots) : slots;

            if (!Array.isArray(parsedSlots)) {
                return next(new ErrorResponse("Slots must be an array", 400));
            }

            if (parsedSlots.length === 0) {
                return next(new ErrorResponse("At least one slot is required", 400)); // ✅ extra guard
            }

            // Validate each slot
            const isValidSlots = parsedSlots.every(
                (s) =>
                    s.startTime &&
                    s.endTime &&
                    typeof s.startTime === "string" &&
                    typeof s.endTime === "string"
            );
            if (!isValidSlots) {
                return next(new ErrorResponse("Each slot must have startTime and endTime", 400));
            }
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
            faqs: parsedFaqs,
            variants: [], // handled later
            availability: {
                isSlotBased: isSlotBasedBool,
                slots: parsedSlots, // vendor-defined slots
                bookedDates: [], // empty initially
            },
        });

        // Insert variants
        if (variants.length > 0) {
            const isValidVariants = variants.every(
                (v) => v && v.name && (v.isCheckbox || (v.unit && v.price !== undefined))
            );
            if (!isValidVariants) {
                await Service.deleteOne({ _id: service._id });
                return next(new ErrorResponse("Invalid variant data", 400));
            }

            const createdVariants = await ServiceVariant.insertMany(
                variants.map((variant) => ({
                    service: service._id,
                    name: variant.name,
                    unit: variant.isCheckbox ? "item" : variant.unit,
                    price: Number(variant.price),
                    minQty: variant.isCheckbox ? 1 : variant.minQty ? Number(variant.minQty) : 1,
                    maxQty: variant.isCheckbox
                        ? 1
                        : variant.maxQty
                        ? Number(variant.maxQty)
                        : undefined,
                    isActive: true,
                    isCheckbox: variant.isCheckbox || false,
                    defaultChecked: variant.defaultChecked || false,
                }))
            );

            service.variants = createdVariants.map((v) => v._id);
            await service.save();
        }

        // Add service to user profile
        await User.findByIdAndUpdate(req.user.id, {
            $push: { services: service._id },
        });

        const populatedService = await Service.findById(service._id)
            .populate("variants")
            .populate("vendor", "name profilePhoto")
            .populate("category", "title");

        res.status(201).json({
            success: true,
            data: populatedService,
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
        let service = await Service.findById(req.params.id).populate("variants");

        if (!service) {
            return next(new ErrorResponse("Service not found", 404));
        }

        if (service.vendor.toString() !== req.user.id) {
            return next(new ErrorResponse("Not authorized to update this service", 403));
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
                return next(new ErrorResponse("Invalid sub-category for selected category", 400));
            }
        }

        // Handle image uploads
        let images = service.images;
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map((file) => file.path);
            images = [...images, ...newImages];

            if (images.length > 10) {
                // Changed to match your createService limit
                return next(new ErrorResponse("Cannot have more than 10 images", 400));
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
            // Merge with existing details
            req.body.details = { ...service.details, ...req.body.details };
        }

        // Parse FAQs if provided
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
                    new ErrorResponse("Each FAQ must have valid 'question' and 'answer'", 400)
                );
            }
            req.body.faqs = parsedFaqs;
        }

        // Handle variants
        if (req.body.variants) {
            let variants = [];
            try {
                variants =
                    typeof req.body.variants === "string"
                        ? JSON.parse(req.body.variants)
                        : req.body.variants;

                if (!Array.isArray(variants)) {
                    variants = [variants];
                }
            } catch (err) {
                return next(new ErrorResponse("Invalid variants format", 400));
            }

            const isValidVariants = variants.every(
                (v) => v && v.name && v.unit && v.price !== undefined && !isNaN(Number(v.price))
            );

            if (!isValidVariants) {
                return next(
                    new ErrorResponse("Each variant must have name, unit, and valid price", 400)
                );
            }

            // Delete old variants and create new ones
            await ServiceVariant.deleteMany({ service: service._id });
            const createdVariants = await ServiceVariant.insertMany(
                variants.map((variant) => ({
                    service: service._id,
                    name: variant.name,
                    unit: variant.unit,
                    price: Number(variant.price),
                    minQty: variant.minQty ? Number(variant.minQty) : 1,
                    maxQty: variant.maxQty ? Number(variant.maxQty) : undefined,
                    isActive: true,
                }))
            );

            req.body.variants = createdVariants.map((v) => v._id);
        }

        // Prevent vendor field from being modified
        delete req.body.vendor;

        // Update service
        service.set({ ...req.body, images });
        await service.save();

        // Get fully populated service for response
        const populatedService = await Service.findById(service._id)
            .populate("variants")
            .populate("vendor", "name profilePhoto")
            .populate("category", "title");

        res.status(200).json({
            success: true,
            data: populatedService,
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
            return next(new ErrorResponse("Not authorized to delete this service", 403));
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
            const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
        // Step 1: Get all services with all necessary populated data
        const services = await Service.find()
            .populate("vendor", "name profilePhoto")
            .populate("category", "title")
            .populate({
                path: "variants",
                model: "ServiceVariant",
                match: { isActive: true }, // Only active variants
                select: "name unit price minQty maxQty", // Only essential fields
            })
            .lean();

        // Step 2: Get active offers for these services
        const serviceIds = services.map((s) => s._id);
        const activeOffers = await Offer.find({
            service: { $in: serviceIds },
            isActive: true,
            validFrom: { $lte: new Date() },
            validTill: { $gte: new Date() },
        })
            .select("service discountedPrice discountPercentage")
            .lean();

        // Step 3: Create offer lookup map
        const offerMap = activeOffers.reduce((map, offer) => {
            map.set(offer.service.toString(), {
                discountedPrice: offer.discountedPrice,
                discountPercentage: offer.discountPercentage,
            });
            return map;
        }, new Map());

        // Step 4: Enrich services with offers
        const enrichedServices = services.map((service) => ({
            ...service,
            variants: service.variants || [], // Ensure variants array exists
            offer: offerMap.get(service._id.toString()) || null,
        }));

        res.status(200).json({
            success: true,
            count: enrichedServices.length,
            data: enrichedServices,
        });
    } catch (err) {
        next(err);
    }
};

function computeAvailableDates(availability) {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        // For slot-based services, check if any slots are available
        if (availability.isSlotBased) {
            const bookedDate = availability.bookedDates.find(
                (d) => d.date.toDateString() === date.toDateString()
            );

            // If no bookings or some slots are still available
            if (!bookedDate || bookedDate.slots.length < availability.slots.length) {
                dates.push(date);
            }
        } else {
            // Your existing logic for non-slot-based services
            const booked = availability.bookedDates.find(
                (d) => d.date.toDateString() === date.toDateString()
            );
            if (!booked || booked.count < availability.maxBookingsPerDay) {
                dates.push(date);
            }
        }
    }

    return dates;
}

// @desc    Get a single service by id (from query params)
// @route   GET /api/services/getServices?id=serviceId
// @access  Public
exports.getService = async (req, res, next) => {
    try {
        // Extract id from req.params, req.query, or req.body
        const id = req.query.id || req.body.id;

        // Check if id is provided
        if (!id) {
            return next(new ErrorResponse("Please provide a service id", 400));
        }

        // Step 1: Get service + vendor + category + variants
        const service = await Service.findById(id)
            .populate("vendor", "name profilePhoto")
            .populate("category", "title")
            .populate("variants") // you want variants anyway
            .lean();

        if (!service) {
            return next(new ErrorResponse("Service not found", 404));
        }

        // Step 2: Attach service-level availability
        // if (service.availability) {
        //     service.availableDates = computeAvailableDates(service.availability);
        // }

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

// controllers/serviceController.js
// exports.getAvailableSlots = async (req, res, next) => {
//     try {
//         const { id } = req.params;
//         const { date } = req.query;
//         console.log(date,id)

//         if (!id || !date) {
//             return next(new ErrorResponse("Service ID and date are required", 400));
//         }

//         const service = await Service.findById(id);
//         if (!service) return res.status(404).json({ message: "Service not found" });
//         console.log('service',service)
//         if (!service.isSlotBased) {
//             return res.status(200).json({ success: true, data: [] }); // not slot-based
//         }

//         const bookingDate = new Date(date);
//         bookingDate.setUTCHours(0, 0, 0, 0);

//         const bookings = await Booking.find({
//             service: id,
//             date: bookingDate,
//             status: { $ne: "cancelled" },
//         });

//         const bookedSlots = bookings.map((b) => b.slot);

//         const availableSlots = service.availability.slots.map((slot) => ({
//             ...slot.toObject(),
//             isBooked: bookedSlots.some(
//                 (bs) => bs && bs.startTime === slot.startTime && bs.endTime === slot.endTime
//             ),
//         }));

//         res.status(200).json({ success: true, data: availableSlots });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

exports.checkAvailability = async (req, res, next) => {
    try {
        const { serviceId } = req.params; // <-- from params
        const { date } = req.query;  
        console.log(serviceId, date);
        if (!serviceId || !date) {
            return next(new ErrorResponse("Service ID and date are required", 400));
        }

        const service = await Service.findById(serviceId);
        if (!service) return next(new ErrorResponse("Service not found", 404));

        if (!service.availability?.isSlotBased) {
            return next(new ErrorResponse("This service is not slot-based", 400));
        }

        // Normalize date → midnight UTC
        const bookingDate = new Date(date);
        bookingDate.setUTCHours(0, 0, 0, 0);

        // Fetch all confirmed bookings for that service/date
        const bookings = await Booking.find({
            service: serviceId,
            date: bookingDate,
            status: { $ne: "cancelled" },
        });

        // Collect booked slotIds
        const bookedSlotIds = bookings
            .filter((b) => b.slot && b.slot.slotId)
            .map((b) => b.slot.slotId.toString());

        // Build availability response
        const availableSlots = (service.availability.slots || []).map((s) => {
            return {
                _id: s._id,
                startTime: s.startTime,
                endTime: s.endTime,
                isBooked: bookedSlotIds.includes(s._id.toString()),
            };
        });

        res.status(200).json({
            success: true,
            serviceId,
            date,
            slots: availableSlots,
        });
    } catch (err) {
        next(err);
    }
};