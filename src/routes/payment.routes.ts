import { Router } from "express";
import { createRazorpayOrder } from "../controllers/payment.controller";

const router = Router();

router.post("/create-order", createRazorpayOrder);

export default router;