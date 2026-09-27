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
exports.getUserBets = exports.placeSportsBet = exports.getMatches = void 0;
const db_1 = __importDefault(require("../config/db"));
const getMatches = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const matches = yield db_1.default.sportsMatch.findMany({
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
        res.status(200).json({ success: true, data: matches });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || "Failed to fetch matches" });
    }
});
exports.getMatches = getMatches;
const placeSportsBet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        // Safely extract the ID whether your JWT uses 'id' or 'userId'
        const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId);
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized: User ID missing from token." });
            return;
        }
        const { matchId, amount, guess } = req.body;
        if (!amount || amount <= 0) {
            res.status(400).json({ success: false, message: "Invalid bet amount." });
            return;
        }
        const match = yield db_1.default.sportsMatch.findUnique({ where: { id: matchId } });
        if (!match || match.status !== "UPCOMING") {
            res.status(400).json({ success: false, message: "Match is unavailable for betting." });
            return;
        }
        let lockedOdds = 0;
        let poolUpdateField = "";
        if (guess === "TEAM_A") {
            lockedOdds = match.oddsA;
            poolUpdateField = "totalPoolA";
        }
        else if (guess === "TEAM_B") {
            lockedOdds = match.oddsB;
            poolUpdateField = "totalPoolB";
        }
        else if (guess === "DRAW" && match.oddsDraw) {
            lockedOdds = match.oddsDraw;
            poolUpdateField = "totalPoolDraw";
        }
        else {
            res.status(400).json({ success: false, message: "Invalid prediction." });
            return;
        }
        const transaction = yield db_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const wallet = yield tx.wallet.findUnique({
                where: { userId_currency: { userId, currency: "USD" } }
            });
            if (!wallet || wallet.balance < amount) {
                throw new Error("Insufficient USD balance.");
            }
            yield tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: amount } }
            });
            const bet = yield tx.sportsBet.create({
                data: { userId, matchId, amount, guess, lockedOdds }
            });
            const updatedMatch = yield tx.sportsMatch.update({
                where: { id: matchId },
                data: { [poolUpdateField]: { increment: amount } }
            });
            return { bet, updatedMatch };
        }));
        const { updatedMatch } = transaction;
        const VIG = 0.95;
        const vPoolA = updatedMatch.totalPoolA + 1000;
        const vPoolB = updatedMatch.totalPoolB + 1000;
        const vPoolDraw = updatedMatch.oddsDraw ? (updatedMatch.totalPoolDraw + 1000) : 0;
        const totalVirtualPool = vPoolA + vPoolB + vPoolDraw;
        const newOddsA = (totalVirtualPool / vPoolA) * VIG;
        const newOddsB = (totalVirtualPool / vPoolB) * VIG;
        const newOddsDraw = updatedMatch.oddsDraw ? ((totalVirtualPool / vPoolDraw) * VIG) : null;
        yield db_1.default.sportsMatch.update({
            where: { id: matchId },
            data: {
                oddsA: Number(newOddsA.toFixed(2)),
                oddsB: Number(newOddsB.toFixed(2)),
                oddsDraw: newOddsDraw ? Number(newOddsDraw.toFixed(2)) : null
            }
        });
        res.status(200).json({ success: true, message: "Bet locked in!", data: transaction.bet });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
exports.placeSportsBet = placeSportsBet;
const getUserBets = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId);
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized." });
            return;
        }
        // Fetch bets and include the related match data
        const bets = yield db_1.default.sportsBet.findMany({
            where: { userId },
            include: { match: true }, // Assumes your Prisma relation is named 'match'
            orderBy: { createdAt: "desc" }
        });
        res.status(200).json({ success: true, data: bets });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});
exports.getUserBets = getUserBets;
