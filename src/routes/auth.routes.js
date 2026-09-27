"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const router = (0, express_1.Router)();
router.post("/register", auth_controller_1.register);
router.post("/login", auth_controller_1.login);
router.post("/verify-otp", auth_controller_1.verifyOtp);
router.post("/logout", auth_controller_1.logout);
router.get("/google", auth_controller_1.googleRedirect);
router.get("/google/callback", auth_controller_1.googleCallback);
exports.default = router; // <-- This exact export is required
