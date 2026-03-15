import { describe, expect, it } from "vitest";
import { getMonsterDropBaseItemIds, getMonsterDropGold, listMonsterDropEntries } from "@/game/loot/monsterDropTableService";

describe("game/loot/monsterDropTableService", () => {
  it("covers every normal encounter enemy with a monster equipment mapping", () => {
    const entries = listMonsterDropEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((entry) => entry.enemyId)).size).toBe(entries.length);
  });

  it("resolves representative enemy ids to fixed equipment ids", () => {
    expect(getMonsterDropBaseItemIds("goblin_archer")).toEqual(["bone_throwing_knife", "beast_bone_bow"]);
    expect(getMonsterDropBaseItemIds("skeleton_knight")).toEqual(["bone_shield"]);
    expect(getMonsterDropBaseItemIds("shield_golem")).toEqual(["crystal_shield"]);
    expect(getMonsterDropBaseItemIds("boss_aries")).toEqual([]);
  });

  it("resolves representative enemy ids to gold values", () => {
    expect(getMonsterDropGold("giant_rat")).toBe(5);
    expect(getMonsterDropGold("goblin_archer")).toBeGreaterThan(getMonsterDropGold("plague_rat"));
    expect(getMonsterDropGold("lizardman_guard")).toBeGreaterThan(getMonsterDropGold("stone_gargoyle"));
    expect(getMonsterDropGold("construct_shield")).toBeGreaterThan(getMonsterDropGold("orc_warrior"));
    expect(getMonsterDropGold("boss_aries")).toBe(0);
  });
});
