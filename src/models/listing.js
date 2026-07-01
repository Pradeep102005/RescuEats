const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "VendorProfile",
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            trim: true,
        },

        images: [
            {
                type: String,
            },
        ], // S3 URLs

        // pricing set by vendor — this is the RAW cost, not what customer pays.
        // final customer-facing price is computed at reservation time and stored on Payment,
        // never trust a stale computed price here — always recompute from baseCost.
        baseCost: {
            type: Number,
            required: true,
            min: 1,
        },

        quantityTotal: {
            type: Number,
            required: true,
            min: 1,
        },

        quantityAvailable: {
            type: Number,
            required: true,
            min: 0,
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

        closingTime: {
            type: Date,
            required: true,
        }, // TTL field — self-deletes at/after this time

        status: {
            type: String,
            enum: ["active", "sold_out", "expired"],
            default: "active",
        },
    },
    {
        timestamps: true,
    }
);

listingSchema.index({ location: "2dsphere" });

listingSchema.index({
    vendorId: 1,
    status: 1,
});

module.exports = mongoose.model("Listing", listingSchema);