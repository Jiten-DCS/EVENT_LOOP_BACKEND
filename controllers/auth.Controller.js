const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const { createSendToken } = require("../config/jwt");
const sendEmail = require("../utils/emailSender");
const { v2: cloudinary } = require("cloudinary");
const crypto = require("crypto");

// Add these imports at the top (replace firebase import)
const twilio = require("twilio");
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Updated register function
exports.register = async (req, res, next) => {
  const { name, email, password, role, phoneNumber, category, businessName } =
    req.body;

  try {
    // Check if user already exists by email or phone
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    });
    if (existingUser) {
      return next(
        new ErrorResponse("User with this email or phone already exists", 400)
      );
    }

    // Handle profile photo upload
    let profilePhoto = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    if (req.file) {
      profilePhoto = req.file.path;
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // First try to send OTP via Twilio before creating user
    // try {
    //   await client.messages.create({
    //     body: `Your verification code is: ${otp}. Valid for 10 minutes.`,
    //     from: process.env.TWILIO_PHONE_NUMBER,
    //     to: phoneNumber,
    //   });
    // } catch (twilioError) {
    //   console.error("Twilio error:", twilioError);
    //   return next(
    //     new ErrorResponse(
    //       "Failed to send verification SMS. Please check your phone number.",
    //       400
    //     )
    //   );
    // }

    // Create user only after successful SMS sending
    const user = await User.create({
      name,
      email,
      password,
      role,
      phoneNumber,
      phoneNumberVerified: false,
      phoneVerificationOtp: otp,
      phoneVerificationExpires: otpExpires,
      category: role === "vendor" ? category : undefined,
      businessName: role === "vendor" ? businessName : undefined,
      profilePhoto,
      isApproved: role === "vendor" ? false : true,
    });

    res.status(200).json({
      success: true,
      message: "User registered successfully. OTP sent to your phone number.",
      userId: user._id,
      phoneNumber: user.phoneNumber,
    });
  } catch (err) {
    next(err);
  }
};

