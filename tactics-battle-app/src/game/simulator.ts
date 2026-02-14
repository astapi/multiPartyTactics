import {
  Unit,
  getTurnOrder,
  regenerateMp,
  tickCooldownsOnTurnStart,
  tickEffectsOnTurnStart,
  tickStatusesOnTurnStart,
} from "@/game/battle";
import { selectVenomTyrantAction } from "@/game/boss-ai";
import {
  ARCANE_SKILLS,
  BLADE_SKILLS,
  CLERIC_SKILLS,
  GUARDIAN_SKILLS,
  Skill,
  VENOM_TYRANT,
  executeSkill,
} from "@/game/skills";
import { evaluateTactics } from "@/game/tactics/evaluator";
import { BattleLogRecord, TacticsRuleRecord } from "@/types/models";
import { generateId } from "@/utils/id";

const buildSkillMap = (skills: Skill[]): Map<string, Skill> => {
  const map = new Map<string, Skill>();
  for (const skill of skills) map.set(skill.id, skill);
  return map;
};

const ALL_SKILLS = [
  ...VENOM_TYRANT.skills,
  ...GUARDIAN_SKILLS,
  ...CLERIC_SKILLS,
  ...BLADE_SKILLS,
  ...ARCANE_SKILLS,
];

export const createBossUnit = (): Unit => ({
  id: "boss",
  name: VENOM_TYRANT.name,
  stats: { ...VENOM_TYRANT.stats },
  hp: VENOM_TYRANT.stats.maxHp,
  mp: VENOM_TYRANT.stats.maxMp,
  statusEffects: [],
  effects: [],
  cooldowns: {},
  order: 999,
});

export const runBattleTurn = (params: {
  sessionId: string;
  turn: number;
  party: Unit[];
  boss: Unit;
  tacticsByCharacter: Record<string, TacticsRuleRecord[]>;
  skillMap: Map<string, Skill>;
}): { logs: BattleLogRecord[]; battleEnded: boolean; winner: "party" | "boss" | null } => {
  const logs: BattleLogRecord[] = [];
  const units = [...params.party, params.boss];
  const order = getTurnOrder(units);

  for (const entry of order) {
    const actor = entry.unit;
    if (actor.hp <= 0) continue;

    tickCooldownsOnTurnStart(actor);
    regenerateMp(actor);
    tickEffectsOnTurnStart(actor);
    const statusResult = tickStatusesOnTurnStart(actor);
    if (actor.hp <= 0 || statusResult.skippedAction) continue;

    if (actor.id === params.boss.id) {
      const aliveParty = params.party.filter((unit) => unit.hp > 0);
      if (aliveParty.length === 0) break;
      const decision = selectVenomTyrantAction(params.boss, aliveParty, params.turn);
      const result = executeSkill(params.boss, decision.target, decision.skill);
      logs.push({
        id: undefined,
        battleSessionId: params.sessionId,
        turn: params.turn,
        actorName: params.boss.name,
        actionType: decision.skill.name,
        targetName: decision.target.name,
        damage: result.damage,
        healing: result.healing,
        logMessage: `${params.boss.name} used ${decision.skill.name} on ${decision.target.name}`,
      });
    } else {
      const rules = params.tacticsByCharacter[actor.id] ?? [];
      const resolution = evaluateTactics(
        actor,
        params.party,
        [params.boss],
        rules,
        params.skillMap,
        params.turn
      );
      if (!resolution.skill || !resolution.target) continue;
      const result = executeSkill(actor, resolution.target, resolution.skill);
      logs.push({
        id: undefined,
        battleSessionId: params.sessionId,
        turn: params.turn,
        actorName: actor.name,
        actionType: resolution.skill.name,
        targetName: resolution.target.name,
        damage: result.damage,
        healing: result.healing,
        logMessage: `${actor.name} used ${resolution.skill.name} on ${resolution.target.name}`,
      });
    }

    const partyAlive = params.party.some((unit) => unit.hp > 0);
    const bossAlive = params.boss.hp > 0;
    if (!partyAlive || !bossAlive) {
      return { logs, battleEnded: true, winner: bossAlive ? "boss" : "party" };
    }
  }

  return { logs, battleEnded: false, winner: null };
};

export const createBattleSessionId = (): string => generateId("battle");

export const createSkillMap = (skills: Skill[]): Map<string, Skill> => buildSkillMap(skills);

export const DEFAULT_SKILLS = ALL_SKILLS;
