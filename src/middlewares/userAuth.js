const jwt = require("jsonwebtoken");
const User = require("../models/user");

const userAuth = async (req, res, next) => {
    try {
        const { token } = req.cookies;

        if (!token) {
            return res.status(401).json({ error: "Authentication required. Please login." });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "devSecret");

        const user = await User.findById(decoded._id);
        if (!user) {
            return res.status(401).json({ error: "User not found. Invalid token." });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token. Please login again." });
    }
};

module.exports = userAuth;
