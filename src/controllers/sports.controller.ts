import { Request, Response } from "express";
import prisma from "../config/db";
import { syncSportsMatches } from "../services/sportsSync"; // Imported for the manual trigger

export const getMatches = async (_req: Request, res: Response): Promise<any> => {
  try {
    const matches = await prisma.sportsMatch.findMany({
      where: {
        status: { in: ["UPCOMING", "LIVE"] }, // Hide COMPLETED matches
        startTime: {
          gte: new Date(), // Only fetch matches happening right now or in the future
        },
      },
      orderBy: {
        startTime: "asc", // Show the soonest matches first
      },
    });

    return res.status(200).json({ success: true, data: matches });
  } catch (error: any) {
    console.error("Fetch matches error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch matches" });
  }
};

export const placeSportsBet = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId; 
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: User ID missing from token." });
    }

    const { matchId, amount, guess } = req.body;

    const betAmount = Number(amount);
    if (isNaN(betAmount) || betAmount <= 0) {
       return res.status(400).json({ success: false, message: "Invalid bet amount." });
    }

    const match = await prisma.sportsMatch.findUnique({ where: { id: matchId } });
    if (!match || match.status !== "UPCOMING") {
       return res.status(400).json({ success: false, message: "Match is unavailable for betting." });
    }

    let lockedOdds = 0;
    let poolUpdateField = "";
    
    if (guess === "TEAM_A") {
      lockedOdds = match.oddsA;
      poolUpdateField = "totalPoolA";
    } else if (guess === "TEAM_B") {
      lockedOdds = match.oddsB;
      poolUpdateField = "totalPoolB";
    } else if (guess === "DRAW" && match.oddsDraw) {
      lockedOdds = match.oddsDraw;
      poolUpdateField = "totalPoolDraw";
    } else {
       return res.status(400).json({ success: false, message: "Invalid prediction." });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findFirst({
        where: { userId: userId, currency: "INR" }
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId: userId,
            currency: "INR",
            balance: 10000 
          }
        });
      }

      if (wallet.balance < betAmount) {
        throw new Error(`Insufficient INR balance. You have ${wallet.balance}, but tried to bet ${betAmount}.`);
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: betAmount } }
      });

      const bet = await tx.sportsBet.create({
        data: { userId, matchId, amount: betAmount, guess, lockedOdds }
      });

      const updatedMatch = await tx.sportsMatch.update({
        where: { id: matchId },
        data: { [poolUpdateField]: { increment: betAmount } }
      });

      return { bet, updatedMatch };
    });

    const { updatedMatch } = transaction;
    const VIG = 0.95; 
    
    const vPoolA = updatedMatch.totalPoolA + 1000;
    const vPoolB = updatedMatch.totalPoolB + 1000;
    const vPoolDraw = updatedMatch.oddsDraw ? (updatedMatch.totalPoolDraw + 1000) : 0;
    
    const totalVirtualPool = vPoolA + vPoolB + vPoolDraw;

    const newOddsA = (totalVirtualPool / vPoolA) * VIG;
    const newOddsB = (totalVirtualPool / vPoolB) * VIG;
    const newOddsDraw = updatedMatch.oddsDraw ? ((totalVirtualPool / vPoolDraw) * VIG) : null;

    const finalUpdatedMatch = await prisma.sportsMatch.update({
      where: { id: matchId },
      data: {
        oddsA: Number(newOddsA.toFixed(3)),
        oddsB: Number(newOddsB.toFixed(3)),
        oddsDraw: newOddsDraw ? Number(newOddsDraw.toFixed(3)) : null
      }
    });

    return res.status(200).json({ 
      success: true, 
      message: "Bet locked in!", 
      data: { 
        bet: transaction.bet, 
        match: finalUpdatedMatch 
      } 
    });
  } catch (error: any) {
    console.error("Bet placement error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getUserBets = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const bets = await prisma.sportsBet.findMany({
      where: { userId },
      include: { match: true },
      orderBy: { createdAt: "desc" }
    });

    return res.status(200).json({ success: true, data: bets });
  } catch (error: any) {
    console.error("Get user bets error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const manuallySettleMatch = async (req: Request, res: Response): Promise<any> => {
  try {
    const { matchId, winningOutcome } = req.body; 

    if (!matchId || !winningOutcome) {
      return res.status(400).json({ error: "Missing matchId or winningOutcome" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.sportsMatch.update({
        where: { id: matchId },
        data: { status: "COMPLETED" }
      });

      const pendingBets = await tx.sportsBet.findMany({
        where: { matchId, status: "PENDING" }
      });

      for (const bet of pendingBets) {
        const isWinner = bet.guess === winningOutcome;
        
        await tx.sportsBet.update({
          where: { id: bet.id },
          data: { status: isWinner ? "WON" : "LOST" }
        });

        if (isWinner) {
          const payout = bet.amount * bet.lockedOdds;
          
          const wallet = await tx.wallet.findFirst({
            where: { userId: bet.userId, currency: "INR" }
          });

          if (wallet) { // ✅ Fixed the stray 'z' typo here
            await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: payout } }
            });
          }
        }
      }
    });

    return res.json({ success: true, message: `Match ${matchId} settled as ${winningOutcome}` });
  } catch (error: any) {
    console.error("Settlement error:", error);
    return res.status(500).json({ error: "Failed to settle match" });
  }
};

// ✅ ADDED: The new manual API trigger for the sports sync/settlement engine
export const triggerManualSettlement = async (req: Request, res: Response): Promise<any> => {
  try {
    console.log("⚡ Manual settlement triggered via API...");
    
    await syncSportsMatches();
    
    return res.status(200).json({ success: true, message: "Bets synced and settled successfully!" });
  } catch (error: any) {
    console.error("Manual settlement failed:", error);
    return res.status(500).json({ success: false, error: "Failed to run settlement engine." });
  }
};