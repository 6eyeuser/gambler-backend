import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_gambler_jwt_key_2026";

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Fallback support: check cookies first, then Authorization header if cookie fails
    let token = req.cookies?.token;
    
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token found." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token." });
  }
};