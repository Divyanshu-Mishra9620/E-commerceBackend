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

const router = express.Router();

router.get("/order/:orderId", getOrderByOrderId);
router.get("/:orderId/geocode", getOrderCoordinates);
router.get("/:userId", getAllOrdersByUser);
router.get("/", getAllOrders);
router.delete("/:userId", cancelOrder);
router.post("/:userId", createOrder);
router.put("/status/:orderId", updateOrderStatus);

export default router;
