import { generateId } from "@/utils/id";
import { ClassId, TacticsRuleRecord } from "@/types/models";

type RuleInput = Omit<TacticsRuleRecord, "id" | "characterId">;

const createRules = (characterId: string, rules: RuleInput[]): TacticsRuleRecord[] =>
  rules.map((rule) => ({
    id: generateId("rule"),
    characterId,
    ...rule,
  }));

const guardianDefaultTactics = (characterId: string): TacticsRuleRecord[] =>
  createRules(characterId, [
    {
      priority: 1,
      skillId: "substitute",
      conditionType: "ALLY_HP_BELOW",
      conditionParams: JSON.stringify({ threshold: 0.25 }),
      targetType: "SELF",
      targetParams: null,
    },
    {
      priority: 2,
      skillId: "taunt",
      conditionType: "ALWAYS",
      conditionParams: null,
      targetType: "SELF",
      targetParams: null,
    },
    {
      priority: 3,
      skillId: "defend",
      conditionType: "ALWAYS",
      conditionParams: null,
      targetType: "SELF",
      targetParams: null,
    },
  ]);

const swordmanDefaultTactics = (characterId: string): TacticsRuleRecord[] =>
  createRules(characterId, [
    {
      priority: 1,
      skillId: "focus",
      conditionType: "TURN_EQUALS",
      conditionParams: JSON.stringify({ turn: 1 }),
      targetType: "SELF",
      targetParams: null,
    },
    {
      priority: 2,
      skillId: "sword_dance",
      conditionType: "ENEMY_HP_BELOW",
      conditionParams: JSON.stringify({ threshold: 0.45 }),
      targetType: "ENEMY_LOWEST_HP",
      targetParams: null,
    },
    {
      priority: 3,
      skillId: "rift_slash",
      conditionType: "ALWAYS",
      conditionParams: null,
      targetType: "ENEMY_LOWEST_HP",
      targetParams: null,
    },
  ]);

const berserkerDefaultTactics = (characterId: string): TacticsRuleRecord[] =>
  createRules(characterId, [
    {
      priority: 1,
      skillId: "pump_up",
      conditionType: "TURN_EQUALS",
      conditionParams: JSON.stringify({ turn: 1 }),
      targetType: "SELF",
      targetParams: null,
    },
    {
      priority: 2,
      skillId: "crushing_swing",
      conditionType: "ENEMY_HP_BELOW",
      conditionParams: JSON.stringify({ threshold: 0.35 }),
      targetType: "ENEMY_LOWEST_HP",
      targetParams: null,
    },
    {
      priority: 3,
      skillId: "sweep",
      conditionType: "ALWAYS",
      conditionParams: null,
      targetType: "ENEMY_FIRST",
      targetParams: null,
    },
  ]);

const clericDefaultTactics = (characterId: string): TacticsRuleRecord[] =>
  createRules(characterId, [
    {
      priority: 1,
      skillId: "heal",
      conditionType: "ALLY_HP_BELOW",
      conditionParams: JSON.stringify({ threshold: 0.3 }),
      targetType: "ALLY_LOWEST_HP",
      targetParams: null,
    },
    {
      priority: 2,
      skillId: "all_heal",
      conditionType: "ALLY_HP_BELOW",
      conditionParams: JSON.stringify({ threshold: 0.6 }),
      targetType: "ALLY_LOWEST_HP",
      targetParams: null,
    },
    {
      priority: 3,
      skillId: "defense_up",
      conditionType: "TURN_EQUALS",
      conditionParams: JSON.stringify({ turn: 1 }),
      targetType: "ALLY_LOWEST_HP",
      targetParams: null,
    },
  ]);

const witchDefaultTactics = (characterId: string): TacticsRuleRecord[] =>
  createRules(characterId, [
    {
      priority: 1,
      skillId: "mana_charge",
      conditionType: "TURN_EQUALS",
      conditionParams: JSON.stringify({ turn: 1 }),
      targetType: "SELF",
      targetParams: null,
    },
    {
      priority: 2,
      skillId: "fireball",
      conditionType: "ENEMY_HP_BELOW",
      conditionParams: JSON.stringify({ threshold: 0.4 }),
      targetType: "ENEMY_LOWEST_HP",
      targetParams: null,
    },
    {
      priority: 3,
      skillId: "lightning",
      conditionType: "ALWAYS",
      conditionParams: null,
      targetType: "ENEMY_FIRST",
      targetParams: null,
    },
  ]);

const thiefDefaultTactics = (characterId: string): TacticsRuleRecord[] =>
  createRules(characterId, [
    {
      priority: 1,
      skillId: "antidote_herb",
      conditionType: "ANY_ALLY_HAS_STATUS",
      conditionParams: JSON.stringify({ status: "POISON" }),
      targetType: "ALLY_WITH_STATUS_LOWEST_HP",
      targetParams: JSON.stringify({ status: "POISON" }),
    },
    {
      priority: 2,
      skillId: "healing_potion",
      conditionType: "ALLY_HP_BELOW",
      conditionParams: JSON.stringify({ threshold: 0.35 }),
      targetType: "ALLY_LOWEST_HP",
      targetParams: null,
    },
  ]);

export const buildDefaultTacticsForClass = (
  characterId: string,
  classId: ClassId
): TacticsRuleRecord[] => {
  switch (classId) {
    case "GUARDIAN":
      return guardianDefaultTactics(characterId);
    case "SWORDMAN":
      return swordmanDefaultTactics(characterId);
    case "BERSERKER":
      return berserkerDefaultTactics(characterId);
    case "CLERIC":
      return clericDefaultTactics(characterId);
    case "WITCH":
      return witchDefaultTactics(characterId);
    case "THIEF":
      return thiefDefaultTactics(characterId);
    default:
      return [];
  }
};
