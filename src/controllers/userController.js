import mongoose from "mongoose";
import User from "../models/User.js";

export const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { street, city, state, country, postalCode } = req.body;
  const objectuid = new mongoose.Types.ObjectId(userId);
  try {
    const user = await User.findByIdAndUpdate(
      objectuid,
      {
        address: { street, city, state, country, postalCode },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Address updated successfully", user });
  } catch (error) {
    console.error("Error updating address:", error);
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
