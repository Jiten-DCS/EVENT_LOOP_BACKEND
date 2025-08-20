// const mongoose = require('mongoose');

// const bookingSchema = new mongoose.Schema({
//   user: {
//     type: mongoose.Schema.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   userName: {
//     type: String,
//     required: true
//   },
//   userEmail: {
//     type: String,
//     required: true
//   },
//   vendor: {
//     type: mongoose.Schema.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   service: {
//     type: mongoose.Schema.ObjectId,
//     ref: 'Service',
//     required: true
//   },
//   message: {
//     type: String,
//     maxlength: [500, 'Message cannot be more than 500 characters']
//   },
//   date: {
//     type: Date,
//     required: [true, 'Please provide a booking date']
//   },
//   status: {
//     type: String,
//     enum: ['pending', 'confirmed', 'cancelled', 'completed'],
//     default: 'pending'
//   },
//   paymentStatus: {
//     type: String,
//     enum: ['pending', 'paid', 'refunded'],
//     default: 'pending'
//   },
//   amount: {
//     type: Number,
//     required: true
//   },

//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Add this to your booking schema
// bookingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 }); // 30 minutes expiry for unpaid bookings

// // Or create a cleanup job
// exports.cleanupUnpaidBookings = async () => {
//   const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
//   await Booking.deleteMany({
//     paymentStatus: 'pending',
//     createdAt: { $lt: thirtyMinutesAgo }
//   });
// };


// module.exports = mongoose.model('Booking', bookingSchema);



// models/Booking.js
const mongoose = require('mongoose');

// ---- utils --------------------------------------------------------------
function toUTCDateOnly(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return d;       // let Mongoose throw required error
  // normalize to 00:00:00 UTC (date-only semantics)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const lineItemSchema = new mongoose.Schema(
    {
        // 🔗 keep a hard link to the selected variant
        variant: { type: mongoose.Schema.ObjectId, ref: "ServiceVariant", required: true },

        name: { type: String, required: true }, // e.g. "Veg Plate"
        unit: { type: String, required: true }, // "plate", "litre", "piece" …
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },

        // Slot snapshot — only relevant when isSlotBased=true
        isSlotBased: { type: Boolean, default: false },
        slotType: { type: String, enum: [null, "full-day", "half-day"], default: null },
        slotName: {
            type: String,
            enum: [null, "morning", "afternoon", "evening", "night"],
            default: null,
        },
    },
    { _id: false }
);

const bookingSchema = new mongoose.Schema(
    {
        // ---- WHO ----------------------------------------------------------
        user: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
        userName: { type: String, required: true },
        userEmail: { type: String, required: true },
        vendor: { type: mongoose.Schema.ObjectId, ref: "User", required: true },

        // ---- WHAT ----------------------------------------------------------
        service: { type: mongoose.Schema.ObjectId, ref: "Service", required: true },
        message: { type: String, maxlength: 500 },

        // ---- WHEN (date-only semantics) -----------------------------------
        date: { type: Date, required: [true, "Please provide a booking date"] },

        // ---- STATUS --------------------------------------------------------
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled", "completed"],
            default: "pending",
        },
        paymentStatus: { type: String, enum: ["pending", "paid", "refunded"], default: "pending" },

        // ---- LINE-ITEMS & TOTALS ------------------------------------------
        items: { type: [lineItemSchema], validate: (v) => Array.isArray(v) && v.length > 0 },
        subTotal: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        grandTotal: { type: Number, default: 0 },

        // ---- legacy flat amount -------------------------------------------
        amount: { type: Number, required: true },

        createdAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

// -------------------- AUTO-CALC TOTALS ---------------------------------
// ---- Calculations -------------------------------------------------------
function calcTotals(doc) {
  if (!doc.items || !doc.items.length) return;
  doc.subTotal = doc.items.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);
  doc.tax        = Math.round(doc.subTotal * 0.18);  // GST 18% example
  doc.grandTotal = doc.subTotal + doc.tax;
  doc.amount     = doc.grandTotal;                   // keep legacy field synced
}
// Normalize date to UTC midnight (avoid timezone collisions)
bookingSchema.pre("validate", function(next) {
  if (this.date) this.date = toUTCDateOnly(this.date);

  // Business rule: at most ONE slot-based item per booking
  const slotItems = (this.items || []).filter(i => i.isSlotBased);
  if (slotItems.length > 1) {
    return next(new Error("Only one slot-based item is allowed per booking."));
  }
  next();
});

bookingSchema.pre("save", function(next) { calcTotals(this); next(); });
bookingSchema.pre("updateOne", function(next) {
  const set = this.getUpdate()?.$set || {};
  if (set.items) calcTotals(set);
  next();
});

// -------------------- TTL for unpaid bookings --------------------------
// bookingSchema.index(
//   { createdAt: 1 },
//   { expireAfterSeconds: 30 * 60 } // 30 min
// );

module.exports = mongoose.model('Booking', bookingSchema);