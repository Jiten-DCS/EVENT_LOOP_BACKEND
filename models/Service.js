const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    maxlength: [5000, 'Description cannot be more than 1000 characters']
  },
  minPrice: {
    type: Number,
    required: [true, 'Please provide minimum price'],
    min: [0, 'Price cannot be negative']
  },
  maxPrice: {
    type: Number,
    required: [true, 'Please provide maximum price'],
    validate: {
      validator: function(value) {
        return value >= this.minPrice;
      },
      message: 'Max price must be greater than or equal to min price'
    }
  },
  category: {
    type: mongoose.Schema.ObjectId,
    ref: 'Category',
    required: [true, 'Please provide a category']
  },
  subCategory: {
    type: String,
    required: [true, 'Please provide a sub-category'],
    validate: {
      validator: function(value) {
        // This will check if subCategory exists in the category's subCategories array
        return this.populated('category') 
          ? this.category.subCategories.includes(value)
          : true;
      },
      message: 'Invalid sub-category for the selected category'
    }
  },
  tags: [String],
  images: {
    type: [String],
    validate: {
      validator: function(value) {
        return value.length <= 10;
      },
      message: 'Cannot upload more than 10 images'
    }
  },
  location: {
    type: String,
    required: [true, 'Please provide service location']
  },
  phone: {
    type: String,
    required: [true, 'Please provide contact number']
  },
  website: String,
  socialLinks: {
    facebook: String,
    instagram: String,
    twitter: String,
    youtube: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
serviceSchema.index({ category: 1 });
serviceSchema.index({ location: 'text', title: 'text', description: 'text', subCategory: 'text' });

module.exports = mongoose.model('Service', serviceSchema);