const razorpay = require("../config/razorpay");
const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const ErrorResponse = require("../utils/errorResponse");
const sendEmail = require("../utils/emailSender"); // Add this import at the top if not already present
const bookingConfirmedUserTemplate = require("../utils/emailTemplates/bookingConfirmedUserTemplate");
const bookingConfirmedVendorTemplate = require("../utils/emailTemplates/bookingConfirmedVendorTemplate");

// @desc    Create Razorpay order
// @route   POST /api/payments/create-order
// @access  Private
exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return next(new ErrorResponse("Booking not found", 404));
    }

    // Check if booking belongs to the user
    if (booking.user.toString() !== req.user.id) {
      return next(
        new ErrorResponse("Not authorized to pay for this booking", 403)
      );
    }

    // Check if booking is already paid
    if (booking.paymentStatus !== "pending") {
      return next(new ErrorResponse("Booking already paid", 400));
    }

    const options = {
      amount: booking.amount * 100, // amount in the smallest currency unit (paise)
      currency: "INR",
      receipt: `booking_${booking._id}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    // Create payment record
    const payment = await Payment.create({
      vendor: booking.vendor,
      user: req.user.id,
      booking: booking._id,
      amount: booking.amount,
      razorpayOrderId: order.id,
      receipt: order.receipt,
    });

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify Razorpay payment
// @route   POST /api/payments/verify
// @access  Private
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;

    // Find payment record
    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
    });
    if (!payment) {
      return next(new ErrorResponse("Payment not found", 404));
    }

    // Verify signature
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return next(new ErrorResponse("Payment verification failed", 400));
    }

    // Update payment status
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = "successful";
    await payment.save();

    // ========== ADD THIS SECTION HERE ==========
    // Get booking details with populated fields
    const booking = await Booking.findById(payment.booking).populate(
      "service vendor"
    );

    // Update booking status to confirmed
    await Booking.findByIdAndUpdate(payment.booking, {
      paymentStatus: "paid",
      status: "confirmed",
    });

    // Send confirmation emails
    await sendEmail({
      email: booking.userEmail,
      subject: "Booking Confirmed - Payment Successful",
      html: bookingConfirmedUserTemplate({
        userName: booking.userName,
        serviceTitle: booking.service.title,
        amount: booking.amount,
        companyLogoUrl: "https://your-cloudinary-url.com/company-logo.png",
      }),
    });

    await sendEmail({
      email: booking.vendor.email,
      subject: "Booking Confirmed - Payment Received",
      html: bookingConfirmedVendorTemplate({
        vendorName: booking.vendor.name,
        customerName: booking.userName,
        serviceTitle: booking.service.title,
        amount: booking.amount,
        companyLogoUrl: "https://your-cloudinary-url.com/company-logo.png",
      }),
    });
    // ========== END OF ADDITION ==========

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (err) {
    next(err);
  }
};
