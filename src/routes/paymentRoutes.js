import express from "express";
import {
  createRazorpayOrder,
  getPaymentDetails,
  verifyPayment,
  verifySubscription,
  createSubscription,
  getSubscriptionDetails,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/create-order", createRazorpayOrder);
router.post("/create-subscription", createSubscription);
router.post("/verify-subscription", verifySubscription);
router.post("/verify", verifyPayment);

router.get("/payment/:userId", getSubscriptionDetails);
router.get("/:paymentId", getPaymentDetails);

export default router;
