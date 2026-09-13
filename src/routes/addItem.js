const express = require("express");
const itemRouter = express.Router();
const Listing = require("../models/listing");
const VendorProfile = require("../models/vendorProfile");

// Role check + auth already handled at the router-group level in app.js
// This handler is guaranteed to only be reached by authenticated vendors.

// 1. Add Item Route
itemRouter.post("/add-item", async (req, res) => {
    try {
        // Find the vendor's profile to link the listing
        const vendorProfile = await VendorProfile.findOne({ userId: req.user._id });
        if (!vendorProfile) {
            return res.status(404).json({ error: "Vendor profile not found. Complete your profile first." });
        }

        const { title, description, images, baseCost, quantityTotal, closingTime } = req.body;

        // Basic validations
        if (!title || !baseCost || !quantityTotal || !closingTime) {
            return res.status(400).json({
                error: "title, baseCost, quantityTotal, and closingTime are required"
            });
        }

        // Ensure closingTime is in the future
        if (new Date(closingTime) <= new Date()) {
            return res.status(400).json({ error: "closingTime must be in the future" });
        }

        // Create the listing — location is NOT needed here,
        // it comes from VendorProfile when doing geo-queries
        const listing = new Listing({
            vendorId: vendorProfile._id,
            title,
            description,
            images: images || [],
            baseCost,
            quantityTotal,
            quantityAvailable: quantityTotal, // initially all available
            closingTime: new Date(closingTime),
        });

        await listing.save();

        // Increment activeListingsCount on vendor profile
        await VendorProfile.findByIdAndUpdate(vendorProfile._id, {
            $inc: { activeListingsCount: 1 }
        });

        res.status(201).json({
            message: "Item added successfully",
            data: listing
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 2. Get My Listings — returns all listings belonging to this vendor
itemRouter.get("/my-listings", async (req, res) => {
    try {
        const vendorProfile = await VendorProfile.findOne({ userId: req.user._id });
        if (!vendorProfile) {
            return res.status(404).json({ error: "Vendor profile not found." });
        }

        const listings = await Listing.find({ vendorId: vendorProfile._id })
            .sort({ createdAt: -1 });

        res.status(200).json({ data: listings });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. Delete Listing — auth already guarantees this is the vendor
itemRouter.delete("/listings/:id", async (req, res) => {
    try {
        const vendorProfile = await VendorProfile.findOne({ userId: req.user._id });
        if (!vendorProfile) {
            return res.status(404).json({ error: "Vendor profile not found." });
        }

        // Single query scoped to this vendor — if it's not theirs, returns null
        const listing = await Listing.findOneAndDelete({
            _id: req.params.id,
            vendorId: vendorProfile._id,
        });

        if (!listing) {
            return res.status(404).json({ error: "Listing not found." });
        }

        if (listing.status === "active") {
            await VendorProfile.findByIdAndUpdate(vendorProfile._id, {
                $inc: { activeListingsCount: -1 },
            });
        }

        res.status(200).json({ message: "Listing deleted successfully." });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = itemRouter;
