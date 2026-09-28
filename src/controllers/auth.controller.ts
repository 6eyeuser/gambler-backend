import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import nodemailer from "nodemailer";
import prisma from "../config/db";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_gambler_jwt_key_2026";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://gambler-frontend-steel.vercel.app";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const BACKEND_URL = "https://gambler-backend-production-b2fe.up.railway.app";
const REDIRECT_URI = `${BACKEND_URL}/api/v1/auth/google/callback`;

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: "Email already exists." });

    const passwordHash = await bcrypt.hash(password, 10);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.create({
      data: { email, passwordHash, otpCode, otpExpiry, authProvider: "LOCAL" },
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false, 
      auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
    });

    await transporter.sendMail({
      from: `"GamblerPro" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: "Your GamblerPro Verification Code",
      text: `Welcome! Your verification code is: ${otpCode}. It expires in 10 minutes.`,
    });

    res.status(200).json({ message: "OTP sent to your email." });
  } catch (error) {
    res.status(500).json({ message: "Server error during registration." });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otpCode !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        status: "VERIFIED", otpCode: null, otpExpiry: null,
        wallets: { create: { currency: "USD", balance: 100.0 } }
      },
    });

    const token = jwt.sign({ userId: updatedUser.id, email: updatedUser.email }, JWT_SECRET, { expiresIn: "7d" });
    
    res.cookie("token", token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: "none", 
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    // STEP 3: Return token in JSON body as fallback storage mechanism
    res.status(200).json({ message: "Verification successful!", token });
  } catch (error) {
    res.status(500).json({ message: "Server error during verification." });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) return res.status(400).json({ message: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials." });
    if (user.status !== "VERIFIED") return res.status(403).json({ message: "Please verify your account first." });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    
    res.cookie("token", token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: "none", 
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    // STEP 3: Return token in JSON body as fallback storage mechanism
    res.status(200).json({ message: "Logged in successfully.", token });
  } catch (error) {
    res.status(500).json({ message: "Server error during login." });
  }
};

export const googleRedirect = (req: Request, res: Response) => {
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent`;
  res.redirect(googleAuthUrl);
};

export const googleCallback = async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.redirect(`${FRONTEND_URL}/auth?error=NoCodeProvided`);

  try {
    const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
    });

    const { access_token } = tokenResponse.data;
    const userProfileResponse = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { id: googleId, email } = userProfileResponse.data;
    if (!email) return res.redirect(`${FRONTEND_URL}/auth?error=EmailNotFound`);

    let user = await prisma.user.findFirst({ where: { OR: [{ googleId }, { email }] } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email, googleId, authProvider: "GOOGLE", status: "VERIFIED",
          wallets: { create: { currency: "USD", balance: 100.0 } },
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id }, data: { googleId, authProvider: "GOOGLE", status: "VERIFIED" },
      });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    
    res.cookie("token", token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: "none", 
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    // STEP 3: Pass token as query parameter so frontend can capture and cache it
    res.redirect(`${FRONTEND_URL}/dashboard?token=${token}`);
  } catch (error: any) {
    res.redirect(`${FRONTEND_URL}/auth?error=GoogleAuthFailed`);
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "none" });
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
  }
  res.status(200).json({ message: "Logged out successfully" });
};