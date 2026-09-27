import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
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

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 8080;

initSocket(httpServer);

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

httpServer.listen(PORT, async () => {
    console.log(`🚀 Gambler API running on http://localhost:${PORT}`);
    // 🛑 ALL AUTOMATED CRON LOOPS HAVE BEEN REMOVED.
    // The server will now only settle bets when you explicitly hit the button.
});