import express from "express";
import { getAllUserByRole } from "../controllers/userController.js";

const router = express.Router();

router.get("/", getAllUserByRole);

export default router;
