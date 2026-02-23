import { bench, describe } from "vitest";
import { calculatePhysicalDamage } from "@/game/battle";
import { generateEncounter } from "@/game/encounter";
import { generateExplorationResult } from "@/game/exploration";
import { evaluateTactics } from "@/game/tactics/evaluator";
import { DUNGEONS } from "@/constants/dungeons";
import { makeRule, makeSkill, makeUnit } from "./helpers";

describe("logic benchmarks", () => {
  const attacker = makeUnit({ stats: { atk: 20 } });
  const defender = makeUnit({ stats: { def: 4 } });

  bench("calculatePhysicalDamage", () => {
    calculatePhysicalDamage(attacker, defender, 1.5, 1);
  });

  bench("generateEncounter", () => {
    generateEncounter({
      dungeonId: "crestoria_dungeon_1_4",
      floor: 3,
      seed: 123456,
    });
  });

  const actor = makeUnit({ id: "actor" });
  const allies = [actor, makeUnit({ id: "ally", hp: 20, stats: { maxHp: 100 } })];
  const enemies = [makeUnit({ id: "e1", hp: 60 }), makeUnit({ id: "e2", hp: 10, stats: { maxHp: 100 } })];
  const skill = makeSkill({ id: "s" });
  const skillMap = new Map([[skill.id, skill]]);
  const rules = [
    makeRule({
      id: "r1",
      skillId: "s",
      conditionType: "ALLY_HP_BELOW",
      conditionParams: JSON.stringify({ threshold: 0.5 }),
      targetType: "ENEMY_LOWEST_HP",
    }),
  ];

  bench("evaluateTactics", () => {
    evaluateTactics(actor, allies, enemies, rules, skillMap, 1);
  });

  bench("generateExplorationResult", () => {
    generateExplorationResult({
      party: [attacker, defender],
      dungeon: DUNGEONS[0],
      floor: 2,
      seed: 42,
    });
  });
});
