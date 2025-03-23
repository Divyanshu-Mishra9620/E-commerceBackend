import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { validationResult } from "express-validator";

export const getAllOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const orders = await Order.find({ user: userId }).populate(
      "products.product"
    );

    return res.status(200).json({ orders: orders || [] });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { products, shippingAddress, paymentMethod } = req.body;
    console.log(products, shippingAddress, paymentMethod);

    let totalPrice = 0;
    let productDetails = [];

    for (let item of products) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res
          .status(404)
          .json({ message: `Product not found: ${item.product}` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product: ${product.name}`,
        });
      }

      totalPrice += (+product.discounted_price || 799) * +item.quantity;
      productDetails.push({ product: item.product, quantity: item.quantity });

      product.stock -= item.quantity;
      await product.save();
    }

    const newOrder = new Order({
      user: userId,
      products: productDetails,
      totalPrice,
      shippingAddress,
      paymentMethod,
      paymentStatus: "Unpaid",
      status: "Processing",
    });

    await newOrder.save();
    return res
      .status(201)
      .json({ message: "Order placed successfully", order: newOrder });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, status } = req.body;
    const validStatuses = ["Processing", "Shipped", "Delivered", "Cancelled"];

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (
      (order.status === "Delivered" && status !== "Cancelled") ||
      (order.status === "Cancelled" && status !== "Processing")
    ) {
      return res.status(400).json({ message: "Invalid status transition" });
    }

    order.status = status;
    await order.save();

    return res.status(200).json({ message: "Order status updated", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === "Shipped" || order.status === "Delivered") {
      return res
        .status(400)
        .json({ message: "Cannot cancel a shipped or delivered order" });
    }

    for (let item of order.products) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    await Order.findByIdAndDelete(orderId);
    return res.status(200).json({ message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
