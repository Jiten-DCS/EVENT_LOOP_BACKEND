// models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a category title'],
    unique: true,
    trim: true,
    maxlength: [50, 'Category title cannot be more than 50 characters']
  },
  slug: {
    type: String,
    unique: true
  },
  image: {
    type: String,
    required: [true, 'Please provide a category image']
  },
  subCategories: [String],
  config: {
    type: mongoose.Schema.Types.Mixed // dynamic form structure per category
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

categorySchema.pre('save', function (next) {
  this.slug = this.title.toLowerCase().split(' ').join('-');
  next();
});

module.exports = mongoose.model('Category', categorySchema);