import nodemailer from 'nodemailer';

export const sendEmailOTP = async (to: string, otp: string) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Gambler API" <${process.env.SMTP_EMAIL}>`,
      to,
      subject: 'Verify your account',
      text: `Your 6-digit verification code is: ${otp}. It expires in 10 minutes.`,
    });
  } catch (error) {
    console.warn('Email failed to send. Check SMTP credentials. OTP is logged in the console.');
  }
};