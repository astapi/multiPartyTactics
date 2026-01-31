import {
  StatusType,
  Unit,
  getTurnOrder,
  regenerateMp,
  tickCooldownsOnTurnStart,
  tickEffectsOnTurnStart,
  tickStatusesOnTurnStart,
} from "./battle";
import { selectVenomTyrantAction } from "./boss-ai";
import {
  JobId,
  JOB_DEFINITIONS,
  Skill,
  VENOM_TYRANT,
  executeSkill,
  getHpPercent,
  hasEffect,
  isSkillUsable,
} from "./skills";

type ConditionContext = {
  turn: number;
  actor: Unit;
  allies: Unit[];
  enemies: Unit[];
};

type TacticsRule = {
  id: string;
  skillId: string;
  condition: (context: ConditionContext) => boolean;
  selectTarget: (context: ConditionContext) => Unit | null;
};

type Scenario = {
  id: string;
  name: string;
  seed: number;
  party: Unit[];
  boss: Unit;
  tactics: Record<string, TacticsRule[]>;
};

type RuleEvaluation = {
  rule: TacticsRule;
  usable: boolean;
  conditionMet: boolean;
  target: Unit | null;
};

const createSeededRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
};

const buildSkillMap = (skills: Skill[]): Map<string, Skill> => {
  const map = new Map<string, Skill>();
  for (const skill of skills) {
    map.set(skill.id, skill);
  }
  return map;
};

const cloneStats = (stats: Unit["stats"]): Unit["stats"] => ({ ...stats });

const createUnit = (params: {
  id: string;
  name: string;
  jobId?: JobId;
  stats: Unit["stats"];
  order: number;
}): Unit => ({
  id: params.id,
  name: params.name,
  jobId: params.jobId,
  stats: cloneStats(params.stats),
  hp: params.stats.maxHp,
  mp: params.stats.maxMp,
  statusEffects: [],
  effects: [],
  cooldowns: {},
  order: params.order,
});

const pickLowestHpPercent = (units: Unit[]): Unit | null => {
  if (units.length === 0) {
    return null;
  }
  return units.reduce((best, unit) =>
    getHpPercent(unit) < getHpPercent(best) ? unit : best
  );
};

const pickLowestHpWithStatus = (units: Unit[], status: StatusType): Unit | null => {
  const candidates = units.filter((unit) =>
    unit.statusEffects.some((effect) => effect.type === status)
  );
  return pickLowestHpPercent(candidates);
};

const anyAllyHasStatus = (units: Unit[], status: StatusType): boolean =>
  units.some((unit) => unit.statusEffects.some((effect) => effect.type === status));

const isEnemyMissingStatus = (enemy: Unit, status: StatusType): boolean =>
  !enemy.statusEffects.some((effect) => effect.type === status);

const isEnemyMissingDebuff = (enemy: Unit, id: string): boolean => !hasEffect(enemy, id);

const rule = (
  id: string,
  skillId: string,
  condition: (context: ConditionContext) => boolean,
  selectTarget: (context: ConditionContext) => Unit | null
): TacticsRule => ({ id, skillId, condition, selectTarget });

const getAllSkills = (): Skill[] => [
  ...VENOM_TYRANT.skills,
  ...JOB_DEFINITIONS.flatMap((job) => job.skills),
];

