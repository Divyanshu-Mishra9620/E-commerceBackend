import express from "express";
import {
  addReview,
  deleteReview,
  editReview,
  getProductReviews,
  getReviewsByUser,
} from "../controllers/reviewController.js";
const router = express.Router();

router.get("/user/:userId", getReviewsByUser);
router.get("/:productId/reviews", getProductReviews);
router.post("/:productId/reviews", addReview);
router.put("/:productId/reviews/:reviewId", editReview);
router.delete("/:productId/reviews/:reviewId", deleteReview);

export default router;
