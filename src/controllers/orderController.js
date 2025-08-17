import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

import { Client } from "@googlemaps/google-maps-services-js";

export const getAllOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    const ordersPromise = Order.find({ user: userId })
      .populate(
        "products.product",
        "product_name image discounted_price uniq_id"
      )
      .sort({ createdAt: -1 })
      .lean();

    const countPromise = Order.countDocuments({ user: userId });

    const [orders, totalOrders] = await Promise.all([
      ordersPromise,
      countPromise,
    ]);

    res.status(200).json({ orders, totalOrders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { userId } = req.params;
    const { cartItems: products, shippingAddress, paymentMethod } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ message: "Order must contain products." });
    }

    const productIds = products.map((item) => item.product._id);

    const productsInDB = await Product.find({
      _id: { $in: productIds },
    }).session(session);

    if (productsInDB.length !== productIds.length) {
      return res
        .status(404)
        .json({ message: "One or more products not found." });
    }

    let totalPrice = 0;
    // const bulkStockUpdates = [];

    for (const item of products) {
      const productDB = productsInDB.find((p) =>
        p._id.equals(item.product._id)
      );

      // TODO LATER
      // if (productDB.stock < item.quantity) {
      //   throw new Error(`Not enough stock for ${productDB.product_name}.`);
      // }

      let cost_per_pdt = 599;
      if (!isNaN(+productDB.discounted_price))
        cost_per_pdt = +productDB.discounted_price;

      totalPrice += cost_per_pdt * item.quantity;

      // bulkStockUpdates.push({
      //   updateOne: {
      //     filter: { _id: productDB._id },
      //     update: { $inc: { stock: -item.quantity } },
      //   },
      // });
    }

    const newOrder = new Order({
      user: userId,
      products: products.map((p) => ({
        product: p.product._id,
        quantity: p.quantity,
      })),
      totalPrice,
      shippingAddress,
      paymentMethod,
    });

    await newOrder.save({ session });

    // await Product.bulkWrite(bulkStockUpdates, { session });

    await session.commitTransaction();

    res
      .status(201)
      .json({ message: "Order placed successfully", order: newOrder });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating order:", error);
    res.status(500).json({ message: error.message || "Internal Server Error" });
  } finally {
    session.endSession();
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const validStatuses = ["Processing", "Shipped", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (status === "Cancelled" && order.status !== "Cancelled") {
      const bulkStockUpdates = order.products.map((item) => ({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { stock: item.quantity } },
        },
      }));
      await Product.bulkWrite(bulkStockUpdates);
    }

    order.status = status;
    await order.save();

    res.status(200).json({ message: "Order status updated", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find();

    return res.status(200).json({ orders: orders || [] });
  } catch (error) {
    console.error("Error fetching orders:", error);
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

export const getOrderByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }
    const order = await Order.findById(orderId).populate(
      "products.product",
      "product_name image discounted_price uniq_id"
    );
    if (!order) return res.status(404).json({ message: "Order not found" }, []);

    return res.status(200).json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const googleMapsClient = new Client({});

export const getOrderCoordinates = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).lean();
    if (!order || !order.shippingAddress) {
      return res.status(404).json({ message: "Address not found" });
    }

    const { street, city, state, postalCode, country } = order.shippingAddress;
    const addressString = `${street}, ${city}, ${state} ${postalCode}, ${country}`;

    const response = await googleMapsClient.geocode({
      params: {
        address: addressString,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    if (response.data.results.length > 0) {
      res.status(200).json(response.data.results[0].geometry.location);
    } else {
      throw new Error("Could not geocode address.");
    }
  } catch (error) {
    console.error("Geocoding error:", error);
    res.status(500).json({ message: "Failed to get coordinates" });
  }
};
