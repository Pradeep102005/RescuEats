const express = require("express");
const listingsRouter = express.Router();
const Listing = require("../models/listing");
const VendorProfile = require("../models/vendorProfile");

/**
 * GET /api/listings/nearby?lat=&lng=&radius=
 *
 * Finds active listings from vendors within `radius` km of the given coordinates.
 * The geo-query runs on VendorProfile's 2dsphere index, then fetches their active listings.
 *
 * Query params:
 *   lat    — customer latitude  (required)
 *   lng    — customer longitude (required)
 *   radius — search radius in km (optional, default: 5)
 *   page   — pagination page number (optional, default: 1)
 *   limit  — results per page (optional, default: 20)
 *
 * Response intentionally EXCLUDES vendor address — that's only revealed after reservation.
 */
listingsRouter.get("/nearby", async (req, res) => {
    try {
        const { lat, lng, radius = 5, page = 1, limit = 20 } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                error: "lat and lng query parameters are required.",
            });
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const radiusKm = parseFloat(radius);
        const pageNum = parseInt(page, 10);
        const limitNum = Math.min(parseInt(limit, 10), 50); // cap at 50

        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({ error: "lat and lng must be valid numbers." });
        }

        // Step 1: Find vendor profiles within radius using MongoDB $geoNear
        // $maxDistance expects meters, so convert km → meters
        const nearbyVendors = await VendorProfile.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [longitude, latitude], // GeoJSON: [lng, lat]
                    },
                    $maxDistance: radiusKm * 1000, // km to meters
                },
            },
            isSuspended: false, // exclude suspended vendors
        }).select("_id businessName avgRating totalReviews location");

        if (nearbyVendors.length === 0) {
            return res.status(200).json({ data: [], total: 0, page: pageNum });
        }

        const vendorIds = nearbyVendors.map((v) => v._id);

        // Step 2: Fetch active listings belonging to those vendors
        const skip = (pageNum - 1) * limitNum;

        const [listings, total] = await Promise.all([
            Listing.find({
                vendorId: { $in: vendorIds },
                status: "active",
                quantityAvailable: { $gt: 0 },
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),

            Listing.countDocuments({
                vendorId: { $in: vendorIds },
                status: "active",
                quantityAvailable: { $gt: 0 },
            }),
        ]);

        // Step 3: Attach vendor info to each listing (name, rating, distance)
        // Build a lookup map for O(1) access
        const vendorMap = {};
        for (const v of nearbyVendors) {
            vendorMap[v._id.toString()] = {
                businessName: v.businessName,
                avgRating: v.avgRating,
                totalReviews: v.totalReviews,
            };
        }

        const enrichedListings = listings.map((listing) => {
            const vendor = vendorMap[listing.vendorId.toString()] || {};
            return {
                ...listing,
                vendor, // { businessName, avgRating, totalReviews } — no address
            };
        });

        res.status(200).json({
            data: enrichedListings,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /api/listings/:id
 *
 * Public listing detail — anyone can view a listing's info.
 * Does NOT include vendor address (that's only revealed after reservation).
 */
listingsRouter.get("/:id", async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id).lean();
        if (!listing) {
            return res.status(404).json({ error: "Listing not found." });
        }

        // Attach vendor name and rating (but NOT address)
        const vendor = await VendorProfile.findById(listing.vendorId)
            .select("businessName avgRating totalReviews")
            .lean();

        res.status(200).json({
            data: {
                ...listing,
                vendor: vendor || {},
            },
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = listingsRouter;
