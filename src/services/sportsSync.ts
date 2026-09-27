import axios from "axios";
import prisma from "../config/db";

// .trim() removes invisible spaces or line breaks imported from the .env file
const API_KEY = process.env.ODDS_API_KEY?.trim(); 

const sportsToFetch = [
  { key: "soccer_epl", group: "Football" },
  { key: "soccer_spain_la_liga", group: "Football" },
  { key: "soccer_uefa_champs_league", group: "Football" },
  { key: "soccer_italy_serie_a", group: "Football" },
  { key: "soccer_germany_bundesliga", group: "Football" },
  { key: "soccer_france_ligue_one", group: "Football" },
  { key: "soccer_usa_mls", group: "Football" },
  { key: "soccer_saudi_arabia_pro_league", group: "Football" },
  { key: "basketball_nba", group: "Basketball" },
  { key: "mma_mixed_martial_arts", group: "UFC" }
];

export async function syncSportsMatches() {
  console.log("🔄 Starting daily global sports sync & settlement...");

  if (!API_KEY) {
    console.error("🛑 FATAL ERROR: ODDS_API_KEY is missing!");
    return;
  }

  for (const sport of sportsToFetch) {
    
    // ---------------------------------------------------------
    // 1. FETCH LIVE ODDS
    // ---------------------------------------------------------
    try {
      // Axios securely encodes the URL and parameters for us
      const oddsResponse = await axios.get(`https://api.the-odds-api.com/v4/sports/${sport.key}/odds`, {
        params: {
          apiKey: API_KEY,
          regions: "us",
          markets: "h2h,totals",
          oddsFormat: "decimal"
        }
      });
      
      const matches = oddsResponse.data;

      if (Array.isArray(matches)) {
        for (const match of matches) {
          if (!match.home_team || !match.away_team || !match.commence_time) continue;

          const teamA = String(match.home_team);
          const teamB = String(match.away_team);
          const startTime = new Date(match.commence_time);

          if (isNaN(startTime.getTime())) continue;

          const bookmaker = match.bookmakers?.[0];
          if (!bookmaker) continue;

          const h2hMarket = bookmaker.markets?.find((m: any) => m.key === "h2h");
          if (!h2hMarket) continue;

          let oddsA = 1.90;
          let oddsB = 1.90;
          let oddsDraw: number | null = null;

          for (const outcome of h2hMarket.outcomes) {
            if (outcome.name === teamA && outcome.price) oddsA = Number(outcome.price);
            else if (outcome.name === teamB && outcome.price) oddsB = Number(outcome.price);
            else if (outcome.name === "Draw" && outcome.price) oddsDraw = Number(outcome.price);
          }

          const finalOddsA = isNaN(oddsA) ? 1.90 : oddsA;
          const finalOddsB = isNaN(oddsB) ? 1.90 : oddsB;
          const finalOddsDraw = (oddsDraw !== null && !isNaN(oddsDraw)) ? oddsDraw : null;

          const existingMatch = await prisma.sportsMatch.findFirst({
            where: { sportKey: sport.key, teamA: teamA, teamB: teamB }
          });

          if (existingMatch) {
            if (existingMatch.status !== "COMPLETED") {
              await prisma.sportsMatch.update({
                where: { id: existingMatch.id },
                data: { oddsA: finalOddsA, oddsB: finalOddsB, oddsDraw: finalOddsDraw, startTime: startTime }
              });
            }
          } else {
            await prisma.sportsMatch.create({
              data: {
                sportKey: sport.key,
                sportGroup: sport.group,
                teamA: teamA,
                teamB: teamB,
                startTime: startTime,
                oddsA: finalOddsA,
                oddsB: finalOddsB,
                oddsDraw: finalOddsDraw,
                status: "UPCOMING"
              }
            });
          }
        }
      }
      console.log(`✅ Odds Synced: \({sport.group} -\){sport.key}`);
    } catch (error: any) {
      console.error(`❌ Odds Error (${sport.key}):`, error.response?.data ? JSON.stringify(error.response.data) : error.message);
    }

    // ---------------------------------------------------------
    // 2. FETCH MATCH SCORES
    // ---------------------------------------------------------
    try {
      const scoresResponse = await axios.get(`https://api.the-odds-api.com/v4/sports/${sport.key}/scores`, {
        params: {
          apiKey: API_KEY,
          daysFrom: 3 // Set to 3 to catch the older matches
        }
      });
      const scoresData = scoresResponse.data;

      if (Array.isArray(scoresData)) {
        for (const matchResult of scoresData) {
          if (!matchResult.completed) continue;

          const teamA = String(matchResult.home_team);
          const teamB = String(matchResult.away_team);

          const pendingDbMatch = await prisma.sportsMatch.findFirst({
            where: {
              sportKey: sport.key,
              teamA: teamA,
              teamB: teamB,
              status: { in: ["UPCOMING", "LIVE"] } 
            }
          });

          if (!pendingDbMatch || !matchResult.scores) continue;

          const scoreA = Number(matchResult.scores.find((s: any) => s.name === teamA)?.score || 0);
          const scoreB = Number(matchResult.scores.find((s: any) => s.name === teamB)?.score || 0);

          let winningOutcome = "";
          if (scoreA > scoreB) winningOutcome = "TEAM_A";
          else if (scoreB > scoreA) winningOutcome = "TEAM_B";
          else winningOutcome = "DRAW";

          console.log(`🏆 Settling Match: \({teamA}\){scoreA} - \({scoreB}\){teamB} (Winner: ${winningOutcome})`);

          await prisma.$transaction(async (tx) => {
            await tx.sportsMatch.update({
              where: { id: pendingDbMatch.id },
              data: { status: "COMPLETED" }
            });

            const pendingBets = await tx.sportsBet.findMany({
              where: { matchId: pendingDbMatch.id, status: "PENDING" }
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

                if (wallet) {
                  await tx.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: { increment: payout } }
                  });
                }
              }
            }
          });
        }
      }
    } catch (error: any) {
      console.log(`⚠️ Scores Error (${sport.key}):`, error.response?.data ? JSON.stringify(error.response.data) : error.message);
    }
  }
  
  console.log("🏁 Global sports sync & settlement complete!");
}