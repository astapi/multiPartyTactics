import { DEFAULT_CONSTELLATION_ID, type ConstellationId } from "@/constants/constellations";
import { DUNGEONS } from "@/constants/dungeons";
import {
  type BossBattleOutcome,
  type ExplorationFloorProgress,
  type ExplorationSessionConfig,
  advanceExplorationStep,
  applyBossBattleResult,
  applyBossEncounterDecision,
  createExplorationSession,
} from "@/game/explorationSession";
import {
  createBossEncounter,
  generateEncounter,
  type EncounterResult,
  type EncounterScaleOverrides,
} from "@/game/encounter";
import { CLASS_DEFINITIONS } from "@/game/skills/classes";
import type { Skill } from "@/game/skills/types";
import { applyFixedDamage, applyStatus, type Unit } from "@/game/battle";
import { simulateBattle } from "@/game/battleSimulation";
import {
  applyExperienceToCharacter,
  calculateBattleExp,
  getBaseStatsForClassLevel,
  getTotalExpForLevel,
  type StatBlock,
} from "@/game/progression";
import { buildDefaultTacticsForClass } from "@/game/tactics/defaults";
import type { CharacterRecord, ClassId, TacticsRuleRecord } from "@/types/models";
import { createSeededRng } from "@/utils/rng";

export type SimulationPartyTemplate = {
  name: string;
  classId: ClassId;
  constellationId?: ConstellationId;
  level?: number;
};

export type MonsterScalingConfig = {
  statScaleMultiplier: number;
  statScaleAdd: number;
  statScalePerFloorAdd: number;
  hpScaleMultiplier: number;
  hpScaleAdd: number;
  hpScalePerFloorAdd: number;
  applyToBoss: boolean;
};

export type SimulationLossWeights = {
  remainingFloorPenalty: number;
  targetExplorationRuns: number;
  explorationRunDeviationPenalty: number;
  targetBattleTurns: number;
  battleTurnDeviationPenalty: number;
  targetLevel: number;
  targetLevelPenalty: number;
};

export type SimulationParameters = {
  dungeonId?: string;
  startFloor?: number;
  targetFloor?: number;
  maxFailuresPerFloor?: number;
  baseSeed?: number;
  battleMaxTurns?: number;
  explorationConfig?: Partial<ExplorationSessionConfig>;
  monsterScaling?: Partial<MonsterScalingConfig>;
  partyTemplates?: SimulationPartyTemplate[];
  lossWeights?: Partial<SimulationLossWeights>;
};

export type SimulationPartySnapshot = {
  id: string;
  name: string;
  classId: ClassId;
  constellationId: ConstellationId;
  level: number;
  exp: number;
  stats: StatBlock;
  currentHp: number;
  currentMp: number;
  statusEffects: Array<{ type: string; remainingTurns: number; potency?: number }>;
};

export type FloorAttemptSummary = {
  floor: number;
  runs: number;
  failures: number;
  stairsDiscovered: boolean;
  explorationPercent: number;
};

export type SimulationLossBreakdown = {
  remainingFloorPenalty: number;
  explorationRunDeviationPenalty: number;
  battleTurnDeviationPenalty: number;
  targetLevelDeviationPenalty: number;
  total: number;
};

export type DungeonSimulationResult = {
  completion: "TARGET_REACHED" | "FAILURE_LIMIT_REACHED";
  dungeonId: string;
  baseSeed: number;
  monsterScaling: MonsterScalingConfig;
  startFloor: number;
  targetFloor: number;
  reachedFloor: number;
  explorationRuns: number;
  battleCount: number;
  averageBattleTurns: number;
  totalFailures: number;
  failureCountOnFinalFloor: number;
  finalChallengeFloor: number;
  finalParty: SimulationPartySnapshot[];
  floorAttempts: FloorAttemptSummary[];
  floorProgress: ExplorationFloorProgress[];
  loss: SimulationLossBreakdown;
};

type LevelGoalMap = Record<string, number>;

type SimulationContext = {
  characters: CharacterRecord[];
  tacticsByCharacter: Record<string, TacticsRuleRecord[]>;
  skillMap: Map<string, Skill>;
};

