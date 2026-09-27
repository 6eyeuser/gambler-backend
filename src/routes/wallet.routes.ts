import { Router } from 'express';
import { WalletController } from '../controllers/wallet.controller'; 
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/deposit', verifyToken, WalletController.deposit);
router.post('/withdraw', verifyToken, WalletController.withdraw);
router.post("/razorpay/order", verifyToken, WalletController.createRazorpayOrder);
router.post("/razorpay/verify", verifyToken, WalletController.verifyRazorpayPayment);

export default router; // <-- This exact export is required