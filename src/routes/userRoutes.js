import express from "express";
import { getAllOrdersByUser } from "../controllers/orderController.js";
import { getUser, updateUser } from "../controllers/userController.js";

const router = express.Router();

router.get("/profile", getAllOrdersByUser);
router.put("/:userId", updateUser);
router.get("/email/:email", getUser);

export default router;
