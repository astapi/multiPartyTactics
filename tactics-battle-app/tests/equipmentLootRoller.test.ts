import { describe, expect, it } from "vitest";
import { rollMonsterDrops, rollTreasureChestEquipment } from "@/game/loot/equipmentLootRoller";
import { getEquipmentById } from "@/game/loot/equipmentMasterService";
import type { EncounterResult } from "@/game/encounter";

const encounter: EncounterResult = {
  enemies: [
    {
      enemyId: "goblin",
      name: "Goblin",
      stats: { maxHp: 10, atk: 5, def: 5, spd: 5, maxMp: 0, mpRegen: 0 },
    },
    {
      enemyId: "slime",
      name: "Slime",
      stats: { maxHp: 10, atk: 5, def: 5, spd: 5, maxMp: 0, mpRegen: 0 },
    },
  ],
  rollMeta: {
    dungeonId: "crestoria_dungeon_1_200",
    floor: 2,
    seed: 77,
    enemyCount: 2,
  },
};

describe("game/loot/equipmentLootRoller", () => {
  it("rolls deterministic chest rewards from chest source only", () => {
    const a = rollTreasureChestEquipment({
      dungeonId: "crestoria_dungeon_1_200",
      floor: 2,
      explorationSeed: 12345,
      tick: 7,
    });
    const b = rollTreasureChestEquipment({
      dungeonId: "crestoria_dungeon_1_200",
      floor: 2,
      explorationSeed: 12345,
      tick: 7,
    });
    expect(a).toEqual(b);
    expect(a.sourceType).toBe("TREASURE_CHEST");
    expect(a.mutationPrefixId).toBeNull();
    expect(a.grantKey).toBe("treasure:crestoria_dungeon_1_200:2:12345:7");
    const item = getEquipmentById(a.baseItemId);
    expect(item.source).toBe("chest");
    expect(item.chestTier).toBe(10);
  });

  it("rolls tier-appropriate chest items for different floors", () => {
    const base = {
      dungeonId: "crestoria_dungeon_1_200",
      explorationSeed: 99999,
      tick: 3,
    };

    const tier10 = rollTreasureChestEquipment({ ...base, floor: 5 });
    const tier10Item = getEquipmentById(tier10.baseItemId);
    expect(tier10Item.chestTier).toBe(10);
    expect(tier10Item.id).toMatch(/^chest_bronze_/);

    const tier30 = rollTreasureChestEquipment({ ...base, floor: 25 });
    const tier30Item = getEquipmentById(tier30.baseItemId);
    expect(tier30Item.chestTier).toBe(30);
    expect(tier30Item.id).toMatch(/^chest_steel_/);

    const tier100 = rollTreasureChestEquipment({ ...base, floor: 95 });
    const tier100Item = getEquipmentById(tier100.baseItemId);
    expect(tier100Item.chestTier).toBe(100);
    expect(tier100Item.id).toMatch(/^chest_cobalt_/);

    const tier190 = rollTreasureChestEquipment({ ...base, floor: 185 });
    const tier190Item = getEquipmentById(tier190.baseItemId);
    expect(tier190Item.chestTier).toBe(190);
    expect(tier190Item.id).toMatch(/^chest_chaos_/);
  });

  it("clamps floors above 190 to tier 190", () => {
    const result = rollTreasureChestEquipment({
      dungeonId: "crestoria_dungeon_1_200",
      floor: 200,
      explorationSeed: 55555,
      tick: 1,
    });
    const item = getEquipmentById(result.baseItemId);
    expect(item.chestTier).toBe(190);
  });

  it("does not roll axe or bow in early tiers (10, 20)", () => {
    const base = {
      dungeonId: "crestoria_dungeon_1_200",
      explorationSeed: 0,
      tick: 0,
    };
    const earlyCategories = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const result = rollTreasureChestEquipment({ ...base, floor: 3, explorationSeed: seed });
      earlyCategories.add(result.category);
    }
    expect(earlyCategories.has("two_handed_axe")).toBe(false);
    expect(earlyCategories.has("bow")).toBe(false);
  });

  it("rolls per-enemy monster drops with stable grant keys", () => {
    const rolls = rollMonsterDrops({
      dungeonId: "crestoria_dungeon_1_200",
      floor: 2,
      battleSessionId: "session-1",
      encounter,
      seed: 99,
    });
    expect(rolls).toHaveLength(encounter.enemies.length);
    for (const row of rolls) {
      if (!row.reward) continue;
      expect(row.reward.sourceType).toBe("MONSTER_DROP");
      expect(row.reward.grantKey).toBe(`monster_drop:session-1:${row.enemyIndex}`);
      const item = getEquipmentById(row.reward.baseItemId);
      expect(item.source).toBe("monster");
      if (row.reward.mutationPrefixId) {
        expect(item.can_mutate).toBe(true);
      }
    }
  });

  it("is deterministic for identical monster drop inputs", () => {
    const params = {
      dungeonId: "crestoria_dungeon_1_200",
      floor: 6,
      battleSessionId: "session-xyz",
      encounter,
      seed: 123,
    };
    expect(rollMonsterDrops(params)).toEqual(rollMonsterDrops(params));
  });
});
