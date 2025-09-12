import express from "express";
import {
  getAllWishlistProducts,
  addWishlistProduct,
  removeWishlistProduct,
} from "../controllers/wishlistController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:userId", protect, getAllWishlistProducts);
router.post("/:userId", protect, addWishlistProduct);
router.delete("/:userId", protect, removeWishlistProduct);

export default router;
