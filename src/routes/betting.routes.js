"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const betting_controller_1 = require("../controllers/betting.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post('/coinflip', auth_middleware_1.verifyToken, betting_controller_1.BettingController.coinFlip);
exports.default = router; // <-- This exact export is required
