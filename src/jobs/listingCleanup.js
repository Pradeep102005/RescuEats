const cron = require("node-cron");
const Listing = require("../models/listing");
const VendorProfile = require("../models/vendorProfile");

/**
 * Expired Listings Cleanup Job
 *
 * Runs every minute. Finds all listings that are still "active" but whose
 * closingTime has passed, marks them as "expired", and decrements each
 * vendor's activeListingsCount by the number of expired listings.
 */
function startListingCleanupJob() {
    // Schedule: every minute
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();

            // Find all active listings that have expired
            const expiredListings = await Listing.find({
                status: "active",
                closingTime: { $lte: now },
            });

            if (expiredListings.length === 0) return;

            // Collect listing IDs and count per vendor for batch update
            const listingIds = [];
            const vendorDecrements = {}; // vendorId -> count

            for (const listing of expiredListings) {
                listingIds.push(listing._id);

                const vid = listing.vendorId.toString();
                vendorDecrements[vid] = (vendorDecrements[vid] || 0) + 1;
            }

            // Batch-update all expired listings to "expired" status
            await Listing.updateMany(
                { _id: { $in: listingIds } },
                { $set: { status: "expired" } }
            );

            // Decrement activeListingsCount for each affected vendor
            const vendorUpdates = Object.entries(vendorDecrements).map(
                ([vendorId, count]) =>
                    VendorProfile.findByIdAndUpdate(vendorId, {
                        $inc: { activeListingsCount: -count },
                    })
            );

            await Promise.all(vendorUpdates);

            console.log(
                `[Cron] Expired ${listingIds.length} listing(s) across ${Object.keys(vendorDecrements).length} vendor(s).`
            );
        } catch (err) {
            console.error("[Cron] Listing cleanup error:", err.message);
        }
    });

    console.log("[Cron] Listing cleanup job scheduled (every minute).");
}

module.exports = startListingCleanupJob;
