import { Request, Response } from "express";
import prisma from "../config/db";
import { getIO } from "../config/socket";

export class BettingController {
  static async coinFlip(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { betAmount, guess, currency = "USD" } = req.body;

      if (betAmount <= 0) return res.status(400).json({ message: "Invalid bet amount." });

      // 1. Fetch wallet & verify balance
      const wallet = await prisma.wallet.findUnique({
        where: { userId_currency: { userId, currency } },
      });

      if (!wallet || wallet.balance < betAmount) {
        return res.status(400).json({ message: "Insufficient balance." });
      }

      // 2. Determine outcome (50/50 odds)
      const result = Math.random() < 0.5 ? "HEADS" : "TAILS";
      const isWin = guess === result;
      
      // Calculate profit (1.98x payout means 2% house edge)
      const payoutMultiplier = 1.98;
      const profit = isWin ? (betAmount * payoutMultiplier) - betAmount : -betAmount;
      const newBalance = wallet.balance + profit;

      // 3. Update database balance
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      // 4. Broadcast the live bet to everyone on the site
      const io = getIO();
      io.emit("liveBet", {
        game: "Coin Flip",
        currency,
        betAmount,
        isWin,
        profit: isWin ? profit.toFixed(2) : betAmount.toFixed(2), // Show amount won or lost
        timestamp: new Date().toISOString(),
      });

      // 5. Send result back to the specific player
      res.status(200).json({
        message: isWin ? `Winner! Coin landed on ${result}.` : `Bust! Coin landed on ${result}.`,
        data: { newBalance, isWin, result },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error processing bet." });
    }
  }
}