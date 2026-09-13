const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const paymentRouter = express.Router();
const razorpay = require("../config/razorpay");
const Payment = require("../models/payment");
const Reservation = require("../models/reservation");
const Listing = require("../models/listing");
const userAuth = require("../middlewares/userAuth");

/**
 * POST /api/payments/create-order
 *
 * Creates a Razorpay order for an existing reservation.
 * The reservation must be in "pending_payment" status.
 *
 * Flow:
 *   1. Find the reservation and its listing
 *   2. Compute the price split (baseCost × qty + platform fee)
 *   3. Create a Payment doc (status: pending)
 *   4. Create a Razorpay order
 *   5. Link the Razorpay order ID back to Payment
 *   6. Return the order details to frontend (for Razorpay Checkout)
 *
 * Body: { reservationId }
 */
paymentRouter.post("/create-order", userAuth, async (req, res) => {
    try {
        const { reservationId } = req.body;

        if (!reservationId) {
            return res.status(400).json({ error: "reservationId is required." });
        }

        // Find the reservation — must belong to this customer and be awaiting payment
        const reservation = await Reservation.findOne({
            _id: reservationId,
            customerId: req.user._id,
            status: "pending_payment",
        });

        if (!reservation) {
            return res.status(404).json({
                error: "Reservation not found or already paid.",
            });
        }

        // Check if a payment already exists for this reservation
        const existingPayment = await Payment.findOne({ reservationId });
        if (existingPayment && existingPayment.gatewayOrderId) {
            // Return the existing order so frontend can retry payment
            return res.status(200).json({
                message: "Order already exists. Use existing order to complete payment.",
                data: {
                    orderId: existingPayment.gatewayOrderId,
                    amount: existingPayment.finalAmount * 100, // paise
                    currency: existingPayment.currency,
                    paymentId: existingPayment._id,
                    keyId: process.env.RAZORPAY_KEY_ID,
                },
            });
        }

        // Fetch listing to get the price
        const listing = await Listing.findById(reservation.listingId);
        if (!listing) {
            return res.status(404).json({ error: "Associated listing not found." });
        }

        // Compute the base amount: baseCost × quantity reserved
        const baseAmount = listing.baseCost * reservation.quantityReserved;

        // Create the Payment document — pre-validate hook computes the split automatically
        const payment = new Payment({
            reservationId: reservation._id,
            customerId: req.user._id,
            vendorId: reservation.vendorId,
            baseAmount,
        });

        await payment.save();

        // Create Razorpay order (amount in paise = finalAmount × 100)
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(payment.finalAmount * 100), // Razorpay needs paise
            currency: payment.currency,
            receipt: payment._id.toString(),
            notes: {
                reservationId: reservation._id.toString(),
                customerId: req.user._id.toString(),
            },
        });

        // Link the Razorpay order ID back to the payment doc
        payment.gatewayOrderId = razorpayOrder.id;
        await payment.save();

        // Link payment to reservation
        reservation.paymentId = payment._id;
        await reservation.save();

        res.status(201).json({
            message: "Order created. Complete payment using Razorpay Checkout.",
            data: {
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount, // in paise
                currency: razorpayOrder.currency,
                paymentId: payment._id,
                keyId: process.env.RAZORPAY_KEY_ID,
                // Frontend needs these to open Razorpay Checkout
                prefill: {
                    name: req.user.name,
                    email: req.user.email,
                    contact: req.user.phone || "",
                },
            },
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/payments/verify
 *
 * Verifies Razorpay payment signature after the customer completes checkout.
 * If signature is valid, marks Payment as "paid" and Reservation as "confirmed".
 *
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
paymentRouter.post("/verify", userAuth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                error: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
            });
        }

        // Step 1: Verify the signature
        // Razorpay signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
        }

        // Step 2: Find the payment by Razorpay order ID
        const payment = await Payment.findOne({
            gatewayOrderId: razorpay_order_id,
        }).session(session);

        if (!payment) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ error: "Payment record not found." });
        }

        if (payment.status === "paid") {
            await session.abortTransaction();
            session.endSession();
            return res.status(200).json({ message: "Payment already verified.", data: payment });
        }

        // Step 3: Update payment status
        payment.status = "paid";
        payment.gatewayPaymentId = razorpay_payment_id;
        payment.paidAt = new Date();
        await payment.save({ session });

        // Step 4: Confirm the reservation
        await Reservation.findByIdAndUpdate(
            payment.reservationId,
            { status: "confirmed" },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            message: "Payment verified. Reservation confirmed!",
            data: {
                paymentId: payment._id,
                status: payment.status,
                reservationId: payment.reservationId,
            },
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/payments/webhook
 *
 * Razorpay webhook handler — server-to-server callback as a safety net.
 * Even if the frontend verify call fails (network issue, user closes tab),
 * this webhook will still confirm the payment.
 *
 * Razorpay sends the event body + X-Razorpay-Signature header.
 */
paymentRouter.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers["x-razorpay-signature"];

        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(JSON.stringify(req.body))
            .digest("hex");

        if (expectedSignature !== signature) {
            return res.status(400).json({ error: "Invalid webhook signature." });
        }

        const event = req.body;

        // Handle payment.captured event
        if (event.event === "payment.captured") {
            const razorpayPayment = event.payload.payment.entity;
            const orderId = razorpayPayment.order_id;
            const paymentId = razorpayPayment.id;

            const payment = await Payment.findOne({ gatewayOrderId: orderId });

            if (payment && payment.status !== "paid") {
                payment.status = "paid";
                payment.gatewayPaymentId = paymentId;
                payment.paidAt = new Date();
                await payment.save();

                // Confirm the reservation
                await Reservation.findByIdAndUpdate(payment.reservationId, {
                    status: "confirmed",
                });
            }
        }

        // Always respond 200 to Razorpay so it doesn't retry
        res.status(200).json({ received: true });
    } catch (err) {
        console.error("[Webhook] Error:", err.message);
        res.status(200).json({ received: true }); // still 200 to prevent retries
    }
});

module.exports = paymentRouter;
