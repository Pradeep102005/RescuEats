const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
    {
        reservationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Reservation",
            required: true,
            unique: true, // Prevents a customer from rating the same pickup more than once
        },
        customerId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "User", 
            required: true 
        },
        vendorId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "VendorProfile", 
            required: true 
        },
        rating: { 
            type: Number, 
            required: true, 
            min: 1, 
            max: 5 
        },
    },
    { timestamps: true }
);

ratingSchema.index({ vendorId: 1, createdAt: -1 });

module.exports = mongoose.model("Rating", ratingSchema);
