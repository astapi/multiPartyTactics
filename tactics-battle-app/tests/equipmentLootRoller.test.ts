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
    dungeonId: "crestoria_dungeon_1_4",
    floor: 2,
    seed: 77,
    enemyCount: 2,
  },
};

describe("game/loot/equipmentLootRoller", () => {
  it("rolls deterministic chest rewards from chest source only", () => {
    const a = rollTreasureChestEquipment({
      dungeonId: "crestoria_dungeon_1_4",
      floor: 2,
      explorationSeed: 12345,
      tick: 7,
    });
    const b = rollTreasureChestEquipment({
      dungeonId: "crestoria_dungeon_1_4",
      floor: 2,
      explorationSeed: 12345,
      tick: 7,
    });
    expect(a).toEqual(b);
    expect(a.sourceType).toBe("TREASURE_CHEST");
    expect(a.mutationPrefixId).toBeNull();
    expect(a.grantKey).toBe("treasure:crestoria_dungeon_1_4:2:12345:7");
    expect(getEquipmentById(a.baseItemId).source).toBe("chest");
  });

  it("rolls per-enemy monster drops with stable grant keys", () => {
    const rolls = rollMonsterDrops({
      dungeonId: "crestoria_dungeon_1_4",
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
      dungeonId: "crestoria_dungeon_5_9",
      floor: 6,
      battleSessionId: "session-xyz",
      encounter,
      seed: 123,
    };
    expect(rollMonsterDrops(params)).toEqual(rollMonsterDrops(params));
  });
});
