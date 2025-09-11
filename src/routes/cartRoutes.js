import express from "express";
import {
  getUserCart,
  updateCart,
  removeCartItem,
  getAllCarts,
} from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:userId", getUserCart);
router.put("/:userId", updateCart);
router.delete("/:userId/", removeCartItem);
router.get("/", getAllCarts);

export default router;
