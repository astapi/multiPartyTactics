import { describe, expect, it } from "vitest";
import { buildDungeonBundles, findBundleByFloor } from "@/game/dungeonBundles";

describe("game/dungeonBundles", () => {
  it("builds boss-based bundles for crestoria 1-120", () => {
    const bundles = buildDungeonBundles("crestoria_dungeon_1_200");
    expect(bundles[0]).toEqual({ startFloor: 1, bossFloor: 10 });
    expect(bundles[1]).toEqual({ startFloor: 11, bossFloor: 20 });
    expect(bundles[2]).toEqual({ startFloor: 21, bossFloor: 30 });
    expect(bundles.at(-1)).toEqual({ startFloor: 111, bossFloor: 120 });
  });

  it("falls back to a single-floor bundle for unknown dungeon ids", () => {
    expect(findBundleByFloor("unknown_dungeon", 3)).toEqual({ startFloor: 3, bossFloor: 3 });
  });

  it("finds bundle by floor", () => {
    expect(findBundleByFloor("crestoria_dungeon_1_200", 1)).toEqual({ startFloor: 1, bossFloor: 10 });
    expect(findBundleByFloor("crestoria_dungeon_1_200", 19)).toEqual({ startFloor: 11, bossFloor: 20 });
    expect(findBundleByFloor("crestoria_dungeon_1_200", 3)).toEqual({ startFloor: 1, bossFloor: 10 });
  });
});
