import { Request, Response } from "express";
import prisma from "../config/db";

export const placePlinkoBet = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, amount, rows = 8, risk = "Medium" } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid bet parameters" });
    }

    const betAmount = Number(amount);
    const numRows = Math.min(Math.max(Number(rows), 8), 16);

    // 1. Transaction to securely handle wallet deduction and payout
    const result = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findFirst({
        where: { userId, currency: "INR" },
      });

      if (!wallet || wallet.balance < betAmount) {
        throw new Error("Insufficient balance");
      }

      // Deduct bet immediately
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: betAmount } }
      });

      // 2. Generate True Path
      const path: string[] = [];
      let rightCount = 0;
      
      for (let i = 0; i < numRows; i++) {
        const dir = Math.random() > 0.5 ? "R" : "L";
        path.push(dir);
        if (dir === "R") rightCount++;
      }

      // 3. Generate Multipliers (Exact parity with frontend)
      let base = [];
      if (numRows === 8) {
        base = [10, 3, 1.5, 0.5, 0, 0.5, 1.5, 3, 10];
      } else {
        for (let i = 0; i <= numRows; i++) {
          const dist = Math.abs(i - numRows / 2);
          base.push(Number((Math.pow(1.4, dist) - 0.4).toFixed(1)));
        }
      }
      
      let multipliers = base;
      if (risk === "Low") multipliers = base.map(b => Number((b * 0.6 + 0.4).toFixed(1)));
      else if (risk === "High") multipliers = base.map(b => Number((b * 1.5).toFixed(1)));

      const multiplier = multipliers[rightCount];
      const payout = betAmount * multiplier;

      // Add payout back to wallet if user won anything
      if (payout > 0) {
        wallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: payout } }
        });
      }

      return {
        bet: { path, multiplier, payout, amount: betAmount },
        newBalance: wallet.balance
      };
    });

    return res.json({ success: true, data: result });

  } catch (error: any) {
    console.error("Plinko bet error:", error);
    return res.status(400).json({ error: error.message || "Failed to place bet" });
  }
};