const mongoose = require("mongoose");

const vendorProfileSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        businessName: {
            type: String,
            required: true,
            trim: true,
        },

        fssaiOrLicenseNumber: {
            type: String,
            trim: true, // basic food-safety compliance check
        },

        pickupAddress: {
            type: String,
            required: true,
        },

        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },

            coordinates: {
                type: [Number],
                required: true, // [lng, lat]
            },
        },

        // denormalized — updated via background job, not computed on every read
        avgRating: {
            type: Number,
            default: 0,
        },

        totalReviews: {
            type: Number,
            default: 0,
        },

        activeListingsCount: {
            type: Number,
            default: 0,
        },

        // trust/safety fields — tied to Report auto-suspension logic
        reportCount: {
            type: Number,
            default: 0,
        },

        isSuspended: {
            type: Boolean,
            default: false,
        },

        // payout details — where vendor's share actually gets sent
        payoutMethod: {
            type: String,
            enum: ["bank_transfer", "upi"],
            default: "upi",
        },

        payoutDetails: {
            upiId: {
                type: String,
                trim: true,
            },

            bankAccountNumber: {
                type: String,
                trim: true,
            },

            ifscCode: {
                type: String,
                trim: true,
            },
        },
    },
    {
        timestamps: true,
    }
);

vendorProfileSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("VendorProfile", vendorProfileSchema);