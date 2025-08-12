const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
require('dotenv').config()

exports.protect = async (req, res, next) => {
  let token;

  // Check for token in headers or cookies
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route due to no token', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new ErrorResponse('No user found with this token', 404));
    }

    // Additional security: Check if vendor is still approved
    if (user.role === 'vendor' && !user.isApproved) {
      return next(new ErrorResponse('Your account is no longer approved', 401));
    }

    req.user = user;
    next();
  } catch (err) {
    // Token expired or invalid
    if (err.name === 'TokenExpiredError') {
      return next(new ErrorResponse('Token expired, please login again', 401));
    } else if (err.name === 'JsonWebTokenError') {
      return next(new ErrorResponse('Invalid token', 401));
    }
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ErrorResponse(`User role ${req.user.role} is not authorized to access this route`, 403));
    }
    next();
  };
};

// Rate limiting middleware for auth routes
exports.rateLimiter = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = req.ip + req.path;
    const now = Date.now();
    
    if (!attempts.has(key)) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const attempt = attempts.get(key);
    
    if (now > attempt.resetTime) {
      attempt.count = 1;
      attempt.resetTime = now + windowMs;
      return next();
    }
    
    if (attempt.count >= maxAttempts) {
      return next(new ErrorResponse('Too many attempts, please try again later', 429));
    }
    
    attempt.count++;
    next();
  };
};

// Check if vendor is approved
exports.isVendorApproved = async (req, res, next) => {
  if (req.user.role === 'vendor' && !req.user.isApproved) {
    return next(new ErrorResponse('Vendor not approved by admin yet', 403));
  }
  next();
};