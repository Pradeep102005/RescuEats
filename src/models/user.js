const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        passwordHash: {
            type: String,
            required: true,
        },

        role: {
            type: String,
            enum: ["customer", "vendor"],
            required: true,
        },

        isVerified: {
            type: Boolean,
            default: false, // vendors need admin/doc verification before listing
        },

        phone: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// hash password before save, only if modified
userSchema.pre("save", async function (next) {
    if (!this.isModified("passwordHash")) return next();

    this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    next();
});

userSchema.methods.comparePassword = function (plainPassword) {
    return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);