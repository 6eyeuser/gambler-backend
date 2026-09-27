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
exports.WalletController = void 0;
const db_1 = __importDefault(require("../config/db"));
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});
class WalletController {
    static deposit(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.userId;
                const { amount, currency = "USD" } = req.body;
                if (amount <= 0)
                    return res.status(400).json({ message: "Invalid amount." });
                const updatedWallet = yield db_1.default.wallet.update({
                    where: { userId_currency: { userId, currency } },
                    data: { balance: { increment: amount } },
                });
                return res.status(200).json({ message: "Deposit successful.", data: updatedWallet });
            }
            catch (error) {
                return res.status(500).json({ message: "Server error during deposit." });
            }
        });
    }
    static withdraw(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.userId;
                const { amount, currency = "USD" } = req.body;
                if (amount <= 0)
                    return res.status(400).json({ message: "Invalid amount." });
                const wallet = yield db_1.default.wallet.findUnique({
                    where: { userId_currency: { userId, currency } },
                });
                if (!wallet || wallet.balance < amount) {
                    return res.status(400).json({ message: "Insufficient balance." });
                }
                const updatedWallet = yield db_1.default.wallet.update({
                    where: { userId_currency: { userId, currency } },
                    data: { balance: { decrement: amount } },
                });
                return res.status(200).json({ message: "Withdrawal successful.", data: updatedWallet });
            }
            catch (error) {
                return res.status(500).json({ message: "Server error during withdrawal." });
            }
        });
    }
    // --- NEW RAZORPAY METHODS ---
    static createRazorpayOrder(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { amount } = req.body;
                if (!amount || amount <= 0) {
                    return res.status(400).json({ success: false, message: "Invalid amount." });
                }
                const options = {
                    amount: Math.round(amount * 100), // Convert to smallest currency unit (paise/cents)
                    currency: "INR", // Change to "USD" if your Razorpay dashboard supports multi-currency
                    receipt: `receipt_${Date.now()}`,
                };
                const order = yield razorpay.orders.create(options);
                return res.status(200).json({ success: true, data: order });
            }
            catch (error) {
                return res.status(500).json({ success: false, message: error.message });
            }
        });
    }
    static verifyRazorpayPayment(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userId = req.user.userId;
                const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, currency = "USD" } = req.body;
                const body = razorpay_order_id + "|" + razorpay_payment_id;
                const expectedSignature = crypto_1.default
                    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
                    .update(body.toString())
                    .digest("hex");
                if (expectedSignature !== razorpay_signature) {
                    return res.status(400).json({ success: false, message: "Invalid payment signature verification." });
                }
                // Secure Atomic Transaction
                const updatedWallet = yield db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    let wallet = yield tx.wallet.findUnique({
                        where: { userId_currency: { userId, currency } },
                    });
                    // Auto-create wallet if it doesn't exist yet
                    if (!wallet) {
                        wallet = yield tx.wallet.create({
                            data: { userId, currency, balance: 0 },
                        });
                    }
                    return yield tx.wallet.update({
                        where: { id: wallet.id },
                        data: { balance: { increment: amount } },
                    });
                }));
                return res.status(200).json({
                    success: true,
                    message: "Payment verified and wallet credited!",
                    data: updatedWallet
                });
            }
            catch (error) {
                return res.status(400).json({ success: false, message: error.message });
            }
        });
    }
}
exports.WalletController = WalletController;
