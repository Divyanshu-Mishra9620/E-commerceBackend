import express from "express";
import {
  addReview,
  deleteReview,
  editReview,
  getProductReviews,
  getReviewsByUser,
  addReviewReply,
  getAllReviews,
} from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/user/:userId", getReviewsByUser);
router.get("/:productId/reviews", getProductReviews);
router.post("/:productId/reviews", addReview);

router.get("/", protect, getAllReviews);
router.put("/:productId/reviews/:reviewId", protect, editReview);
router.delete("/:productId/reviews/:reviewId", protect, deleteReview);
router.delete("/:reviewId", protect, deleteReview);
router.post("/:reviewId/reply", protect, addReviewReply);

export default router;
