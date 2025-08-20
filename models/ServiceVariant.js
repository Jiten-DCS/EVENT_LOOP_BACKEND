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

        // 🆕 Slot behaviour (only matters for halls / slot-based services)
        isSlotBased: { type: Boolean, default: false }, // true for hall variants
        slotType: {
            type: String,
            enum: [null, "full-day", "half-day"], // keep it simple for now
            default: null,
        },
        slotName: {
            type: String,
            enum: [null, "morning", "afternoon", "evening", "night"],
            default: null,
        },
    },
    { timestamps: true }
);

// Helpful index for availability queries
serviceVariantSchema.index({ service: 1, isActive: 1, isSlotBased: 1, slotType: 1, slotName: 1 });

module.exports = mongoose.model("ServiceVariant", serviceVariantSchema);
