import { getDb } from "@/db/database";
import type { WalletRecord } from "@/types/equipment";

const MAIN_WALLET_ID = "main";
const DEFAULT_GOLD = 12450;

const mapWallet = (row: any): WalletRecord => ({
  id: row.id,
  gold: row.gold,
  updatedAt: row.updated_at,
});

const ensureMainWalletTx = async (db: Awaited<ReturnType<typeof getDb>>): Promise<void> => {
  await db.runAsync(
    `INSERT OR IGNORE INTO wallets (id, gold, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [MAIN_WALLET_ID, DEFAULT_GOLD]
  );
};

export const walletRepository = {
  async getMainWallet(): Promise<WalletRecord> {
    const db = await getDb();
    await ensureMainWalletTx(db);
    const row = await db.getFirstAsync<any>(
      "SELECT * FROM wallets WHERE id = ? LIMIT 1",
      [MAIN_WALLET_ID]
    );
    if (!row) throw new Error("Main wallet not found");
    return mapWallet(row);
  },

  async spendGold(amount: number): Promise<boolean> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("spendGold requires a positive amount");
    }
    const db = await getDb();
    await db.execAsync("BEGIN;");
    try {
      await ensureMainWalletTx(db);
      const wallet = await db.getFirstAsync<any>(
        "SELECT * FROM wallets WHERE id = ? LIMIT 1",
        [MAIN_WALLET_ID]
      );
      if (!wallet || wallet.gold < amount) {
        await db.execAsync("ROLLBACK;");
        return false;
      }
      await db.runAsync(
        `UPDATE wallets
         SET gold = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [wallet.gold - Math.floor(amount), MAIN_WALLET_ID]
      );
      await db.execAsync("COMMIT;");
      return true;
    } catch (error) {
      try {
        await db.execAsync("ROLLBACK;");
      } catch {
        // ignore rollback failure
      }
      throw error;
    }
  },

  async addGold(amount: number): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("addGold requires a positive amount");
    }
    const db = await getDb();
    await ensureMainWalletTx(db);
    const wallet = await db.getFirstAsync<any>(
      "SELECT * FROM wallets WHERE id = ? LIMIT 1",
      [MAIN_WALLET_ID]
    );
    const currentGold = Math.max(0, Math.floor(wallet?.gold ?? DEFAULT_GOLD));
    await db.runAsync(
      `UPDATE wallets
       SET gold = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [currentGold + Math.floor(amount), MAIN_WALLET_ID]
    );
  },
};
