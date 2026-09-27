import { Server } from "socket.io";

// Global states exposed to the controller for secure validation
export let gameState: "WAITING" | "PLAYING" | "CRASHED" = "WAITING";
export let currentMultiplier = 1.00;
export const activeBets = new Map<string, number>(); // Memory map tracks who bet in the CURRENT round

const generateCrashPoint = () => {
  const r = Math.random();
  // 3% chance of instant crash at 1.00x (House edge)
  if (r < 0.03) return 1.00;
  // Standard casino crash distribution formula
  return Math.max(1.00, Math.floor(100 * (0.99 / (1 - r))) / 100);
};

export const initCrashGame = (io: Server) => {
  console.log("🚀 Crash Game Engine Initialized");

  const runGame = async () => {
    while (true) {
      // 1. WAITING STATE (10 Second Betting Window)
      gameState = "WAITING";
      currentMultiplier = 1.00;
      activeBets.clear(); // Reset all bets for the new round
      
      let crashPoint = generateCrashPoint();
      let countdown = 10;

      while (countdown > 0) {
        io.emit("crash_state", { state: gameState, countdown, multiplier: 1.00 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        countdown--;
      }

      // 2. PLAYING STATE (Graph rising)
      gameState = "PLAYING";
      let startTime = Date.now();

      while (gameState === "PLAYING") {
        const elapsed = Date.now() - startTime;
        
        // Exponential curve for the multiplier tick
        currentMultiplier = Math.max(1.00, Math.pow(Math.E, 0.00006 * elapsed));

        if (currentMultiplier >= crashPoint) {
          currentMultiplier = crashPoint;
          gameState = "CRASHED";
        }

        io.emit("crash_state", { state: gameState, multiplier: currentMultiplier.toFixed(2) });
        await new Promise((resolve) => setTimeout(resolve, 100)); // Broadcast tick every 100ms
      }

      // 3. CRASHED STATE (Game Over)
      io.emit("crash_state", { 
        state: gameState, 
        multiplier: currentMultiplier.toFixed(2), 
        crashPoint: crashPoint.toFixed(2) 
      });
      
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before next round
    }
  };

  runGame();
};