const makeScenarios = (): Scenario[] => {
  const partyBaseStats = {
    guardian: {
      maxHp: 120,
      atk: 8,
      def: 10,
      spd: 8,
      maxMp: 20,
      mpRegen: 2,
    },
    cleric: {
      maxHp: 80,
      atk: 5,
      def: 6,
      spd: 10,
      maxMp: 35,
      mpRegen: 2,
    },
    blade: {
      maxHp: 90,
      atk: 12,
      def: 5,
      spd: 12,
      maxMp: 25,
      mpRegen: 2,
    },
    arcane: {
      maxHp: 75,
      atk: 6,
      def: 5,
      spd: 11,
      maxMp: 30,
      mpRegen: 2,
    },
  };

  const baseParty = () => [
    createUnit({
      id: "guardian",
      name: "Guardian",
      jobId: "GUARDIAN",
      stats: partyBaseStats.guardian,
      order: 1,
    }),
    createUnit({
      id: "cleric",
      name: "Cleric",
      jobId: "CLERIC",
      stats: partyBaseStats.cleric,
      order: 2,
    }),
    createUnit({
      id: "blade",
      name: "Blade",
      jobId: "BLADE",
      stats: partyBaseStats.blade,
      order: 3,
    }),
    createUnit({
      id: "arcane",
      name: "Arcane",
      jobId: "ARCANE",
      stats: partyBaseStats.arcane,
      order: 4,
    }),
  ];

  const baseBoss = () =>
    createUnit({
      id: "boss",
      name: VENOM_TYRANT.name,
      stats: VENOM_TYRANT.stats,
      order: 99,
    });

  const guardianRules: TacticsRule[] = [
    rule(
      "guard_stance_turn1",
      "guard_stance",
      ({ turn }) => turn === 1,
      ({ actor }) => actor
    ),
    rule(
      "fortify_low_hp",
      "fortify",
      ({ actor }) => getHpPercent(actor) < 0.5,
      ({ actor }) => actor
    ),
    rule(
      "shield_bash_turn4",
      "shield_bash",
      ({ turn }) => turn % 4 === 0,
      ({ enemies }) => enemies[0] ?? null
    ),
  ];

  const clericRulesBase: TacticsRule[] = [
    rule(
      "greater_heal_critical",
      "greater_heal",
      ({ allies }) => {
        const lowest = pickLowestHpPercent(allies);
        return lowest ? getHpPercent(lowest) < 0.25 : false;
      },
      ({ allies }) => pickLowestHpPercent(allies)
    ),
    rule(
      "heal_low",
      "heal",
      ({ allies }) => {
        const lowest = pickLowestHpPercent(allies);
        return lowest ? getHpPercent(lowest) < 0.45 : false;
      },
      ({ allies }) => pickLowestHpPercent(allies)
    ),
    rule(
      "bless_turn1",
      "bless",
      ({ turn }) => turn === 1,
      ({ allies }) => allies.find((unit) => unit.id === "blade") ?? null
    ),
  ];

  const clericRulesScenarioB: TacticsRule[] = [
    rule(
      "cleanse_poison",
      "cleanse",
      ({ allies }) => anyAllyHasStatus(allies, "POISON"),
      ({ allies }) => pickLowestHpWithStatus(allies, "POISON")
    ),
    ...clericRulesBase,
  ];

  const clericRulesScenarioC: TacticsRule[] = [
    rule(
      "cleanse_turn_leq3",
      "cleanse",
      ({ turn }) => turn <= 3,
      ({ allies }) => pickLowestHpWithStatus(allies, "POISON")
    ),
    rule(
      "heal_low",
      "heal",
      ({ allies }) => {
        const lowest = pickLowestHpPercent(allies);
        return lowest ? getHpPercent(lowest) < 0.45 : false;
      },
      ({ allies }) => pickLowestHpPercent(allies)
    ),
  ];

  const bladeRules: TacticsRule[] = [
    rule(
      "berserk_turn1",
      "berserk",
      ({ turn }) => turn === 1,
      ({ actor }) => actor
    ),
    rule(
      "execute_low_hp",
      "execute",
      ({ enemies }) => (enemies[0] ? getHpPercent(enemies[0]) < 0.3 : false),
      ({ enemies }) => enemies[0] ?? null
    ),
    rule("power_strike", "power_strike", () => true, ({ enemies }) => enemies[0]),
  ];

  const arcaneRules: TacticsRule[] = [
    rule(
      "weaken_missing",
      "weaken",
      ({ enemies }) => (enemies[0] ? isEnemyMissingDebuff(enemies[0], "ATK_DOWN") : false),
      ({ enemies }) => enemies[0] ?? null
    ),
    rule(
      "armor_break_missing",
      "armor_break",
      ({ enemies }) => (enemies[0] ? isEnemyMissingDebuff(enemies[0], "DEF_DOWN") : false),
      ({ enemies }) => enemies[0] ?? null
    ),
    rule(
      "poison_missing",
      "poison",
      ({ enemies }) => (enemies[0] ? isEnemyMissingStatus(enemies[0], "POISON") : false),
      ({ enemies }) => enemies[0] ?? null
    ),
    rule(
      "mana_charge_low_mp",
      "mana_charge",
      ({ actor }) => actor.mp < 6,
      ({ actor }) => actor
    ),
  ];

  const scenarioA: Scenario = {
    id: "A",
    name: "Scenario A",
    seed: 1001,
    party: baseParty(),
    boss: baseBoss(),
    tactics: {
      guardian: guardianRules,
      cleric: clericRulesBase,
      blade: bladeRules,
      arcane: arcaneRules,
    },
  };

  const scenarioB: Scenario = {
    id: "B",
    name: "Scenario B",
    seed: 2002,
    party: baseParty(),
    boss: baseBoss(),
    tactics: {
      guardian: guardianRules,
      cleric: clericRulesScenarioB,
      blade: bladeRules,
      arcane: arcaneRules,
    },
  };

  const scenarioC: Scenario = {
    id: "C",
    name: "Scenario C",
    seed: 3003,
    party: baseParty(),
    boss: baseBoss(),
    tactics: {
      guardian: guardianRules,
      cleric: clericRulesScenarioC,
      blade: bladeRules,
      arcane: arcaneRules,
    },
  };

  return [scenarioA, scenarioB, scenarioC];
};

const evaluateRule = (
  actor: Unit,
  rule: TacticsRule,
  context: ConditionContext,
  skillMap: Map<string, Skill>
): RuleEvaluation => {
  const skill = skillMap.get(rule.skillId);
  if (!skill) {
    throw new Error(`Missing skill: ${rule.skillId}`);
  }
  const usable = isSkillUsable(actor, skill);
  const conditionMet = rule.condition(context);
  const target = conditionMet ? rule.selectTarget(context) : null;
  return { rule, usable, conditionMet, target };
};

