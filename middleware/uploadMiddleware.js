const multer = require('multer');
const { storage } = require('../config/cloudinary');
const ErrorResponse = require('../utils/errorResponse');

// File filter for images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    // Check file type more specifically
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ErrorResponse('Please upload only JPEG, JPG, PNG, or WebP images', 400), false);
    }
  } else {
    cb(new ErrorResponse('Please upload only images', 400), false);
  }
};

// Base multer configuration
const multerConfig = {
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB per file
    files: 10 // Maximum 10 files for multiple upload
  }
};

// Single image upload (for profile photos)
const uploadSingle = multer(multerConfig).single('categoryImage');

// Multiple images upload (for gallery)
const uploadMultiple = multer(multerConfig).array('galleryImages', 10);

// Enhanced error handling for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new ErrorResponse('File size too large. Maximum size is 5MB', 400));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new ErrorResponse('Too many files. Maximum 10 files allowed', 400));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new ErrorResponse('Unexpected file field', 400));
    }
  }
  next(err);
};

// Middleware for single image upload with error handling
exports.uploadSingleImage = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
};

// Middleware for multiple images upload with error handling
exports.uploadMultipleImages = (req, res, next) => {
  uploadMultiple(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
};

// Middleware for flexible upload (single or multiple based on field name)
exports.uploadFlexible = (req, res, next) => {
  const upload = multer(multerConfig).fields([
    { name: 'categoryImage', maxCount: 1 }, // Changed from profilePhoto, ensure client sends 'categoryImage' for this
    { name: 'galleryImages', maxCount: 10 }
  ]);

  upload(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
};

// Helper function to validate image dimensions (optional)
exports.validateImageDimensions = (minWidth = 100, minHeight = 100, maxWidth = 2000, maxHeight = 2000) => {
  return async (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    try {
      const sharp = require('sharp');
      const files = req.files || [req.file];

      for (const file of files) {
        if (file) {
          const { width, height } = await sharp(file.buffer).metadata();
          
          if (width < minWidth || height < minHeight) {
            return next(new ErrorResponse(`Image dimensions too small. Minimum ${minWidth}x${minHeight}px required`, 400));
          }
          
          if (width > maxWidth || height > maxHeight) {
            return next(new ErrorResponse(`Image dimensions too large. Maximum ${maxWidth}x${maxHeight}px allowed`, 400));
          }
        }
      }
      
      next();
    } catch (error) {
      next(new ErrorResponse('Error validating image dimensions', 500));
    }
  };
};