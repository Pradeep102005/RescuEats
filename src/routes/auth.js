const express = require("express");
const authRouter = express.Router();
const User = require("../models/user");
const VendorProfile = require("../models/vendorProfile");
const { validateSignUpData, validateVendorSignUpData } = require("../utils/validation");

// 1. Customer Registration Route
authRouter.post("/register/customer", async (req, res) => {
    try {
        // Validate user inputs
        validateSignUpData(req);

        const { name, email, password, phone } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists with this email" });
        }

        // Create new Customer User
        const user = new User({
            name,
            email,
            passwordHash: password, // Pre-save hook handles hashing
            role: "customer",
            phone,
            isVerified: true // Customers don't need doc verification
        });

        await user.save();
        res.status(201).json({ message: "Customer registered successfully", data: user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 2. Vendor Registration Route
authRouter.post("/register/vendor", async (req, res) => {
    let createdUser = null;
    try {
        // Validate vendor inputs
        validateVendorSignUpData(req);

        const { name, email, password, phone, businessName, fssaiOrLicenseNumber, pickupAddress, coordinates } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists with this email" });
        }

        // Create the Vendor User
        createdUser = new User({
            name,
            email,
            passwordHash: password, // Pre-save hook handles hashing
            role: "vendor",
            phone,
            isVerified: false // Vendors need manual verification/docs before listing
        });

        await createdUser.save();

        // Create the associated Vendor Profile
        const vendorProfile = new VendorProfile({
            userId: createdUser._id,
            businessName,
            fssaiOrLicenseNumber,
            pickupAddress,
            location: {
                type: "Point",
                coordinates: coordinates // [lng, lat]
            }
        });

        await vendorProfile.save();

        res.status(201).json({
            message: "Vendor registered successfully. Awaiting document verification.",
            data: {
                user: createdUser,
                profile: vendorProfile
            }
        });
    } catch (err) {
        // Cleanup created user if vendor profile creation fails
        if (createdUser && createdUser._id) {
            await User.deleteOne({ _id: createdUser._id });
        }
        res.status(400).json({ error: err.message });
    }
});

// 3. Login Route
authRouter.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new Error("Email and password are required");
        }

        // Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error("Invalid credentials");
        }

        // Validate password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new Error("Invalid credentials");
        }

        // Generate JWT Token
        const token = await user.getJWT();

        // Send token inside cookie
        res.cookie("token", token, {
            expires: new Date(Date.now() + 7 * 24 * 3600000), // 7 days
            httpOnly: true,
        });

        res.status(200).json({
            message: "Login successful",
            data: user
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = authRouter;