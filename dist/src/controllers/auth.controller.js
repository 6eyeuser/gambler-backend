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
exports.logout = exports.googleCallback = exports.googleRedirect = exports.login = exports.verifyOtp = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const db_1 = __importDefault(require("../config/db"));
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_gambler_jwt_key_2026";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:8080/api/v1/auth/google/callback";
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const existingUser = yield db_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ message: "Email already exists." });
        const passwordHash = yield bcrypt_1.default.hash(password, 10);
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        yield db_1.default.user.create({
            data: { email, passwordHash, otpCode, otpExpiry, authProvider: "LOCAL" },
        });
        const transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: false,
            auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
        });
        yield transporter.sendMail({
            from: `"GamblerPro" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: "Your GamblerPro Verification Code",
            text: `Welcome! Your verification code is: ${otpCode}. It expires in 10 minutes.`,
        });
        res.status(200).json({ message: "OTP sent to your email." });
    }
    catch (error) {
        res.status(500).json({ message: "Server error during registration." });
    }
});
exports.register = register;
const verifyOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, otp } = req.body;
        const user = yield db_1.default.user.findUnique({ where: { email } });
        if (!user || user.otpCode !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
            return res.status(400).json({ message: "Invalid or expired OTP." });
        }
        const updatedUser = yield db_1.default.user.update({
            where: { email },
            data: {
                status: "VERIFIED", otpCode: null, otpExpiry: null,
                wallets: { create: { currency: "USD", balance: 100.0 } }
            },
        });
        const token = jsonwebtoken_1.default.sign({ userId: updatedUser.id, email: updatedUser.email }, JWT_SECRET, { expiresIn: "7d" });
        res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(200).json({ message: "Verification successful!" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error during verification." });
    }
});
exports.verifyOtp = verifyOtp;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const user = yield db_1.default.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash)
            return res.status(400).json({ message: "Invalid credentials." });
        const isMatch = yield bcrypt_1.default.compare(password, user.passwordHash);
        if (!isMatch)
            return res.status(400).json({ message: "Invalid credentials." });
        if (user.status !== "VERIFIED")
            return res.status(403).json({ message: "Please verify your account first." });
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
        res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(200).json({ message: "Logged in successfully." });
    }
    catch (error) {
        res.status(500).json({ message: "Server error during login." });
    }
});
exports.login = login;
const googleRedirect = (req, res) => {
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent`;
    res.redirect(googleAuthUrl);
};
exports.googleRedirect = googleRedirect;
const googleCallback = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const code = req.query.code;
    if (!code)
        return res.redirect(`${FRONTEND_URL}/auth?error=NoCodeProvided`);
    try {
        const tokenResponse = yield axios_1.default.post("https://oauth2.googleapis.com/token", {
            code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
        });
        const { access_token } = tokenResponse.data;
        const userProfileResponse = yield axios_1.default.get("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        const { id: googleId, email } = userProfileResponse.data;
        if (!email)
            return res.redirect(`${FRONTEND_URL}/auth?error=EmailNotFound`);
        let user = yield db_1.default.user.findFirst({ where: { OR: [{ googleId }, { email }] } });
        if (!user) {
            user = yield db_1.default.user.create({
                data: {
                    email, googleId, authProvider: "GOOGLE", status: "VERIFIED",
                    wallets: { create: { currency: "USD", balance: 100.0 } },
                },
            });
        }
        else if (!user.googleId) {
            user = yield db_1.default.user.update({
                where: { id: user.id }, data: { googleId, authProvider: "GOOGLE", status: "VERIFIED" },
            });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
        res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.redirect(`${FRONTEND_URL}/dashboard`);
    }
    catch (error) {
        res.redirect(`${FRONTEND_URL}/auth?error=GoogleAuthFailed`);
    }
});
exports.googleCallback = googleCallback;
const logout = (req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
    res.status(200).json({ message: "Logged out successfully" });
};
exports.logout = logout;
