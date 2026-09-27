import { Router } from "express";
import { getDashboardHistory } from "../controllers/dashboard.controller";

const router = Router();

router.get("/history/:userId", getDashboardHistory);

export default router;