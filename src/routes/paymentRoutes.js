import express from "express";
import {
  createRazorpayOrder,
  getPaymentDetails,
  verifyPayment,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:paymentId", getPaymentDetails);
router.post("/create-order", protect, createRazorpayOrder);
router.post("/verify", verifyPayment);

export default router;
