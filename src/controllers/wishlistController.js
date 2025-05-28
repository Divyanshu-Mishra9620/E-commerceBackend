import Wishlist from "../models/Wishlist.js";
import Product from "../models/Product.js";

export const getAllWishlistProducts = async (req, res) => {
  try {
    const { userId } = req.params;
    const wishlist = await Wishlist.findOne({ user: userId }).populate(
      "items.product"
    );

    if (!wishlist || wishlist.items.length === 0) {
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
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, items: [] });
    }

    const itemIndex = wishlist.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      wishlist.items.push({ product: productId });
    }

    await wishlist.save();
    return res
      .status(200)
      .json({ message: "Product added to wishlist", wishlist });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const removeWishlistProduct = async (req, res) => {
  try {
    const { userId } = req.params;
    const { product } = req.body;

    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist)
      return res.status(404).json({ message: "Wishlist not found" });

    wishlist.items = wishlist.items.filter(
      (item) => item.product.toString() !== product
    );

    if (wishlist.items.length === 0) {
      await Wishlist.deleteOne({ user: userId });
      return res.status(200).json({ message: "Wishlist is now empty" });
    }

    await wishlist.save();
    return res
      .status(200)
      .json({ message: "Product removed from wishlist", wishlist });
  } catch (error) {
    console.error("Error removing product from wishlist:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
