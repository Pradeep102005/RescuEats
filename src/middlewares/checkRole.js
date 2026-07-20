// Higher-order middleware factory — returns a middleware locked to a specific role.
// Mount this on a router group, NOT inside individual handlers.
// e.g. app.use("/vendor", userAuth, checkRole("vendor"), vendorRoutes)

const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        // At this point userAuth has already run, so req.user exists.
        // If the user's role is not in the allowed list, reject immediately
        // with a generic 403 — no hints about what this route does.
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: "Access denied" });
        }

        next();
    };
};

module.exports = checkRole;
