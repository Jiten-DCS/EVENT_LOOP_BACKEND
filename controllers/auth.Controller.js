const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { createSendToken } = require('../config/jwt');
const sendEmail = require('../utils/emailSender');
const { v2: cloudinary } = require('cloudinary');
const crypto = require('crypto');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  const { name, email, password, role,phoneNumber, category, businessName } = req.body;

  try {
    // Check if user already exists by email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ErrorResponse('User already exists', 400));
    }

    // Check if an admin already exists
    if (role === 'admin') {
      const adminExists = await User.findOne({ role: 'admin' });
      if (adminExists) {
        return next(new ErrorResponse('Admin already exists', 403));
      }
    }

    // Handle profile photo upload
    let profilePhoto = 'default.jpg';
    if (req.file) {
      profilePhoto = req.file.path; // Cloudinary URL
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      phoneNumber,
      category: role === 'vendor' ? category : undefined,
      businessName: role === 'vendor' ? businessName : undefined,
      profilePhoto,
      isApproved: role === 'vendor' ? false : true
    });

    // Send welcome email
    try {
      await sendEmail({
        email: user.email,
        subject: 'Welcome to Event Loop!',
        template: 'welcomeEmail',
        templateData: {
          name: user.name,
          appLink: process.env.APP_URL || 'http://localhost:3000/dashboard',
          unsubscribeLink: process.env.APP_URL
            ? `${process.env.APP_URL}/unsubscribe`
            : 'http://localhost:3000/unsubscribe'
        }
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Notify admin if vendor
    if (role === 'vendor') {
      const message = `A new vendor ${user.name} (${user.businessName}) has registered and is waiting for approval. Please review their application in the admin panel.`;
      try {
        await sendEmail({
          email: process.env.ADMIN_EMAIL,
          subject: 'New Vendor Registration - Action Required',
          message
        });
      } catch (adminEmailError) {
        console.error('Failed to send new vendor notification to admin:', adminEmailError);
      }
    }

    createSendToken(user, 201, res);
  } catch (err) {
    next(err);
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
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password, user.password))) {
      return next(new ErrorResponse('Incorrect email or password', 401));
    }

    // Check if vendor is approved
    if (user.role === 'vendor' && !user.isApproved) {
      return next(new ErrorResponse('Your account is pending approval', 401));
    }

    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Logout user
// @route   GET /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
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
      data: user
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
      return next(new ErrorResponse('User not found', 404));
    }

    const { name, email, description, category, address, businessName } = req.body;
    const updateData = {};

    // Basic fields update
    if (name) updateData.name = name;

    if (email) {
      const emailExists = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (emailExists) {
        return next(new ErrorResponse('Email already exists', 400));
      }
      updateData.email = email;
    }

    if (description) updateData.description = description;

    // Vendor-specific fields
    if (user.role === 'vendor') {
      if (category) updateData.category = category;
      if (businessName) updateData.businessName = businessName;
    }

    // Address update (for both user and vendor)
    if (address) updateData.address = address;

    // Handle profile photo update
    if (req.file) {
      if (user.profilePhoto && user.profilePhoto !== 'default.jpg') {
        const publicId = user.profilePhoto.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      }
      updateData.profilePhoto = req.file.path;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedUser
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
      return next(new ErrorResponse('User not found', 404));
    }

    if (user.role !== 'vendor') {
      return next(new ErrorResponse('Only vendors can update gallery', 403));
    }

    const { removeImages } = req.body; // Array of image URLs to remove
    let galleryImages = [...user.galleryImages];

    // Remove specified images
    if (removeImages && Array.isArray(removeImages)) {
      for (const imageUrl of removeImages) {
        // Remove from cloudinary
        const publicId = imageUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(publicId);
        
        // Remove from array
        galleryImages = galleryImages.filter(img => img !== imageUrl);
      }
    }

    // Add new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.path);
      galleryImages = [...galleryImages, ...newImages];
    }

    // Limit gallery to 20 images
    if (galleryImages.length > 20) {
      return next(new ErrorResponse('Gallery cannot have more than 20 images', 400));
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { galleryImages },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedUser
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
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';

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
        pages: Math.ceil(total / limit)
      },
      data: users
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
      return next(new ErrorResponse('User not found', 404));
    }

    res.status(200).json({
      success: true,
      data: user
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
      return next(new ErrorResponse('User not found', 404));
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) {
      // Check if email is already taken by another user
      const emailExists = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (emailExists) {
        return next(new ErrorResponse('Email already exists', 400));
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
    if (isApproved === true && user.role === 'vendor' && !user.isApproved) {
      const message = `Congratulations! Your vendor account has been approved. You can now start offering your services.`;
      await sendEmail({
        email: updatedUser.email,
        subject: 'Vendor Account Approved',
        message
      });
    }

    res.status(200).json({
      success: true,
      data: updatedUser
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
      return next(new ErrorResponse('User not found', 404));
    }

    // Delete profile photo from cloudinary if it's not default
    if (user.profilePhoto && user.profilePhoto !== 'default.jpg') {
      const publicId = user.profilePhoto.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }

    // Delete gallery images from cloudinary
    if (user.galleryImages && user.galleryImages.length > 0) {
      for (const imageUrl of user.galleryImages) {
        const publicId = imageUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      }
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {}
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
      return next(new ErrorResponse('User not found', 404));
    }

    if (user.role !== 'vendor') {
      return next(new ErrorResponse('User is not a vendor', 400));
    }

    user.isApproved = isApproved;
    await user.save();

    // Send notification email
    const message = isApproved 
      ? `Congratulations! Your vendor account has been approved. You can now start offering your services.`
      : `We're sorry, but your vendor account application has been rejected. Please contact support for more information.`;
    
    await sendEmail({
      email: user.email,
      subject: isApproved ? 'Vendor Account Approved' : 'Vendor Account Rejected',
      message
    });

    res.status(200).json({
      success: true,
      data: user
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
      return next(new ErrorResponse('No user found with that email', 404));
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
        subject: 'Your password reset OTP (valid for 10 min)',
        message
      });

      res.status(200).json({
        success: true,
        message: 'OTP sent to email'
      });
    } catch (err) {
      // Reset the OTP fields if email fails
      user.passwordResetOtp = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return next(new ErrorResponse('Email could not be sent', 500));
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
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new ErrorResponse('Invalid email or OTP has expired', 400));
    }

    // 2) Check if OTP matches
    if (user.passwordResetOtp !== otp) {
      return next(new ErrorResponse('OTP is incorrect', 400));
    }

    // 3) Update password
    user.password = newPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 4) Send confirmation email
    const message = 'Your password has been successfully updated.';

    await sendEmail({
      email: user.email,
      subject: 'Password updated successfully',
      message
    });

    // 5) Log the user in by sending token
    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};