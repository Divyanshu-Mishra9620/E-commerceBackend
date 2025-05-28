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

/**
 * @route POST /api/payment/create
 * @access Private
 */
export const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const user = req.user;

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
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ message: "Failed to create subscription order" });
  }
};

export const verifySubscription = async (req, res) => {
  try {
    const requiredFields = [
      "razorpay_payment_id",
      "razorpay_order_id",
      "razorpay_signature",
      "planId",
      "duration",
      "user",
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          message: `Missing required field: ${field}`,
        });
      }
    }

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      planId,
      duration,
      user,
    } = req.body;

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_API_SECRET)
      .update(body)
      .digest("hex");

    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(generatedSignature),
      Buffer.from(razorpay_signature)
    );

    if (!isSignatureValid) {
      console.error("Payment verification failed: Signature mismatch");
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    const plan = getPlanDetails(planId);
    if (!plan) {
      console.error(`Invalid plan ID: ${planId}`);
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected",
      });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + parseInt(duration));

    const subscription = new Subscription({
      user: user._id,
      startDate,
      endDate,
      planId,
      planName: plan.name,
      duration: parseInt(duration),
      amount: plan.price,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "active",
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const savedSubscription = await subscription.save({ session });

      const foundUser = await User.findById(user._id).session(session);
      if (!foundUser) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      foundUser.role = foundUser.role === "user" ? "seller" : foundUser.role;
      foundUser.subscription = savedSubscription._id;
      foundUser.subscriptionExpiry = endDate;

      await foundUser.save({ session });

      const msUntilEnd = endDate - new Date();
      if (msUntilEnd > 0) {
        setTimeout(async () => {
          const userSession = await mongoose.startSession();
          userSession.startTransaction();

          try {
            const userToUpdate = await User.findById(user._id).session(
              userSession
            );
            if (
              userToUpdate &&
              userToUpdate.subscription?.equals(savedSubscription._id)
            ) {
              userToUpdate.role = "user";
              userToUpdate.subscription = null;
              userToUpdate.subscriptionExpiry = null;
              await userToUpdate.save({ session: userSession });
              await userSession.commitTransaction();
            } else {
              await userSession.abortTransaction();
            }
          } catch (err) {
            console.error("Error in subscription expiry handler:", err);
            await userSession.abortTransaction();
          } finally {
            userSession.endSession();
          }
        }, msUntilEnd);
      }

      await session.commitTransaction();

      res.status(201).json({
        success: true,
        message: "Subscription created successfully",
        data: {
          subscription: savedSubscription,
          user: {
            id: foundUser._id,
            role: foundUser.role,
            subscriptionExpiry: foundUser.subscriptionExpiry,
          },
        },
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Subscription verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify subscription",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

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

export const getSubscriptionDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const subscription = await Subscription.findOne({ user: id })
      .populate("user", "name email role")
      .lean();

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
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

/**
 * @route GET /api/payment/:paymentId
 * @access Private
 */
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
