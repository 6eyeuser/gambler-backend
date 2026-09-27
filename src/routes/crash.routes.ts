import { Router } from "express";
import { placeCrashBet, cashoutCrashBet } from "../controllers/crash.controller";

const router = Router();

router.post("/bet", placeCrashBet);
router.post("/cashout", cashoutCrashBet);

export default router;