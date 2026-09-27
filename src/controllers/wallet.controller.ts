import { Request, Response } from "express";
import prisma from "../config/db";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

export class WalletController {
  static async deposit(req: Request, res: Response): Promise<any> {
    try {
      const userId = (req as any).user.userId;
      const { amount, currency = "USD" } = req.body;

      if (amount <= 0) return res.status(400).json({ message: "Invalid amount." });

      const updatedWallet = await prisma.wallet.update({
        where: { userId_currency: { userId, currency } },
        data: { balance: { increment: amount } },
      });

      return res.status(200).json({ message: "Deposit successful.", data: updatedWallet });
    } catch (error) {
      return res.status(500).json({ message: "Server error during deposit." });
    }
  }

  static async withdraw(req: Request, res: Response): Promise<any> {
    try {
      const userId = (req as any).user.userId;
      const { amount, currency = "USD" } = req.body;

      if (amount <= 0) return res.status(400).json({ message: "Invalid amount." });

      const wallet = await prisma.wallet.findUnique({
        where: { userId_currency: { userId, currency } },
      });

      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance." });
      }

      const updatedWallet = await prisma.wallet.update({
        where: { userId_currency: { userId, currency } },
        data: { balance: { decrement: amount } },
      });

      return res.status(200).json({ message: "Withdrawal successful.", data: updatedWallet });
    } catch (error) {
      return res.status(500).json({ message: "Server error during withdrawal." });
    }
  }

  // --- NEW RAZORPAY METHODS ---

  static async createRazorpayOrder(req: Request, res: Response): Promise<any> {
    try {
      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount." });
      }

      const options = {
        amount: Math.round(amount * 100), // Convert to smallest currency unit (paise/cents)
        currency: "INR", // Change to "USD" if your Razorpay dashboard supports multi-currency
        receipt: `receipt_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);

      return res.status(200).json({ success: true, data: order });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async verifyRazorpayPayment(req: Request, res: Response): Promise<any> {
    try {
      const userId = (req as any).user.userId;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, currency = "USD" } = req.body;

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
        .update(body.toString())
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: "Invalid payment signature verification." });
      }

      // Secure Atomic Transaction
      const updatedWallet = await prisma.$transaction(async (tx) => {
        let wallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId, currency } },
        });

        // Auto-create wallet if it doesn't exist yet
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: { userId, currency, balance: 0 },
          });
        }

        return await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });
      });

      return res.status(200).json({ 
        success: true, 
        message: "Payment verified and wallet credited!", 
        data: updatedWallet 
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}