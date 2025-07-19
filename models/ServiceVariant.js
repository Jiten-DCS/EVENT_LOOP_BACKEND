const mongoose = require('mongoose');

const serviceVariantSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.ObjectId,
      ref: 'Service',
      required: true,
      index: true
    },
    name: { type: String, required: true },   // e.g. "Veg Plate"
    unit: { type: String, required: true },   // "plate", "litre", "hour", ...
    price: { type: Number, required: true, min: 0 },
    minQty: { type: Number, default: 1 },
    maxQty: Number,
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ServiceVariant', serviceVariantSchema);