require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const connectDb = require("./config/database");
const authRouter = require("./routes/auth");
const itemRouter = require("./routes/addItem");
const uploadRouter = require("./routes/upload");
const profileRouter = require("./routes/vendorProfile");
const listingsRouter = require("./routes/listings");
const reservationRouter = require("./routes/reservations");
const paymentRouter = require("./routes/payments");
const userAuth = require("./middlewares/userAuth");
const checkRole = require("./middlewares/checkRole");
const startListingCleanupJob = require("./jobs/listingCleanup");

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

// Public routes — no auth needed
app.use("/", authRouter);
app.use("/api/listings", listingsRouter);

// Customer routes — any authenticated user
app.use("/api/reservations", userAuth, reservationRouter);

// Payment routes — mounted without auth at router level because
// /webhook must be public (Razorpay server-to-server).
// /create-order and /verify use userAuth middleware inside the router.
app.use("/api/payments", paymentRouter);

// Vendor-only routes — auth + role gated at mount level
// Any request to /vendor/* must pass through userAuth → checkRole("vendor")
app.use("/vendor", userAuth, checkRole("vendor"), itemRouter);
app.use("/vendor", userAuth, checkRole("vendor"), uploadRouter);
app.use("/vendor", userAuth, checkRole("vendor"), profileRouter);

const server = http.createServer(app);

connectDb()
    .then(() => {
        console.log("Database connection successful");

        // Start background jobs after DB is connected
        startListingCleanupJob();

        server.listen(3000, () => {
            console.log("Server is running on port 3000");
        });
    })
    .catch((err) => {
        console.log("Database connection failed", err);
    });