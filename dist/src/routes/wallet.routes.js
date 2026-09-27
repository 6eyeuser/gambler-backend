"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = require("../controllers/wallet.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post('/deposit', auth_middleware_1.verifyToken, wallet_controller_1.WalletController.deposit);
router.post('/withdraw', auth_middleware_1.verifyToken, wallet_controller_1.WalletController.withdraw);
router.post("/razorpay/order", auth_middleware_1.verifyToken, wallet_controller_1.WalletController.createRazorpayOrder);
router.post("/razorpay/verify", auth_middleware_1.verifyToken, wallet_controller_1.WalletController.verifyRazorpayPayment);
exports.default = router; // <-- This exact export is required
