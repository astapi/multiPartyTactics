import { describe, expect, it } from "vitest";
import { evaluateTactics } from "@/game/tactics/evaluator";
import { makeRule, makeSkill, makeUnit } from "./helpers";

describe("game/tactics/evaluator", () => {
  it("evaluates rules by priority and skips unusable skills", () => {
    const actor = makeUnit({ id: "actor", mp: 3, hp: 20, stats: { maxHp: 100 } });
    const ally1 = makeUnit({ id: "ally1", hp: 80, stats: { maxHp: 100 } });
    const ally2 = makeUnit({
      id: "ally2",
      hp: 30,
      stats: { maxHp: 100 },
      statusEffects: [{ type: "POISON", remainingTurns: 2, potency: 2 }],
    });
    const enemy1 = makeUnit({ id: "enemy1", hp: 60 });
    const enemy2 = makeUnit({ id: "enemy2", hp: 20 });

    const expensive = makeSkill({ id: "expensive", mpCost: 99, target: "ALLY", type: "heal" });
    const usable = makeSkill({ id: "usable", mpCost: 0, target: "ALLY", type: "heal" });
    const skillMap = new Map([
      [expensive.id, expensive],
      [usable.id, usable],
    ]);

    const rules = [
      makeRule({
        id: "r3",
        priority: 3,
        skillId: "usable",
        conditionType: "ANY_ALLY_HAS_STATUS",
        conditionParams: JSON.stringify({ status: "POISON" }),
        targetType: "ALLY_WITH_STATUS_LOWEST_HP",
        targetParams: JSON.stringify({ status: "POISON" }),
      }),
      makeRule({
        id: "r1",
        priority: 1,
        skillId: "expensive",
        conditionType: "ALWAYS",
        targetType: "SELF",
      }),
      makeRule({
        id: "r2",
        priority: 2,
        skillId: "usable",
        conditionType: "SELF_HP_BELOW",
        conditionParams: JSON.stringify({ threshold: 0.1 }),
        targetType: "SELF",
      }),
    ];

    const result = evaluateTactics(
      actor,
      [actor, ally1, ally2],
      [enemy1, enemy2],
      rules,
      skillMap,
      2
    );
    expect(result.skill?.id).toBe("usable");
    expect(result.target?.id).toBe("ally2");
    expect(result.evaluatedRuleIds).toEqual(["r1", "r2", "r3"]);
  });

  it("supports various conditions and targets", () => {
    const actor = makeUnit({ id: "actor", hp: 40, stats: { maxHp: 100 } });
    const allyLow = makeUnit({ id: "allyLow", hp: 10, stats: { maxHp: 100 } });
    const enemyA = makeUnit({ id: "enemyA", hp: 70, stats: { maxHp: 100 } });
    const enemyB = makeUnit({ id: "enemyB", hp: 20, stats: { maxHp: 100 } });
    const skill = makeSkill({ id: "s", mpCost: 0 });
    const skillMap = new Map([[skill.id, skill]]);

    const turnEquals = evaluateTactics(
      actor,
      [actor, allyLow],
      [enemyA, enemyB],
      [makeRule({ id: "turn", skillId: "s", conditionType: "TURN_EQUALS", conditionParams: "{\"turn\":5}", targetType: "AUTO" })],
      skillMap,
      5
    );
    expect(turnEquals.target?.id).toBe("enemyA");

    const allyLowest = evaluateTactics(
      actor,
      [actor, allyLow],
      [enemyA, enemyB],
      [makeRule({ id: "ally", skillId: "s", conditionType: "ALLY_HP_BELOW", conditionParams: "{\"threshold\":0.2}", targetType: "ALLY_LOWEST_HP" })],
      skillMap,
      1
    );
    expect(allyLowest.target?.id).toBe("allyLow");

    const enemyLowest = evaluateTactics(
      actor,
      [actor, allyLow],
      [enemyA, enemyB],
      [makeRule({ id: "enemy", skillId: "s", conditionType: "ENEMY_COUNT_AT_LEAST", conditionParams: "{\"count\":2}", targetType: "AUTO" })],
      skillMap,
      1
    );
    expect(enemyLowest.target?.id).toBe("enemyA");

    const allyMpLow = makeUnit({
      id: "allyMpLow",
      mp: 2,
      stats: { maxHp: 100, maxMp: 10 },
      order: 3,
    });
    const allyMpHigh = makeUnit({
      id: "allyMpHigh",
      mp: 9,
      stats: { maxHp: 100, maxMp: 10 },
      order: 2,
    });
    const actorOrdered = makeUnit({ id: "actorOrdered", mp: 10, stats: { maxHp: 100, maxMp: 10 }, order: 1 });

    const mpCondition = evaluateTactics(
      actorOrdered,
      [actorOrdered, allyMpHigh, allyMpLow],
      [enemyA, enemyB],
      [
        makeRule({
          id: "mp",
          skillId: "s",
          conditionType: "ALLY_MP_BELOW",
          conditionParams: "{\"threshold\":0.3}",
          targetType: "ALLY_POSITION",
          targetParams: "{\"position\":3}",
        }),
      ],
      skillMap,
      1
    );
    expect(mpCondition.target?.id).toBe("allyMpLow");

    const enemyAuto = evaluateTactics(
      actor,
      [actor, allyLow],
      [enemyA, enemyB],
      [
        makeRule({
          id: "enemy-auto",
          skillId: "s",
          conditionType: "ALWAYS",
          targetType: "AUTO",
        }),
      ],
      skillMap,
      1
    );
    expect(enemyAuto.target?.id).toBe("enemyA");
  });

  it("treats BELOW conditions as <= at threshold boundary", () => {
    const actor = makeUnit({
      id: "actor",
      hp: 50,
      mp: 10,
      stats: { maxHp: 100, maxMp: 20 },
      order: 1,
    });
    const ally = makeUnit({
      id: "ally",
      hp: 40,
      mp: 3,
      stats: { maxHp: 100, maxMp: 10 },
      order: 2,
    });
    const enemy = makeUnit({
      id: "enemy",
      hp: 30,
      stats: { maxHp: 100, maxMp: 20 },
      order: 100,
    });
    const skill = makeSkill({ id: "s", mpCost: 0, target: "ALLY" });
    const skillMap = new Map([[skill.id, skill]]);

    const selfBoundary = evaluateTactics(
      actor,
      [actor, ally],
      [enemy],
      [
        makeRule({
          id: "self-boundary",
          skillId: "s",
          conditionType: "SELF_HP_BELOW",
          conditionParams: "{\"threshold\":0.5}",
          targetType: "SELF",
        }),
      ],
      skillMap,
      1
    );
    expect(selfBoundary.skill?.id).toBe("s");
    expect(selfBoundary.target?.id).toBe("actor");

    const allyBoundary = evaluateTactics(
      actor,
      [actor, ally],
      [enemy],
      [
        makeRule({
          id: "ally-boundary",
          skillId: "s",
          conditionType: "ALLY_HP_BELOW",
          conditionParams: "{\"threshold\":0.4}",
          targetType: "ALLY_LOWEST_HP",
        }),
      ],
      skillMap,
      1
    );
    expect(allyBoundary.target?.id).toBe("ally");

    const allyMpBoundary = evaluateTactics(
      actor,
      [actor, ally],
      [enemy],
      [
        makeRule({
          id: "ally-mp-boundary",
          skillId: "s",
          conditionType: "ALLY_MP_BELOW",
          conditionParams: "{\"threshold\":0.3}",
          targetType: "ALLY_LOWEST_HP",
        }),
      ],
      skillMap,
      1
    );
    expect(allyMpBoundary.target?.id).toBe("ally");

  });

  it("supports SELF_HP_ABOVE and ALLY_FIRST_MATCHING_CONDITION", () => {
    const actor = makeUnit({
      id: "actor",
      hp: 50,
      stats: { maxHp: 100, maxMp: 20 },
      order: 2,
    });
    const allyFront = makeUnit({
      id: "ally-front",
      hp: 20,
      stats: { maxHp: 100, maxMp: 20 },
      order: 1,
    });
    const allyBack = makeUnit({
      id: "ally-back",
      hp: 10,
      stats: { maxHp: 100, maxMp: 20 },
      order: 3,
    });
    const enemy = makeUnit({ id: "enemy", hp: 80, stats: { maxHp: 100 }, order: 100 });
    const skill = makeSkill({ id: "s", mpCost: 0, target: "ALLY" });
    const skillMap = new Map([[skill.id, skill]]);

    const selfHpAbove = evaluateTactics(
      actor,
      [actor, allyFront, allyBack],
      [enemy],
      [
        makeRule({
          id: "self-above",
          skillId: "s",
          conditionType: "SELF_HP_ABOVE",
          conditionParams: "{\"threshold\":0.5}",
          targetType: "SELF",
        }),
      ],
      skillMap,
      1
    );
    expect(selfHpAbove.skill?.id).toBe("s");
    expect(selfHpAbove.target?.id).toBe("actor");

    const firstMatching = evaluateTactics(
      actor,
      [actor, allyFront, allyBack],
      [enemy],
      [
        makeRule({
          id: "first-matching",
          skillId: "s",
          conditionType: "ALLY_HP_BELOW",
          conditionParams: "{\"threshold\":0.4}",
          targetType: "ALLY_FIRST_MATCHING_CONDITION",
        }),
      ],
      skillMap,
      1
    );
    expect(firstMatching.target?.id).toBe("ally-front");
  });

  it("supports BOSS_BATTLE condition", () => {
    const actor = makeUnit({ id: "actor", order: 1 });
    const ally = makeUnit({ id: "ally", order: 2 });
    const bossEnemy = makeUnit({ id: "enemy_boss_lepus_1", order: 100 });
    const normalEnemy = makeUnit({ id: "enemy_goblin_1", order: 101 });
    const skill = makeSkill({ id: "s", mpCost: 0, target: "SELF" });
    const skillMap = new Map([[skill.id, skill]]);

    const bossHit = evaluateTactics(
      actor,
      [actor, ally],
      [bossEnemy],
      [
        makeRule({
          id: "boss-rule",
          skillId: "s",
          conditionType: "BOSS_BATTLE",
          targetType: "SELF",
        }),
      ],
      skillMap,
      1
    );
    expect(bossHit.skill?.id).toBe("s");
    expect(bossHit.target?.id).toBe("actor");

    const normalMiss = evaluateTactics(
      actor,
      [actor, ally],
      [normalEnemy],
      [
        makeRule({
          id: "boss-rule",
          skillId: "s",
          conditionType: "BOSS_BATTLE",
          targetType: "SELF",
        }),
      ],
      skillMap,
      1
    );
    expect(normalMiss.skill).toBeNull();
    expect(normalMiss.target).toBeNull();
  });

  it("returns null when ALLY_FIRST_MATCHING_CONDITION has no matching ally", () => {
    const actor = makeUnit({
      id: "actor",
      hp: 90,
      stats: { maxHp: 100, maxMp: 20 },
      order: 1,
    });
    const ally = makeUnit({
      id: "ally",
      hp: 80,
      stats: { maxHp: 100, maxMp: 20 },
      order: 2,
    });
    const enemy = makeUnit({ id: "enemy", hp: 80, stats: { maxHp: 100 }, order: 100 });
    const skill = makeSkill({ id: "s", mpCost: 0, target: "ALLY" });
    const skillMap = new Map([[skill.id, skill]]);

    const result = evaluateTactics(
      actor,
      [actor, ally],
      [enemy],
      [
        makeRule({
          id: "no-match",
          skillId: "s",
          conditionType: "ALLY_HP_BELOW",
          conditionParams: "{\"threshold\":0.4}",
          targetType: "ALLY_FIRST_MATCHING_CONDITION",
        }),
      ],
      skillMap,
      1
    );

    expect(result.skill).toBeNull();
    expect(result.target).toBeNull();
  });

  it("supports multiple conditions via ALL_OF", () => {
    const actor = makeUnit({
      id: "actor",
      hp: 100,
      mp: 10,
      stats: { maxHp: 100, maxMp: 10 },
      order: 1,
    });
    const ally = makeUnit({
      id: "ally",
      hp: 20,
      mp: 1,
      stats: { maxHp: 100, maxMp: 10 },
      order: 2,
    });
    const enemy = makeUnit({ id: "enemy", order: 100 });
    const skill = makeSkill({ id: "s", mpCost: 0 });

    const rule = makeRule({
      id: "all-of",
      skillId: "s",
      conditionType: "ALL_OF",
      conditionParams: JSON.stringify({
        conditions: [
          { type: "ALLY_HP_BELOW", params: { threshold: 0.3 } },
          { type: "ALLY_MP_BELOW", params: { threshold: 0.2 } },
          { type: "TURN_EQUALS", params: { turn: 2 } },
        ],
      }),
      targetType: "ALLY_POSITION",
      targetParams: JSON.stringify({ position: 2 }),
    });

    const hit = evaluateTactics(actor, [actor, ally], [enemy], [rule], new Map([[skill.id, skill]]), 2);
    expect(hit.skill?.id).toBe("s");
    expect(hit.target?.id).toBe("ally");

    const miss = evaluateTactics(actor, [actor, ally], [enemy], [rule], new Map([[skill.id, skill]]), 3);
    expect(miss.skill).toBeNull();
    expect(miss.target).toBeNull();
  });

  it("handles invalid params JSON and returns null when target selection fails", () => {
    const actor = makeUnit({ id: "actor" });
    const ally = makeUnit({ id: "ally" });
    const enemy = makeUnit({ id: "enemy" });
    const skill = makeSkill({ id: "s" });
    const skillMap = new Map([[skill.id, skill]]);

    const result = evaluateTactics(
      actor,
      [actor, ally],
      [enemy],
      [
        makeRule({
          id: "r1",
          skillId: "s",
          conditionType: "ALWAYS",
          conditionParams: "{invalid",
          targetType: "ALLY_WITH_STATUS_LOWEST_HP",
          targetParams: "{\"status\":\"STUN\"}",
        }),
      ],
      skillMap,
      1
    );

    expect(result).toEqual({
      skill: null,
      target: null,
      evaluatedRuleIds: ["r1"],
    });
  });

  it("returns null when no skill exists in map", () => {
    const actor = makeUnit({ id: "actor" });
    const result = evaluateTactics(
      actor,
      [actor],
      [makeUnit({ id: "enemy" })],
      [makeRule({ id: "missing", skillId: "does-not-exist" })],
      new Map(),
      1
    );
    expect(result.skill).toBeNull();
    expect(result.target).toBeNull();
    expect(result.evaluatedRuleIds).toEqual(["missing"]);
  });

  it("returns null for unsupported condition/target types (defensive default branches)", () => {
    const actor = makeUnit({ id: "actor" });
    const skill = makeSkill({ id: "s" });
    const rule = makeRule({ id: "r1", skillId: "s" }) as any;
    rule.conditionType = "UNKNOWN_CONDITION";
    rule.targetType = "UNKNOWN_TARGET";

    const result = evaluateTactics(
      actor,
      [actor],
      [makeUnit({ id: "enemy" })],
      [rule],
      new Map([[skill.id, skill]]),
      1
    );
    expect(result).toEqual({ skill: null, target: null, evaluatedRuleIds: ["r1"] });
  });
});
