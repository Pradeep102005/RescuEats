const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const connectDb = require("./config/database");
const authRouter = require("./routes/auth");

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

app.use("/", authRouter);

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