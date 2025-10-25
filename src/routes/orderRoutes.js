import express from "express";
import {
  getAllOrdersByUser,
  getAllOrders,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderCoordinates,
  getOrderByOrderId,
} from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/order/:orderId", getOrderByOrderId);
router.get("/:orderId/geocode", getOrderCoordinates);

router.put("/:orderId", protect, updateOrderStatus);
router.get("/", protect, getAllOrders);
router.get("/:userId", protect, getAllOrdersByUser);
router.post("/:userId", protect, createOrder);
router.delete("/:userId", protect, cancelOrder);

export default router;
