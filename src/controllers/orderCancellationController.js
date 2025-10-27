import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_API_KEY,
  key_secret: process.env.RAZORPAY_API_SECRET,
});

export const getCancellationDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    const order = await Order.findById(orderId)
      .populate(
        "products.product",
        "product_name image discounted_price uniq_id stock"
      )
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const canCancel = ["Processing", "Shipped"].includes(order.status);
    const canReturn = ["Delivered"].includes(order.status);

    const createdDate = new Date(order.orderedAt);
    const currentDate = new Date();
    const daysOld = Math.floor(
      (currentDate - createdDate) / (1000 * 60 * 60 * 24)
    );

    res.status(200).json({
      order,
      eligibility: {
        canCancel,
        canReturn,
        daysOld,
        returnsWindowOpen: daysOld <= 14,
        cancellationDeadline: new Date(
          createdDate.getTime() + 7 * 24 * 60 * 60 * 1000
        ),
      },
      cancellationReasons: [
        "Changed my mind",
        "Found a better price elsewhere",
        "Found what I wanted in a physical store",
        "Ordered by mistake",
        "Delivery taking too long",
        "Other",
      ],
      returnReasons: [
        "Product quality not as expected",
        "Received damaged product",
        "Wrong item received",
        "Item doesn't fit",
        "Changed my mind",
        "Product defective",
        "Other",
      ],
    });
  } catch (error) {
    console.error("Error fetching cancellation details:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const requestCancellation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, reason, comments } = req.body;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    if (!reason) {
      return res
        .status(400)
        .json({ message: "Cancellation reason is required" });
    }

    const order = await Order.findById(orderId).session(session);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    if (!["Processing", "Shipped"].includes(order.status)) {
      return res
        .status(400)
        .json({ message: `Cannot cancel order with status: ${order.status}` });
    }

    const createdDate = new Date(order.orderedAt);
    const currentDate = new Date();
    const daysOld = Math.floor(
      (currentDate - createdDate) / (1000 * 60 * 60 * 24)
    );

    if (daysOld > 7 && order.status !== "Processing") {
      return res.status(400).json({
        message: "Cancellation window expired (7 days from order date)",
      });
    }

    const bulkStockUpdates = order.products.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: item.quantity } },
      },
    }));

    if (bulkStockUpdates.length > 0) {
      await Product.bulkWrite(bulkStockUpdates, { session });
    }

    let refundDetails = null;
    if (order.paymentStatus === "Paid" && order.paymentMethod === "Razorpay") {
      try {
        if (!order.transactionId) {
          console.warn("No transaction ID found for order:", orderId);
          refundDetails = {
            error:
              "Payment ID not found in order. Please contact support for manual refund.",
            status: "failed",
          };
        } else {
          const refund = await razorpay.payments.refund(order.transactionId, {
            amount: Math.round(order.totalPrice * 100),
            notes: {
              reason: reason,
              comments: comments || "",
              orderId: orderId,
            },
          });

          refundDetails = {
            refundId: refund.id,
            amount: refund.amount / 100,
            status: refund.status,
          };

          order.paymentStatus = "Refunded";
        }
      } catch (refundError) {
        console.error("Refund error:", refundError);
        refundDetails = {
          error: refundError.message,
          status: "failed",
        };
      }
    }

    order.status = "Cancelled";
    order.cancellationReason = reason;
    order.notes = comments || "";
    order.cancelledAt = new Date();

    await order.save({ session });
    await session.commitTransaction();

    const user = await User.findById(userId);
    if (user && user.email) {
      console.log(`Cancellation notification sent to ${user.email}`);
    }

    res.status(200).json({
      message: "Order cancellation requested successfully",
      order,
      refund: refundDetails,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error requesting cancellation:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    session.endSession();
  }
};

