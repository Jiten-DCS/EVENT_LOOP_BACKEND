const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Please provide a phone number'],
    unique: true,
    validate: {
      validator: function(v) {
        return validator.isMobilePhone(v, 'any', { strictMode: false });
      },
      message: 'Please provide a valid phone number'
    }
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'vendor', 'admin'],
    default: 'user'
  },
  category: {
    type: String,
    required: function() { return this.role === 'vendor'; }
  },
  profilePhoto: {
    type: String,
    default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png'
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  address: {
    type: String,
    maxlength: [200, 'Address cannot be more than 200 characters']
  },
  businessName: {
    type: String,
    required: function() { return this.role === 'vendor'; },
    maxlength: [100, 'Business name cannot be more than 100 characters']
  },
  galleryImages: {
  type: [String],
  validate: {
    validator: function (arr) {
      return arr.length <= 12;
    },
    message: 'You can upload a maximum of 12 gallery images.'
  }
},
  services: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Service'
  }],
  availability: [{
    date: Date,
    slots: [String]
  }],
  isApproved: {
    type: Boolean,
    default: false
  },
  wishlist: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Service'
  }],
  // Password reset fields
  passwordResetOtp: String,
  passwordResetExpires: Date,
  // Phone verification fields
  phoneNumberVerified: {
    type: Boolean,
    default: false
  },
  // Updated Twilio SMS verification fields
  phoneVerificationOtp: {
    type: String,
    select: false
  },
  phoneVerificationExpires: {
    type: Date,
    select: false
  },
  phoneVerificationAttempts: {
    type: Number,
    default: 0,
    max: [5, 'Maximum verification attempts reached']
  },
  phoneVerificationBlockedUntil: Date,
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ name: 'text', email: 'text', description: 'text', phoneNumber: 'text' });
userSchema.index({ phoneNumberVerified: 1 });
userSchema.index({ phoneVerificationBlockedUntil: 1 });

// Document middleware to hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Update lastActiveAt timestamp before update
userSchema.pre('findOneAndUpdate', function(next) {
  this.set({ lastActiveAt: Date.now() });
  next();
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if phone verification is blocked
userSchema.methods.isPhoneVerificationBlocked = function() {
  return this.phoneVerificationBlockedUntil && this.phoneVerificationBlockedUntil > Date.now();
};

// Virtual for formatted phone number
// userSchema.virtual('formattedPhone').get(function() {
//   return `+${this.phoneNumber.replace(/\D/g, '')}`;
// });


module.exports = mongoose.model('User', userSchema);