type AdventureResult = {
  succeeded: boolean;
  qualifiedForFloorAdvance: boolean;
  failureReason: "DEFEAT" | "RUN_TIMEOUT" | "NO_BATTLE_VICTORY" | null;
  floor: number;
  floorProgress: ExplorationFloorProgress;
  characters: CharacterRecord[];
  runParty: Unit[];
  encounterCount: number;
  bossEncounterCount: number;
  battleVictoryCount: number;
  battleCount: number;
  totalBattleTurns: number;
};

export const DEFAULT_SIMULATION_PARTY: SimulationPartyTemplate[] = [
  { name: "Aegis", classId: "GUARDIAN" },
  { name: "Blade", classId: "SWORDMAN" },
  { name: "Rage", classId: "BERSERKER" },
  { name: "Grace", classId: "CLERIC" },
  { name: "Nova", classId: "WITCH" },
  { name: "Shade", classId: "THIEF" },
];

export const DEFAULT_SIMULATION_LOSS_WEIGHTS: SimulationLossWeights = {
  remainingFloorPenalty: 10000,
  targetExplorationRuns: 120 * 40,
  explorationRunDeviationPenalty: 5,
  targetBattleTurns: 4,
  battleTurnDeviationPenalty: 500,
  targetLevel: 100,
  targetLevelPenalty: 200,
};

export const DEFAULT_MONSTER_SCALING: MonsterScalingConfig = {
  statScaleMultiplier: 1,
  statScaleAdd: 0,
  statScalePerFloorAdd: 0,
  hpScaleMultiplier: 1,
  hpScaleAdd: 0,
  hpScalePerFloorAdd: 0,
  applyToBoss: true,
};

const DEFAULT_PARAMETERS: Required<
  Pick<
    SimulationParameters,
    "dungeonId" | "startFloor" | "targetFloor" | "maxFailuresPerFloor" | "battleMaxTurns"
  >
