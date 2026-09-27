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
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = __importDefault(require("./config/db"));
const socket_1 = require("./config/socket");
// Route Imports
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const betting_routes_1 = __importDefault(require("./routes/betting.routes"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const sports_routes_1 = __importDefault(require("./routes/sports.routes"));
// Services
const sportsSync_1 = require("./services/sportsSync");
const settlement_service_1 = require("./services/settlement.service"); // Added Settlement Service
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 8080;
(0, socket_1.initSocket)(httpServer);
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/user', user_routes_1.default);
app.use('/api/v1/bet', betting_routes_1.default);
app.use('/api/v1/wallet', wallet_routes_1.default);
app.use('/api/v1/sports', sports_routes_1.default);
app.get('/health', (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield db_1.default.$queryRaw `SELECT 1`;
        res.status(200).json({ status: 'healthy', database: 'connected' });
    }
    catch (error) {
        res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
    }
}));
httpServer.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`🚀 Gambler API running on http://localhost:${PORT}`);
    // Automate the API fetching to run once a day at midnight
    node_cron_1.default.schedule('0 0 * * *', () => {
        (0, sportsSync_1.syncSportsMatches)();
    });
    // Start the automated payout system (checks for finished matches every 5 minutes)
    (0, settlement_service_1.startSettlementCron)();
    // Force a sync right now just so your database fills up instantly on boot
    try {
        yield (0, sportsSync_1.syncSportsMatches)();
    }
    catch (error) {
        console.error("Failed to run initial sports sync:", error);
    }
}));
