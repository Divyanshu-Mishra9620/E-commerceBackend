import mongoose from "mongoose";
import cloudinary from "../lib/cloudinary.js";
import Product from "../models/Product.js";

export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();

    if (!products.length) {
      return res.status(404).json({ message: "No products found" });
    }
    console.log(products.length);

    return res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProductByTitle = async (req, res) => {
  const { title } = req.params;
  if (!title) {
    return res.status(400).json({ message: "Search title is required" });
  }

  try {
    const products = await Product.find({
      $or: [
        { title: { $regex: title, $options: "i" } },
        { category: { $regex: title, $options: "i" } },
        { description: { $regex: title, $options: "i" } },
      ],
    });

    if (!products.length) {
      return res.status(404).json({ message: "No products found" });
    }
    return res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);
    if (!product)
      return res.status(404).json({
        message: `No product found with with a ID: ${id}`,
      });
    return res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock, tag, image, reviews } =
      req.body;
    let product = await Product.findOne({
      $or: [
        { name: { $regex: new RegExp(name, "i") } },
        { category: { $regex: new RegExp(category, "i") } },
        { tag: { $regex: new RegExp(tag, "i") } },
      ],
    });
    if (product) {
      product.stock += stock;
      await product.save();
      return res
        .status(201)
        .json({ message: "Product created successfully", product });
    } else {
      product = new Product({
        name,
        description,
        price,
        category,
        stock,
        image,
        tag,
        reviews,
      });
      await product.save();
      return res
        .status(201)
        .json({ message: "Product created successfully", product });
    }
  } catch (error) {
    console.error("Error craeting product:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    let product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await Product.findByIdAndDelete(productId);

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const uploadProductImagesToCloudinary = async (req, res) => {
  try {
    const products = await Product.find();

    if (!products.length) {
      return res.status(404).json({ message: "No products found" });
    }

    for (const product of products) {
      let uploadedImages = [];

      for (const imageUrl of product.image) {
        const uploaded = await cloudinary.v2.uploader.upload(imageUrl, {
          folder: "ecommerce_products",
        });
        uploadedImages.push(uploaded.secure_url);
      }

      product.image = uploadedImages;
      await product.save();
    }

    return res.status(200).json({ message: "Images uploaded successfully" });
  } catch (error) {
    console.error("Error uploading images:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const addReview = async (req, res) => {
  const { productId } = req.params;
  const { user, rating = 0, comment = "" } = req.body;

  if (!/^[0-9a-fA-F]{24}$/.test(productId)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  if (!user || !user._id || !/^[0-9a-fA-F]{24}$/.test(user._id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  if (typeof rating !== "number" || rating < 0 || rating > 5) {
    return res.status(400).json({ message: "Invalid rating" });
  }

  if (typeof comment !== "string") {
    return res.status(400).json({ message: "Invalid comment" });
  }

  try {
    const prodObjectId = new mongoose.Types.ObjectId(productId);
    const userObjectId = new mongoose.Types.ObjectId(user._id);

    const product = await Product.findById(prodObjectId);
    console.log(product);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.reviews.push({
      user: userObjectId,
      name: user.name,
      rating,
      comment,
    });

    const totalRating = product.reviews.reduce(
      (acc, rev) => acc + rev.rating,
      0
    );
    product.avgRating = totalRating / product.reviews.length;

    await product.save();

    res.status(201).json({ message: "Review added successfully", product });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProductReviews = async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await Product.findById(productId).select(
      "reviews avgRating"
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const editReview = async (req, res) => {
  const { productId, editingReviewId } = req.params;
  const { rating, comment } = req.body;

  console.log("Review ID to edit:", editingReviewId);
  console.log("Product ID:", productId);
  const prodObjId = new mongoose.Types.ObjectId(productId);
  try {
    const product = await Product.findById(prodObjId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    console.log(product);

    const reviewToEdit = product.reviews.find(
      (rev) => rev.user.toString() === editingReviewId.toString()
    );
    console.log(reviewToEdit);

    if (!reviewToEdit) {
      return res.status(404).json({ message: "Review not found" });
    }

    reviewToEdit.rating = rating;
    reviewToEdit.comment = comment;

    await product.save();

    res.status(200).json({ message: "Review updated successfully", product });
  } catch (error) {
    console.error("Error editing review:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const deleteReview = async (req, res) => {
  const { productId, reviewId } = req.params;
  console.log("rid", reviewId);
  console.log("pid", productId);

  try {
    let product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    product.reviews = product.reviews.filter((item) => item.user != reviewId);
    await product.save();
    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
