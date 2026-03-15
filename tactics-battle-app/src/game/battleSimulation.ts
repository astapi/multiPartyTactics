import {
  Unit,
  getTurnOrder,
  regenerateMp,
  tickCooldownsOnTurnStart,
  tickEffectsOnTurnStart,
  tickStatusesOnTurnStart,
} from "@/game/battle";
import { EncounterEnemy } from "@/game/encounter";
import type { Skill } from "@/game/skills/types";
import { executeSkill } from "@/game/skills/execute";
import { evaluateTactics } from "@/game/tactics/evaluator";
import { mapAttackStyleFromUnit } from "@/features/battle/animation/mapAttackStyle";
import type { BattleVisualEvent } from "@/features/battle/animation/types";
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
  visualEvents: BattleVisualEvent[];
  finalParty: Unit[];
  finalEnemies: Unit[];
  replayStates: BattleReplayState[];
  outcomeRevealLogCount: number;
};

export type BattleReplayState = {
  turn: number;
  party: Unit[];
  enemies: Unit[];
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

const snapshotState = (turn: number, party: Unit[], enemies: Unit[]): BattleReplayState => ({
  turn,
  party: party.map(cloneUnit),
  enemies: enemies.map(cloneUnit),
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
const isAreaSkill = (skill: Skill): boolean =>
  skill.area === "ALLY_ALL" ||
  skill.area === "ALL_ENEMIES" ||
  skill.area === "ENEMY_ROW" ||
  skill.area === "RANDOM_ENEMY";

const getLowestHpPercent = (units: Unit[]): Unit =>
  units.reduce((lowest, unit) =>
    unit.hp / Math.max(1, unit.stats.maxHp) < lowest.hp / Math.max(1, lowest.stats.maxHp)
      ? unit
      : lowest
  );

const getEnemyTargetWeight = (unit: Unit): number => {
  // Party units use `order = slotIndex + 1` (1..6). Front slots are easier to target.
  const position = Math.max(1, Math.min(6, unit.order));
  return 7 - position;
};

const pickWeightedPartyTarget = (units: Unit[], rng: () => number): Unit => {
  const weights = units.map(getEnemyTargetWeight);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return units[0];

  let roll = rng() * total;
  for (let i = 0; i < units.length; i += 1) {
    roll -= weights[i];
    if (roll < 0) {
      return units[i];
    }
  }
  return units[units.length - 1];
};

const createBattleLog = (
  sessionId: string,
  turn: number,
  actorId: string | null,
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
  actorId,
  actorName: actor,
  actionType: action,
  targetName: target,
  damage,
  healing,
  logMessage: message,
});

const getBattleOutcomeLogKey = (outcome: BattleOutcome): string => {
  switch (outcome) {
    case "WIN":
      return "battle.log.result_win";
    case "LOSE":
      return "battle.log.result_lose";
    case "DRAW":
      return "battle.log.result_draw";
    default:
      return "battle.log.result_draw";
  }
};

const shouldSplitAttackLogs = (skill: Skill): boolean =>
  skill.type === "attack" && skill.area === "RANDOM_ENEMY";

const aggregateHitResultsByTarget = (
  hitResults: Array<{ targetId: string; targetName: string; damage: number }>
): Array<{ targetId: string; targetName: string; damage: number }> => {
  const aggregated = new Map<string, { targetId: string; targetName: string; damage: number }>();
  for (const hit of hitResults) {
    const current = aggregated.get(hit.targetId);
    if (current) {
      current.damage += hit.damage;
      continue;
    }
    aggregated.set(hit.targetId, { ...hit });
  }
  return [...aggregated.values()];
};

export const simulateBattle = (params: BattleSimulationParams): BattleSimulationResult => {
  const maxTurns = params.maxTurns ?? 50;
  const rng = createSeededRng(params.seed);
  const party = params.party.map(cloneUnit);
  const enemies = createEncounterUnits(params.enemies);
  const logs: BattleLogRecord[] = [];
  const visualEvents: BattleVisualEvent[] = [];
  const replayStates: BattleReplayState[] = [snapshotState(0, party, enemies)];

  const pushLog = (
    log: BattleLogRecord,
    turn: number,
    buildVisualEvents?: (logIndex: number) => BattleVisualEvent[]
  ) => {
    logs.push(log);
    const logIndex = logs.length - 1;
    if (buildVisualEvents) {
      visualEvents.push(...buildVisualEvents(logIndex));
    }
    replayStates.push(snapshotState(turn, party, enemies));
  };

  const finalizeBattle = (outcome: BattleOutcome, turn: number): BattleSimulationResult => {
    pushLog(
      createBattleLog(
        params.sessionId,
        turn,
        null,
        "SYSTEM",
        `RESULT_${outcome}`,
        null,
        0,
        0,
        getBattleOutcomeLogKey(outcome)
      ),
      turn
    );
    return {
      outcome,
      turns: turn,
      logs,
      visualEvents,
      finalParty: party,
      finalEnemies: enemies,
      replayStates,
      outcomeRevealLogCount: logs.length,
    };
  };

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
        pushLog(
          createBattleLog(
            params.sessionId,
            turn,
            actor.id,
            actor.name,
            "POISON_TICK",
            actor.name,
            statusResult.poisonedDamage,
            0,
            "battle.log.poison_tick"
          ),
          turn
        );
      }

      if (actor.hp <= 0) continue;
      if (statusResult.skippedAction) {
        pushLog(
          createBattleLog(
            params.sessionId,
            turn,
            actor.id,
            actor.name,
            "SKIP",
            null,
            0,
            0,
            "battle.log.skip_stun"
          ),
          turn
        );
        continue;
      }

      const actorIsParty = party.some((member) => member.id === actor.id);
      if (actorIsParty) {
        const aliveParty = getAlive(party);
        const aliveEnemies = getAlive(enemies);
        if (aliveEnemies.length === 0) {
          return finalizeBattle("WIN", turn);
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
          const result = executeSkill(actor, target, BASIC_ATTACK, rng, {
            allies: aliveParty,
            opponents: aliveEnemies,
          });
          pushLog(
            createBattleLog(
              params.sessionId,
              turn,
              actor.id,
              actor.name,
              BASIC_ATTACK.id,
              result.resolvedTargetIds.length > 1 ? null : target.name,
              result.damage,
              0,
              "battle.log.basic_attack"
            ),
            turn,
            (logIndex) =>
              createBasicAttackVisualEvents({
                turn,
                logIndex,
                actorId: actor.id,
                targetIds: result.resolvedTargetIds,
                damage: result.damage,
                attackStyle: mapAttackStyleFromUnit(actor),
              })
          );
          continue;
        }
        const result = executeSkill(actor, resolution.target, resolution.skill, rng, {
          allies: aliveParty,
          opponents: aliveEnemies,
        });
        if (shouldSplitAttackLogs(resolution.skill)) {
          const hitRows = aggregateHitResultsByTarget(result.hitResults);
          pushLog(
            createBattleLog(
              params.sessionId,
              turn,
              actor.id,
              actor.name,
              resolution.skill.id,
              null,
              0,
              0,
              "battle.log.skill_use"
            ),
            turn
          );
          for (const hit of hitRows) {
            pushLog(
              createBattleLog(
                params.sessionId,
                turn,
                actor.id,
                actor.name,
                resolution.skill.id,
                hit.targetName,
                hit.damage,
                0,
                "battle.log.damage_target"
              ),
              turn
            );
          }
          continue;
        }
        const isArea = isAreaSkill(resolution.skill) || result.resolvedTargetIds.length > 1;
        pushLog(
          createBattleLog(
            params.sessionId,
            turn,
            actor.id,
            actor.name,
            resolution.skill.id,
            isArea ? null : resolution.target.name,
            result.damage,
            result.healing,
            isArea ? "battle.log.skill_use" : "battle.log.skill_use_target"
          ),
          turn
        );
      } else {
        const aliveParty = getAlive(party);
        if (aliveParty.length === 0) {
          return finalizeBattle("LOSE", turn);
        }
        const target = pickWeightedPartyTarget(aliveParty, rng);
        const aliveEnemies = getAlive(enemies);
        const result = executeSkill(actor, target, BASIC_ATTACK, rng, {
          allies: aliveEnemies,
          opponents: aliveParty,
        });
        pushLog(
          createBattleLog(
            params.sessionId,
            turn,
            actor.id,
            actor.name,
            BASIC_ATTACK.id,
            result.resolvedTargetIds.length > 1 ? null : target.name,
            result.damage,
            0,
            "battle.log.basic_attack"
          ),
          turn,
          (logIndex) =>
            createBasicAttackVisualEvents({
              turn,
              logIndex,
              actorId: actor.id,
              targetIds: result.resolvedTargetIds,
              damage: result.damage,
              attackStyle: mapAttackStyleFromUnit(actor),
            })
        );
      }

      const partyAlive = getAlive(party).length > 0;
      const enemiesAlive = getAlive(enemies).length > 0;
      if (!partyAlive || !enemiesAlive) {
        return finalizeBattle(partyAlive ? "WIN" : "LOSE", turn);
      }
    }
  }

  return finalizeBattle("DRAW", maxTurns);
};

