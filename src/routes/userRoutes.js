import express from "express";
import { getAllOrdersByUser } from "../controllers/orderController.js";
import {
  getAllUser,
  getAllUserByRole,
  getUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/profile", getAllOrdersByUser);
router.put("/:userId", updateUser);
router.delete("/delete/:userId", deleteUser);
router.get("/email/:email", getUser);
router.get("/", getAllUser);
router.get("/sellers", getAllUserByRole);

export default router;
