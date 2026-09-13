const express = require("express");
const profileRouter = express.Router();
const VendorProfile = require("../models/vendorProfile");

// Allowed fields that a vendor can update on their profile.
// Location and userId are intentionally excluded — location updates
// require coordinate validation and userId is immutable.
const EDITABLE_FIELDS = [
    "businessName",
    "fssaiOrLicenseNumber",
    "pickupAddress",
    "payoutMethod",
    "payoutDetails",
];

/**
 * GET /vendor/profile
 * Returns the full vendor profile for the authenticated vendor.
 */
profileRouter.get("/profile", async (req, res) => {
    try {
        const profile = await VendorProfile.findOne({ userId: req.user._id });
        if (!profile) {
            return res.status(404).json({ error: "Vendor profile not found." });
        }

        res.status(200).json({ data: profile });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * PATCH /vendor/profile
 * Partial update — only touches the fields sent in the request body.
 * Supports updating location separately via { coordinates: [lng, lat] }.
 */
profileRouter.patch("/profile", async (req, res) => {
    try {
        const profile = await VendorProfile.findOne({ userId: req.user._id });
        if (!profile) {
            return res.status(404).json({ error: "Vendor profile not found." });
        }

        // Pick only allowed fields from body
        const updates = {};
        for (const field of EDITABLE_FIELDS) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        // Handle location update separately — needs GeoJSON structure
        if (req.body.coordinates) {
            const coords = req.body.coordinates;

            // Validate [lng, lat] format
            if (
                !Array.isArray(coords) ||
                coords.length !== 2 ||
                typeof coords[0] !== "number" ||
                typeof coords[1] !== "number"
            ) {
                return res.status(400).json({
                    error: "coordinates must be [longitude, latitude] with numeric values.",
                });
            }

            // Validate coordinate ranges
            if (coords[0] < -180 || coords[0] > 180 || coords[1] < -90 || coords[1] > 90) {
                return res.status(400).json({
                    error: "Invalid coordinate values. Longitude: -180 to 180, Latitude: -90 to 90.",
                });
            }

            updates.location = {
                type: "Point",
                coordinates: coords,
            };
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "No valid fields to update." });
        }

        const updatedProfile = await VendorProfile.findByIdAndUpdate(
            profile._id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            message: "Profile updated successfully.",
            data: updatedProfile,
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = profileRouter;
