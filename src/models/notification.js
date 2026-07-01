const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        type: {
            type: String,
            enum: [
                "reservation_confirmed",
                "reservation_cancelled",
                "payout_completed",
                "listing_expiring_soon",
                "account_suspended",
            ],
            required: true,
        },

        relatedReservationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Reservation",
        },

        channel: {
            type: String,
            enum: ["email", "sms", "push"],
            default: "email",
        },

        status: {
            type: String,
            enum: ["queued", "sent", "failed"],
            default: "queued",
        },

        sentAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);