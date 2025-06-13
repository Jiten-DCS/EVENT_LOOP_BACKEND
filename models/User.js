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
    unique: true
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
    default: 'default.jpg'
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
  galleryImages: [String],
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
  passwordResetOtp: String,
  passwordResetExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Create text indexes for better search functionality on name, email, and description
userSchema.index({ name: 'text', email: 'text', description: 'text', phoneNumber: 'text' });

module.exports = mongoose.model('User', userSchema);
