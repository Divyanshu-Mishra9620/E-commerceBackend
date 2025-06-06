import express from "express";
import { getAllOrdersByUser } from "../controllers/orderController.js";
import {
  getAllUser,
  getUser,
  updateUser,
  deleteUser,
  getUserByID,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/profile", getAllOrdersByUser);
router.put("/:userId", updateUser);
router.delete("/delete/:userId", deleteUser);
router.get("/email/:email", getUser);
router.get("/:id", getUserByID);
router.get("/", getAllUser);

export default router;
