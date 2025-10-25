import Product from "../models/Product.js";
import mongoose from "mongoose";

export const addReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment, user } = req.body;

    if (!rating) {
      return res.status(400).json({ message: "Rating is required." });
    }

    const reviewData = {
      _id: new mongoose.Types.ObjectId(),
      user: user._id,
      name: user.name || "Anonymous",
      rating: Number(rating),
      comment: comment || "",
      reply: null,
      createdAt: new Date(),
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      [
        {
          $set: {
            reviews: {
              $filter: {
                input: "$reviews",
                as: "review",
                cond: { $ne: ["$$review.user", user._id] },
              },
            },
          },
        },
        {
          $set: {
            reviews: { $concatArrays: ["$reviews", [reviewData]] },
          },
        },
        {
          $set: {
            avgRating: { $avg: "$reviews.rating" },
          },
        },
      ],
      { new: true, select: "reviews avgRating" }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(201).json({ ...updatedProduct });
  } catch (error) {
    console.error("Review addition error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const editReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Invalid rating value" });
    }

    const updateResult = await Product.updateOne(
      { _id: productId, "reviews._id": reviewId },
      {
        $set: {
          "reviews.$.rating": Number(rating),
          "reviews.$.comment": comment,
          "reviews.$.updatedAt": new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ message: "Product or review not found" });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      [{ $set: { avgRating: { $avg: "$reviews.rating" } } }],
      { new: true, select: "reviews avgRating" }
    );

    res.status(200).json({ message: "Review updated", ...updatedProduct });
  } catch (error) {
    console.error("Error editing review:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteReview = async (req, res) => {
  const { productId, reviewId } = req.params;
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      [
        { $pull: { reviews: { _id: reviewId } } },
        { $set: { avgRating: { $ifNull: [{ $avg: "$reviews.rating" }, 0] } } },
      ],
      { new: true, select: "reviews avgRating" }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Review deleted", ...updatedProduct });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProductReviews = async (req, res) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }
  try {
    const product = await Product.findById(productId)
      .select("reviews avgRating")
      .lean();

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getReviewsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    const productsWithUserReviews = await Product.aggregate([
      { $unwind: "$reviews" },

      { $match: { "reviews.user": userId } },

      {
        $group: {
          _id: "$_id",
          product: { $first: "$$ROOT" },
          userReviews: { $push: "$reviews" },
        },
      },
      {
        $project: {
          product: {
            $mergeObjects: ["$product", { reviews: "$userReviews" }],
          },
        },
      },
    ]);

    res.status(200).json(productsWithUserReviews);
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllReviews = async (req, res) => {
  try {
    const reviews = [];

    const products = await Product.find()
      .select("_id name reviews")
      .populate("reviews.user", "name email")
      .lean();

    products.forEach((product) => {
      if (product.reviews && product.reviews.length > 0) {
        product.reviews.forEach((review) => {
          reviews.push({
            _id: review._id,
            productId: product._id,
            productName: product.name,
            ...review,
          });
        });
      }
    });

    res
      .status(200)
      .json({
        reviews: reviews.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        ),
      });
  } catch (error) {
    console.error("Error fetching all reviews:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const addReviewReply = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reply } = req.body;

    if (!reply || reply.trim() === "") {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const result = await Product.updateOne(
      { "reviews._id": reviewId },
      {
        $set: {
          "reviews.$.reply": reply,
          "reviews.$.replyAt": new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.status(200).json({ message: "Reply added successfully" });
  } catch (error) {
    console.error("Error adding reply:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