const createBasicAttackVisualEvents = (params: {
  turn: number;
  logIndex: number;
  actorId: string;
  targetIds: string[];
  damage: number;
  attackStyle: BattleVisualEvent["attackStyle"];
}): BattleVisualEvent[] => {
  if (params.targetIds.length === 0) return [];

  const events: BattleVisualEvent[] = [
    {
      kind: "attack_trail",
      turn: params.turn,
      logIndex: params.logIndex,
      actorId: params.actorId,
      targetIds: [...params.targetIds],
      attackStyle: params.attackStyle ?? "generic",
    },
    {
      kind: "hit_flash",
      turn: params.turn,
      logIndex: params.logIndex,
      actorId: params.actorId,
      targetIds: [...params.targetIds],
      attackStyle: params.attackStyle ?? "generic",
    },
    {
      kind: "hit_reaction",
      turn: params.turn,
      logIndex: params.logIndex,
      actorId: params.actorId,
      targetIds: [...params.targetIds],
      attackStyle: params.attackStyle ?? "generic",
    },
  ];

  if (params.damage > 0) {
    events.push({
      kind: "damage_number",
      turn: params.turn,
      logIndex: params.logIndex,
      actorId: params.actorId,
      targetIds: [...params.targetIds],
      amount: params.damage,
      attackStyle: params.attackStyle ?? "generic",
    });
  }

  return events;
};
