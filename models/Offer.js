const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: [true, 'Please provide offer title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide offer description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  bannerImage: {
    type: String,
    required: [true, 'Please provide offer banner image']
  },
  originalPrice: {
    type: Number,
    required: [true, 'Please provide original price'],
    min: [0, 'Price cannot be negative']
  },
  discountedPrice: {
    type: Number,
    required: [true, 'Please provide discounted price'],
    min: [0, 'Price cannot be negative'],
    validate: {
      validator: function(value) {
        return value < this.originalPrice;
      },
      message: 'Discounted price must be less than original price'
    }
  },
  discountPercentage: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot be more than 100%']
  },
  validFrom: {
    type: Date,
    required: [true, 'Please provide offer start date'],
    default: Date.now
  },
  validTill: {
    type: Date,
    required: [true, 'Please provide offer end date'],
    validate: {
      validator: function(value) {
        return value > this.validFrom;
      },
      message: 'End date must be after start date'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate discount percentage before saving
offerSchema.pre('save', function(next) {
  if (this.originalPrice && this.discountedPrice) {
    this.discountPercentage = Math.round(((this.originalPrice - this.discountedPrice) / this.originalPrice) * 100);
  }
  next();
});

// Indexes for better performance
offerSchema.index({ vendor: 1 });
offerSchema.index({ service: 1 });
offerSchema.index({ validTill: 1 });
offerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Offer', offerSchema);