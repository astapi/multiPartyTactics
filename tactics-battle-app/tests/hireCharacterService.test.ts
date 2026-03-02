import { beforeEach, describe, expect, it, vi } from "vitest";

type WalletRow = { gold: number };
type CharacterRow = {
  id: string;
  name: string;
  classId: string;
};
type TacticsRow = {
  id: string;
  characterId: string;
};

class FakeDb {
  private wallet: WalletRow | null = null;
  private characters: CharacterRow[] = [];
  private tactics: TacticsRow[] = [];
  private snapshot: {
    wallet: WalletRow | null;
    characters: CharacterRow[];
    tactics: TacticsRow[];
  } | null = null;
  private failOnTacticsInsert = false;

  reset(): void {
    this.wallet = null;
    this.characters = [];
    this.tactics = [];
    this.snapshot = null;
    this.failOnTacticsInsert = false;
  }

  seedWallet(gold: number): void {
    this.wallet = { gold };
  }

  setFailOnTacticsInsert(shouldFail: boolean): void {
    this.failOnTacticsInsert = shouldFail;
  }

  getWalletGold(): number | null {
    return this.wallet?.gold ?? null;
  }

  getCharacterCount(): number {
    return this.characters.length;
  }

  getTacticsCount(): number {
    return this.tactics.length;
  }

  async execAsync(sql: string): Promise<void> {
    if (sql === "BEGIN;") {
      this.snapshot = {
        wallet: this.wallet ? { ...this.wallet } : null,
        characters: this.characters.map((row) => ({ ...row })),
        tactics: this.tactics.map((row) => ({ ...row })),
      };
      return;
    }
    if (sql === "COMMIT;") {
      this.snapshot = null;
      return;
    }
    if (sql === "ROLLBACK;") {
      if (this.snapshot) {
        this.wallet = this.snapshot.wallet ? { ...this.snapshot.wallet } : null;
        this.characters = this.snapshot.characters.map((row) => ({ ...row }));
        this.tactics = this.snapshot.tactics.map((row) => ({ ...row }));
      }
      this.snapshot = null;
      return;
    }
  }

  async runAsync(query: string, params: any[] = []): Promise<void> {
    if (query.includes("INSERT OR IGNORE INTO wallets")) {
      if (!this.wallet) {
        this.wallet = { gold: Number(params[1]) };
      }
      return;
    }
    if (query.includes("UPDATE wallets")) {
      if (!this.wallet) throw new Error("wallet row not found");
      this.wallet.gold = Number(params[0]);
      return;
    }
    if (query.includes("INSERT INTO characters")) {
      this.characters.push({
        id: String(params[0]),
        name: String(params[1]),
        classId: String(params[2]),
      });
      return;
    }
    if (query.includes("INSERT INTO tactics_rules")) {
      if (this.failOnTacticsInsert) {
        throw new Error("forced tactics insert failure");
      }
      this.tactics.push({
        id: String(params[0]),
        characterId: String(params[1]),
      });
      return;
    }
  }

  async getFirstAsync<T>(query: string): Promise<T | null> {
    if (query.includes("SELECT gold FROM wallets")) {
      if (!this.wallet) return null;
      return { gold: this.wallet.gold } as T;
    }
    return null;
  }
}

const fakeDb = new FakeDb();

vi.mock("@/db/database", () => ({
  getDb: vi.fn(async () => fakeDb),
}));

vi.mock("@/constants/classes", () => ({
  getClassById: vi.fn((id: string) => ({
    id,
    hiringCost: id === "GUARDIAN" ? 5000 : 6000,
  })),
}));

vi.mock("@/constants/constellations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/constants/constellations")>();
  return {
    ...actual,
    getRandomConstellationId: vi.fn(() => "ARIES"),
  };
});

import { hireCharacterService } from "@/features/guild/hireCharacterService";

describe("hireCharacterService", () => {
  beforeEach(() => {
    fakeDb.reset();
  });

  it("creates character and spends gold from default wallet", async () => {
    const result = await hireCharacterService.hireCharacter({
      name: "Alice",
      classId: "GUARDIAN",
    });

    expect(result.ok).toBe(true);
    expect(fakeDb.getWalletGold()).toBe(5000);
    expect(fakeDb.getCharacterCount()).toBe(1);
    expect(fakeDb.getTacticsCount()).toBeGreaterThan(0);
  });

  it("returns insufficient gold and does not create records", async () => {
    fakeDb.seedWallet(1000);

    const result = await hireCharacterService.hireCharacter({
      name: "Bob",
      classId: "GUARDIAN",
    });

    expect(result).toEqual({
      ok: false,
      reason: "INSUFFICIENT_GOLD",
      requiredGold: 5000,
      walletGold: 1000,
    });
    expect(fakeDb.getWalletGold()).toBe(1000);
    expect(fakeDb.getCharacterCount()).toBe(0);
    expect(fakeDb.getTacticsCount()).toBe(0);
  });

  it("rolls back wallet update when tactics insert fails", async () => {
    fakeDb.seedWallet(12000);
    fakeDb.setFailOnTacticsInsert(true);

    await expect(
      hireCharacterService.hireCharacter({
        name: "Carol",
        classId: "GUARDIAN",
      })
    ).rejects.toThrow("forced tactics insert failure");

    expect(fakeDb.getWalletGold()).toBe(12000);
    expect(fakeDb.getCharacterCount()).toBe(0);
    expect(fakeDb.getTacticsCount()).toBe(0);
  });
});
