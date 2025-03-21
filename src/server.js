import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import app from "./app.js";

const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv.config({ path: envFile });
connectDB();

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
