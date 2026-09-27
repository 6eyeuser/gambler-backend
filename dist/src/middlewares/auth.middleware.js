"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_gambler_jwt_key_2026";
const verifyToken = (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token)
            return res.status(401).json({ message: "Unauthorized: No token found." });
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({ message: "Unauthorized: Invalid token." });
    }
};
exports.verifyToken = verifyToken;
