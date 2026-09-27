import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/db';
import { RegisterInput, LoginInput } from '../utils/validation';
import { sendEmailOTP } from '../utils/mailer';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class AuthService {
  static async googleLogin(idToken: string) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) throw new Error('INVALID_GOOGLE_TOKEN');

    const { email, sub: googleId } = payload;

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.$transaction(async (tx: any) => {
        const newUser = await tx.user.create({
          data: {
            email,
            authProvider: 'GOOGLE',
            googleId,
            status: 'VERIFIED',
          },
        });

        await tx.wallet.createMany({
          data: [
            { userId: newUser.id, currency: 'USD', balance: 0.0, version: 1 },
            { userId: newUser.id, currency: 'BTC', balance: 0.0, version: 1 },
          ],
        });

        return newUser;
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { email },
        data: { googleId, authProvider: 'GOOGLE', status: 'VERIFIED' },
      });
    }

    // TypeScript strict-null safeguard
    if (!user) {
      throw new Error('Authentication failed');
    }

    const token = jwt.sign(
      { userId: user.id, status: user.status },
      process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod',
      { expiresIn: '15m' }
    );

    return { user, token };
  }

  static async registerUser(input: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) throw new Error('EMAIL_EXISTS');

    const passwordHash = await argon2.hash(input.password);

    const newUser = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          status: 'UNVERIFIED',
        },
      });

      await tx.wallet.createMany({
        data: [
          { userId: user.id, currency: 'USD', balance: 0.0, version: 1 },
          { userId: user.id, currency: 'BTC', balance: 0.0, version: 1 },
        ],
      });

      return user;
    });

    return {
      id: newUser.id,
      email: newUser.email,
      status: newUser.status,
      createdAt: newUser.createdAt,
    };
  }

  static async loginUser(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || !user.passwordHash || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const token = jwt.sign(
      { userId: user.id, status: user.status },
      process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod',
      { expiresIn: '15m' }
    );

    return { user, token };
  }

  static async generateAndSendOTP(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.status === 'VERIFIED') throw new Error('ALREADY_VERIFIED');

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { otpCode, otpExpiry },
    });

    console.log(`\n🔔 TESTING ONLY - OTP for ${email} is: ${otpCode}\n`);
    await sendEmailOTP(email, otpCode);
    
    return { success: true };
  }

  static async verifyOTP(email: string, otpCode: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.status === 'VERIFIED') throw new Error('ALREADY_VERIFIED');
    if (user.otpCode !== otpCode) throw new Error('INVALID_OTP');
    if (!user.otpExpiry || user.otpExpiry < new Date()) throw new Error('EXPIRED_OTP');

    await prisma.user.update({
      where: { email },
      data: { status: 'VERIFIED', otpCode: null, otpExpiry: null },
    });

    return { success: true };
  }
}