import { Router } from "express";
import { placePlinkoBet } from "../controllers/plinko.controller";

const router = Router();

// Matches the frontend call: POST /api/v1/plinko/bet
router.post("/bet", placePlinkoBet);

export default router;