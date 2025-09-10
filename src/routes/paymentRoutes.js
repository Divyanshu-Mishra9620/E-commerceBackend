import express from "express";
import {
  createRazorpayOrder,
  getPaymentDetails,
  verifyPayment,
  verifySubscription,
  createSubscription,
  getSubscriptionDetails,
} from "../controllers/paymentController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create-order", protect, createRazorpayOrder);
router.post("/create-subscription", protect, createSubscription);
router.post("/verify-subscription", protect, verifySubscription);
router.post("/verify", protect, verifyPayment);

router.get("/payment/:userId", protect, getSubscriptionDetails);
router.get("/:paymentId", protect, getPaymentDetails);

export default router;
