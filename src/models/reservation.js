const mongoose = require("mongoose");
const crypto = require("crypto");

const reservationSchema = new mongoose.Schema(
    {
        listingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Listing",
            required: true,
        },

        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "VendorProfile",
            required: true,
        },

        // a reservation is created first (pending_payment), then associated with a payment record.
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
        },

        quantityReserved: {
            type: Number,
            required: true,
            min: 1,
        },

        status: {
            type: String,
            enum: [
                "pending_payment",
                "confirmed",
                "picked_up",
                "expired",
                "cancelled",
            ],
            default: "pending_payment",
        },

        pickupCode: {
            type: String,
            default: () =>
                crypto.randomInt(100000, 999999).toString(), // vendor verifies this at handoff
        },

        pickupDeadline: {
            type: Date,
            required: true,
        }, // mirrors Listing.closingTime at time of booking

        pickedUpAt: {
            type: Date,
        },

        cancelledAt: {
            type: Date,
        },

        cancellationReason: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

reservationSchema.index({ customerId: 1, createdAt: -1 }); // customer order history

reservationSchema.index({ vendorId: 1, status: 1 }); // vendor dashboard

reservationSchema.index({ listingId: 1, status: 1 }); // stock/availability checks

module.exports = mongoose.model("Reservation", reservationSchema);