const formatRuleLog = (
  scenario: Scenario,
  turn: number,
  actor: Unit,
  evaluation: RuleEvaluation
): string => {
  const targetName = evaluation.target ? evaluation.target.name : "none";
  return [
    `[${scenario.name}]`,
    `turn ${turn}`,
    actor.name,
    `rule=${evaluation.rule.id}`,
    `usable=${evaluation.usable}`,
    `condition=${evaluation.conditionMet}`,
    `target=${targetName}`,
  ].join(" ");
};

const logSkillResult = (
  scenario: Scenario,
  turn: number,
  actor: Unit,
  target: Unit,
  skill: Skill,
  result: ReturnType<typeof executeSkill>
): void => {
  const statusApplied = result.appliedStatuses.map((status) => status.type).join(",");
  const cleansed = result.cleansedStatuses.join(",");
  console.log(
    [
      `[${scenario.name}]`,
      `turn ${turn}`,
      actor.name,
      `skill=${skill.name}`,
      `target=${target.name}`,
      `damage=${result.damage}`,
      `heal=${result.healing}`,
      `applied=[${statusApplied}]`,
      `cleansed=[${cleansed}]`,
    ].join(" ")
  );
};

const executePartyTurn = (
  scenario: Scenario,
  actor: Unit,
  allies: Unit[],
  enemies: Unit[],
  turn: number,
  rng: () => number,
  skillMap: Map<string, Skill>
): void => {
  const rules = scenario.tactics[actor.id] ?? [];
  for (const ruleEntry of rules) {
    const evaluation = evaluateRule(actor, ruleEntry, { turn, actor, allies, enemies }, skillMap);
    console.log(formatRuleLog(scenario, turn, actor, evaluation));
    if (!evaluation.usable || !evaluation.conditionMet || !evaluation.target) {
      continue;
    }

    const skill = skillMap.get(ruleEntry.skillId);
    if (!skill) {
      throw new Error(`Missing skill: ${ruleEntry.skillId}`);
    }

    const result = executeSkill(actor, evaluation.target, skill, rng);
    logSkillResult(scenario, turn, actor, evaluation.target, skill, result);
    return;
  }

  console.log(`[${scenario.name}] turn ${turn} ${actor.name} action=WAIT`);
};

const executeBossTurn = (
  scenario: Scenario,
  boss: Unit,
  allies: Unit[],
  turn: number,
  rng: () => number,
  skillMap: Map<string, Skill>
): void => {
  const decision = selectVenomTyrantAction(boss, allies, turn);
  const skill = skillMap.get(decision.skill.id);
  if (!skill) {
    throw new Error(`Missing skill: ${decision.skill.id}`);
  }
  const result = executeSkill(boss, decision.target, skill, rng);
  logSkillResult(scenario, turn, boss, decision.target, skill, result);
};

const isPartyDefeated = (party: Unit[]): boolean =>
  party.every((unit) => unit.hp <= 0);

const runScenario = (scenario: Scenario, maxTurns: number): void => {
  const rng = createSeededRng(scenario.seed);
  const skillMap = buildSkillMap(getAllSkills());
  const units: Unit[] = [...scenario.party, scenario.boss];

  console.log(`[${scenario.name}] start seed=${scenario.seed}`);

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const order = getTurnOrder(units);
    for (const entry of order) {
      const actor = entry.unit;
      if (actor.hp <= 0) {
        continue;
      }

      tickCooldownsOnTurnStart(actor);
      regenerateMp(actor);
      tickEffectsOnTurnStart(actor);
      const statusResult = tickStatusesOnTurnStart(actor);
      if (statusResult.poisonedDamage > 0) {
        console.log(
          `[${scenario.name}] turn ${turn} ${actor.name} poisonDamage=${statusResult.poisonedDamage}`
        );
      }

      if (actor.hp <= 0) {
        continue;
      }

      if (statusResult.skippedAction) {
        console.log(`[${scenario.name}] turn ${turn} ${actor.name} skipped=STUN`);
        continue;
      }

      if (actor.id === scenario.boss.id) {
        executeBossTurn(scenario, actor, scenario.party, turn, rng, skillMap);
      } else {
        executePartyTurn(scenario, actor, scenario.party, [scenario.boss], turn, rng, skillMap);
      }

      if (scenario.boss.hp <= 0 || isPartyDefeated(scenario.party)) {
        break;
      }
    }

    if (scenario.boss.hp <= 0 || isPartyDefeated(scenario.party)) {
      break;
    }
  }

  console.log(
    `[${scenario.name}] end bossHp=${scenario.boss.hp} partyAlive=${scenario.party.filter(
      (unit) => unit.hp > 0
    ).length}`
  );
};

export const runAllScenarios = (): void => {
  const scenarios = makeScenarios();
  for (const scenario of scenarios) {
    runScenario(scenario, 6);
  }
};
