const validator = require("validator");

const validateSignUpData = (req) => {
    const { name, email, password, phone } = req.body;

    if (!name || name.trim().length < 3) {
        throw new Error("Name must be at least 3 characters long");
    }
    if (!validator.isEmail(email)) {
        throw new Error("Email is not valid!");
    }
    if (!validator.isStrongPassword(password)) {
        throw new Error("Please enter a strong Password!");
    }
    if (phone && !validator.isMobilePhone(phone)) {
        throw new Error("Invalid phone number!");
    }
};

const validateVendorSignUpData = (req) => {
    // Perform standard User check
    validateSignUpData(req);

    // Vendor specific fields
    const { businessName, pickupAddress, coordinates } = req.body;

    if (!businessName || businessName.trim().length < 2) {
        throw new Error("Business name must be at least 2 characters long");
    }
    if (!pickupAddress || pickupAddress.trim().length < 5) {
        throw new Error("Pickup address must be at least 5 characters long");
    }
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        throw new Error("Coordinates must be an array of [longitude, latitude]");
    }
};

module.exports = {
    validateSignUpData,
    validateVendorSignUpData,
};
