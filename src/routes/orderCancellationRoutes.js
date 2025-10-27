import express from "express";
import {
  getCancellationDetails,
  requestCancellation,
  requestReturn,
  getCancellationHistory,
  getRefundStatus,
  getAllCancellationRequests,
  approveCancellationRequest,
} from "../controllers/orderCancellationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/details/:orderId", getCancellationDetails);
router.post("/request-cancellation/:userId", protect, requestCancellation);
router.post("/request-return/:userId", protect, requestReturn);
router.get("/history/:userId", protect, getCancellationHistory);
router.get("/refund-status/:orderId", getRefundStatus);

router.get("/admin/requests", protect, getAllCancellationRequests);
router.post("/admin/approve", protect, approveCancellationRequest);

export default router;
