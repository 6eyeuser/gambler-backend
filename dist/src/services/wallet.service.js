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
exports.WalletService = void 0;
const db_1 = __importDefault(require("../config/db"));
class WalletService {
    static deposit(userId, currency, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (amount <= 0) {
                throw new Error('Deposit amount must be greater than zero.');
            }
            // Find the specific wallet (e.g., 'USD' or 'BTC') for this user
            const wallet = yield db_1.default.wallet.findFirst({
                where: { userId, currency },
            });
            if (!wallet) {
                throw new Error(`Wallet for currency ${currency} not found.`);
            }
            // Atomically increment the balance
            const updatedWallet = yield db_1.default.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: {
                        increment: amount,
                    },
                },
            });
            return updatedWallet;
        });
    }
}
exports.WalletService = WalletService;
