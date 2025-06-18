const express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  updateGallery,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  updateVendorApproval,
  forgotPassword,
  resetPassword,
  verifyRegistration, // Updated controller
  sendOTP, // Updated controller
  verifyOTP, // Updated controller
  resendLoginOTP, // New function
  verifyLoginOTP, // New function
} = require("../controllers/auth.Controller");
const {
  protect,
  authorize,
  rateLimiter,
} = require("../middleware/authMiddleware");
const {
  uploadSingleImage,
  uploadMultipleImages,
} = require("../middleware/uploadMiddleware");

// Public routes
router.post(
  "/register",
  rateLimiter(5, 10 * 60 * 1000),
  uploadSingleImage,
  register
);
router.post("/login", rateLimiter(5, 10 * 60 * 1000), login);

// New routes for login phone verification
router.post("/resend-login-otp", resendLoginOTP);
router.post("/verify-login-otp", verifyLoginOTP);

// OTP Verification routes (Updated for Twilio SMS)
router.post(
  "/verify-registration",
  rateLimiter(3, 5 * 60 * 1000),
  verifyRegistration
); // Rate limit: 3 attempts per 5 minutes
router.post("/send-otp", rateLimiter(3, 5 * 60 * 1000), sendOTP); // Rate limit: 3 attempts per 5 minutes
router.post("/verify-otp", rateLimiter(5, 10 * 60 * 1000), verifyOTP); // Rate limit: 5 attempts per 10 minutes

// Protected routes (All authenticated users)
router.get("/logout", logout);
router.get("/me", protect, getMe);
router.put("/update-profile", protect, uploadSingleImage, updateProfile);

// Vendor specific routes
router.put(
  "/update-gallery",
  protect,
  authorize("vendor"),
  uploadMultipleImages,
  updateGallery
);

// Admin only routes
router.get("/users", protect, authorize("admin"), getUsers);
router.get("/users/:id", protect, authorize("admin"), getUser);
router.put("/users/:id", protect, authorize("admin"), updateUser);
router.delete("/users/:id", protect, authorize("admin"), deleteUser);
router.put(
  "/users/:id/approval",
  protect,
  authorize("admin"),
  updateVendorApproval
);

// Password reset routes
router.post("/forgot-password", forgotPassword);
router.put("/reset-password", resetPassword);

module.exports = router;
