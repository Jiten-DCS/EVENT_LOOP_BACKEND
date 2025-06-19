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
    min: [0, 'Price cannot be negative']
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
    required: [true, 'Please provide offer end date']
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

// Pre-save middleware for new documents
offerSchema.pre('save', function(next) {
  // Calculate discount percentage
  // if (this.originalPrice && this.discountedPrice) {
  //   this.discountPercentage = Math.round(((this.originalPrice - this.discountedPrice) / this.originalPrice) * 100);
  // }
  
  // Validate dates
  if (this.validTill <= this.validFrom) {
    return next(new Error('End date must be after start date'));
  }
  
  // Validate prices
  if (this.discountedPrice >= this.originalPrice) {
    return next(new Error('Discounted price must be less than original price'));
  }
  
  next();
});

// Pre-update middleware
offerSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], async function(next) {
  const update = this.getUpdate();
  
  if (update.validTill || update.validFrom) {
    // Get the current document to compare dates
    const doc = await this.model.findOne(this.getQuery());
    
    if (doc) {
      const validFrom = update.validFrom || doc.validFrom;
      const validTill = update.validTill || doc.validTill;
      
      if (new Date(validTill) <= new Date(validFrom)) {
        return next(new Error('End date must be after start date'));
      }
    }
  }
  
  if (update.discountedPrice || update.originalPrice) {
    // Get the current document to compare prices
    const doc = await this.model.findOne(this.getQuery());
    
    if (doc) {
      const originalPrice = update.originalPrice || doc.originalPrice;
      const discountedPrice = update.discountedPrice || doc.discountedPrice;
      
      if (discountedPrice >= originalPrice) {
        return next(new Error('Discounted price must be less than original price'));
      }
    }
  }
  
  next();
});

// Indexes for better performance
offerSchema.index({ vendor: 1 });
offerSchema.index({ service: 1 });
offerSchema.index({ validTill: 1 });
offerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Offer', offerSchema);