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
exports.sendEmailOTP = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const sendEmailOTP = (to, otp) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transporter = nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASSWORD,
            },
        });
        yield transporter.sendMail({
            from: `"Gambler API" <${process.env.SMTP_EMAIL}>`,
            to,
            subject: 'Verify your account',
            text: `Your 6-digit verification code is: ${otp}. It expires in 10 minutes.`,
        });
    }
    catch (error) {
        console.warn('Email failed to send. Check SMTP credentials. OTP is logged in the console.');
    }
});
exports.sendEmailOTP = sendEmailOTP;
