import express from "express";
import {
  getAllWishlistProducts,
  addWishlistProduct,
  removeWishlistProduct,
} from "../controllers/wishlistController.js";

const router = express.Router();

router.get("/:userId", getAllWishlistProducts);
router.post("/:userId", addWishlistProduct);
router.delete("/:userId", removeWishlistProduct);

export default router;
