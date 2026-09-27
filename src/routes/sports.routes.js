"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sports_controller_1 = require("../controllers/sports.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware"); // Update this path to match your actual auth middleware
const router = (0, express_1.Router)();
router.get("/matches", sports_controller_1.getMatches);
router.post("/bet", auth_middleware_1.verifyToken, sports_controller_1.placeSportsBet); // Protected route
router.get("/bets", auth_middleware_1.verifyToken, sports_controller_1.getUserBets);
exports.default = router;
