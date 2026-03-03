import { describe, expect, it } from "vitest";
import {
  coerceRuleToSkillDefinition,
  getSkillTacticsDefinition,
  validateRuleAgainstSkillDefinition,
} from "@/game/tactics/skillTacticsDefinitions";
import { buildDefaultTacticsForClass } from "@/game/tactics/defaults";
import type { ClassId, TacticsRuleRecord } from "@/types/models";
import { makeRule } from "./helpers";

describe("game/tactics/skillTacticsDefinitions", () => {
  it("keeps class default tactics inside skill definition matrix", () => {
    const classes: ClassId[] = [
      "GUARDIAN",
      "SWORDMAN",
      "BERSERKER",
      "CLERIC",
      "WITCH",
      "THIEF",
    ];

    for (const classId of classes) {
      const rules = buildDefaultTacticsForClass("char-x", classId);
      for (const rule of rules) {
        const definition = getSkillTacticsDefinition(rule.skillId);
        const result = validateRuleAgainstSkillDefinition(rule, definition);
        expect(result.ok).toBe(true);
      }
    }
  });

  it("coerces invalid condition/target to skill defaults", () => {
    const definition = getSkillTacticsDefinition("heal");
    const invalidRule: TacticsRuleRecord = makeRule({
      skillId: "heal",
      conditionType: "ALWAYS",
      conditionParams: null,
      targetType: "AUTO",
      targetParams: null,
    });

    const normalized = coerceRuleToSkillDefinition(invalidRule, definition);
    expect(normalized.conditionType).toBe("ALLY_HP_BELOW");
    expect(normalized.conditionParams).toBe("{\"threshold\":0.3}");
    expect(normalized.targetType).toBe("ALLY_LOWEST_HP");
    expect(normalized.targetParams).toBeNull();
  });

  it("rejects out-of-range threshold and disallowed target", () => {
    const definition = getSkillTacticsDefinition("taunt");
    const outOfRangeRule = makeRule({
      skillId: "taunt",
      conditionType: "SELF_HP_ABOVE",
      conditionParams: JSON.stringify({ threshold: 1.2 }),
      targetType: "SELF",
      targetParams: null,
    });
    const badThreshold = validateRuleAgainstSkillDefinition(
      outOfRangeRule,
      definition
    );
    expect(badThreshold.ok).toBe(false);
    if (!badThreshold.ok) {
      expect(badThreshold.reason).toBe("threshold:range");
    }

    const disallowedTargetRule = makeRule({
      skillId: "taunt",
      conditionType: "ALWAYS",
      conditionParams: null,
      targetType: "AUTO",
      targetParams: null,
    });
    const badTarget = validateRuleAgainstSkillDefinition(
      disallowedTargetRule,
      definition
    );
    expect(badTarget.ok).toBe(false);
    if (!badTarget.ok) {
      expect(badTarget.reason).toBe("target_type:not_allowed");
    }
  });
});
