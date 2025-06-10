const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  vendor: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  service: {
    type: mongoose.Schema.ObjectId,
    ref: 'Service',
    required: true
  },
  message: {
    type: String,
    maxlength: [500, 'Message cannot be more than 500 characters']
  },
  date: {
    type: Date,
    required: [true, 'Please provide a booking date']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add this to your booking schema
bookingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 }); // 30 minutes expiry for unpaid bookings

// Or create a cleanup job
exports.cleanupUnpaidBookings = async () => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  await Booking.deleteMany({
    paymentStatus: 'pending',
    createdAt: { $lt: thirtyMinutesAgo }
  });
};


module.exports = mongoose.model('Booking', bookingSchema);