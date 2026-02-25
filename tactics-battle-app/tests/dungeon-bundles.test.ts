import { describe, expect, it } from "vitest";
import { buildDungeonBundles, findBundleByFloor } from "@/game/dungeonBundles";

describe("game/dungeonBundles", () => {
  it("builds boss-based bundles for hakusla", () => {
    const bundles = buildDungeonBundles("hakusla_dungeon_1_200");
    expect(bundles[0]).toEqual({ startFloor: 1, bossFloor: 5 });
    expect(bundles[1]).toEqual({ startFloor: 6, bossFloor: 10 });
    expect(bundles[2]).toEqual({ startFloor: 11, bossFloor: 20 });
    expect(bundles.at(-1)).toEqual({ startFloor: 196, bossFloor: 200 });
  });

  it("falls back to single-floor bundles when boss floors are not defined", () => {
    const bundles = buildDungeonBundles("crestoria_dungeon_1_4");
    expect(bundles).toEqual([
      { startFloor: 1, bossFloor: 1 },
      { startFloor: 2, bossFloor: 2 },
      { startFloor: 3, bossFloor: 3 },
      { startFloor: 4, bossFloor: 4 },
    ]);
  });

  it("finds bundle by floor", () => {
    expect(findBundleByFloor("hakusla_dungeon_1_200", 1)).toEqual({ startFloor: 1, bossFloor: 5 });
    expect(findBundleByFloor("hakusla_dungeon_1_200", 19)).toEqual({ startFloor: 11, bossFloor: 20 });
    expect(findBundleByFloor("crestoria_dungeon_1_4", 3)).toEqual({ startFloor: 3, bossFloor: 3 });
  });
});
