import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Initialize Razorpay with API credentials
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_API_KEY,
  key_secret: process.env.RAZORPAY_API_SECRET,
});

/**
 * Creates a new Razorpay order
 * @route POST /api/payment/create
 * @access Private
 */
export const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const user = req.user;

    // Validate MongoDB ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(user._id)
    ) {
      console.error("Invalid IDs - Order:", orderId, "User:", user._id);
      return res
        .status(400)
        .json({ success: false, message: "Invalid Order or User ID" });
    }

    // Convert string IDs to MongoDB ObjectIds
    const orderObjectId = new mongoose.Types.ObjectId(orderId);
    const userObjectId = new mongoose.Types.ObjectId(user._id);

    // Find the order and verify ownership
    const order = await Order.findOne({
      _id: orderObjectId,
      user: userObjectId,
    });

    // Verify order exists and belongs to user
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found or unauthorized" });
    }

    // Verify amount matches order total
    if (amount !== order.totalPrice) {
      return res.status(400).json({
        success: false,
        message: "Amount does not match the order total",
      });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100, // Convert to smallest currency unit (paise)
      currency: "INR",
      receipt: `order_${orderId}`,
      notes: {
        orderId: orderId.toString(),
        userId: user._id.toString(),
      },
    });

    // Create payment record in database
    const payment = await Payment.create({
      order: orderId,
      user: user._id,
      razorpayOrderId: razorpayOrder.id,
      amount: amount,
      currency: "INR",
      status: "created",
    });

    // Return success response
    res.status(200).json({
      success: true,
      order: razorpayOrder,
      paymentId: payment._id,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    console.error("Razorpay API Error Response:", error.error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

/**
 * Verifies Razorpay payment signature and updates order status
 * @route POST /api/payment/verify
 * @access Private
 */
export const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    // Verify payment signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_API_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed: Invalid signature",
      });
    }

    // Fetch payment details from Razorpay
    const paymentDetails = await razorpay.payments.fetch(razorpayPaymentId);

    // Update payment record in database
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId },
      {
        razorpayPaymentId,
        razorpaySignature,
        status: "captured",
        method: paymentDetails.method,
        bank: paymentDetails.bank,
        wallet: paymentDetails.wallet,
        email: paymentDetails.email,
        contact: paymentDetails.contact,
      },
      { new: true }
    ).populate("order");

    // Update order status
    await Order.findByIdAndUpdate(payment.order._id, {
      paymentStatus: "Paid",
      status: "Processing",
    });

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      payment,
    });
  } catch (error) {
    console.error("Payment verification failed:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

/**
 * Retrieves payment details
 * @route GET /api/payment/:paymentId
 * @access Private
 */
export const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Fetch payment details with related order and user information
    const payment = await Payment.findById(paymentId).populate("order user");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    res.status(200).json({ success: true, payment });
  } catch (error) {
    console.error("Error fetching payment details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment details",
      error: error.message,
    });
  }
};
