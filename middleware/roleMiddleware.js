const ErrorResponse = require('../utils/errorResponse');

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

exports.isVendorApproved = async (req, res, next) => {
  if (req.user.role === 'vendor' && !req.user.isApproved) {
    return next(
      new ErrorResponse('Vendor not approved by admin yet', 403)
    );
  }
  next();
};