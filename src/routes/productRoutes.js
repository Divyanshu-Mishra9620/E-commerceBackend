import express from "express";
import {
  getAllProducts,
  getProductByTitle,
  getProductById,
  createProduct,
  deleteProduct,
  uploadProductImagesToCloudinary,
  addReview,
  getProductReviews,
  deleteReview,
  editReview,
} from "../controllers/productController.js";

const router = express.Router();

router.get("/", getAllProducts);
router.get("/search", getProductByTitle);
router.get("/:id", getProductById);
router.post("/", createProduct);
router.delete("/:id", deleteProduct);
router.get("/upload-images", uploadProductImagesToCloudinary);

//reviews
router.post("/:productId/reviews", addReview);
router.get("/:productId/reviews", getProductReviews);
router.delete("/:productId/reviews/:reviewId", deleteReview);
router.put("/:productId/reviews/:editingReviewId", editReview);

export default router;
