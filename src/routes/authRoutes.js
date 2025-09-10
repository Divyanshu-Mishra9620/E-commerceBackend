import express from "express";
import {
  registerUser,
  loginUser,
  checkAuth,
  googleSignIn,
  forgotPassword,
  resetPassword,
  refreshToken,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google", googleSignIn);
router.get("/me", protect, checkAuth);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/refresh-token", refreshToken);
router.post("/check-user", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error in /check-user:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
