require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const connectDb = require("./config/database");
const authRouter = require("./routes/auth");
const itemRouter = require("./routes/addItem");
const uploadRouter = require("./routes/upload");
const userAuth = require("./middlewares/userAuth");
const checkRole = require("./middlewares/checkRole");

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

// Vendor-only routes — auth + role gated at mount level
// Any request to /vendor/* must pass through userAuth → checkRole("vendor")
app.use("/vendor", userAuth, checkRole("vendor"), itemRouter);
app.use("/vendor", userAuth, checkRole("vendor"), uploadRouter);

const server = http.createServer(app);

connectDb()
    .then(() => {
        console.log("Database connection successful");

        server.listen(3000, () => {
            console.log("Server is running on port 3000");
        });
    })
    .catch((err) => {
        console.log("Database connection failed", err);
    });