const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Load env vars
dotenv.config();

const connectDB = require('./config/db');
connectDB();


// Route files
const authRoutes = require('./routes/auth.Routes');
const vendorRoutes = require('./routes/vendor.Routes');
const serviceRoutes = require('./routes/service.Routes');
const bookingRoutes = require('./routes/booking.Routes');
const paymentRoutes = require('./routes/payment.Routes');
const adminRoutes = require('./routes/admin.Routes');
const offerRoutes = require('./routes/offer.Routes');
const reviewsRoute = require('./routes/review.Routes');
const wishlistRoutes = require('./routes/wishlist.Routes');



const app = express();

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());


// Set security headers
app.use(helmet());


// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100
});
app.use(limiter);


// Enable CORS
app.use(cors({
  origin: 'http://localhost:8080', // Adjust if your frontend runs on a different port
  credentials: true
}));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/offer', offerRoutes);
app.use('/api/reviews', reviewsRoute);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use(require('./middleware/errorMiddleware'));

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});