import { Request, Response } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import prisma from "../config/db";

// 1. Create Order Function
export const createRazorpayOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string,
    });

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return res.json({ success: true, data: order });
  } catch (error) {
    console.error("Razorpay Order Error:", error);
    return res.status(500).json({ error: "Failed to create Razorpay order" });
  }
};

// 2. Verify Payment Function
export const verifyPayment = async (req: Request, res: Response): Promise<any> => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature, 
      userId, 
      amount 
    } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: "Missing user or amount details" });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET as string;
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({
        where: { userId, currency: "INR" },
      });

      if (!wallet) {
        await tx.wallet.create({
          data: { userId, currency: "INR", balance: amount }
        });
      } else {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } }
        });
      }
    });

    return res.json({ success: true, message: "Payment verified and funds added!" });

  } catch (error) {
    console.error("Payment Verification Error:", error);
    return res.status(500).json({ error: "Internal Server Error during verification" });
  }
};