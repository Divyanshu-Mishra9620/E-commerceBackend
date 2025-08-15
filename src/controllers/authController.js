import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { serialize } from "cookie";
import dotenv from "dotenv";
const envFile =
  process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv.config({ path: envFile });
const FRONTEND_URI = process.env.FRONTEND_URI;

export const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const newUser = new User({
      name,
      email,
      password,
      role,
    });

    await newUser.save();

    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });
  } catch (error) {
    console.error("Error in registerUser:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const googleSignIn = async (req, res) => {
  const { name, email, profilePic } = req.body;

  try {
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name,
        email,
        profilePic,
        provider: "google",
      });
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Google Sign-In successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error in Google Sign-In:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    res.setHeader("Set-Cookie", [
      serialize("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 15 * 60,
      }),
      serialize("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      }),
    ]);

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic || "",
        role: user.role || "user",
      },
      accessToken,
      expiresIn: 15 * 60,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.error("Error in checkAuth:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();
    const resetUrl = `${FRONTEND_URI}/reset-password/${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "Password Reset Request",
      text: `You are receiving this because you (or someone else) have requested a password reset for your account.\n\n
             Please click on the following link to reset your password:\n\n
             ${resetUrl}\n\n
             If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Password reset email sent" });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const refreshToken = async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.setHeader(
      "Set-Cookie",
      serialize("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 15 * 60,
      })
    );

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      expiresIn: 15 * 60,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.setHeader("Set-Cookie", [
      serialize("accessToken", "", { maxAge: -1, path: "/" }),
      serialize("refreshToken", "", { maxAge: -1, path: "/" }),
    ]);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
};
