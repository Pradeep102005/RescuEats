const express = require("express");
const mongoose = require("mongoose");
const reservationRouter = express.Router();
const Reservation = require("../models/reservation");
const Listing = require("../models/listing");
const VendorProfile = require("../models/vendorProfile");

/**
 * POST /api/reservations/create
 *
 * Atomically reserves quantity from a listing using a MongoDB transaction.
 * Inside the transaction:
 *   1. Find the listing and check availability
 *   2. Decrement quantityAvailable
 *   3. Create the reservation document
 * If anything fails, the whole thing rolls back — no phantom stock.
 *
 * Body: { listingId, quantity }
 */
reservationRouter.post("/create", async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { listingId, quantity = 1 } = req.body;
        const qty = parseInt(quantity, 10);

        if (!listingId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: "listingId is required." });
        }

        if (!qty || qty < 1) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: "quantity must be at least 1." });
        }

        // Step 1: Find listing and atomically decrement quantity
        // findOneAndUpdate is atomic per document — combined with the session,
        // this guarantees no two customers can oversell the same stock.
        const listing = await Listing.findOneAndUpdate(
            {
                _id: listingId,
                status: "active",
                quantityAvailable: { $gte: qty }, // enough stock?
            },
            {
                $inc: { quantityAvailable: -qty },
            },
            {
                new: true, // return the updated doc
                session,
            }
        );

        if (!listing) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({
                error: "Listing unavailable — either sold out, expired, or does not exist.",
            });
        }

        // If quantity hit 0, mark as sold_out
        if (listing.quantityAvailable === 0) {
            listing.status = "sold_out";
            await listing.save({ session });
        }

        // Step 2: Create the reservation (pending payment — not confirmed until Razorpay verifies)
        const reservation = new Reservation({
            listingId: listing._id,
            customerId: req.user._id,
            vendorId: listing.vendorId,
            quantityReserved: qty,
            status: "pending_payment",
            pickupDeadline: listing.closingTime,
        });

        await reservation.save({ session });

        // Step 3: Commit — stock is decremented, reservation is pending payment
        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            message: "Reservation created. Complete payment to confirm.",
            data: {
                reservationId: reservation._id,
                quantityReserved: reservation.quantityReserved,
                pickupDeadline: reservation.pickupDeadline,
                status: reservation.status,
                // Frontend should now call POST /api/payments/create-order with this reservationId
                nextStep: "POST /api/payments/create-order",
            },
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /api/reservations/:id
 *
 * Returns reservation details. If the requesting user is the customer
 * who made the reservation, the response INCLUDES the vendor's pickup
 * address and location — this is the only place that info is revealed.
 */
reservationRouter.get("/:id", async (req, res) => {
    try {
        const reservation = await Reservation.findOne({
            _id: req.params.id,
            customerId: req.user._id, // scoped to this customer
        }).lean();

        if (!reservation) {
            return res.status(404).json({ error: "Reservation not found." });
        }

        // Fetch listing details
        const listing = await Listing.findById(reservation.listingId)
            .select("title images baseCost closingTime")
            .lean();

        // Fetch vendor profile — NOW we include address since they reserved
        const vendor = await VendorProfile.findById(reservation.vendorId)
            .select("businessName pickupAddress location phone")
            .lean();

        res.status(200).json({
            data: {
                ...reservation,
                listing: listing || {},
                vendor: vendor || {},
            },
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /api/reservations
 *
 * Returns all reservations for the authenticated customer, sorted newest first.
 */
reservationRouter.get("/", async (req, res) => {
    try {
        const reservations = await Reservation.find({
            customerId: req.user._id,
        })
            .sort({ createdAt: -1 })
            .populate("listingId", "title images baseCost closingTime status")
            .lean();

        res.status(200).json({ data: reservations });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /api/reservations/:id/cancel
 *
 * Cancels a reservation and atomically restores the reserved quantity
 * back to the listing using a MongoDB transaction.
 *
 * Body (optional): { reason: "string" }
 */
reservationRouter.post("/:id/cancel", async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { reason } = req.body;

        // Find the reservation — must belong to this customer and be in a cancellable state
        const reservation = await Reservation.findOne({
            _id: req.params.id,
            customerId: req.user._id,
            status: { $in: ["confirmed", "pending_payment"] },
        }).session(session);

        if (!reservation) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                error: "Reservation not found or cannot be cancelled.",
            });
        }

        // Step 1: Mark reservation as cancelled
        reservation.status = "cancelled";
        reservation.cancelledAt = new Date();
        reservation.cancellationReason = reason || "Cancelled by customer";
        await reservation.save({ session });

        // Step 2: Restore quantity back to the listing
        const listing = await Listing.findByIdAndUpdate(
            reservation.listingId,
            {
                $inc: { quantityAvailable: reservation.quantityReserved },
            },
            { new: true, session }
        );

        // If listing was sold_out and now has stock again, reactivate it
        if (listing && listing.status === "sold_out" && listing.quantityAvailable > 0) {
            // Only reactivate if closingTime hasn't passed
            if (listing.closingTime > new Date()) {
                listing.status = "active";
                await listing.save({ session });
            }
        }

        // Step 3: Commit
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            message: "Reservation cancelled. Quantity restored.",
            data: {
                reservationId: reservation._id,
                status: reservation.status,
                quantityRestored: reservation.quantityReserved,
            },
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ error: err.message });
    }
});

module.exports = reservationRouter;
