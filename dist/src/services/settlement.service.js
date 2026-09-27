"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSettlementCron = exports.runAutoSettlement = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = __importDefault(require("../config/db"));
// This function simulates checking your real-world Sports API for results.
const fetchRealMatchResult = (matchId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Example: const res = await axios.get(`https://api.sports.io/match/${matchId}/results`);
        // return res.data.winner; // "TEAM_A", "TEAM_B", or "DRAW"
        // For now, returning null means the match isn't finished yet.
        return null;
    }
    catch (error) {
        console.error(`Failed to fetch result for match ${matchId}`);
        return null;
    }
});
const runAutoSettlement = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("🔄 [Cron] Running automated bet settlement...");
    try {
        // 1. Find all matches that have started but haven't been settled yet
        const pendingMatches = yield db_1.default.sportsMatch.findMany({
            where: {
                status: "UPCOMING", // Using UPCOMING as per your schema default
                startTime: { lt: new Date() }, // Match time is in the past
            },
        });
        for (const match of pendingMatches) {
            // 2. Ask your API who won the match
            const winningOutcome = yield fetchRealMatchResult(match.id);
            if (!winningOutcome)
                continue; // Match still in progress
            // 3. SECURE TRANSACTION: Update the match, pay winners, and mark losers
            yield db_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
                // Mark match as completed
                yield tx.sportsMatch.update({
                    where: { id: match.id },
                    data: { status: "COMPLETED", winningOutcome },
                });
                // Find all pending bets for this match
                const pendingBets = yield tx.sportsBet.findMany({
                    where: { matchId: match.id, status: "PENDING" },
                });
                for (const bet of pendingBets) {
                    if (bet.guess === winningOutcome) {
                        const payout = bet.amount * bet.lockedOdds;
                        // Mark Bet as WON
                        yield tx.sportsBet.update({
                            where: { id: bet.id },
                            data: { status: "WON" },
                        });
                        // Credit User's USD Wallet
                        yield tx.wallet.updateMany({
                            where: { userId: bet.userId, currency: "USD" },
                            data: { balance: { increment: payout } },
                        });
                        console.log(`💰 Paid out $${payout.toFixed(2)} to user ${bet.userId} for Bet ${bet.id}`);
                    }
                    else {
                        // Mark Bet as LOST
                        yield tx.sportsBet.update({
                            where: { id: bet.id },
                            data: { status: "LOST" },
                        });
                    }
                }
            }));
            console.log(`✅ Match ${match.id} fully settled. Winner: ${winningOutcome}`);
        }
    }
    catch (error) {
        console.error("❌ Settlement Error:", error);
    }
});
exports.runAutoSettlement = runAutoSettlement;
// Schedule the cron job to run every 5 minutes
const startSettlementCron = () => {
    node_cron_1.default.schedule("*/5 * * * *", () => {
        (0, exports.runAutoSettlement)();
    });
    console.log("⏱️ Auto-settlement cron job initialized (Runs every 5 minutes)");
};
exports.startSettlementCron = startSettlementCron;
