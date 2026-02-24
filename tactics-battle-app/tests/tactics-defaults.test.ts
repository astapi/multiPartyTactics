import { describe, expect, it, vi } from "vitest";
import { buildDefaultTacticsForClass } from "@/game/tactics/defaults";
import { ClassId } from "@/types/models";

describe("game/tactics/defaults", () => {
  it("builds guardian default tactics (substitute -> taunt -> defend)", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const rules = buildDefaultTacticsForClass("char-1", "GUARDIAN");
    expect(rules).toHaveLength(3);
    expect(
      rules.map((rule) => ({
        priority: rule.priority,
        skillId: rule.skillId,
        conditionType: rule.conditionType,
        conditionParams: rule.conditionParams,
        targetType: rule.targetType,
      }))
    ).toEqual([
      {
        priority: 1,
        skillId: "substitute",
        conditionType: "ALLY_HP_BELOW",
        conditionParams: "{\"threshold\":0.25}",
        targetType: "SELF",
      },
      {
        priority: 2,
        skillId: "taunt",
        conditionType: "ALWAYS",
        conditionParams: null,
        targetType: "SELF",
      },
      {
        priority: 3,
        skillId: "defend",
        conditionType: "ALWAYS",
        conditionParams: null,
        targetType: "SELF",
      },
    ]);
    expect(rules.every((rule) => rule.id.startsWith("rule-1700000000000-"))).toBe(true);
    expect(rules.every((rule) => rule.characterId === "char-1")).toBe(true);
  });

  it("builds class defaults for all classes", () => {
    const cases: Array<{
      classId: ClassId;
      expectedSkillIds: string[];
      expectedConditions: Array<{ type: string; params: string | null }>;
    }> = [
      {
        classId: "SWORDMAN",
        expectedSkillIds: ["focus", "sword_dance", "rift_slash"],
        expectedConditions: [
          { type: "TURN_EQUALS", params: "{\"turn\":1}" },
          { type: "ENEMY_HP_BELOW", params: "{\"threshold\":0.45}" },
          { type: "ALWAYS", params: null },
        ],
      },
      {
        classId: "BERSERKER",
        expectedSkillIds: ["pump_up", "crushing_swing", "sweep"],
        expectedConditions: [
          { type: "TURN_EQUALS", params: "{\"turn\":1}" },
          { type: "ENEMY_HP_BELOW", params: "{\"threshold\":0.35}" },
          { type: "ALWAYS", params: null },
        ],
      },
      {
        classId: "CLERIC",
        expectedSkillIds: ["heal", "all_heal", "defense_up"],
        expectedConditions: [
          { type: "ALLY_HP_BELOW", params: "{\"threshold\":0.3}" },
          { type: "ALLY_HP_BELOW", params: "{\"threshold\":0.6}" },
          { type: "TURN_EQUALS", params: "{\"turn\":1}" },
        ],
      },
      {
        classId: "WITCH",
        expectedSkillIds: ["mana_charge", "fireball", "lightning"],
        expectedConditions: [
          { type: "TURN_EQUALS", params: "{\"turn\":1}" },
          { type: "ENEMY_HP_BELOW", params: "{\"threshold\":0.4}" },
          { type: "ALWAYS", params: null },
        ],
      },
      {
        classId: "THIEF",
        expectedSkillIds: ["antidote_herb", "healing_potion"],
        expectedConditions: [
          { type: "ANY_ALLY_HAS_STATUS", params: "{\"status\":\"POISON\"}" },
          { type: "ALLY_HP_BELOW", params: "{\"threshold\":0.35}" },
        ],
      },
    ];

    for (const c of cases) {
      const rules = buildDefaultTacticsForClass("char-x", c.classId);
      expect(rules.map((rule) => rule.skillId)).toEqual(c.expectedSkillIds);
      expect(
        rules.map((rule) => ({
          type: rule.conditionType,
          params: rule.conditionParams,
        }))
      ).toEqual(c.expectedConditions);
      expect(rules.map((rule) => rule.priority)).toEqual(
        Array.from({ length: rules.length }, (_, i) => i + 1)
      );
      expect(rules.every((rule) => rule.characterId === "char-x")).toBe(true);
    }
  });
});
