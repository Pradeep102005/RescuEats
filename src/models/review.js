const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
    {
        reservationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Reservation",
            required: true,
            unique: true, // one review per reservation — prevents duplicate/spam reviews
        },
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "VendorProfile", required: true },

        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, trim: true },
    },
    { timestamps: true }
);

reviewSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);