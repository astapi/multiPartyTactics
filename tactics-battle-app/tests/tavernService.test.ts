import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TavernCandidateRecord } from "@/types/models";

type WalletRow = { gold: number };
type CharacterInsert = { id: string; name: string };

class FakeDb {
  wallet: WalletRow | null = { gold: 10000 };
  characters: CharacterInsert[] = [];
  deletedCandidateIds: string[] = [];
  tacticsCount = 0;

  async execAsync(_sql: string): Promise<void> {}

  async runAsync(query: string, params: any[] = []): Promise<void> {
    if (query.includes("INSERT OR IGNORE INTO wallets")) {
      if (!this.wallet) this.wallet = { gold: Number(params[1]) };
      return;
    }
    if (query.includes("UPDATE wallets")) {
      if (!this.wallet) throw new Error("wallet not found");
      this.wallet.gold = Number(params[0]);
      return;
    }
    if (query.includes("INSERT INTO characters")) {
      this.characters.push({ id: String(params[0]), name: String(params[1]) });
      return;
    }
    if (query.includes("INSERT INTO tactics_rules")) {
      this.tacticsCount += 1;
      return;
    }
    if (query.includes("DELETE FROM tavern_candidates")) {
      this.deletedCandidateIds.push(String(params[0]));
    }
  }

  async getFirstAsync<T>(query: string): Promise<T | null> {
    if (query.includes("SELECT gold FROM wallets")) {
      return (this.wallet ? { gold: this.wallet.gold } : null) as T | null;
    }
    return null;
  }
}

const fakeDb = new FakeDb();

const candidate: TavernCandidateRecord = {
  id: "tavern-1",
  name: "アデル",
  classId: "THIEF",
  constellationId: "ARIES",
  level: 12,
  age: 24,
  growthMultiplier: 1,
  traitIds: ["LUCKY_DROP"],
  priceGold: 6820,
  baseMaxHp: 128,
  baseAtk: 25,
  baseDef: 9,
  baseSpi: 11,
  baseSpd: 22,
  baseMaxMp: 32,
  baseMpRegen: 2,
  innateHpRate: 1.02,
  innateAtkBonus: 3,
  innateDefBonus: -1,
  innateSpiBonus: 2,
  innateSpdBonus: 1,
  generatedAt: "2026-03-15T00:00:00.000Z",
};

vi.mock("@/db/database", () => ({
  getDb: vi.fn(async () => fakeDb),
}));

vi.mock("@/constants/classes", () => {
  return {
    CLASS_MASTER: [
      { id: "GUARDIAN", name: "Guardian", description: "", image: 1, baseStats: { maxHp: 120, atk: 8, def: 10, spi: 5, spd: 8, maxMp: 20, mpRegen: 2 }, hiringCost: 5000 },
      { id: "SWORDMAN", name: "Swordman", description: "", image: 1, baseStats: { maxHp: 100, atk: 11, def: 8, spi: 6, spd: 10, maxMp: 22, mpRegen: 2 }, hiringCost: 5500 },
      { id: "BERSERKER", name: "Berserker", description: "", image: 1, baseStats: { maxHp: 110, atk: 14, def: 6, spi: 4, spd: 9, maxMp: 18, mpRegen: 2 }, hiringCost: 6000 },
      { id: "CLERIC", name: "Cleric", description: "", image: 1, baseStats: { maxHp: 80, atk: 5, def: 6, spi: 13, spd: 10, maxMp: 35, mpRegen: 2 }, hiringCost: 7000 },
      { id: "WITCH", name: "Witch", description: "", image: 1, baseStats: { maxHp: 75, atk: 6, def: 5, spi: 15, spd: 11, maxMp: 30, mpRegen: 2 }, hiringCost: 6500 },
      { id: "THIEF", name: "Thief", description: "", image: 1, baseStats: { maxHp: 90, atk: 12, def: 5, spi: 6, spd: 12, maxMp: 25, mpRegen: 2 }, hiringCost: 5500 },
      { id: "PORTER", name: "Porter", description: "", image: 1, baseStats: { maxHp: 95, atk: 7, def: 7, spi: 7, spd: 9, maxMp: 18, mpRegen: 2 }, hiringCost: 4500 },
    ],
  };
});

vi.mock("@/db/repositories/tavernRepository", () => ({
  tavernRepository: {
    getCandidateById: vi.fn(async () => candidate),
    listCandidates: vi.fn(async () => [candidate]),
    getRefreshState: vi.fn(async () => null),
    replaceCandidates: vi.fn(async () => undefined),
  },
}));

vi.mock("@/game/tactics/defaults", () => ({
  buildDefaultTacticsForClass: vi.fn((characterId: string) => [
    {
      id: "rule-1",
      characterId,
      priority: 1,
      skillId: "healing_potion",
      conditionType: "ALWAYS",
      conditionParams: null,
      targetType: "SELF",
      targetParams: null,
    },
  ]),
}));

import { tavernService } from "@/features/guild/tavernService";

describe("tavernService", () => {
  beforeEach(() => {
    fakeDb.wallet = { gold: 10000 };
    fakeDb.characters = [];
    fakeDb.deletedCandidateIds = [];
    fakeDb.tacticsCount = 0;
  });

  it("hires a tavern candidate and spends gold", async () => {
    const result = await tavernService.hireCandidate(candidate.id);

    expect(result.ok).toBe(true);
    expect(fakeDb.wallet?.gold).toBe(3180);
    expect(fakeDb.characters).toHaveLength(1);
    expect(fakeDb.deletedCandidateIds).toEqual([candidate.id]);
    expect(fakeDb.tacticsCount).toBe(1);
  });

  it("returns insufficient gold without creating a character", async () => {
    fakeDb.wallet = { gold: 1000 };

    const result = await tavernService.hireCandidate(candidate.id);

    expect(result).toEqual({
      ok: false,
      reason: "INSUFFICIENT_GOLD",
      requiredGold: candidate.priceGold,
      walletGold: 1000,
    });
    expect(fakeDb.characters).toHaveLength(0);
    expect(fakeDb.deletedCandidateIds).toHaveLength(0);
  });
});
