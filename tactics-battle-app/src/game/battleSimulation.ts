import {
  Unit,
  getTurnOrder,
  regenerateMp,
  tickCooldownsOnTurnStart,
  tickEffectsOnTurnStart,
  tickStatusesOnTurnStart,
} from "@/game/battle";
import { EncounterEnemy } from "@/game/encounter";
import { Skill, executeSkill } from "@/game/skills";
import { evaluateTactics } from "@/game/tactics/evaluator";
import { BattleLogRecord, TacticsRuleRecord } from "@/types/models";
import { createSeededRng } from "@/utils/rng";

export type BattleOutcome = "WIN" | "LOSE" | "DRAW";

export type BattleSimulationParams = {
  sessionId: string;
  seed: number;
  party: Unit[];
  enemies: EncounterEnemy[];
  tacticsByCharacter: Record<string, TacticsRuleRecord[]>;
  skillMap: Map<string, Skill>;
  maxTurns?: number;
};

export type BattleSimulationResult = {
  outcome: BattleOutcome;
  turns: number;
  logs: BattleLogRecord[];
  finalParty: Unit[];
  finalEnemies: Unit[];
};

const BASIC_ATTACK: Skill = {
  id: "basic_attack",
  name: "Attack",
  type: "attack",
  target: "ENEMY",
  mpCost: 0,
  cooldown: 0,
  multiplier: 1,
  tags: ["basic"],
};

const cloneUnit = (unit: Unit): Unit => ({
  ...unit,
  stats: { ...unit.stats },
  statusEffects: unit.statusEffects.map((status) => ({ ...status })),
  effects: unit.effects.map((effect) => ({ ...effect })),
  cooldowns: { ...unit.cooldowns },
});

const createEncounterUnits = (enemies: EncounterEnemy[]): Unit[] => {
  const counts = new Map<string, number>();
  return enemies.map((enemy, index) => {
    const next = (counts.get(enemy.enemyId) ?? 0) + 1;
    counts.set(enemy.enemyId, next);
    const hasDup = enemies.some(
      (entry, entryIndex) => entry.enemyId === enemy.enemyId && entryIndex !== index
    );
    return {
      id: `enemy_${enemy.enemyId}_${index + 1}`,
      name: hasDup ? `${enemy.name} ${next}` : enemy.name,
      stats: { ...enemy.stats },
      hp: enemy.stats.maxHp,
      mp: enemy.stats.maxMp,
      statusEffects: [],
      effects: [],
      cooldowns: {},
      order: 100 + index,
    };
  });
};

const getAlive = (units: Unit[]): Unit[] => units.filter((unit) => unit.hp > 0);

const getLowestHpPercent = (units: Unit[]): Unit =>
  units.reduce((lowest, unit) =>
    unit.hp / Math.max(1, unit.stats.maxHp) < lowest.hp / Math.max(1, lowest.stats.maxHp)
      ? unit
      : lowest
  );

const createBattleLog = (
  sessionId: string,
  turn: number,
  actor: string,
  action: string,
  target: string | null,
  damage: number,
  healing: number,
  message: string
): BattleLogRecord => ({
  id: undefined,
  battleSessionId: sessionId,
  turn,
  actorName: actor,
  actionType: action,
  targetName: target,
  damage,
  healing,
  logMessage: message,
});

export const simulateBattle = (params: BattleSimulationParams): BattleSimulationResult => {
  const maxTurns = params.maxTurns ?? 50;
  const rng = createSeededRng(params.seed);
  const party = params.party.map(cloneUnit);
  const enemies = createEncounterUnits(params.enemies);
  const logs: BattleLogRecord[] = [];

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const units = [...party, ...enemies];
    const order = getTurnOrder(units);

    for (const entry of order) {
      const actor = entry.unit;
      if (actor.hp <= 0) continue;

      tickCooldownsOnTurnStart(actor);
      regenerateMp(actor);
      tickEffectsOnTurnStart(actor);
      const statusResult = tickStatusesOnTurnStart(actor);

      if (statusResult.poisonedDamage > 0) {
        logs.push(
          createBattleLog(
            params.sessionId,
            turn,
            actor.name,
            "POISON_TICK",
            actor.name,
            statusResult.poisonedDamage,
            0,
            `${actor.name} took ${statusResult.poisonedDamage} poison damage`
          )
        );
      }

      if (actor.hp <= 0) continue;
      if (statusResult.skippedAction) {
        logs.push(
          createBattleLog(
            params.sessionId,
            turn,
            actor.name,
            "SKIP",
            null,
            0,
            0,
            `${actor.name} is stunned and cannot act`
          )
        );
        continue;
      }

      const actorIsParty = party.some((member) => member.id === actor.id);
      if (actorIsParty) {
        const aliveParty = getAlive(party);
        const aliveEnemies = getAlive(enemies);
        if (aliveEnemies.length === 0) {
          return { outcome: "WIN", turns: turn, logs, finalParty: party, finalEnemies: enemies };
        }
        const rules = params.tacticsByCharacter[actor.id] ?? [];
        const resolution = evaluateTactics(
          actor,
          aliveParty,
          aliveEnemies,
          rules,
          params.skillMap,
          turn
        );
        if (!resolution.skill || !resolution.target) {
          // ルールがマッチしない場合は通常攻撃
          const target = getLowestHpPercent(aliveEnemies);
          const result = executeSkill(actor, target, BASIC_ATTACK, rng);
          logs.push(
            createBattleLog(
              params.sessionId,
              turn,
              actor.name,
              BASIC_ATTACK.name,
              target.name,
              result.damage,
              0,
              `${actor.name} attacked ${target.name}`
            )
          );
          continue;
        }
        const result = executeSkill(actor, resolution.target, resolution.skill, rng);
        logs.push(
          createBattleLog(
            params.sessionId,
            turn,
            actor.name,
            resolution.skill.name,
            resolution.target.name,
            result.damage,
            result.healing,
            `${actor.name} used ${resolution.skill.name} on ${resolution.target.name}`
          )
        );
      } else {
        const aliveParty = getAlive(party);
        if (aliveParty.length === 0) {
          return { outcome: "LOSE", turns: turn, logs, finalParty: party, finalEnemies: enemies };
        }
        const target = getLowestHpPercent(aliveParty);
        const result = executeSkill(actor, target, BASIC_ATTACK, rng);
        logs.push(
          createBattleLog(
            params.sessionId,
            turn,
            actor.name,
            BASIC_ATTACK.name,
            target.name,
            result.damage,
            0,
            `${actor.name} attacked ${target.name}`
          )
        );
      }

      const partyAlive = getAlive(party).length > 0;
      const enemiesAlive = getAlive(enemies).length > 0;
      if (!partyAlive || !enemiesAlive) {
        return {
          outcome: partyAlive ? "WIN" : "LOSE",
          turns: turn,
          logs,
          finalParty: party,
          finalEnemies: enemies,
        };
      }
    }
  }

  return {
    outcome: "DRAW",
    turns: maxTurns,
    logs,
    finalParty: party,
    finalEnemies: enemies,
  };
};