> = {
  dungeonId: "crestoria_dungeon_1_200",
  startFloor: 1,
  targetFloor: 120,
  maxFailuresPerFloor: 50,
  battleMaxTurns: 50,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const toCharacterRecord = (template: SimulationPartyTemplate, slotIndex: number): CharacterRecord => {
  const level = Math.max(1, Math.floor(template.level ?? 1));
  const constellationId = template.constellationId ?? DEFAULT_CONSTELLATION_ID;
  const stats = getBaseStatsForClassLevel(template.classId, level, constellationId);
  return {
    id: `sim-char-${slotIndex + 1}`,
    slotIndex,
    name: template.name,
    classId: template.classId,
    constellationId,
    level,
    exp: getTotalExpForLevel(level),
    baseMaxHp: stats.maxHp,
    baseAtk: stats.atk,
    baseDef: stats.def,
    baseSpi: stats.spi,
    baseSpd: stats.spd,
    baseMaxMp: stats.maxMp,
    baseMpRegen: stats.mpRegen,
    currentHp: stats.maxHp,
    currentMp: stats.maxMp,
    age: 18,
    growthMultiplier: 1,
    traitIds: [],
    innateHpRate: 1,
    innateAtkBonus: 0,
    innateDefBonus: 0,
    innateSpiBonus: 0,
    innateSpdBonus: 0,
  };
};

const createSkillMap = (): Map<string, Skill> =>
  new Map(
    CLASS_DEFINITIONS.flatMap((definition) =>
      definition.skills.map((skill) => [skill.id, skill] as const)
    )
  );

const createSimulationContext = (partyTemplates: SimulationPartyTemplate[] = DEFAULT_SIMULATION_PARTY): SimulationContext => {
  const characters = partyTemplates.map(toCharacterRecord);
  const tacticsByCharacter = Object.fromEntries(
    characters.map((character) => [
      character.id,
      buildDefaultTacticsForClass(character.id, character.classId),
    ])
  ) as Record<string, TacticsRuleRecord[]>;

  return {
    characters,
    tacticsByCharacter,
    skillMap: createSkillMap(),
  };
};

const toFullRunUnit = (character: CharacterRecord): Unit => ({
  id: character.id,
  name: character.name,
  classId: character.classId,
  stats: {
    maxHp: character.baseMaxHp,
    atk: character.baseAtk,
    def: character.baseDef,
    spi: character.baseSpi,
    spd: character.baseSpd,
    maxMp: character.baseMaxMp,
    mpRegen: character.baseMpRegen,
  },
  hp: character.baseMaxHp,
  mp: character.baseMaxMp,
  statusEffects: [],
  effects: [],
  cooldowns: {},
  order: (character.slotIndex ?? 0) + 1,
});

const syncRunPartyState = (runParty: Unit[], battleParty: Unit[]): Unit[] => {
  const battlePartyById = new Map(battleParty.map((unit) => [unit.id, unit] as const));
  return runParty.map((unit) => {
    const fromBattle = battlePartyById.get(unit.id);
    if (!fromBattle) return unit;
    return {
      ...fromBattle,
      stats: { ...fromBattle.stats },
      statusEffects: fromBattle.statusEffects.map((status) => ({ ...status })),
      effects: fromBattle.effects.map((effect) => ({ ...effect })),
      cooldowns: { ...fromBattle.cooldowns },
    };
  });
};

const applyExperienceRewards = (
  characters: CharacterRecord[],
  runParty: Unit[],
  gainedExp: number
): { characters: CharacterRecord[]; runParty: Unit[] } => {
  const nextCharacters = characters.map((character) => applyExperienceToCharacter(character, gainedExp).character);
  const nextRunParty = runParty.map((unit) => {
    const updatedCharacter = nextCharacters.find((character) => character.id === unit.id);
    if (!updatedCharacter) return unit;
    return {
      ...unit,
      stats: {
        maxHp: updatedCharacter.baseMaxHp,
        atk: updatedCharacter.baseAtk,
        def: updatedCharacter.baseDef,
        spi: updatedCharacter.baseSpi,
        spd: updatedCharacter.baseSpd,
        maxMp: updatedCharacter.baseMaxMp,
        mpRegen: updatedCharacter.baseMpRegen,
      },
      hp: Math.min(unit.hp, updatedCharacter.baseMaxHp),
      mp: Math.min(unit.mp, updatedCharacter.baseMaxMp),
    };
  });
  return { characters: nextCharacters, runParty: nextRunParty };
};

const applyTrapToRunParty = (
  runParty: Unit[],
  seed: number,
  floor: number,
  step: number,
  damage: number,
  debuffType?: string
): Unit[] => {
  const alive = runParty.filter((unit) => unit.hp > 0);
  if (alive.length === 0) return runParty;
  const rng = createSeededRng((seed ^ Math.imul(floor, 8191) ^ Math.imul(step, 131071)) >>> 0);
  const target = alive[Math.floor(rng() * alive.length)] ?? alive[0];
  applyFixedDamage(target, damage);
  if (debuffType === "POISON" && target.hp > 0) {
    applyStatus(target, {
      type: "POISON",
      remainingTurns: 3,
      potency: Math.max(1, Math.floor(damage / 2)),
    });
  }
  return [...runParty];
};

const getLatestFloorProgress = (
  progressMap: Record<number, ExplorationFloorProgress>,
  floor: number
): ExplorationFloorProgress =>
  progressMap[floor] ?? {
    floor,
    explorationPercent: 0,
    stairsDiscovered: false,
  };

const getPersistedFloorProgress = (
  progressMap: Map<number, ExplorationFloorProgress>,
  floor: number
): ExplorationFloorProgress | undefined => progressMap.get(floor);

const toEncounterScaleOverrides = (
  scaling: MonsterScalingConfig,
  options: { applyToBoss: boolean }
): EncounterScaleOverrides | undefined => {
  if (!options.applyToBoss && !scaling.applyToBoss) {
    return undefined;
  }

  return {
    statScaleMultiplier: scaling.statScaleMultiplier,
    statScaleAdd: scaling.statScaleAdd,
    statScalePerFloorAdd: scaling.statScalePerFloorAdd,
    hpScaleMultiplier: scaling.hpScaleMultiplier,
    hpScaleAdd: scaling.hpScaleAdd,
    hpScalePerFloorAdd: scaling.hpScalePerFloorAdd,
  };
};

const resolveBossOutcome = (encounterResult: ReturnType<typeof simulateBattle>): BossBattleOutcome => {
  switch (encounterResult.outcome) {
    case "WIN":
      return "WIN";
    case "LOSE":
      return "LOSE";
    case "DRAW":
    default:
      return "DRAW";
  }
};

const runSingleAdventure = (params: {
  dungeonId: string;
  floor: number;
  seed: number;
  battleMaxTurns: number;
  explorationConfig?: Partial<ExplorationSessionConfig>;
  monsterScaling: MonsterScalingConfig;
  persistedProgress: ExplorationFloorProgress[];
  context: SimulationContext;
}): AdventureResult => {
  const dungeon = DUNGEONS.find((entry) => entry.id === params.dungeonId);
  if (!dungeon) {
    throw new Error(`Unknown dungeon id: ${params.dungeonId}`);
  }

  let characters = params.context.characters.map((character) => ({ ...character }));
  let runParty = characters.map(toFullRunUnit);
  let encounterCount = 0;
  let bossEncounterCount = 0;
  let battleVictoryCount = 0;
  let battleCount = 0;
  let totalBattleTurns = 0;

  let session = createExplorationSession({
    dungeon,
    party: runParty,
    floor: params.floor,
    seed: params.seed,
    config: params.explorationConfig,
    persistedProgress: params.persistedProgress,
  });

  while (true) {
    if (session.status === "RUNNING") {
      const eventCountBefore = session.events.length;
      const encounterCountBefore = session.encounters.length;
      session = advanceExplorationStep(session);
      const latestEvent = session.events.at(-1);
      const latestEncounter =
        session.encounters.length > encounterCountBefore ? session.encounters.at(-1) : undefined;

      if (session.events.length > eventCountBefore && latestEvent?.type === "ENCOUNTER" && latestEncounter) {
        encounterCount += 1;
        const scaledEncounter = generateEncounter({
          dungeonId: params.dungeonId,
          floor: params.floor,
          seed: (params.seed + session.currentStep * 1009) >>> 0,
          scaleOverrides: toEncounterScaleOverrides(params.monsterScaling, { applyToBoss: true }),
        });
        const battle = simulateBattle({
          sessionId: `sim-floor-${params.floor}-step-${session.currentStep}-encounter-${encounterCount}`,
          seed: (params.seed ^ Math.imul(session.currentStep, 3571) ^ encounterCount) >>> 0,
          party: runParty,
          enemies: scaledEncounter.enemies,
          tacticsByCharacter: params.context.tacticsByCharacter,
          skillMap: params.context.skillMap,
          maxTurns: params.battleMaxTurns,
        });
        battleCount += 1;
        totalBattleTurns += battle.turns;
        runParty = syncRunPartyState(runParty, battle.finalParty);
        if (battle.outcome !== "WIN") {
          return {
            succeeded: false,
            qualifiedForFloorAdvance: false,
            failureReason: "DEFEAT",
            floor: params.floor,
            floorProgress: getLatestFloorProgress(session.floorProgressMap, params.floor),
            characters,
            runParty,
            encounterCount,
            bossEncounterCount,
            battleVictoryCount,
            battleCount,
            totalBattleTurns,
          };
        }
        battleVictoryCount += 1;
        const gainedExp = calculateBattleExp({
          floor: params.floor,
          enemyCount: scaledEncounter.enemies.length,
        });
        const rewarded = applyExperienceRewards(characters, runParty, gainedExp);
        characters = rewarded.characters;
        runParty = rewarded.runParty;
        continue;
      }

      if (session.events.length > eventCountBefore && latestEvent?.type === "TRAP") {
        runParty = applyTrapToRunParty(
          runParty,
          params.seed,
          params.floor,
          session.currentStep,
          latestEvent.payload?.damage ?? 0,
          latestEvent.payload?.debuffType
        );
        if (runParty.every((unit) => unit.hp <= 0)) {
          return {
            succeeded: false,
            qualifiedForFloorAdvance: false,
            failureReason: "DEFEAT",
            floor: params.floor,
            floorProgress: getLatestFloorProgress(session.floorProgressMap, params.floor),
            characters,
            runParty,
            encounterCount,
            bossEncounterCount,
            battleVictoryCount,
            battleCount,
            totalBattleTurns,
          };
        }
      }

      if (session.status === "FLOOR_CLEARED") {
        return {
          succeeded: true,
          qualifiedForFloorAdvance: battleVictoryCount > 0,
          failureReason: battleVictoryCount > 0 ? null : "NO_BATTLE_VICTORY",
          floor: params.floor,
          floorProgress: getLatestFloorProgress(session.floorProgressMap, params.floor),
          characters,
          runParty,
          encounterCount,
          bossEncounterCount,
          battleVictoryCount,
          battleCount,
          totalBattleTurns,
        };
      }

      continue;
    }

    if (session.status === "AWAITING_BOSS_DECISION") {
      session = applyBossEncounterDecision(session, "FIGHT");
      continue;
    }

    if (session.status === "AWAITING_BOSS_RESULT") {
      const encounter = createBossEncounter({
        dungeonId: params.dungeonId,
        floor: params.floor,
        seed: (params.seed ^ Math.imul(session.currentStep, 4099) ^ Math.imul(params.floor, 65537)) >>> 0,
        scaleOverrides: toEncounterScaleOverrides(params.monsterScaling, {
          applyToBoss: params.monsterScaling.applyToBoss,
        }),
      });
      bossEncounterCount += 1;
      const battle = simulateBattle({
        sessionId: `sim-floor-${params.floor}-boss-${bossEncounterCount}`,
        seed: (params.seed ^ Math.imul(session.currentStep, 6949) ^ bossEncounterCount) >>> 0,
        party: runParty,
        enemies: encounter.enemies,
        tacticsByCharacter: params.context.tacticsByCharacter,
        skillMap: params.context.skillMap,
        maxTurns: params.battleMaxTurns,
      });
      battleCount += 1;
      totalBattleTurns += battle.turns;
      runParty = syncRunPartyState(runParty, battle.finalParty);
      const bossOutcome = resolveBossOutcome(battle);
      session = applyBossBattleResult(session, bossOutcome);
      if (bossOutcome !== "WIN") {
        return {
          succeeded: false,
          qualifiedForFloorAdvance: false,
          failureReason: "DEFEAT",
          floor: params.floor,
          floorProgress: getLatestFloorProgress(session.floorProgressMap, params.floor),
          characters,
          runParty,
          encounterCount,
          bossEncounterCount,
          battleVictoryCount,
          battleCount,
          totalBattleTurns,
        };
      }
      battleVictoryCount += 1;
      const gainedExp = calculateBattleExp({
        floor: params.floor,
        enemyCount: encounter.enemies.length,
      });
      const rewarded = applyExperienceRewards(characters, runParty, gainedExp);
      characters = rewarded.characters;
      runParty = rewarded.runParty;
      if (session.status === "FLOOR_CLEARED") {
        return {
          succeeded: true,
          qualifiedForFloorAdvance: true,
          failureReason: null,
          floor: params.floor,
          floorProgress: getLatestFloorProgress(session.floorProgressMap, params.floor),
          characters,
          runParty,
          encounterCount,
          bossEncounterCount,
          battleVictoryCount,
          battleCount,
          totalBattleTurns,
        };
      }
      continue;
    }

    return {
      succeeded: false,
      qualifiedForFloorAdvance: false,
      failureReason: "RUN_TIMEOUT",
      floor: params.floor,
      floorProgress: getLatestFloorProgress(session.floorProgressMap, params.floor),
      characters,
      runParty,
      encounterCount,
      bossEncounterCount,
      battleVictoryCount,
      battleCount,
      totalBattleTurns,
    };
  }
};

const toPartySnapshot = (characters: CharacterRecord[], runParty: Unit[]): SimulationPartySnapshot[] => {
  const runPartyById = new Map(runParty.map((unit) => [unit.id, unit] as const));
  return characters.map((character) => {
    const runtime = runPartyById.get(character.id);
    return {
      id: character.id,
      name: character.name,
      classId: character.classId,
      constellationId: character.constellationId,
      level: character.level,
      exp: character.exp,
      stats: {
        maxHp: character.baseMaxHp,
        atk: character.baseAtk,
        def: character.baseDef,
        spi: character.baseSpi,
        spd: character.baseSpd,
        maxMp: character.baseMaxMp,
        mpRegen: character.baseMpRegen,
      },
      currentHp: runtime?.hp ?? character.baseMaxHp,
      currentMp: runtime?.mp ?? character.baseMaxMp,
      statusEffects:
        runtime?.statusEffects.map((status) => ({
          type: status.type,
          remainingTurns: status.remainingTurns,
          potency: status.potency,
        })) ?? [],
    };
  });
};

export const calculateSimulationLoss = (
  result: Pick<
    DungeonSimulationResult,
    "targetFloor" | "reachedFloor" | "explorationRuns" | "averageBattleTurns" | "battleCount" | "totalFailures" | "failureCountOnFinalFloor" | "finalParty"
  >,
  lossWeights: Partial<SimulationLossWeights> = {}
): SimulationLossBreakdown => {
  const weights = { ...DEFAULT_SIMULATION_LOSS_WEIGHTS, ...lossWeights };
  const remainingFloors = Math.max(0, result.targetFloor - result.reachedFloor);
  const averageLevel =
    result.finalParty.length > 0
      ? result.finalParty.reduce((sum, member) => sum + member.level, 0) / result.finalParty.length
      : 0;
  const targetLevelDeviation =
    result.reachedFloor >= result.targetFloor
      ? Math.abs(averageLevel - weights.targetLevel)
      : 0;
  const explorationRunDeviation = Math.abs(result.explorationRuns - weights.targetExplorationRuns);
  const battleTurnDeviation =
    result.battleCount > 0 ? Math.abs(result.averageBattleTurns - weights.targetBattleTurns) : weights.targetBattleTurns;

  const breakdown = {
    remainingFloorPenalty: remainingFloors * weights.remainingFloorPenalty,
    explorationRunDeviationPenalty:
      explorationRunDeviation * weights.explorationRunDeviationPenalty,
    battleTurnDeviationPenalty:
      battleTurnDeviation * weights.battleTurnDeviationPenalty,
    targetLevelDeviationPenalty: targetLevelDeviation * weights.targetLevelPenalty,
  };

  return {
    ...breakdown,
    total:
      breakdown.remainingFloorPenalty +
      breakdown.explorationRunDeviationPenalty +
      breakdown.battleTurnDeviationPenalty +
      breakdown.targetLevelDeviationPenalty,
  };
};

export const runDungeonAutoSimulation = (
  parameters: SimulationParameters = {}
): DungeonSimulationResult => {
  const params = {
    ...DEFAULT_PARAMETERS,
    ...parameters,
  };
  const dungeon = DUNGEONS.find((entry) => entry.id === params.dungeonId);
  if (!dungeon) {
    throw new Error(`Unknown dungeon id: ${params.dungeonId}`);
  }
  const baseSeed =
    parameters.baseSeed !== undefined
      ? parameters.baseSeed >>> 0
      : Math.floor(Math.random() * 0x1_0000_0000) >>> 0;

  const startFloor = clamp(Math.floor(params.startFloor), 1, dungeon.floors);
  const targetFloor = clamp(Math.floor(params.targetFloor), startFloor, dungeon.floors);
  const context = createSimulationContext(parameters.partyTemplates);
  const monsterScaling: MonsterScalingConfig = {
    ...DEFAULT_MONSTER_SCALING,
    ...(parameters.monsterScaling ?? {}),
  };

  let currentFloor = startFloor;
  let maxReachedFloor = startFloor;
  let explorationRuns = 0;
  let totalBattleTurns = 0;
  let battleCount = 0;
  let totalFailures = 0;
  let lastRunParty = context.characters.map(toFullRunUnit);
  let characters = context.characters;
  const floorProgressMap = new Map<number, ExplorationFloorProgress>();
  const floorAttemptsMap = new Map<number, FloorAttemptSummary>();
  let retryFloor: number | null = null;
  let trainingFloor: number | null = null;
  let retryLevelGoals: LevelGoalMap | null = null;

  const getFailureCountForFloor = (floor: number): number =>
    floorAttemptsMap.get(floor)?.failures ?? 0;

  const hasReachedRetryGoals = (nextCharacters: CharacterRecord[], goals: LevelGoalMap | null): boolean => {
    if (!goals) return true;
    return nextCharacters.every((character) => character.level >= (goals[character.id] ?? character.level));
  };

  while (currentFloor < targetFloor && getFailureCountForFloor(currentFloor) < params.maxFailuresPerFloor) {
    const persistedCurrentFloorProgress = getPersistedFloorProgress(floorProgressMap, currentFloor);
    if (persistedCurrentFloorProgress?.stairsDiscovered && retryFloor === null) {
      currentFloor += 1;
      maxReachedFloor = Math.max(maxReachedFloor, currentFloor);
      continue;
    }

    explorationRuns += 1;
    const seed = (baseSeed + explorationRuns - 1) >>> 0;
    const persistedProgress = floorProgressMap.size > 0 ? [...floorProgressMap.values()] : [];
    const adventure = runSingleAdventure({
      dungeonId: params.dungeonId,
      floor: currentFloor,
      seed,
      battleMaxTurns: params.battleMaxTurns,
      explorationConfig: parameters.explorationConfig,
      monsterScaling,
      persistedProgress,
      context: {
        ...context,
        characters,
      },
    });

    characters = adventure.characters;
    lastRunParty = adventure.runParty;
    totalBattleTurns += adventure.totalBattleTurns;
    battleCount += adventure.battleCount;

    const persistedFloorProgress = adventure.succeeded && adventure.qualifiedForFloorAdvance
      ? adventure.floorProgress
      : {
          ...adventure.floorProgress,
          stairsDiscovered: false,
        };
    floorProgressMap.set(currentFloor, persistedFloorProgress);

    const floorSummary = floorAttemptsMap.get(currentFloor) ?? {
      floor: currentFloor,
      runs: 0,
      failures: 0,
      stairsDiscovered: false,
      explorationPercent: 0,
    };
    floorSummary.runs += 1;
    floorSummary.stairsDiscovered = persistedFloorProgress.stairsDiscovered;
    floorSummary.explorationPercent = persistedFloorProgress.explorationPercent;

    if (adventure.succeeded && adventure.qualifiedForFloorAdvance) {
      floorAttemptsMap.set(currentFloor, floorSummary);
      if (retryFloor !== null) {
        if (hasReachedRetryGoals(characters, retryLevelGoals)) {
          currentFloor = retryFloor;
          maxReachedFloor = Math.max(maxReachedFloor, currentFloor);
          retryFloor = null;
          trainingFloor = null;
          retryLevelGoals = null;
        } else if (trainingFloor !== null) {
          currentFloor = trainingFloor;
        }
      } else {
        currentFloor += 1;
        maxReachedFloor = Math.max(maxReachedFloor, currentFloor);
      }
      continue;
    }

    floorSummary.failures += 1;
    floorAttemptsMap.set(currentFloor, floorSummary);
    totalFailures += 1;

    if (adventure.failureReason === "DEFEAT" && currentFloor > startFloor) {
      const nextRetryFloor: number = retryFloor === null ? currentFloor : retryFloor;
      const nextTrainingFloor = Math.max(startFloor, nextRetryFloor - 1);
      retryFloor = nextRetryFloor;
      retryLevelGoals = Object.fromEntries(
        characters.map((character) => [character.id, character.level + 1])
      );
      trainingFloor = nextTrainingFloor;
      currentFloor = nextTrainingFloor;
    }
  }

  const completion =
    currentFloor >= targetFloor ? "TARGET_REACHED" : "FAILURE_LIMIT_REACHED";
  const reachedFloor = currentFloor >= targetFloor ? targetFloor : maxReachedFloor;
  const finalParty = toPartySnapshot(characters, lastRunParty);
  const averageBattleTurns = battleCount > 0 ? totalBattleTurns / battleCount : 0;
  const result: DungeonSimulationResult = {
    completion,
    dungeonId: params.dungeonId,
    baseSeed,
    monsterScaling,
    startFloor,
    targetFloor,
    reachedFloor,
    explorationRuns,
    battleCount,
    averageBattleTurns,
    totalFailures,
    failureCountOnFinalFloor: getFailureCountForFloor(currentFloor),
    finalChallengeFloor: currentFloor,
    finalParty,
    floorAttempts: [...floorAttemptsMap.values()].sort((a, b) => a.floor - b.floor),
    floorProgress: [...floorProgressMap.values()].sort((a, b) => a.floor - b.floor),
    loss: {
      remainingFloorPenalty: 0,
      explorationRunDeviationPenalty: 0,
      battleTurnDeviationPenalty: 0,
      targetLevelDeviationPenalty: 0,
      total: 0,
    },
  };
  result.loss = calculateSimulationLoss(result, parameters.lossWeights);
  return result;
};

export const buildDefaultSimulationParty = (): SimulationContext => createSimulationContext();