export const requestReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, reason, comments, returnItems } = req.body;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    if (!reason) {
      return res.status(400).json({ message: "Return reason is required" });
    }

    const order = await Order.findById(orderId).session(session);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    if (order.status !== "Delivered") {
      return res
        .status(400)
        .json({ message: `Cannot return order with status: ${order.status}` });
    }

    const deliveryDate = new Date(order.deliveredAt || order.orderedAt);
    const currentDate = new Date();
    const daysOld = Math.floor(
      (currentDate - deliveryDate) / (1000 * 60 * 60 * 24)
    );

    if (daysOld > 14) {
      return res
        .status(400)
        .json({ message: "Return window expired (14 days from delivery)" });
    }

    const itemsToReturn =
      returnItems ||
      order.products.map((p) => ({
        product: p.product,
        quantity: p.quantity,
      }));

    let refundAmount = 0;
    for (const item of itemsToReturn) {
      const orderItem = order.products.find(
        (p) => p.product.toString() === item.product.toString()
      );
      if (orderItem) {
        const product = await Product.findById(item.product).session(session);
        if (product) {
          refundAmount += (product.discounted_price || 599) * item.quantity;
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } },
            { session }
          );
        }
      }
    }

    let refundDetails = null;
    if (order.paymentStatus === "Paid" && order.paymentMethod === "Razorpay") {
      try {
        if (!order.transactionId) {
          console.warn("No transaction ID found for order:", orderId);
          refundDetails = {
            error:
              "Payment ID not found in order. Please contact support for manual refund.",
            status: "failed",
          };
        } else {
          const refund = await razorpay.payments.refund(order.transactionId, {
            amount: Math.round(refundAmount * 100),
            notes: {
              reason: reason,
              comments: comments || "",
              orderId: orderId,
              returnType:
                itemsToReturn.length === order.products.length
                  ? "full"
                  : "partial",
            },
          });

          refundDetails = {
            refundId: refund.id,
            amount: refund.amount / 100,
            status: refund.status,
            type:
              itemsToReturn.length === order.products.length
                ? "full"
                : "partial",
          };

          if (itemsToReturn.length === order.products.length) {
            order.paymentStatus = "Refunded";
          } else {
            order.paymentStatus = "Partially Refunded";
          }
        }
      } catch (refundError) {
        console.error("Refund error:", refundError);
        refundDetails = {
          error: refundError.message,
          status: "failed",
        };
      }
    }

    order.status = "Returned";
    order.refundReason = reason;
    order.notes = comments || "";

    await order.save({ session });
    await session.commitTransaction();

    const user = await User.findById(userId);
    if (user && user.email) {
      console.log(`Return notification sent to ${user.email}`);
    }

    res.status(200).json({
      message: "Return request submitted successfully",
      order,
      refund: refundDetails,
      refundAmount,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error requesting return:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    session.endSession();
  }
};

export const getCancellationHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason, limit = 10, skip = 0 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    let query = {
      user: userId,
      status: { $in: ["Cancelled", "Returned"] },
    };

    if (status) {
      query.status = status;
    }

    if (reason) {
      query.$or = [
        { cancellationReason: new RegExp(reason, "i") },
        { refundReason: new RegExp(reason, "i") },
      ];
    }

    const cancellations = await Order.find(query)
      .populate("products.product", "product_name image discounted_price")
      .sort({ cancelledAt: -1, updatedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Order.countDocuments(query);

    res.status(200).json({
      cancellations,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + parseInt(limit) < total,
      },
    });
  } catch (error) {
    console.error("Error fetching cancellation history:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getRefundStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    const order = await Order.findById(orderId).lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (userId && order.user.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const refundStatus = {
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      refundReason: order.refundReason || order.cancellationReason,
      totalPrice: order.totalPrice,
      cancelledAt: order.cancelledAt,
      updatedAt: order.updatedAt,
      timeline: {
        initiated: order.cancelledAt || order.updatedAt,
        inProgress:
          order.status === "Cancelled" || order.status === "Returned"
            ? true
            : false,
        completed: ["Refunded", "Partially Refunded"].includes(
          order.paymentStatus
        ),
      },
    };

    res.status(200).json(refundStatus);
  } catch (error) {
    console.error("Error fetching refund status:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllCancellationRequests = async (req, res) => {
  try {
    const { status = "Cancelled", limit = 20, skip = 0 } = req.query;

    const requests = await Order.find({ status })
      .populate("user", "name email phone")
      .populate("products.product", "product_name image discounted_price")
      .sort({ cancelledAt: -1, updatedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Order.countDocuments({ status });

    res.status(200).json({
      requests,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      },
    });
  } catch (error) {
    console.error("Error fetching cancellation requests:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const approveCancellationRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId, approved, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    const order = await Order.findById(orderId).session(session);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (approved) {
      if (
        order.paymentStatus === "Paid" &&
        order.paymentMethod === "Razorpay"
      ) {
        try {
          const refund = await razorpay.payments.refund(order.transactionId, {
            amount: Math.round(order.totalPrice * 100),
            notes: {
              adminApproved: true,
              adminNotes: notes || "",
              orderId: orderId,
            },
          });

          order.paymentStatus = "Refunded";
        } catch (refundError) {
          console.error("Refund error:", refundError);
          return res.status(500).json({ message: "Failed to process refund" });
        }
      }

      order.notes = notes || order.notes;
    }

    await order.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      message: approved ? "Cancellation approved" : "Cancellation rejected",
      order,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error approving cancellation:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    session.endSession();
  }
};
