const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
      unique: true, // enforces 1:1 — a reservation cannot exist without exactly one payment
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

    // --- the split, snapshotted at transaction time, immutable after creation ---
    baseAmount: {
      type: Number,
      required: true,
    }, // = Listing.baseCost * quantityReserved, at time of booking

    platformFeePercent: {
      type: Number,
      required: true,
      default: 9,
    }, // stored per-payment, not hardcoded in code

    platformFeeAmount: {
      type: Number,
      required: true,
    }, // = baseAmount * (platformFeePercent / 100)

    finalAmount: {
      type: Number,
      required: true,
    }, // = baseAmount + platformFeeAmount — what customer actually pays

    currency: {
      type: String,
      default: "INR",
    },

    // --- customer-side payment state ---
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    gatewayOrderId: {
      type: String,
    }, // e.g. Razorpay order_id, created when reservation initiated

    gatewayPaymentId: {
      type: String,
    }, // set once gateway confirms payment

    paidAt: {
      type: Date,
    },

    // --- vendor-side payout state, deliberately separate from customer payment state.
    // customer payment can be "paid" while payout is still "pending" — payouts may be
    // batched/delayed, this mirrors how Razorpay Route / Stripe Connect actually work ---
    vendorPayoutStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    vendorPayoutAmount: {
      type: Number,
      required: true,
    }, // = baseAmount, vendor gets their listed price in full

    vendorPayoutTransactionId: {
      type: String,
    },

    payoutAt: {
      type: Date,
    },

    // refund tracking — needed for the cancellation rollback flow (Phase 4)
    refundAmount: {
      type: Number,
      default: 0,
    },

    refundedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// compute the split automatically before first save, so controllers never hand-roll the math
paymentSchema.pre("validate", function (next) {
  if (this.isNew) {
    this.platformFeeAmount = Math.round(
      this.baseAmount * (this.platformFeePercent / 100) * 100
    ) / 100;

    this.finalAmount = this.baseAmount + this.platformFeeAmount;

    this.vendorPayoutAmount = this.baseAmount;
  }

  next();
});

paymentSchema.index({ vendorId: 1, vendorPayoutStatus: 1 }); // vendor payout batch job

paymentSchema.index({ customerId: 1, createdAt: -1 }); // customer payment history

module.exports = mongoose.model("Payment", paymentSchema);
