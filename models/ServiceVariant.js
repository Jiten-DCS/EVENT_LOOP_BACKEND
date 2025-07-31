const mongoose = require("mongoose");

const serviceVariantSchema = new mongoose.Schema(
    {
        service: {
            type: mongoose.Schema.ObjectId,
            ref: "Service",
            required: true,
            index: true,
        },
        name: { type: String, required: true },
        unit: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        minQty: { type: Number, default: 1 },
        maxQty: Number,
        isActive: { type: Boolean, default: true },
        isCheckbox: { type: Boolean, default: false }, // New field
        defaultChecked: { type: Boolean, default: false }, // Optional: if some checkboxes should be pre-selected
    },
    { timestamps: true }
);

module.exports = mongoose.model('ServiceVariant', serviceVariantSchema);