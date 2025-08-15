import express from "express";
import { getAllOrdersByUser } from "../controllers/orderController.js";
import {
  getAllUser,
  getUser,
  updateUser,
  deleteUser,
  getUserByID,
  handleOAuthLogin,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/profile/:userId", getAllOrdersByUser);
router.post("/oauth", handleOAuthLogin);
router.delete("/delete/:userId", deleteUser);
router.get("/email/:email", getUser);
router.put("/:userId", updateUser);
router.get("/:userId", getUserByID);
router.get("/", getAllUser);

export default router;
