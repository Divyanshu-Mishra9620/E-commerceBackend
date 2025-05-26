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
  editProduct,
  getSellerProducts,
} from "../controllers/productController.js";

const router = express.Router();

router.get("/", getAllProducts);
router.get("/search", getProductByTitle);
router.get("/:id", getProductById);
router.post("/", createProduct);
router.put("/:id", editProduct);
router.delete("/:id", deleteProduct);
router.get("/upload-images", uploadProductImagesToCloudinary);

//reviews
router.post("/:productId/reviews", addReview);
router.get("/:productId/reviews", getProductReviews);
router.delete("/:productId/reviews/:reviewId", deleteReview);
router.put("/:productId/reviews/:editingReviewId", editReview);

//sell products
router.get("/seller/:id", getSellerProducts);

export default router;