// Updated verifyRegistration function
exports.verifyRegistration = async (req, res, next) => {
  const { userId, otp } = req.body;

  try {
    // Find the unverified user with valid OTP
    const user = await User.findOne({
      _id: userId,
      phoneNumberVerified: false,
      phoneVerificationOtp: otp,
      phoneVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(new ErrorResponse("Invalid OTP or OTP has expired", 400));
    }

    // Mark user as verified and clear OTP fields
    user.phoneNumberVerified = true;
    user.phoneVerificationOtp = undefined;
    user.phoneVerificationExpires = undefined;
    user.phoneVerificationAttempts = 0;
    await user.save();

    // Log the user in by sending token
    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Resend OTP for login verification
// @route   POST /api/auth/resend-login-otp
// @access  Public
exports.resendLoginOTP = async (req, res, next) => {
  const { phoneNumber } = req.body;

  try {
    // Validate phone number
    if (!phoneNumber) {
      return next(new ErrorResponse("Phone number is required", 400));
    }

    // Find user by phone number
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return next(
        new ErrorResponse("User not found with this phone number", 404)
      );
    }

    // Check if user is already verified
    if (user.phoneNumberVerified) {
      return next(new ErrorResponse("Phone number already verified", 400));
    }

    // Check if user is blocked from verification attempts
    if (
      user.phoneVerificationBlockedUntil &&
      user.phoneVerificationBlockedUntil > Date.now()
    ) {
      const timeLeft = Math.ceil(
        (user.phoneVerificationBlockedUntil - Date.now()) / (1000 * 60)
      );
      return next(
        new ErrorResponse(
          `Too many attempts. Try again in ${timeLeft} minutes`,
          429
        )
      );
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Send OTP via Twilio first
    try {
      await client.messages.create({
        body: `Your login verification code is: ${otp}. Valid for 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    } catch (twilioError) {
      console.error("Twilio error:", twilioError);
      return next(
        new ErrorResponse(
          "Failed to send verification SMS. Please try again.",
          500
        )
      );
    }

    // Update user with new OTP only after successful SMS
    user.phoneVerificationOtp = otp;
    user.phoneVerificationExpires = otpExpires;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Verification OTP sent successfully to your phone number",
      userId: user._id,
      phoneNumber: user.phoneNumber,
    });
  } catch (err) {
    console.error("Error sending login OTP:", err);
    next(new ErrorResponse("Failed to send OTP", 500));
  }
};

// @desc    Verify OTP for login
// @route   POST /api/auth/verify-login-otp
// @access  Public
exports.verifyLoginOTP = async (req, res, next) => {
  const { phoneNumber, otp } = req.body;

  try {
    // Basic validation
    if (!phoneNumber || !otp) {
      return next(new ErrorResponse("Phone number and OTP are required", 400));
    }

    // Find user with valid OTP
    const user = await User.findOne({
      phoneNumber,
      phoneVerificationOtp: otp,
      phoneVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      // Increment failed attempts for rate limiting
      const existingUser = await User.findOne({ phoneNumber });
      if (existingUser) {
        existingUser.phoneVerificationAttempts =
          (existingUser.phoneVerificationAttempts || 0) + 1;

        // Block user after 3 failed attempts
        if (existingUser.phoneVerificationAttempts >= 3) {
          existingUser.phoneVerificationBlockedUntil =
            Date.now() + 5 * 60 * 1000; // 5 minutes
        }

        await existingUser.save();
      }

      return next(new ErrorResponse("Invalid or expired OTP", 400));
    }

    // Mark as verified and clear OTP fields
    user.phoneNumberVerified = true;
    user.phoneVerificationOtp = undefined;
    user.phoneVerificationExpires = undefined;
    user.phoneVerificationAttempts = 0;
    user.phoneVerificationBlockedUntil = undefined;
    await user.save();

    // Check if vendor is approved before logging in
    if (user.role === "vendor" && !user.isApproved) {
      return next(new ErrorResponse("Your account is pending approval", 401));
    }

    // Log the user in by sending token
    createSendToken(user, 200, res);
  } catch (err) {
    console.error("Error verifying login OTP:", err);
    next(new ErrorResponse("Failed to verify OTP", 500));
  }
};

// Updated sendOTP function (for resending OTP)
exports.sendOTP = async (req, res, next) => {
  const { phoneNumber } = req.body;

  try {
    // Find user by phone number
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return next(new ErrorResponse("User not found", 404));
    }

    // Check if user is already verified
    if (user.phoneNumberVerified) {
      return next(new ErrorResponse("Phone number already verified", 400));
    }

    // Check if user is blocked from verification attempts
    if (
      user.phoneVerificationBlockedUntil &&
      user.phoneVerificationBlockedUntil > Date.now()
    ) {
      const timeLeft = Math.ceil(
        (user.phoneVerificationBlockedUntil - Date.now()) / (1000 * 60)
      );
      return next(
        new ErrorResponse(
          `Too many attempts. Try again in ${timeLeft} minutes`,
          429
        )
      );
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Update user with new OTP
    user.phoneVerificationOtp = otp;
    user.phoneVerificationExpires = otpExpires;
    await user.save();

    // Send OTP via Twilio
    await client.messages.create({
      body: `Your verification code is: ${otp}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (err) {
    console.error("Error sending OTP:", err);
    next(new ErrorResponse("Failed to send OTP", 500));
  }
};

// Updated verifyOTP function
exports.verifyOTP = async (req, res, next) => {
  const { phoneNumber, otp } = req.body;

  try {
    // Basic validation
    if (!phoneNumber || !otp) {
      return next(new ErrorResponse("Phone number and OTP are required", 400));
    }

    // Find user with valid OTP
    const user = await User.findOne({
      phoneNumber,
      phoneVerificationOtp: otp,
      phoneVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      // Increment failed attempts
      await User.findOneAndUpdate(
        { phoneNumber },
        {
          $inc: { phoneVerificationAttempts: 1 },
          $set: {
            phoneVerificationBlockedUntil:
              user?.phoneVerificationAttempts >= 2
                ? Date.now() + 5 * 60 * 1000
                : undefined, // Block for 5 minutes after 3 attempts
          },
        }
      );

      return next(new ErrorResponse("Invalid or expired OTP", 400));
    }

    // Mark as verified and clear OTP fields
    user.phoneNumberVerified = true;
    user.phoneVerificationOtp = undefined;
    user.phoneVerificationExpires = undefined;
    user.phoneVerificationAttempts = 0;
    user.phoneVerificationBlockedUntil = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Phone number verified successfully",
      data: user,
    });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    next(new ErrorResponse("Failed to verify OTP", 500));
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Check if email and password exist
    if (!email || !password) {
      return next(new ErrorResponse('Please provide email and password', 400));
    }

    // Check if user exists and password is correct
    const user = await User.findOne({ email })
      .select('+password')
      

    if (!user || !(await user.comparePassword(password, user.password))) {
      return next(new ErrorResponse('Incorrect email or password', 401));
    }

    // Check if user is blocked
    if (user.isBlocked) {
      const blockInfo = user.blockDetails;
      return next(new ErrorResponse(
        `Your account has been blocked by admin. Reason: ${blockInfo.reason || 'Not specified'}. ` +
        `Blocked on: ${blockInfo.blockedAt.toLocaleString()}. ` +
        'Please check your registered email for more details.',
        403
      ));
    }

    // Check if phone number is verified (optional)
    // if (!user.phoneNumberVerified) {
    //   return res.status(200).json({
    //     success: false,
    //     message: 'Phone number not verified. Please verify to continue.',
    //     requiresPhoneVerification: true,
    //     userId: user._id,
    //     phoneNumber: user.phoneNumber,
    //   });
    // }

    // Check if vendor is approved
    if (user.role === 'vendor' && !user.isApproved) {
      return res.status(200).json({
        success: false,
        message: 'Your vendor account is pending admin approval. ' +
                 'You will be notified via email once approved.',
        isVendorPendingApproval: true
      });
    }

    // Successful login
    createSendToken(user, 200, res);

  } catch (err) {
    console.error('Error in login:', err);
    next(new ErrorResponse('Login failed. Please try again later.', 500));
  }
};
// @desc    Logout user
// @route   GET /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new ErrorResponse("User not found", 404));
    }

    const { name, email, description, category, address, businessName } =
      req.body;
    const updateData = {};

    // Basic fields update
    if (name) updateData.name = name;

    if (email) {
      const emailExists = await User.findOne({
        email,
        _id: { $ne: req.user.id },
      });
      if (emailExists) {
        return next(new ErrorResponse("Email already exists", 400));
      }
      updateData.email = email;
    }

    if (description) updateData.description = description;

    // Vendor-specific fields
    if (user.role === "vendor") {
      if (category) updateData.category = category;
      if (businessName) updateData.businessName = businessName;
    }

    // Address update (for both user and vendor)
    if (address) updateData.address = address;

    // Handle profile photo update
    if (req.file) {
      if (user.profilePhoto && user.profilePhoto !== "default.jpg") {
        const publicId = user.profilePhoto.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      }
      updateData.profilePhoto = req.file.path;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update gallery images (Vendors only)
// @route   PUT /api/auth/update-gallery
// @access  Private (Vendor)
exports.updateGallery = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new ErrorResponse("User not found", 404));
    }

    if (user.role !== "vendor") {
      return next(new ErrorResponse("Only vendors can update gallery", 403));
    }

    const { removeImages } = req.body; // Array of image URLs to remove
    let galleryImages = [...user.galleryImages];

    // Remove specified images
    if (removeImages && Array.isArray(removeImages)) {
      for (const imageUrl of removeImages) {
        // Remove from cloudinary
        const publicId = imageUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);

        // Remove from array
        galleryImages = galleryImages.filter((img) => img !== imageUrl);
      }
    }

    // Add new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => file.path);
      galleryImages = [...galleryImages, ...newImages];
    }

    // Limit gallery to 20 images
    if (galleryImages.length > 20) {
      return next(
        new ErrorResponse("Gallery cannot have more than 20 images", 400)
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { galleryImages },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const { role, isApproved, page = 1, limit = 10 } = req.query;

    // Build query
    const query = {};
    if (role) query.role = role;
    if (isApproved !== undefined) query.isApproved = isApproved === "true";

    const users = await User.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single user (Admin only)
// @route   GET /api/auth/users/:id
// @access  Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ErrorResponse("User not found", 404));
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user (Admin only)
// @route   PUT /api/auth/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, category, isApproved, description } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new ErrorResponse("User not found", 404));
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) {
      // Check if email is already taken by another user
      const emailExists = await User.findOne({
        email,
        _id: { $ne: req.params.id },
      });
      if (emailExists) {
        return next(new ErrorResponse("Email already exists", 400));
      }
      updateData.email = email;
    }
    if (role) updateData.role = role;
    if (category) updateData.category = category;
    if (isApproved !== undefined) updateData.isApproved = isApproved;
    if (description) updateData.description = description;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Send notification email if vendor is approved
    if (isApproved === true && user.role === "vendor" && !user.isApproved) {
      const message = `Congratulations! Your vendor account has been approved. You can now start offering your services.`;
      await sendEmail({
        email: updatedUser.email,
        subject: "Vendor Account Approved",
        message,
      });
    }

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ErrorResponse("User not found", 404));
    }

    // Delete profile photo from cloudinary if it's not default
    if (user.profilePhoto && user.profilePhoto !== "default.jpg") {
      const publicId = user.profilePhoto.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }

    // Delete gallery images from cloudinary
    if (user.galleryImages && user.galleryImages.length > 0) {
      for (const imageUrl of user.galleryImages) {
        const publicId = imageUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      }
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Approve/Reject vendor (Admin only)
// @route   PUT /api/auth/users/:id/approval
// @access  Private/Admin
exports.updateVendorApproval = async (req, res, next) => {
  try {
    const { isApproved } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new ErrorResponse("User not found", 404));
    }

    if (user.role !== "vendor") {
      return next(new ErrorResponse("User is not a vendor", 400));
    }

    user.isApproved = isApproved;
    await user.save();

    // Send notification email
    const message = isApproved
      ? `Congratulations! Your vendor account has been approved. You can now start offering your services.`
      : `We're sorry, but your vendor account application has been rejected. Please contact support for more information.`;

    await sendEmail({
      email: user.email,
      subject: isApproved
        ? "Vendor Account Approved"
        : "Vendor Account Rejected",
      message,
    });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Forgot password - Send OTP to email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // 1) Get user based on POSTed email
    const user = await User.findOne({ email });
    if (!user) {
      return next(new ErrorResponse("No user found with that email", 404));
    }

    // 2) Generate random 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // 3) Save OTP and expiry to user
    user.passwordResetOtp = otp;
    user.passwordResetExpires = otpExpires;
    await user.save({ validateBeforeSave: false });

    // 4) Send OTP to user's email
    const message = `Your password reset OTP is ${otp}. This OTP is valid for 10 minutes.`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Your password reset OTP (valid for 10 min)",
        message,
      });

      res.status(200).json({
        success: true,
        message: "OTP sent to email",
      });
    } catch (err) {
      // Reset the OTP fields if email fails
      user.passwordResetOtp = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return next(new ErrorResponse("Email could not be sent", 500));
    }
  } catch (err) {
    next(err);
  }
};

// @desc    Reset password with OTP
// @route   PUT /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    // 1) Get user based on email
    const user = await User.findOne({
      email,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(new ErrorResponse("Invalid email or OTP has expired", 400));
    }

    // 2) Check if OTP matches
    if (user.passwordResetOtp !== otp) {
      return next(new ErrorResponse("OTP is incorrect", 400));
    }

    // 3) Update password
    user.password = newPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 4) Send confirmation email
    const message = "Your password has been successfully updated.";

    await sendEmail({
      email: user.email,
      subject: "Password updated successfully",
      message,
    });

    // 5) Log the user in by sending token
    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};
