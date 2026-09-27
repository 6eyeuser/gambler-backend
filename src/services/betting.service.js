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
exports.BettingService = void 0;
const db_1 = __importDefault(require("../config/db"));
const socket_1 = require("../config/socket");
class BettingService {
    static playCoinFlip(userId, currency, betAmount, guess) {
        return __awaiter(this, void 0, void 0, function* () {
            if (betAmount <= 0)
                throw new Error('INVALID_BET_AMOUNT');
            const result = yield db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const wallet = yield tx.wallet.findFirst({
                    where: { userId, currency }
                });
                if (!wallet || wallet.balance < betAmount) {
                    throw new Error('INSUFFICIENT_FUNDS');
                }
                const outcome = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
                const isWin = guess === outcome;
                const profit = isWin ? betAmount : -betAmount;
                const updatedWallet = yield tx.wallet.update({
                    where: { id: wallet.id },
                    data: {
                        balance: {
                            increment: profit
                        }
                    }
                });
                return {
                    userId,
                    game: 'Coin Flip',
                    currency,
                    betAmount,
                    guess,
                    outcome,
                    isWin,
                    profit,
                    newBalance: updatedWallet.balance
                };
            }));
            // Fire-and-forget: Broadcast the result to everyone currently online
            try {
                (0, socket_1.getIO)().emit('liveBet', {
                    game: result.game,
                    currency: result.currency,
                    betAmount: result.betAmount,
                    isWin: result.isWin,
                    profit: result.profit,
                    timestamp: new Date().toISOString()
                });
            }
            catch (e) {
                console.error('WebSocket emission failed, but bet succeeded:', e);
            }
            return result;
        });
    }
}
exports.BettingService = BettingService;
