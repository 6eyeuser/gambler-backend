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
exports.BettingController = void 0;
const db_1 = __importDefault(require("../config/db"));
const socket_1 = require("../config/socket");
class BettingController {
    static coinFlip(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.userId;
                const { betAmount, guess, currency = "USD" } = req.body;
                if (betAmount <= 0)
                    return res.status(400).json({ message: "Invalid bet amount." });
                // 1. Fetch wallet & verify balance
                const wallet = yield db_1.default.wallet.findUnique({
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
                yield db_1.default.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: newBalance },
                });
                // 4. Broadcast the live bet to everyone on the site
                const io = (0, socket_1.getIO)();
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
            }
            catch (error) {
                console.error(error);
                res.status(500).json({ message: "Server error processing bet." });
            }
        });
    }
}
exports.BettingController = BettingController;
