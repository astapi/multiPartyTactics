import { describe, expect, it } from "vitest";
import { getMonsterDropBaseItemIds, listMonsterDropEntries } from "@/game/loot/monsterDropTableService";

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
});
