const mongoose = require("mongoose");

/** ——— Helpers ——— */
function toUTCDateOnly(input) {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return d;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/; // "HH:mm" 24h
function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
}

/** ——— Line Items (unchanged) ——— */
const lineItemSchema = new mongoose.Schema(
    {
        variant: { type: mongoose.Schema.ObjectId, ref: "ServiceVariant", required: true },
        name: { type: String, required: true },
        unit: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

/** ——— Booking ———
 * No payment fields. Totals are computed from items, but there's no payment state.
 * Slot stores a reference to the vendor-defined slot template (availability.slots._id)
 * plus a snapshot of start/end times for audit/history.
 */
const bookingSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
        userName: { type: String, required: true },
        userEmail: { type: String, required: true },

        vendor: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
        service: { type: mongoose.Schema.ObjectId, ref: "Service", required: true },

        message: { type: String, maxlength: 500 },

        // normalized to UTC 00:00 for the booking day
        date: { type: Date, required: true },

        // Slot info (present when service is slot-based)
        slot: {
            slotId: { type: mongoose.Schema.Types.ObjectId }, // refs Service.availability.slots._id
            startTime: {
                type: String,
                validate: {
                    validator: (v) => (v == null ? true : TIME_RE.test(v)),
                    message: "slot.startTime must be in HH:mm (24h) format",
                },
            },
            endTime: {
                type: String,
                validate: {
                    validator: (v) => (v == null ? true : TIME_RE.test(v)),
                    message: "slot.endTime must be in HH:mm (24h) format",
                },
            },
        },

        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled", "completed"],
            default: "pending",
        },

        // Pricing snapshot (no payment state)
        items: {
            type: [lineItemSchema],
            validate: (v) => Array.isArray(v) && v.length > 0,
        },
        subTotal: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        grandTotal: { type: Number, default: 0 },
        amount: { type: Number, default: 0 }, // mirrors grandTotal; not required
    },
    { timestamps: true }
);

/** ——— Totals (no payment) ——— */
function calcTotals(doc) {
    if (!doc.items || !doc.items.length) return;
    doc.subTotal = doc.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
    doc.tax = Math.round(doc.subTotal * 0.18); // adjust later if you want dynamic tax
    doc.grandTotal = doc.subTotal + doc.tax;
    doc.amount = doc.grandTotal;
}

/** ——— Hooks ——— */
bookingSchema.pre("validate", function (next) {
    // normalize booking date to UTC midnight
    if (this.date) this.date = toUTCDateOnly(this.date);

    // if slot provided, ensure logical time order
    if (this.slot && this.slot.startTime && this.slot.endTime) {
        const a = toMinutes(this.slot.startTime);
        const b = toMinutes(this.slot.endTime);
        if (a >= b) {
            return next(new Error("slot.startTime must be before slot.endTime"));
        }
    }

    // compute totals before validation finishes (amount isn't required anyway)
    calcTotals(this);
    next();
});

/** ——— Indexes ———
 * Prevent double booking the same service+date+slot.
 * Works only when slot.slotId exists (slot-based services),
 * and does NOT affect non-slot-based bookings.
 */
bookingSchema.index(
    { service: 1, date: 1, "slot.slotId": 1 },
    {
        unique: true,
        partialFilterExpression: { "slot.slotId": { $exists: true } },
        name: "uniq_service_date_slot",
    }
);

// helpful query indexes
bookingSchema.index({ vendor: 1, createdAt: -1 });
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ service: 1, date: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
