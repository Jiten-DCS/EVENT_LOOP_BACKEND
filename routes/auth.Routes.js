const express = require('express');
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
  updateVendorApproval
} = require('../controllers/auth.Controller');
const { protect, authorize, rateLimiter } = require('../middleware/authMiddleware');
const { uploadSingleImage, uploadMultipleImages } = require('../middleware/uploadMiddleware');

// Public routes
router.post('/register', rateLimiter(5, 10 * 60 * 1000), uploadSingleImage, register);
router.post('/login', rateLimiter(5, 10 * 60 * 1000), login);

// Protected routes (All authenticated users)
router.get('/logout', logout);
router.get('/me', protect, getMe);
router.put('/update-profile', protect, uploadSingleImage, updateProfile);

// Vendor specific routes
router.put('/update-gallery', protect, authorize('vendor'), uploadMultipleImages, updateGallery);

// Admin only routes
router.get('/users', protect, authorize('admin'), getUsers);
router.get('/users/:id', protect, authorize('admin'), getUser);
router.put('/users/:id', protect, authorize('admin'), updateUser);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);
router.put('/users/:id/approval', protect, authorize('admin'), updateVendorApproval);

module.exports = router;