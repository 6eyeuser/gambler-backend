import { Router } from "express";
import {
  register,
  login,
  verifyOtp,
  googleRedirect,
  googleCallback,
  logout
} from "../controllers/auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.post("/logout", logout);

router.get("/google", googleRedirect);
router.get("/google/callback", googleCallback);

export default router; // <-- This exact export is required