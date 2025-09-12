import mongoose from "mongoose";
import Cart from "../models/Cart.js";

export const getUserCart = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .lean();

    res.status(200).json(cart || { items: [] });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const { userId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({ message: "Invalid ID provided" });
    }

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      {},
      { upsert: true, new: true }
    );

    const itemIndex = cart.items.findIndex((p) => p.product.equals(productId));

    if (itemIndex > -1) {
      if (quantity > 0) {
        cart.items[itemIndex].quantity = quantity;
      } else {
        cart.items.splice(itemIndex, 1);
      }
    } else if (quantity > 0) {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();

    const populatedCart = await cart.populate("items.product");

    return res
      .status(200)
      .json({ message: "Cart updated", cart: populatedCart });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const removeCartItem = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(productId)
    ) {
      return res.status(400).json({ message: "Invalid ID provided" });
    }

    const updatedCart = await Cart.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { product: productId } } },
      { new: true }
    ).populate("items.product");

    if (!updatedCart) {
      return res.status(200).json({ items: [] });
    }

    return res.status(200).json({ message: "Item removed", cart: updatedCart });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllCarts = async (req, res) => {
  try {
    const carts = await Cart.find().populate("user", "name email");
    return res.status(200).json({ carts });
  } catch (error) {
    console.error("Error fetching all carts:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
