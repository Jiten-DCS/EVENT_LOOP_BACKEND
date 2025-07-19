const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const sendEmail = require("../utils/emailSender");
const vendorBookingNotificationTemplate = require("../utils/emailTemplates/vendorBookingNotificationTemplate");
const bookingStatusUpdateTemplate = require("../utils/emailTemplates/bookingStatusUpdateTemplate");
const ServiceVariant = require("../models/ServiceVariant");

// @desc    Create booking
// @route   POST /api/bookings
// @access  Private
// NEW: require ServiceVariant

exports.createBooking = async (req, res, next) => {
  try {
    const { vendorId, serviceId, message, date, items } = req.body; // <-- NEW items

    /*  VALIDATION SAME AS BEFORE  */
    const service = await Service.findById(serviceId);
    if (!service) return next(new ErrorResponse("Service not found", 404));
    const vendor = await User.findById(vendorId);
    if (!vendor || vendor.role !== "vendor" || !vendor.isApproved)
      return next(new ErrorResponse("Vendor not found", 404));

    const bookingDate = new Date(date);
    if (bookingDate <= new Date())
      return next(new ErrorResponse("Booking date must be in the future", 400));

    /*  NEW: build line items and totals  */
    let subTotal = 0;
    const bookingItems = [];

    for (const it of items || []) {
      const variant = await ServiceVariant.findById(it.variant);
      if (!variant)
        return next(new ErrorResponse(`Variant ${it.variant} not found`, 404));

      const lineTotal = variant.price * it.quantity;
      bookingItems.push({
        variant: variant._id,
        quantity: it.quantity,
        unitPrice: variant.price,
        lineTotal,
      });
      subTotal += lineTotal;
    }

    const tax = Math.round(subTotal * 0.18); // example GST 18 %
    const grandTotal = subTotal + tax;

    /*  CREATE BOOKING  */
    const booking = await Booking.create({
      user: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      vendor: vendorId,
      service: serviceId,
      message,
      date,
      items: bookingItems,
      subTotal,
      tax,
      grandTotal,
      amount: grandTotal, // legacy field kept
    });

    /*  RAZORPAY ORDER  */
    const razorpay = require("../config/razorpay");
    const order = await razorpay.orders.create({
      amount: grandTotal * 100,
      currency: "INR",
      receipt: `booking_${booking._id}`,
      payment_capture: 1,
    });

    const Payment = require("../models/Payment");
    await Payment.create({
      vendor: vendorId,
      user: req.user.id,
      booking: booking._id,
      amount: grandTotal,
      razorpayOrderId: order.id,
      receipt: order.receipt,
    });

     // Send notification email to vendor
    const messageToVendor = `You have a new booking request from ${req.user.name} for ${service.title} on ${date}. Payment is pending.`;
    await sendEmail({
      email: vendor.email,
      subject: "New Booking Request - Payment Pending",
      html: vendorBookingNotificationTemplate({
        vendorName: vendor.name,
        customerName: req.user.name,
        serviceTitle: service.title,
        date,
        companyLogoUrl: "https://your-cloudinary-url.com/company-logo.png   ", // replace with actual logo URL
      }),
    });



    res.status(201).json({
      success: true,
      data: {
        booking,
        payment: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          key: process.env.RAZORPAY_KEY_ID,
        },
      },
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
    if (req.user.id !== req.params.id && req.user.role !== "admin") {
      return next(
        new ErrorResponse("Not authorized to access these bookings", 403)
      );
    }

    const bookings = await Booking.find({ vendor: req.params.id })
  .populate("user", "name email")
  .populate("service", "title")
  .populate("items.variant", "name unit price"); // NEW

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
      return next(
        new ErrorResponse("Not authorized to access these bookings", 403)
      );
    }

 const bookings = await Booking.find({ vendor: req.params.id })
  .populate("user", "name email")
  .populate("service", "title")
  .populate("items.variant", "name unit price"); // NEW

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
