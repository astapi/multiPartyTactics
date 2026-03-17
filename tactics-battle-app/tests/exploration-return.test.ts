import { describe, expect, it } from "vitest";
import {
  calculateDungeonItemCapacity,
  DEFAULT_DUNGEON_ITEM_CAPACITY,
  hasAnyDownMember,
  isPartyWiped,
  normalizeDungeonReturnCondition,
} from "@/game/explorationReturn";

describe("game/explorationReturn", () => {
  it("帰還条件の不正値は既定値へ丸める", () => {
    expect(normalizeDungeonReturnCondition("INVALID")).toBe("ANY_MEMBER_DOWN");
  });

  it("ポーター人数に応じて持ち帰り上限が増える", () => {
    expect(
      calculateDungeonItemCapacity([
        { traitIds: [] },
        { traitIds: ["PORTER"] },
        { traitIds: ["PORTER"] },
      ])
    ).toBe(DEFAULT_DUNGEON_ITEM_CAPACITY + 4);
  });

  it("1人でもHP0以下なら戦闘不能扱いになる", () => {
    expect(
      hasAnyDownMember([
        { hp: 10 },
        { hp: 0 },
      ])
    ).toBe(true);
  });

  it("全員HP0以下のときだけ全滅扱いになる", () => {
    expect(
      isPartyWiped([
        { hp: 0 },
        { hp: -5 },
      ])
    ).toBe(true);
    expect(
      isPartyWiped([
        { hp: 1 },
        { hp: 0 },
      ])
    ).toBe(false);
  });
});
