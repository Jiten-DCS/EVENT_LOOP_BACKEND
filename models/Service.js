// models/Service.js
const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
    {
        vendor: {
            type: mongoose.Schema.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: [true, "Please provide a title"],
            trim: true,
            maxlength: [100, "Title cannot be more than 100 characters"],
        },
        description: {
            type: String,
            required: [true, "Please provide a description"],
            maxlength: [5000, "Description cannot be more than 5000 characters"],
        },
        minPrice: {
            type: Number,
            min: [0, "Price cannot be negative"],
        },
        maxPrice: {
            type: Number,
        },
        category: {
            type: mongoose.Schema.ObjectId,
            ref: "Category",
            required: [true, "Please provide a category"],
        },
        subCategory: {
            type: String,
            required: [true, "Please provide a sub-category"],
        },
        tags: [String],
        images: {
            type: [String],
            validate: {
                validator: function (value) {
                    return value.length <= 10;
                },
                message: "Cannot upload more than 10 images",
            },
        },
        location: {
            type: String,
            required: [true, "Please provide service location"],
        },
        phone: {
            type: String,
            required: [true, "Please provide contact number"],
        },
        website: String,
        socialLinks: {
            facebook: String,
            instagram: String,
            twitter: String,
            youtube: String,
        },
        faqs: [
            {
                question: { type: String, required: true },
                answer: { type: String, required: true },
            },
        ],
        details: {
            type: mongoose.Schema.Types.Mixed, // dynamic category-specific fields
        },
        variants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "ServiceVariant",
            },
        ],
        availability: {
            isSlotBased: { type: Boolean, default: false },

            // vendor-defined slots
            slots: [
                {
                    startTime: { type: String, required: true }, // "09:00"
                    endTime: { type: String, required: true }, // "13:00"
                },
            ],

            // bookings by date
            bookedDates: [
                {
                    date: { type: Date },
                    slots: [
                        {
                            time: { type: String }, // "09:00-13:00"
                            booked: { type: Boolean, default: false }, // mark if booked
                        },
                    ],
                },
            ],
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        strictPopulate: false,
    }
);

serviceSchema.index({ category: 1 });
serviceSchema.index({
    location: "text",
    title: "text",
    description: "text",
    subCategory: "text",
});

module.exports = mongoose.model("Service", serviceSchema);
