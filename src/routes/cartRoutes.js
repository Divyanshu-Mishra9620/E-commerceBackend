import express from "express";
import {
  getAllCartProduct,
  addCartProduct,
  removeFromCart,
  getAllCart,
} from "../controllers/cartController.js";

const router = express.Router();

router.get("/:userId", getAllCartProduct);
router.put("/:userId", addCartProduct);
router.delete("/:userId", removeFromCart);
router.get("/", getAllCart);

export default router;
