import cron from "node-cron";
import prisma from "../config/db";

// This function simulates checking your real-world Sports API for results.
const fetchRealMatchResult = async (matchId: string) => {
  try {
    // Example: const res = await axios.get(`https://api.sports.io/match/${matchId}/results`);
    // return res.data.winner; // "TEAM_A", "TEAM_B", or "DRAW"
    
    // For now, returning null means the match isn't finished yet.
    return null; 
  } catch (error) {
    console.error(`Failed to fetch result for match ${matchId}`);
    return null;
  }
};

export const runAutoSettlement = async () => {
  console.log("🔄 [Cron] Running automated bet settlement...");

  try {
    // 1. Find all matches that have started but haven't been settled yet
    const pendingMatches = await prisma.sportsMatch.findMany({
      where: {
        status: "UPCOMING", // Using UPCOMING as per your schema default
        startTime: { lt: new Date() }, // Match time is in the past
      },
    });

    for (const match of pendingMatches) {
      // 2. Ask your API who won the match
      const winningOutcome = await fetchRealMatchResult(match.id);
      
      if (!winningOutcome) continue; // Match still in progress

      // 3. SECURE TRANSACTION: Update the match, pay winners, and mark losers
      await prisma.$transaction(async (tx) => {
        
        // Mark match as completed
        await tx.sportsMatch.update({
          where: { id: match.id },
          data: { status: "COMPLETED", winningOutcome },
        });

        // Find all pending bets for this match
        const pendingBets = await tx.sportsBet.findMany({
          where: { matchId: match.id, status: "PENDING" },
        });

        for (const bet of pendingBets) {
          if (bet.guess === winningOutcome) {
            const payout = bet.amount * bet.lockedOdds;

            // Mark Bet as WON
            await tx.sportsBet.update({
              where: { id: bet.id },
              data: { status: "WON" },
            });

            // Credit User's USD Wallet
            await tx.wallet.updateMany({
              where: { userId: bet.userId, currency: "USD" },
              data: { balance: { increment: payout } },
            });

            console.log(`💰 Paid out $${payout.toFixed(2)} to user ${bet.userId} for Bet ${bet.id}`);
          } else {
            // Mark Bet as LOST
            await tx.sportsBet.update({
              where: { id: bet.id },
              data: { status: "LOST" },
            });
          }
        }
      });
      
      console.log(`✅ Match ${match.id} fully settled. Winner: ${winningOutcome}`);
    }
  } catch (error) {
    console.error("❌ Settlement Error:", error);
  }
};

// Schedule the cron job to run every 5 minutes
export const startSettlementCron = () => {
  cron.schedule("*/5 * * * *", () => {
    runAutoSettlement();
  });
  console.log("⏱️ Auto-settlement cron job initialized (Runs every 5 minutes)");
};