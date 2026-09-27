import { Router } from 'express';
import { BettingController } from '../controllers/betting.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/coinflip', verifyToken, BettingController.coinFlip); 

export default router; // <-- This exact export is required