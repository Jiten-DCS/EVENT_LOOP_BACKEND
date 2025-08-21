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
exports.checkAvailability = async (req, res, next) => {
  try {
    const { serviceId, date } = req.query;
    if (!serviceId || !date) {
      return next(new ErrorResponse("Service ID and date are required", 400));
    }

    const service = await Service.findById(serviceId);
    if (!service) return next(new ErrorResponse("Service not found", 404));

    // Normalize date → midnight UTC
    const bookingDate = new Date(date);
    bookingDate.setUTCHours(0, 0, 0, 0);

    // Fetch existing slot bookings
    const bookings = await Booking.find({
      service: serviceId,
      date: bookingDate,
      status: { $ne: "cancelled" },
      "items.isSlotBased": true,
    });

    // Collect already booked slot keys
    const bookedSlots = bookings.flatMap((b) =>
      b.items
        .filter((i) => i.isSlotBased && i.slot)
        .map((i) => `${i.slot.startTime}-${i.slot.endTime}`)
    );

    // Mark available slots
    const availableSlots = (service.availability.slots || []).map((s) => {
      const key = `${s.startTime}-${s.endTime}`;
      return { ...s, isBooked: bookedSlots.includes(key) };
    });

    res.status(200).json({
      success: true,
      date,
      availableSlots,
      bookedSlots,
    });
  } catch (err) {
    next(err);
  }
};

// -----------------------------------------------------------------------------
// CREATE BOOKING
// -----------------------------------------------------------------------------
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
      slot, // slot { startTime, endTime }
    } = req.body;

    // Validate required fields
    const required = { service, name, email, phone, date };
    for (const [field, value] of Object.entries(required)) {
      if (!value) {
        return next(new ErrorResponse(`Missing required field: ${field}`, 400));
      }
    }

    // Validate service
    const serviceDoc = await Service.findById(service).populate("vendor");
    if (!serviceDoc) return next(new ErrorResponse("Service not found", 404));

    // Validate vendor
    const vendor = await User.findById(serviceDoc.vendor._id);
    if (!vendor || vendor.role !== "vendor" || !vendor.isApproved) {
      return next(new ErrorResponse("Vendor not available", 404));
    }

    // Validate future date
    const bookingDate = new Date(date);
    bookingDate.setUTCHours(0, 0, 0, 0);
    if (bookingDate <= new Date()) {
      return next(new ErrorResponse("Booking date must be in the future", 400));
    }

    // Validate variants
    if (!Array.isArray(variants) || variants.length === 0) {
      return next(new ErrorResponse("At least one variant must be selected", 400));
    }

    // Build booking items
    const bookingItems = [];
    let calculatedTotal = 0;
    const slotBasedVariants = [];

    for (const item of variants) {
      const variant = await ServiceVariant.findById(item.variant);
      if (!variant) {
        return next(new ErrorResponse(`Variant ${item.variant} not found`, 404));
      }

      if (!item.quantity || item.quantity <= 0) {
        return next(new ErrorResponse("Quantity must be greater than zero", 400));
      }

      if (variant.isSlotBased) slotBasedVariants.push(variant);

      bookingItems.push({
        variant: variant._id,
        name: variant.name,
        unit: variant.unit,
        quantity: item.quantity,
        unitPrice: variant.price,
        isSlotBased: variant.isSlotBased,
        slot:
          variant.isSlotBased && slot
            ? { startTime: slot.startTime, endTime: slot.endTime }
            : null,
      });

      calculatedTotal += variant.price * item.quantity;
    }

    // Slot booking rules
    if (slotBasedVariants.length > 1) {
      return next(
        new ErrorResponse("Only one slot-based variant can be booked per booking", 400)
      );
    }

    if (slotBasedVariants.length === 1) {
      const variant = slotBasedVariants[0];

      // Check if slot already booked
      const conflict = await Booking.findOne({
        service,
        date: bookingDate,
        "items.isSlotBased": true,
        "items.slot.startTime": slot.startTime,
        "items.slot.endTime": slot.endTime,
        status: { $ne: "cancelled" },
      });

      if (conflict) {
        return next(
          new ErrorResponse(
            `This slot (${slot.startTime}-${slot.endTime}) is already booked`,
            400
          )
        );
      }
    } else {
      // Non-slot-based → enforce daily cap
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

    // Validate totals
    if (calculatedTotal !== totalPrice) {
      return next(new ErrorResponse("Price calculation mismatch", 400));
    }

    // Tax & totals
    const tax = Math.round(calculatedTotal * 0.18);
    const grandTotal = calculatedTotal + tax;

    // Create booking
    const booking = await Booking.create({
      user: req.user.id,
      userName: name,
      userEmail: email,
      vendor: vendor._id,
      service,
      message,
      date: bookingDate,
      items: bookingItems,
      subTotal: calculatedTotal,
      tax,
      grandTotal,
      amount: grandTotal,
      status: "pending",
      paymentStatus: "pending",
    });

    // Notify vendor
    await sendEmail({
      email: vendor.email,
      subject: "New Booking Request - Payment Pending",
      html: vendorBookingNotificationTemplate({
        vendorName: vendor.name,
        customerName: name,
        serviceTitle: serviceDoc.title,
        date,
        companyLogoUrl: "https://yourdomain.com/logo.png",
      }),
    });

    // Mock payment gateway response
    const paymentResponse = {
      orderId: `mock_${booking._id}`,
      amount: grandTotal * 100, // paise
      currency: "INR",
      key: process.env.RAZORPAY_KEY_ID,
    };

    res.status(201).json({
      success: true,
      data: { booking, payment: paymentResponse },
    });
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
    if (
      booking.vendor.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(
        new ErrorResponse("Not authorized to update this booking", 403)
      );
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
