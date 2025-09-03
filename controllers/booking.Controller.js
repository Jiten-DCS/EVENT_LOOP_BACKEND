const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const sendEmail = require("../utils/emailSender");
const vendorBookingNotificationTemplate = require("../utils/emailTemplates/vendorBookingNotificationTemplate");
const bookingStatusUpdateTemplate = require("../utils/emailTemplates/bookingStatusUpdateTemplate");
const ServiceVariant = require("../models/ServiceVariant");
const Payment = require("../models/Payment");

// -----------------------------------------------------------------------------
// CHECK AVAILABILITY
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// CREATE BOOKING
exports.createBooking = async (req, res, next) => {
    try {
        const {
            service,
            name,
            email,
            phone,
            date,
            message,
            totalPrice,
            variants = [],
            slotId, // 👈 client sends slotId when slot-based service
        } = req.body;
        console.log('slotId',slotId)

        // --- required field validation
        const required = { service, name, email, phone, date };
        for (const [field, value] of Object.entries(required)) {
            if (!value) return next(new ErrorResponse(`Missing required field: ${field}`, 400));
        }

        const serviceDoc = await Service.findById(service).populate("vendor");
        console.log('serviceDoc',serviceDoc)
        if (!serviceDoc) return next(new ErrorResponse("Service not found", 404));

        const vendor = await User.findById(serviceDoc.vendor._id);
        if (!vendor || vendor.role !== "vendor" || !vendor.isApproved) {
            return next(new ErrorResponse("Vendor not available", 404));
        }

        const bookingDate = new Date(date);
        bookingDate.setUTCHours(0, 0, 0, 0);
        if (bookingDate <= new Date()) {
            return next(new ErrorResponse("Booking date must be in the future", 400));
        }

        if (!Array.isArray(variants) || variants.length === 0) {
            return next(new ErrorResponse("At least one variant must be selected", 400));
        }

        // --- build items & calculate totals
        const bookingItems = [];
        let calculatedTotal = 0;

        for (const item of variants) {
            const variant = await ServiceVariant.findById(item.variant);
            if (!variant) return next(new ErrorResponse(`Variant ${item.variant} not found`, 404));
            if (!item.quantity || item.quantity <= 0) {
                return next(new ErrorResponse("Quantity must be greater than zero", 400));
            }
            bookingItems.push({
                variant: variant._id,
                name: variant.name,
                unit: variant.unit,
                quantity: item.quantity,
                unitPrice: variant.price,
            });
            calculatedTotal += variant.price * item.quantity;
        }

        // --- slot logic
        let slotInfo = null;

        if (serviceDoc.availability?.isSlotBased) {
            // ✅ FIX HERE
            if (!slotId) {
                return next(new ErrorResponse("Slot is required for this service", 400));
            }

            // find slot template in service.availability.slots
            const slotTemplate = serviceDoc.availability?.slots?.find(
                (s) => s._id.toString() === slotId
            );
            if (!slotTemplate) {
                return next(new ErrorResponse("Invalid slot selected", 400));
            }

            // check if already booked (status other than cancelled)
            const alreadyBooked = await Booking.exists({
                service,
                date: bookingDate,
                status: { $ne: "cancelled" },
                "slot.slotId": slotId,
            });

            if (alreadyBooked) {
                return next(
                    new ErrorResponse(
                        `This slot (${slotTemplate.startTime}-${slotTemplate.endTime}) is already booked`,
                        400
                    )
                );
            }

            // snapshot slot info into booking
            slotInfo = {
                slotId: slotTemplate._id,
                startTime: slotTemplate.startTime,
                endTime: slotTemplate.endTime,
            };
        } else {
            // non-slot-based booking capacity check
            const existingBookings = await Booking.countDocuments({
                service,
                date: bookingDate,
                status: { $ne: "cancelled" },
            });
            const maxBookings = serviceDoc.availability?.maxBookingsPerDay || 1;
            if (existingBookings >= maxBookings) {
                return next(new ErrorResponse("No bookings available for this date", 400));
            }
        }

        if (calculatedTotal !== totalPrice) {
            return next(new ErrorResponse("Price calculation mismatch", 400));
        }
        const tax = Math.round(calculatedTotal * 0.18);
        const grandTotal = calculatedTotal + tax;



        // --- create booking
        const booking = await Booking.create({
            user: req.user.id,
            userName: name,
            userEmail: email,
            vendor: vendor._id,
            service,
            message,
            date: bookingDate,
            slot: slotInfo,
            items: bookingItems,
            subTotal: calculatedTotal,
            tax,
            grandTotal,
            amount: grandTotal,
            status: "confirmed",
        });

        // optional: notify vendor
        await sendEmail({
            email: vendor.email,
            subject: "New Booking Confirmed",
            html: vendorBookingNotificationTemplate({
                vendorName: vendor.name,
                customerName: name,
                serviceTitle: serviceDoc.title,
                date,
                companyLogoUrl: "https://yourdomain.com/logo.png",
            }),
        });

        res.status(201).json({ success: true, data: { booking } });
    } catch (err) {
        console.error("Booking creation error:", err);
        next(err);
    }
};

// @desc    Get vendor's bookings
// @route   GET /api/bookings/vendor/:id
// @access  Private (Vendor only)
exports.getVendorBookings = async (req, res, next) => {
    try {
        // Check if vendor is the owner of the bookings
        if (req.user.id !== req.params.id && req.user.role !== "admin") {
            return next(new ErrorResponse("Not authorized to access these bookings", 403));
        }

        const bookings = await Booking.find({ vendor: req.params.id })
            .populate("user", "name email phoneNumber")
            .populate("service", "title images")
            .sort({ date: 1 });

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings,
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
        if (req.user.id !== req.params.id && req.user.role !== "admin") {
            return next(new ErrorResponse("Not authorized to access these bookings", 403));
        }

        const bookings = await Booking.find({ user: req.params.id })
            .populate("vendor", "name businessName")
            .populate("service", "title images")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings,
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
            return next(new ErrorResponse("Booking not found", 404));
        }

        // Check if vendor is the owner of the booking
        if (booking.vendor.toString() !== req.user.id && req.user.role !== "admin") {
            return next(new ErrorResponse("Not authorized to update this booking", 403));
        }

        booking.status = status;
        await booking.save();

        // Send notification email to user
        const messageToUser = `Your booking status has been updated to ${status} by ${req.user.name}.`;
        await sendEmail({
            email: booking.userEmail,
            subject: "Booking Status Update",
            html: bookingStatusUpdateTemplate({
                userName: booking.userName, // if available
                updatedBy: req.user.name,
                status,
                companyLogoUrl: "https://your-cloudinary-url.com/company-logo.png",
            }),
        });

        res.status(200).json({
            success: true,
            data: booking,
        });
    } catch (err) {
        next(err);
    }
};
