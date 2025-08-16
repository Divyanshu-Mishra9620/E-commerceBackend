import express from "express";
import {
  getProductBySlug,
  getSimilarProducts,
} from "../controllers/productController.js";

const router = express.Router();

router.get("/details/:slug", getProductBySlug);
router.get("/:productId/similar", getSimilarProducts);

export default router;
