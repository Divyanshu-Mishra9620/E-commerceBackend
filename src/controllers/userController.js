import mongoose from "mongoose";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" });
};

export const handleOAuthLogin = async (req, res) => {
  try {
    const { email, name, image, providerId } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        name,
        profilePic: image,
        providerId,
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateUser = async (req, res) => {
  const { userId } = req.params;
  const {
    addresses,
    notificationSettings,
    fullName,
    phoneNumber,
    ...otherFields
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID format" });
  }

  try {
    const updateFields = {};

    if (addresses) {
      updateFields.addresses = addresses;
    }

    if (notificationSettings) {
      updateFields.notificationSettings = notificationSettings;
    }

    if (fullName) updateFields.fullName = fullName;
    if (phoneNumber) updateFields.phoneNumber = phoneNumber;

    if (otherFields.street) updateFields["address.street"] = otherFields.street;
    if (otherFields.city) updateFields["address.city"] = otherFields.city;
    if (otherFields.state) updateFields["address.state"] = otherFields.state;
    if (otherFields.country)
      updateFields["address.country"] = otherFields.country;
    if (otherFields.postalCode)
      updateFields["address.postalCode"] = otherFields.postalCode;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "No fields provided to update." });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user?._id || req.body.userId;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res
      .status(400)
      .json({ message: "All password fields are required" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New passwords do not match" });
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }

  try {
    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserByID = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      error: "Invalid ID format",
      receivedId: userId,
      isValid: mongoose.Types.ObjectId.isValid(userId),
    });
  }

  try {
    const objectId = new mongoose.Types.ObjectId(userId);

    const user = await User.findById(objectId).select("-password -__v").lean();

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        query: { _id: objectId },
        databaseCheck: await User.exists({ _id: objectId }),
      });
    }

    return res.json(user);
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({
      error: "Server error",
      details: process.env.NODE_ENV === "development" ? error.message : null,
    });
  }
};

export const deleteUser = async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID format" });
  }

  try {
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting the user", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllUser = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const usersPromise = User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const countPromise = User.countDocuments();

    const [users, totalUsers] = await Promise.all([usersPromise, countPromise]);
    const totalPages = Math.ceil(totalUsers / limit);

    res.status(200).json({ users, totalPages, currentPage: page });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUser = async (req, res) => {
  const { email } = req.params;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error getting the user", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllSellers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const search = req.query.search || "";
    const sortBy = req.query.sort === "oldest" ? "createdAt" : "-createdAt";
    const skip = (page - 1) * limit;

    const query = {
      role: { $in: ["seller", "admin"] },
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    };

    const [sellers, totalSellers] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort(sortBy)
        .limit(limit)
        .skip(skip)
        .lean(),
      User.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalSellers / limit);

    res.status(200).json({
      sellers,
      totalPages,
      currentPage: page,
      totalSellers,
    });
  } catch (error) {
    console.error("Error fetching sellers:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
