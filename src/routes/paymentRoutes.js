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

router.get("/:paymentId", getPaymentDetails);
router.get("/payment/:id", getSubscriptionDetails);

router.post("/create-order", createRazorpayOrder);
router.post("/create-subscription", protect, createSubscription);
router.post("/verify-subscription", verifySubscription);
router.post("/verify", verifyPayment);

export default router;
