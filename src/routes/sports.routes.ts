import { Router } from "express";
import { getMatches, getUserBets, placeSportsBet } from "../controllers/sports.controller";
import { verifyToken } from "../middlewares/auth.middleware"; 
// Import your newly upgraded sync service
import { syncSportsMatches } from "../services/sportsSync"; 

const router = Router();

// Public route to view available matches
router.get("/matches", getMatches);

// Protected routes requiring the user to be logged in
router.post("/bet", verifyToken, placeSportsBet);
router.get("/bets", verifyToken, getUserBets);

// NEW: Manual sync route to trigger live scores and automate payouts
router.get("/force-sync", async (req, res) => {
  try {
    // This runs the function that fetches final scores and pays out winners
    await syncSportsMatches();
    res.status(200).json({ success: true, message: "Sports data successfully synced and settled!" });
  } catch (error) {
    console.error("Force sync error:", error);
    res.status(500).json({ success: false, message: "Failed to sync sports data." });
  }
});

export default router;