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
exports.getDashboardData = void 0;
const db_1 = __importDefault(require("../config/db"));
const getDashboardData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // The userId comes from the verifyToken middleware
        const userId = req.user.userId;
        const user = yield db_1.default.user.findUnique({
            where: { id: userId },
            include: {
                wallets: true, // Crucial: Fetch the connected wallets
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        // The frontend explicitly expects res.data.data.wallets
        res.status(200).json({
            data: {
                id: user.id,
                email: user.email,
                status: user.status,
                wallets: user.wallets,
            },
        });
    }
    catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).json({ message: "Server error loading dashboard." });
    }
});
exports.getDashboardData = getDashboardData;
