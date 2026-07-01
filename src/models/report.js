const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
    {
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // a report targets either a listing or a vendor profile — exactly one should be set
        targetListingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Listing",
        },

        targetVendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "VendorProfile",
        },

        reason: {
            type: String,
            enum: [
                "food_safety_concern",
                "misleading_listing",
                "no_show",
                "fraud",
                "other",
            ],
            required: true,
        },

        details: {
            type: String,
            trim: true,
        },

        status: {
            type: String,
            enum: [
                "open",
                "reviewed",
                "dismissed",
                "action_taken",
            ],
            default: "open",
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }, // admin who resolved it

        resolvedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

reportSchema.index({ targetVendorId: 1, status: 1 });

reportSchema.index({ status: 1, createdAt: -1 }); // moderation queue

module.exports = mongoose.model("Report", reportSchema);