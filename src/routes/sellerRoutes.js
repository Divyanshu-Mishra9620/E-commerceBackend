import express from "express";
import { getAllSellers } from "../controllers/userController.js";

const router = express.Router();

router.get("/", getAllSellers);

export default router;
