import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_gambler_jwt_key_2026";

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Unauthorized: No token found." });

    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded; 
    
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized: Invalid token." });
  }
};