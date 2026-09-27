import { Request, Response } from "express";
import prisma from "../config/db"; // ✅ Correctly importing the shared adapter instance

export const getDashboardHistory = async (req: Request, res: Response): Promise<any> => {
  try {
    // Explicitly cast userId as a string to clear the TypeScript error
    const userId = req.params.userId as string;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Fetch ONLY Sports Bets
    const sportsBets = await prisma.sportsBet.findMany({
      where: { userId },
      include: { match: true }, // Pulls in Team A, Team B, and the sport details
      orderBy: { createdAt: "desc" },
      take: 30, // Grabs the 30 most recent bets
    });

    // Tag them as SPORTS so your frontend knows how to render them
    const history = sportsBets.map((bet) => ({ ...bet, type: "SPORTS" }));

    return res.json({ success: true, history });
  } catch (error) {
    console.error("Dashboard history fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch dashboard history" });
  }
};