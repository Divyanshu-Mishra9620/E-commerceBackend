import express from "express";
import {
  getAllCartProduct,
  addCartProduct,
  removeFromCart,
} from "../controllers/cartController.js";

const router = express.Router();

router.get("/:userId", getAllCartProduct);
router.put("/:userId", addCartProduct);
router.delete("/:userId", removeFromCart);

export default router;
