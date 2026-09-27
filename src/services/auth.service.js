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
exports.AuthService = void 0;
const argon2_1 = __importDefault(require("argon2"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const db_1 = __importDefault(require("../config/db"));
const mailer_1 = require("../utils/mailer");
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
class AuthService {
    static googleLogin(idToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const ticket = yield googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            if (!payload || !payload.email)
                throw new Error('INVALID_GOOGLE_TOKEN');
            const { email, sub: googleId } = payload;
            let user = yield db_1.default.user.findUnique({
                where: { email },
            });
            if (!user) {
                user = yield db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                    const newUser = yield tx.user.create({
                        data: {
                            email,
                            authProvider: 'GOOGLE',
                            googleId,
                            status: 'VERIFIED',
                        },
                    });
                    yield tx.wallet.createMany({
                        data: [
                            { userId: newUser.id, currency: 'USD', balance: 0.0, version: 1 },
                            { userId: newUser.id, currency: 'BTC', balance: 0.0, version: 1 },
                        ],
                    });
                    return newUser;
                }));
            }
            else if (!user.googleId) {
                user = yield db_1.default.user.update({
                    where: { email },
                    data: { googleId, authProvider: 'GOOGLE', status: 'VERIFIED' },
                });
            }
            // TypeScript strict-null safeguard
            if (!user) {
                throw new Error('Authentication failed');
            }
            const token = jsonwebtoken_1.default.sign({ userId: user.id, status: user.status }, process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod', { expiresIn: '15m' });
            return { user, token };
        });
    }
    static registerUser(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingUser = yield db_1.default.user.findUnique({
                where: { email: input.email },
            });
            if (existingUser)
                throw new Error('EMAIL_EXISTS');
            const passwordHash = yield argon2_1.default.hash(input.password);
            const newUser = yield db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const user = yield tx.user.create({
                    data: {
                        email: input.email,
                        passwordHash,
                        status: 'UNVERIFIED',
                    },
                });
                yield tx.wallet.createMany({
                    data: [
                        { userId: user.id, currency: 'USD', balance: 0.0, version: 1 },
                        { userId: user.id, currency: 'BTC', balance: 0.0, version: 1 },
                    ],
                });
                return user;
            }));
            return {
                id: newUser.id,
                email: newUser.email,
                status: newUser.status,
                createdAt: newUser.createdAt,
            };
        });
    }
    static loginUser(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield db_1.default.user.findUnique({
                where: { email: input.email },
            });
            if (!user || !user.passwordHash || !(yield argon2_1.default.verify(user.passwordHash, input.password))) {
                throw new Error('INVALID_CREDENTIALS');
            }
            const token = jsonwebtoken_1.default.sign({ userId: user.id, status: user.status }, process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod', { expiresIn: '15m' });
            return { user, token };
        });
    }
    static generateAndSendOTP(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield db_1.default.user.findUnique({ where: { email } });
            if (!user)
                throw new Error('USER_NOT_FOUND');
            if (user.status === 'VERIFIED')
                throw new Error('ALREADY_VERIFIED');
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
            yield db_1.default.user.update({
                where: { email },
                data: { otpCode, otpExpiry },
            });
            console.log(`\n🔔 TESTING ONLY - OTP for ${email} is: ${otpCode}\n`);
            yield (0, mailer_1.sendEmailOTP)(email, otpCode);
            return { success: true };
        });
    }
    static verifyOTP(email, otpCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield db_1.default.user.findUnique({ where: { email } });
            if (!user)
                throw new Error('USER_NOT_FOUND');
            if (user.status === 'VERIFIED')
                throw new Error('ALREADY_VERIFIED');
            if (user.otpCode !== otpCode)
                throw new Error('INVALID_OTP');
            if (!user.otpExpiry || user.otpExpiry < new Date())
                throw new Error('EXPIRED_OTP');
            yield db_1.default.user.update({
                where: { email },
                data: { status: 'VERIFIED', otpCode: null, otpExpiry: null },
            });
            return { success: true };
        });
    }
}
exports.AuthService = AuthService;
