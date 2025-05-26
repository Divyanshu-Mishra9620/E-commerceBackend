import mongoose from "mongoose";
import cloudinary from "../lib/cloudinary.js";
import Product from "../models/Product.js";

export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();

    if (!products.length) {
      return res.status(404).json({ message: "No products found" });
    }

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
    const productData = req.body;
    console.log("Received product data:", productData);

    if (!productData?.product_name) {
      return res.status(400).json({
        message: "Product name is required",
        receivedData: productData,
      });
    }

    const product = new Product({
      ...productData,
      image: productData?.image_url || productData?.image || "",
      uniq_id: Date.now().toString(),
      pid: Date.now().toString(),
      avgRating: 0,
      reviews: [],
      createdBy: productData.createdBy || "seller",
      seller: productData.creator,
    });

    const savedProduct = await product.save();

    res.status(201).json({
      message: "Product created successfully",
      product: savedProduct,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      message: "Failed to create product",
      error: error.message,
    });
  }
};
export const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPdt = await Product.findByIdAndUpdate(id, req.body.editModal, {
      new: true,
    });
    if (!updatedPdt) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product: updatedPdt,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id);

    let product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await Product.findByIdAndDelete(id);

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
  try {
    const { productId } = req.params;
    const { user, rating, comment } = req.body;

    console.log("Review Data:", { productId, user, rating, comment });

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const reviewData = {
      user: user._id,
      name: user.name || "Anonymous",
      rating: Number(rating),
      comment: comment || "",
      createdAt: new Date(),
    };

    const existingReviewIndex = product.reviews.findIndex(
      (rev) => rev.user?.toString() === user._id?.toString()
    );

    if (existingReviewIndex >= 0) {
      product.reviews[existingReviewIndex] = reviewData;
    } else {
      product.reviews.push(reviewData);
    }

    const totalRating = product.reviews.reduce(
      (acc, rev) => acc + Number(rev.rating),
      0
    );
    product.avgRating = (totalRating / product.reviews.length).toFixed(1);

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          reviews: product.reviews,
          avgRating: product.avgRating,
        },
      },
      {
        new: true,
        runValidators: false,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Review added successfully",
      product: {
        _id: updatedProduct._id,
        reviews: updatedProduct.reviews,
        avgRating: updatedProduct.avgRating,
      },
    });
  } catch (error) {
    console.error("Review addition error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
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
  try {
    const { productId, editingReviewId } = req.params;
    const { rating, comment, name } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Invalid rating value" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const reviewIndex = product.reviews.findIndex(
      (rev) => rev.user?.toString() === editingReviewId
    );

    if (reviewIndex === -1) {
      return res.status(404).json({ message: "Review not found" });
    }

    product.reviews[reviewIndex] = {
      ...product.reviews[reviewIndex],
      name: name || product.reviews[reviewIndex].name,
      user: editingReviewId,
      rating: Number(rating),
      comment: comment || "",
      updatedAt: new Date(),
    };

    const avgRating =
      product.reviews.reduce((acc, rev) => acc + Number(rev.rating), 0) /
      product.reviews.length;

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          reviews: product.reviews,
          avgRating: Number(avgRating.toFixed(1)),
        },
      },
      {
        new: true,
        runValidators: false,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error editing review:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update review",
      error: error.message,
    });
  }
};
export const deleteReview = async (req, res) => {
  const { productId, reviewId } = req.params;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updatedReviews = product.reviews.filter(
      (item) => item.user?.toString() !== reviewId?.toString()
    );

    const avgRating =
      updatedReviews.length > 0
        ? (
            updatedReviews.reduce((acc, rev) => acc + Number(rev.rating), 0) /
            updatedReviews.length
          ).toFixed(1)
        : 0;

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          reviews: updatedReviews,
          avgRating: avgRating,
        },
      },
      {
        new: true,
        runValidators: false,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete review",
      error: error.message,
    });
  }
};

export const getSellerProducts = async (req, res) => {
  const sellerId = req.params;

  if (!sellerId) {
    return res.status(400).json({ message: "Seller ID is required" });
  }

  try {
    const products = await Product.find({ creator: sellerId.id });

    if (!products.length) {
      return res
        .status(404)
        .json({ message: "No products found for this seller" });
    }

    return res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching seller's products:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
