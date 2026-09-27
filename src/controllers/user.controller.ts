import { Request, Response } from "express";
import prisma from "../config/db";

export const getDashboardData = async (req: Request, res: Response) => {
  try {
    // The userId comes from the verifyToken middleware
    const userId = (req as any).user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: true, // Crucial: Fetch the connected wallets
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // The frontend explicitly expects res.data.data.wallets
    res.status(200).json({
      data: {
        id: user.id,
        email: user.email,
        status: user.status,
        wallets: user.wallets,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Server error loading dashboard." });
  }
};