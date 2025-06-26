const User = require("../models/User");
const Category = require("../models/Category");
const Offer = require("../models/Offer");
const ErrorResponse = require("../utils/errorResponse");
const sendEmail = require("../utils/emailSender");
const vendorStatusEmailTemplate = require("../utils/emailTemplates/vendorStatusEmailTemplate");
const accountBlockedEmailTemplate = require("../utils/emailTemplates/accountBlockedEmailTemplate");
const accountUnblockedEmailTemplate = require("../utils/emailTemplates/accountUnblockedEmailTemplate");

// @desc    Get all vendors (for admin)
// @route   GET /api/admin/vendors
// @access  Private (Admin only)
exports.getVendors = async (req, res, next) => {
  try {
    const vendors = await User.find({ role: "vendor" }).select("-password");

    res.status(200).json({
      success: true,
      count: vendors.length,
      data: vendors,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Approve/reject vendor
// @route   PUT /api/admin/vendors/:id/approve
// @access  Private (Admin only)
exports.approveVendor = async (req, res, next) => {
  try {
    const { isApproved } = req.body;

    const vendor = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!vendor || vendor.role !== "vendor") {
      return next(new ErrorResponse("Vendor not found", 404));
    }

    // Send notification email to vendor
    const message = `Your vendor account has been ${
      isApproved ? "approved" : "rejected"
    } by the admin.`;
    await sendEmail({
      email: vendor.email,
      subject: "Vendor Account Status Update",
      html: vendorStatusEmailTemplate({
        vendorName: vendor.name,
        isApproved,
        companyLogoUrl: "https://your-cloudinary-url.com/company-logo.png", // replace with your logo URL
      }),
    });

    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create category
// @route   POST /api/admin/categories
// @access  Private (Admin only)
exports.createCategory = async (req, res, next) => {
  try {
    const { title } = req.body;

    // Ensure subCategories is an array
    let subCategories = req.body.subCategories;
    if (!subCategories) subCategories = [];
    else if (typeof subCategories === "string") {
      // Try parsing JSON array format, e.g. '["a","b"]'
      try {
        const parsed = JSON.parse(subCategories);
        subCategories = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Fallback: comma-separated string
        subCategories = subCategories
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    console.log({ title, subCategories });

    // Check for uploaded image
    if (!req.file) {
      return next(new ErrorResponse("Please upload a category image", 400));
    }

    const category = await Category.create({
      title,
      subCategories,
      image: req.file.path,
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Public
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private (Admin only)
exports.updateCategory = async (req, res, next) => {
  try {
    const { title, subCategories } = req.body;
    const updateData = {};

    // Handle title update
    if (title) {
      updateData.title = title;
    }

    // Handle subCategories update
    if (subCategories) {
      let processedSubCategories = subCategories;
      if (typeof subCategories === "string") {
        try {
          const parsed = JSON.parse(subCategories);
          processedSubCategories = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          processedSubCategories = subCategories
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
      updateData.subCategories = processedSubCategories;
    }

    // Handle image update if new file uploaded
    if (req.file) {
      updateData.image = req.file.path;

      // Optionally delete old image from storage
      // const oldCategory = await Category.findById(req.params.id);
      // if (oldCategory.image) {
      //   // Add code here to delete the old image from your storage (Cloudinary, S3, etc.)
      //   // Example for Cloudinary:
      //   // await cloudinary.uploader.destroy(oldCategory.image);
      // }
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      return next(new ErrorResponse("Category not found", 404));
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private (Admin only)
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return next(new ErrorResponse("Category not found", 404));
    }

    // Delete associated image from storage
    if (category.image) {
      // Add code here to delete the image from your storage
      // Example for Cloudinary:
      // await cloudinary.uploader.destroy(category.image);
    }

    // Optional: Handle services that might be using this category
    // Example:
    // await Service.updateMany(
    //   { category: category.title },
    //   { $unset: { category: 1 } }
    // );

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all offers
// @route   GET /api/admin/offers
// @access  Public
exports.getOffers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, active } = req.query;

    let filter = {};
    if (active !== undefined) {
      filter.isActive = active === "true";
    }

    // Only show offers that are still valid
    filter.validTill = { $gte: new Date() };

    const offers = await Offer.find(filter)
      .populate("vendor", "name email")
      .populate("service", "title category location")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Offer.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: offers.length,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: offers,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single offer
// @route   GET /api/admin/offers/:id
// @access  Public
exports.getOffer = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate("vendor", "name email phone")
      .populate(
        "service",
        "title description category subCategory location phone images"
      );

    if (!offer) {
      return next(new ErrorResponse("Offer not found", 404));
    }

    res.status(200).json({
      success: true,
      data: offer,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Block a user
// @route   PUT /api/admin/users/:id/block
// @access  Private (Admin only)
exports.blockUser = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return next(new ErrorResponse("Reason is required", 400));
    }

    // First find the user to check their role
    const userToBlock = await User.findById(req.params.id);

    if (!userToBlock) {
      return next(new ErrorResponse("User not found", 404));
    }

    // Check if user is a vendor
    if (userToBlock.role === "vendor") {
      return next(new ErrorResponse("Vendors cannot be blocked", 400));
    }

    // Proceed with blocking if not a vendor
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isBlocked: true,
        blockDetails: {
          blockedAt: Date.now(),
          blockedBy: req.user.id,
          reason,
        },
      },
      { new: true, runValidators: true }
    );

    // Send notification email
    const message = `Your account has been blocked by the admin. Reason: ${reason}`;
    await sendEmail({
      email: user.email,
      subject: "Account Blocked",
      html: accountBlockedEmailTemplate({
        userName: user.name,
        reason,
        companyLogoUrl: "https://your-cloudinary-url.com/company-logo.png", // replace with your logo URL
      }),
    });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Unblock a user
// @route   PUT /api/admin/users/:id/unblock
// @access  Private (Admin only)
exports.unblockUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isBlocked: false,
        $set: {
          "blockDetails.unblockedAt": Date.now(),
          "blockDetails.unblockedBy": req.user.id,
        },
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return next(new ErrorResponse("User not found", 404));
    }

    // Send notification email
    const message =
      "Your account has been unblocked by the admin. You can now login and use the platform.";
   await sendEmail({
  email: user.email,
  subject: "Account Unblocked",
  html: accountUnblockedEmailTemplate({
    userName: user.name,
    companyLogoUrl: 'https://your-cloudinary-url.com/company-logo.png' // replace with your logo URL
  })
});

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};
