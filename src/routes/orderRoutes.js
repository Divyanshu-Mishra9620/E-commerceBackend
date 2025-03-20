import express from "express";
import {
  getAllOrdersByUser,
  createOrder,
  updateOrderStatus,
  cancelOrder,
} from "../controllers/orderController.js";

const router = express.Router();

router.get("/:userId", getAllOrdersByUser);
router.delete("/:userId", cancelOrder);
router.post("/:userId", createOrder);
router.put("/:userId", updateOrderStatus);

export default router;
