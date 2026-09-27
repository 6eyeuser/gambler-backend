"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncSportsMatches = syncSportsMatches;
const axios_1 = __importDefault(require("axios"));
const db_1 = __importDefault(require("../config/db"));
const API_KEY = process.env.ODDS_API_KEY;
const sportsToFetch = [
    { key: "soccer_epl", group: "Football" },
    { key: "soccer_spain_la_liga", group: "Football" },
    { key: "soccer_uefa_champs_league", group: "Football" },
    { key: "soccer_italy_serie_a", group: "Football" },
    { key: "soccer_germany_bundesliga", group: "Football" },
    { key: "soccer_france_ligue_one", group: "Football" },
    { key: "soccer_usa_mls", group: "Football" },
    { key: "soccer_saudi_arabia_pro_league", group: "Football" },
    { key: "basketball_nba", group: "Basketball" },
    { key: "mma_mixed_martial_arts", group: "UFC" }
];
function syncSportsMatches() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        console.log("🔄 Starting daily global sports sync...");
        for (const sport of sportsToFetch) {
            try {
                const url = `https://api.the-odds-api.com/v4/sports/${sport.key}/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,totals&oddsFormat=decimal`;
                const response = yield axios_1.default.get(url);
                const matches = response.data;
                if (!Array.isArray(matches))
                    continue;
                for (const match of matches) {
                    // 1. Extreme validation: Skip if critical fields are missing entirely
                    if (!match.home_team || !match.away_team || !match.commence_time) {
                        continue;
                    }
                    const teamA = String(match.home_team);
                    const teamB = String(match.away_team);
                    const startTime = new Date(match.commence_time);
                    // If the API returns a garbage date string, skip it so Prisma doesn't crash
                    if (isNaN(startTime.getTime()))
                        continue;
                    const bookmaker = (_a = match.bookmakers) === null || _a === void 0 ? void 0 : _a[0];
                    if (!bookmaker)
                        continue;
                    const h2hMarket = (_b = bookmaker.markets) === null || _b === void 0 ? void 0 : _b.find((m) => m.key === "h2h");
                    if (!h2hMarket)
                        continue;
                    let oddsA = 1.90;
                    let oddsB = 1.90;
                    let oddsDraw = null;
                    for (const outcome of h2hMarket.outcomes) {
                        if (outcome.name === teamA && outcome.price)
                            oddsA = Number(outcome.price);
                        else if (outcome.name === teamB && outcome.price)
                            oddsB = Number(outcome.price);
                        else if (outcome.name === "Draw" && outcome.price)
                            oddsDraw = Number(outcome.price);
                    }
                    // 2. Sanitize odds to guarantee no NaN values ever reach Prisma
                    const finalOddsA = isNaN(oddsA) ? 1.90 : oddsA;
                    const finalOddsB = isNaN(oddsB) ? 1.90 : oddsB;
                    const finalOddsDraw = (oddsDraw !== null && !isNaN(oddsDraw)) ? oddsDraw : null;
                    const existingMatch = yield db_1.default.sportsMatch.findFirst({
                        where: {
                            sportKey: sport.key,
                            teamA: teamA,
                            teamB: teamB
                        }
                    });
                    if (existingMatch) {
                        yield db_1.default.sportsMatch.update({
                            where: { id: existingMatch.id },
                            data: {
                                oddsA: finalOddsA,
                                oddsB: finalOddsB,
                                oddsDraw: finalOddsDraw,
                                startTime: startTime
                            }
                        });
                    }
                    else {
                        yield db_1.default.sportsMatch.create({
                            data: {
                                sportKey: sport.key, // Restored to fix TS Error
                                sportGroup: sport.group, // Restored to fix TS Error
                                teamA: teamA,
                                teamB: teamB,
                                startTime: startTime,
                                oddsA: finalOddsA,
                                oddsB: finalOddsB,
                                oddsDraw: finalOddsDraw,
                                status: "UPCOMING"
                            }
                        });
                    }
                }
                console.log(`✅ Synced: ${sport.group} - ${sport.key}`);
            }
            catch (error) {
                console.error(`❌ Error syncing ${sport.key}:`, ((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || error.message);
            }
        }
        console.log("🏁 Global sports sync complete!");
    });
}
