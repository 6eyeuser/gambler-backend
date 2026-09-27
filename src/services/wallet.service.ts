import prisma from '../config/db';

export class WalletService {
  static async deposit(userId: string, currency: string, amount: number) {
    if (amount <= 0) {
      throw new Error('Deposit amount must be greater than zero.');
    }

    // Find the specific wallet (e.g., 'USD' or 'BTC') for this user
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency },
    });

    if (!wallet) {
      throw new Error(`Wallet for currency ${currency} not found.`);
    }

    // Atomically increment the balance
    const updatedWallet = await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    return updatedWallet;
  }
}