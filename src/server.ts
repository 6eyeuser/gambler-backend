import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import prisma from './config/db';
import { initSocket } from './config/socket';

// Route Imports
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import bettingRoutes from './routes/betting.routes';
import walletRoutes from './routes/wallet.routes';
import sportsRoutes from './routes/sports.routes';
import dashboardRoutes from "./routes/dashboard.routes";
import paymentRoutes from "./routes/payment.routes";
import plinkoRoutes from "./routes/plinko.routes"; 
import crashRoutes from "./routes/crash.routes";
import minesRoutes from "./routes/mines.routes";

// Services
import { syncSportsMatches } from './services/sportsSync';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 8080;

initSocket(httpServer);

// Allowed origins for cross-origin cookie authentication
const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://gambler-frontend-steel.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or server-to-server calls)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy violation: Origin not allowed'), false);
        }
        return callback(null, true);
    },
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/bet', bettingRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/sports', sportsRoutes);
app.use('/api/v1/plinko', plinkoRoutes); 
app.use('/api/plinko', plinkoRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/v1/crash", crashRoutes);
app.use('/api/v1/mines', minesRoutes);

// Health Checks
app.get('/', (req, res) => {
    res.status(200).send('OK');
});

app.get('/health', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'healthy', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
    }
});

// Manual Sync & Settle Route
app.get('/api/force-sync', async (req, res) => {
    console.log("Manual sync triggered...");
    try {
        await syncSportsMatches();
        res.status(200).send("Global sports sync & settlement complete!");
    } catch (error) {
        console.error("Manual sync failed:", error);
        res.status(500).send("Failed to sync and settle.");
    }
});

httpServer.listen(PORT, async () => {
    console.log(`🚀 Gambler API running on http://localhost:${PORT}`);
    console.log(`👉 Run a manual sync & settle by visiting http://localhost:${PORT}/api/force-sync`);
    
    // Daily sync is preserved
    cron.schedule('0 0 * * *', () => {
        syncSportsMatches();
    });
});