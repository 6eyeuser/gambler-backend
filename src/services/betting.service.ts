import prisma from '../config/db';
import { getIO } from '../config/socket';

export class BettingService {
  static async playCoinFlip(userId: string, currency: string, betAmount: number, guess: 'HEADS' | 'TAILS') {
    if (betAmount <= 0) throw new Error('INVALID_BET_AMOUNT');

    const result = await prisma.$transaction(async (tx: any) => {
      const wallet = await tx.wallet.findFirst({
        where: { userId, currency }
      });

      if (!wallet || wallet.balance < betAmount) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const outcome = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
      const isWin = guess === outcome;
      const profit = isWin ? betAmount : -betAmount;

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: profit
          }
        }
      });

      return {
        userId,
        game: 'Coin Flip',
        currency,
        betAmount,
        guess,
        outcome,
        isWin,
        profit,
        newBalance: updatedWallet.balance
      };
    });

    // Fire-and-forget: Broadcast the result to everyone currently online
    try {
      getIO().emit('liveBet', {
        game: result.game,
        currency: result.currency,
        betAmount: result.betAmount,
        isWin: result.isWin,
        profit: result.profit,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('WebSocket emission failed, but bet succeeded:', e);
    }

    return result;
  }
}