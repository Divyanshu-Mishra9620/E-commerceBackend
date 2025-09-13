import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Subscription from "../models/Subscription.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
dotenv.config({ path: ".env.local" });

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_API_KEY,
  key_secret: process.env.RAZORPAY_API_SECRET,
});

function getPlanDetails(planId) {
  if (typeof planId !== "string") return null;

  const plans = {
    basic: {
      id: "basic",
      name: "Basic Plan",
      price: 299,
      maxListings: 1,
    },
    pro: {
      id: "pro",
      name: "Pro Plan",
      price: 1499,
      maxListings: 10,
    },
    premium: {
      id: "premium",
      name: "Premium Plan",
      price: 2599,
      maxListings: Infinity,
    },
  };

  return plans[planId] || null;
}

export const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId, amount, user } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(user._id)
    ) {
      console.error("Invalid IDs - Order:", orderId, "User:", user._id);
      return res
        .status(400)
        .json({ success: false, message: "Invalid Order or User ID" });
    }

    const orderObjectId = new mongoose.Types.ObjectId(orderId);
    const userObjectId = new mongoose.Types.ObjectId(user._id);

    const order = await Order.findOne({
      _id: orderObjectId,
      user: userObjectId,
    });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found or unauthorized" });
    }

    if (amount !== order.totalPrice) {
      return res.status(400).json({
        success: false,
        message: "Amount does not match the order total",
      });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `order_${orderId}`,
      notes: {
        orderId: orderId.toString(),
        userId: user._id.toString(),
      },
    });

    const payment = await Payment.create({
      order: orderId,
      user: user._id,
      razorpayOrderId: razorpayOrder.id,
      amount: amount,
      currency: "INR",
      status: "created",
    });

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

export const createSubscription = async (req, res) => {
  try {
    const { amount, duration, planId } = req.body;

    const plan = getPlanDetails(planId);
    if (!plan) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const options = {
      amount: amount,
      currency: "INR",
      receipt: `sub_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    res.status(201).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      duration: duration,
      planId: planId,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ message: "Failed to create subscription order" });
  }
};

function verifyRazorpaySignature(orderId, paymentId, signature) {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_API_SECRET)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

export const verifySubscription = async (req, res) => {
  const userId = req.user._id;

  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    planId,
    duration,
  } = req.body;

  if (
    !razorpay_payment_id ||
    !razorpay_order_id ||
    !razorpay_signature ||
    !planId
  ) {
    return res
      .status(400)
      .json({ message: "Missing required payment fields." });
  }

  if (
    !verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    )
  ) {
    return res.status(400).json({ message: "Invalid payment signature." });
  }

  const plan = getPlanDetails(planId);
  if (!plan) {
    return res.status(400).json({ message: "Invalid plan selected." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + parseInt(duration));

    const subscription = new Subscription({
      user: userId,
      startDate,
      endDate,
      planId,
      planName: plan.name,
      duration: parseInt(duration),
      amount: plan.price * parseInt(duration),
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    await subscription.save({ session });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          role: "seller",
          subscription: subscription._id,
          subscriptionExpiry: endDate,
        },
      },
      { new: true, session }
    );

    if (!updatedUser) {
      throw new Error("User not found during update.");
    }

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      user: {
        id: updatedUser._id,
        role: updatedUser.role,
        subscriptionExpiry: updatedUser.subscriptionExpiry,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Subscription verification error:", error);
    res.status(500).json({ message: "Failed to verify subscription" });
  } finally {
    session.endSession();
  }
};

export const getSubscriptionDetails = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: "Invalid user ID" });

    const subscription = await Subscription.findOne({ user: userId });

    if (!subscription) {
      return res.status(404).json({ message: "No active subscription found" });
    }

    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const isValid = endDate > now;

    return res.status(200).json({
      success: true,
      subscription: {
        ...subscription,
        isValid,
        daysRemaining: Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)),
      },
    });
  } catch (error) {
    console.error("Error fetching subscription details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

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

    const paymentDetails = await razorpay.payments.fetch(razorpayPaymentId);

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

export const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

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
