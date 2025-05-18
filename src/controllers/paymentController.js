import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_API_KEY,
  key_secret: process.env.RAZORPAY_API_SECRET,
});

export const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.error("Invalid Order ID:", orderId);
      return res
        .status(400)
        .json({ success: false, message: "Invalid Order ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(user._id)) {
      console.error("Invalid User ID:", user._id);
      return res
        .status(400)
        .json({ success: false, message: "Invalid User ID" });
    }

    const orderObjectId = new mongoose.Types.ObjectId(orderId);
    const userObjectId = new mongoose.Types.ObjectId(user._id);

    const query = {
      _id: orderObjectId,
      user: userObjectId,
    };

    const order = await Order.findOne(query);

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
    console.log("Razorpay Order:", razorpayOrder);

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
    res.status(500).json({ success: false, message: "Internal Server Error" });
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
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
    console.error("Error verifying payment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId).populate("order user");

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    res.status(200).json({ success: true, payment });
  } catch (error) {
    console.error("Error fetching payment details:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
