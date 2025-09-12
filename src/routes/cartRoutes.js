import express from "express";
import {
  getUserCart,
  updateCart,
  removeCartItem,
  getAllCarts,
} from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:userId", protect, getUserCart);
router.put("/:userId", protect, updateCart);
router.delete("/:userId", protect, removeCartItem);
router.get("/", protect, getAllCarts);

export default router;
