import { Router } from "express";
import { getDashboardData } from "../controllers/user.controller";
import { verifyToken } from "../middlewares/auth.middleware";
import prisma from "../config/db";

const router = Router();

// Endpoint for frontend to check current session cookie state on load
router.get("/me", verifyToken, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, status: true }
    });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ message: "Server error verifying session" });
  }
});

// Existing dashboard route
router.get("/dashboard", verifyToken, getDashboardData);

export default router;