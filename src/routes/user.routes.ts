import { Router } from "express";
import { getDashboardData } from "../controllers/user.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

router.get("/dashboard", verifyToken, getDashboardData);

export default router; // <-- This exact export is required