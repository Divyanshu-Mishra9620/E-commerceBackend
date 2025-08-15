import express from "express";
import {
  getAllProducts,
  getProductByTitle,
  getProductById,
  createProduct,
  deleteProduct,
  editProduct,
  getSellerProducts,
  getAllSellerProducts,
  getHomepageCollections,
} from "../controllers/productController.js";

const router = express.Router();

router.get("/homepage-sections", getHomepageCollections);
router.get("/search", getProductByTitle);

router.get("/sellers", getAllSellerProducts);

router.get("/seller/:id", getSellerProducts);
router.get("/", getAllProducts);
router.get("/:id", getProductById);

router.post("/", createProduct);
router.put("/:id", editProduct);
router.delete("/:id", deleteProduct);

export default router;
