const jwt = require('jsonwebtoken');

const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
    issuer: process.env.JWT_ISSUER || 'event-manager-app',
    audience: process.env.JWT_AUDIENCE || 'event-manager-users'
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id, user.role);
  
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // CSRF protection
    path: '/' // Ensure cookie is available site-wide
  };

  res.cookie('token', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token, // Consider removing this in production for cookie-only approach
    data: {
      user
    }
  });
};

// Refresh token functionality
const createRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = { 
  signToken, 
  createSendToken, 
  createRefreshToken, 
  verifyRefreshToken 
};