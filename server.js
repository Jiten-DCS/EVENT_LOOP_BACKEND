
const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// Load env vars first
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'NODE_ENV'];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

const connectDB = require('./config/db');

// Connect to database with error handling
(async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
})();

// Route files
const authRoutes = require('./routes/auth.Routes');
const vendorRoutes = require('./routes/vendor.Routes');
const serviceRoutes = require('./routes/service.Routes');
const bookingRoutes = require('./routes/booking.Routes');
const paymentRoutes = require('./routes/payment.Routes');
const adminRoutes = require('./routes/admin.Routes');
const offerRoutes = require('./routes/offer.Routes');
const reviewsRoute = require('./routes/review.Routes');
const supportRoutes = require('./routes/support.Routes');
const wishlistRoutes = require('./routes/wishlist.Routes');

const app = express();

// Trust proxy (for deployment behind reverse proxy)
app.set('trust proxy', 1);

// Compression middleware
app.use(compression());
// Rate limiting with different limits for different endpoints
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiting
app.use(createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per windowMs
  'Too many requests from this IP, please try again later.'
));

// Stricter rate limiting for auth endpoints
// app.use('/api/auth', createRateLimit(
//   15 * 60 * 1000, // 15 minutes
//   5, // 5 requests per windowMs for auth
//   'Too many authentication attempts, please try again later.'
// ));

// Body parser with size limits
app.use(express.json({ 
  limit: '10mb',
  type: 'application/json'
}));


app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Cookie parser
app.use(cookieParser());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:8080'];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API documentation endpoint (in development)
if (process.env.NODE_ENV === 'development') {
  app.get('/api', (req, res) => {
    res.json({
      message: 'API is running',
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth',
        vendors: '/api/vendors',
        services: '/api/services',
        bookings: '/api/bookings',
        payments: '/api/payments',
        wishlist: '/api/wishlist',
        offers: '/api/offer',
        reviews: '/api/reviews',
        support: '/api/support',
        admin: '/api/admin'
      }
    });
  });
}


// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/offer', offerRoutes);
app.use('/api/reviews', reviewsRoute);
app.use('/api/support', supportRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler for undefined routes - FIXED VERSION
app.all('/{*splat}', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware (should be last)
app.use(require('./middleware/errorMiddleware'));

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/api/health`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('Server closed successfully');
    
    // Close database connection
    require('mongoose').connection.close(() => {
      console.log('Database connection closed');
      process.exit(0);
    });
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle different shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Unhandled Promise Rejection: ${err.message}`);
  console.error('Stack:', err.stack);
  
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  console.error('Stack:', err.stack);
  
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;