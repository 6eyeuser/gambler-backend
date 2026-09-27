import { Router } from "express";
import { startMinesGame, revealMinesTile, cashoutMinesGame } from "../controllers/mines.controller";

const router = Router();

router.post("/start", startMinesGame);
router.post("/reveal", revealMinesTile);
router.post("/cashout", cashoutMinesGame);

export default router;