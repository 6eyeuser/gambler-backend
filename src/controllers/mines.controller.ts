import { Request, Response } from "express";
import prisma from "../config/db";

// Temporary in-memory active games map (For production, store this in Redis or a DB table)
// Map<userId, { betAmount, minesCount, minePositions: number[], revealedTiles: number[], multiplier: number, isGameOver: boolean }>
const activeMinesGames = new Map<string, any>();

export const startMinesGame = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, amount, minesCount } = req.body;
    const betAmount = Number(amount);
    const numMines = Number(minesCount);

    if (!userId || isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({ error: "Invalid bet parameters" });
    }

    if (isNaN(numMines) || numMines < 1 || numMines > 24) {
      return res.status(400).json({ error: "Mines count must be between 1 and 24" });
    }

    if (activeMinesGames.has(userId)) {
      return res.status(400).json({ error: "You already have an active Mines game!" });
    }

    // 1. Transaction to safely deduct balance
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({
        where: { userId, currency: "INR" },
      });

      if (!wallet || wallet.balance < betAmount) {
        throw new Error("Insufficient balance");
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: betAmount } }
      });

      return wallet.balance - betAmount;
    });

    // 2. Generate random mine positions on a 25-tile grid (0 to 24)
    const minePositions: number[] = [];
    while (minePositions.length < numMines) {
      const randomTile = Math.floor(Math.random() * 25);
      if (!minePositions.includes(randomTile)) {
        minePositions.push(randomTile);
      }
    }

    // 3. Save game state in memory
    activeMinesGames.set(userId, {
      betAmount,
      minesCount: numMines,
      minePositions,
      revealedTiles: [],
      multiplier: 1.00,
      isGameOver: false,
    });

    return res.json({
      success: true,
      message: "Mines game started!",
      data: { newBalance: result, remainingTiles: 25 }
    });

  } catch (error: any) {
    console.error("Start Mines Error:", error);
    return res.status(400).json({ error: error.message || "Failed to start game" });
  }
};

export const revealMinesTile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, tileIndex } = req.body;
    const game = activeMinesGames.get(userId);

    if (!game || game.isGameOver) {
      return res.status(400).json({ error: "No active game found." });
    }

    if (tileIndex < 0 || tileIndex > 24 || game.revealedTiles.includes(tileIndex)) {
      return res.status(400).json({ error: "Invalid tile selection." });
    }

    // 1. Check if hit a mine
    if (game.minePositions.includes(tileIndex)) {
      game.isGameOver = true;
      activeMinesGames.delete(userId); // Clear active game

      return res.json({
        success: true,
        data: {
          hitMine: true,
          minePositions: game.minePositions, // Reveal all mines
          payout: 0,
        }
      });
    }

    // 2. Safe tile found! Calculate new multiplier based on combinatorial probability
    game.revealedTiles.push(tileIndex);
    const gemsRevealed = game.revealedTiles.length;
    
    // Standard casino multiplier formula for Mines
    const multiplier = calculateMultiplier(game.minesCount, gemsRevealed);
    game.multiplier = multiplier;

    const currentPayout = game.betAmount * multiplier;

    return res.json({
      success: true,
      data: {
        hitMine: false,
        multiplier,
        payout: currentPayout,
        revealedTiles: game.revealedTiles,
      }
    });

  } catch (error: any) {
    console.error("Reveal Tile Error:", error);
    return res.status(400).json({ error: "Failed to reveal tile" });
  }
};

export const cashoutMinesGame = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.body;
    const game = activeMinesGames.get(userId);

    if (!game || game.isGameOver || game.revealedTiles.length === 0) {
      return res.status(400).json({ error: "No winnings to cash out." });
    }

    const payout = game.betAmount * game.multiplier;
    game.isGameOver = true;
    activeMinesGames.delete(userId);

    // Credit user's wallet
    const updatedWallet = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({ where: { userId, currency: "INR" } });
      if (!wallet) throw new Error("Wallet not found");

      return await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: payout } }
      });
    });

    return res.json({
      success: true,
      data: {
        payout,
        multiplier: game.multiplier,
        newBalance: updatedWallet.balance,
        minePositions: game.minePositions, // Show where the mines were
      }
    });

  } catch (error: any) {
    console.error("Cashout Mines Error:", error);
    return res.status(400).json({ error: "Failed to cash out" });
  }
};

// Helper function to calculate progressive multipliers
function calculateMultiplier(mines: number, gems: number): number {
  let mult = 1.0;
  const houseEdge = 0.99; // 1% house edge
  
  for (let i = 0; i < gems; i++) {
    const remainingTiles = 25 - i;
    const remainingMines = mines;
    const safeTiles = remainingTiles - remainingMines;
    mult *= (remainingTiles / safeTiles);
  }
  
  return Number((mult * houseEdge).toFixed(2));
}