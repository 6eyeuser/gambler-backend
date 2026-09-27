import { Request, Response } from "express";
import prisma from "../config/db";
import { gameState, currentMultiplier, activeBets } from "../services/crash.engine";

export const placeCrashBet = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, amount } = req.body;
    
    if (gameState !== "WAITING") {
      return res.status(400).json({ error: "Game already started, wait for next round." });
    }

    if (activeBets.has(userId)) {
      return res.status(400).json({ error: "You already have a bet for this round." });
    }

    const betAmount = Number(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ error: "Invalid bet amount" });
    }

    const wallet = await prisma.wallet.findFirst({ where: { userId, currency: "INR" } });
    if (!wallet || wallet.balance < betAmount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Deduct money immediately
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: betAmount } }
    });

    // Register the bet in the live engine memory
    activeBets.set(userId, betAmount);

    return res.json({ success: true, message: "Bet placed!", data: { amount: betAmount } });
  } catch (error) {
    console.error("Crash Bet Error:", error);
    return res.status(500).json({ error: "Failed to place bet" });
  }
};

export const cashoutCrashBet = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.body; 
    
    if (gameState !== "PLAYING") {
      return res.status(400).json({ error: "Cannot cash out right now." });
    }

    if (!activeBets.has(userId)) {
      return res.status(400).json({ error: "No active bet to cash out." });
    }

    // 1. Lock the multiplier exactly when the request hits the server
    const lockedMultiplier = currentMultiplier;
    const originalBet = activeBets.get(userId)!;
    
    // 2. Remove them from the active round IMMEDIATELY to prevent double-cashing out
    activeBets.delete(userId);

    const payout = originalBet * lockedMultiplier;

    // 3. Credit the user's wallet
    const wallet = await prisma.wallet.findFirst({ where: { userId, currency: "INR" } });
    if (wallet) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: payout } }
      });
    }

    return res.json({ 
      success: true, 
      data: { payout, multiplier: lockedMultiplier.toFixed(2) } 
    });
  } catch (error) {
    console.error("Crash Cashout Error:", error);
    return res.status(500).json({ error: "Cashout failed" });
  }
};