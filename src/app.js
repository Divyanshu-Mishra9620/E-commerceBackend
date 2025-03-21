import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";

import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://e-commerce-frontend-murex-eta.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      console.log("Incoming origin:", origin);

      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.replace(/\/+$/, "");
      console.log("Normalized origin:", normalizedOrigin);

      if (allowedOrigins.includes(normalizedOrigin)) {
        console.log("Allowed origin:", normalizedOrigin);
        callback(null, true);
      } else {
        console.log("Blocked origin:", normalizedOrigin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", cors());

app.use(express.json());
app.use(morgan("dev"));

app.use((req, res, next) => {
  if (req.url.endsWith("/") && req.url.length > 1) {
    res.redirect(301, req.url.slice(0, -1));
  } else {
    next();
  }
});

app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wishlist", wishlistRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong on the server",
    error: err.message,
  });
});

export default app;
