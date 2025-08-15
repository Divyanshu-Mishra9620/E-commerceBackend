import Wishlist from "../models/Wishlist.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";

export const getAllWishlistProducts = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    const wishlist = await Wishlist.findOne({ user: userId }).populate(
      "items.product"
    );
    if (!wishlist) {
      return res.status(200).json({ items: [] });
    }

    return res.status(200).json(wishlist);
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const addWishlistProduct = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId } = req.body;

    const productExists = await Product.findById(productId);
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }
    const updatedWishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $addToSet: { items: { product: productId } } },
      { new: true, upsert: true }
    ).populate("items.product");

    return res.status(200).json(updatedWishlist);
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const removeWishlistProduct = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId } = req.body;

    const updatedWishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { product: productId } } },
      { new: true }
    ).populate("items.product");

    if (!updatedWishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    if (updatedWishlist.items.length === 0) {
      await Wishlist.findByIdAndDelete(updatedWishlist._id);
      return res.status(200).json({ items: [] });
    }

    return res.status(200).json(updatedWishlist);
  } catch (error) {
    console.error("Error removing product from wishlist:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
