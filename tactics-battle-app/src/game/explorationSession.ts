import difficultyConfig from "@/data/difficultyConfig.json";
import { DungeonOption } from "@/constants/dungeons";
import { Unit } from "@/game/battle";
import {
  ExplorationEvent,
  ExplorationResult,
  rollExplorationEvent,
} from "@/game/exploration";
import { EncounterResult, createBossEncounter } from "@/game/encounter";
import { createSeededRng } from "@/utils/rng";

export type ExplorationFloorProgress = {
  floor: number;
  explorationPercent: number;
  stairsDiscovered: boolean;
};

export type ExplorationSessionStatus =
  | "RUNNING"
  | "AWAITING_BOSS_DECISION"
  | "AWAITING_BOSS_RESULT"
  | "RUN_COMPLETE"
  | "FLOOR_CLEARED";

export type BossEncounterDecision = "FIGHT" | "CONTINUE";
export type BossBattleOutcome = "WIN" | "LOSE" | "DRAW";

export type ExplorationSessionConfig = {
  stepsPerRun: number;
  stairsDiscoveryThresholdPercent: number;
  fullExplorationPercent: number;
  explorationPercentGainPerStep: number;
  shortcutStepCostPerDiscoveredFloor: number;
  discoveredStairsArrivalMinSteps: number;
  discoveredStairsArrivalMaxSteps: number;
};

export type ExplorationSessionState = {
  seed: number;
  dungeon: DungeonOption;
  party: Unit[];
  config: ExplorationSessionConfig;
  currentFloor: number;
  currentStep: number;
  totalSteps: number;
  status: ExplorationSessionStatus;
  events: ExplorationEvent[];
  encounterTicks: number[];
  encounters: EncounterResult[];
  pendingBossEncounter: EncounterResult | null;
  floorProgressMap: Record<number, ExplorationFloorProgress>;
  stairsReachedThisRunMap: Record<number, boolean>;
  floorStepsThisRunMap: Record<number, number>;
  undiscoveredStairsArrivalTargetMap: Record<number, number>;
  discoveredStairsArrivalTargetMap: Record<number, number>;
  specialBossArrivalTargetMap: Record<number, number>;
  bossEncounterOfferedThisRunMap: Record<number, boolean>;
};

const DEFAULT_CONFIG: ExplorationSessionConfig = {
  stepsPerRun: difficultyConfig.exploration.maxTicks,
  stairsDiscoveryThresholdPercent: 40,
  fullExplorationPercent: 100,
  explorationPercentGainPerStep: 0.4,
  shortcutStepCostPerDiscoveredFloor: 2,
  discoveredStairsArrivalMinSteps: 3,
  discoveredStairsArrivalMaxSteps: 20,
};

const SPECIAL_B5_BOSS_DUNGEON_ID = "crestoria_dungeon_1_200";
const SPECIAL_B5_BOSS_FLOOR = 5;
const EARLY_STAIRS_DISCOVERY_START_PERCENT = 30;

const mixSeed32 = (value: number): number => {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
};

const clampPercent = (value: number): number => {
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped * 100) / 100;
};

const makeProgressRecord = (floor: number, partial?: Partial<ExplorationFloorProgress>): ExplorationFloorProgress => ({
  floor,
  explorationPercent: clampPercent(partial?.explorationPercent ?? 0),
  stairsDiscovered: !!partial?.stairsDiscovered,
});

const getFloorProgress = (state: ExplorationSessionState, floor: number): ExplorationFloorProgress =>
  state.floorProgressMap[floor] ?? makeProgressRecord(floor);

const withFloorProgress = (
  state: ExplorationSessionState,
  progress: ExplorationFloorProgress
): ExplorationSessionState => ({
  ...state,
  floorProgressMap: {
    ...state.floorProgressMap,
    [progress.floor]: progress,
  },
});

const isSpecialBossGateFloor = (state: Pick<ExplorationSessionState, "dungeon">, floor: number): boolean =>
  state.dungeon.id === SPECIAL_B5_BOSS_DUNGEON_ID && floor === SPECIAL_B5_BOSS_FLOOR;

export const isStairsDiscoveredForFloor = (progress: Pick<ExplorationFloorProgress, "stairsDiscovered">): boolean =>
  progress.stairsDiscovered;

export const isFloorFullyExplored = (
  progress: Pick<ExplorationFloorProgress, "explorationPercent">,
  fullPercent = DEFAULT_CONFIG.fullExplorationPercent
): boolean => progress.explorationPercent >= fullPercent;

const appendEvent = (state: ExplorationSessionState, event: ExplorationEvent): ExplorationSessionState => ({
  ...state,
  events: [...state.events, event],
});

const appendEncounter = (
  state: ExplorationSessionState,
  tick: number,
  encounter: EncounterResult
): ExplorationSessionState => ({
  ...state,
  encounterTicks: [...state.encounterTicks, tick],
  encounters: [...state.encounters, encounter],
});

export const getDiscoveredStairsArrivalMaxSteps = (params: {
  explorationPercent: number;
  config: Pick<
    ExplorationSessionConfig,
    "stairsDiscoveryThresholdPercent" | "discoveredStairsArrivalMinSteps" | "discoveredStairsArrivalMaxSteps"
  >;
}): number => {
  const minSteps = Math.max(1, Math.floor(params.config.discoveredStairsArrivalMinSteps));
  const defaultMaxSteps = Math.max(minSteps, Math.floor(params.config.discoveredStairsArrivalMaxSteps));
  const threshold = Math.max(0, params.config.stairsDiscoveryThresholdPercent);
  const explorationPercent = clampPercent(params.explorationPercent);
  if (explorationPercent < threshold + 10) return defaultMaxSteps;
  const reduction = Math.floor((explorationPercent - threshold) / 10) + 1;
  return Math.max(minSteps, defaultMaxSteps - reduction);
};

const sampleDiscoveredStairsArrivalTarget = (
  state: ExplorationSessionState,
  floor: number
): number => {
  const minSteps = Math.max(1, Math.floor(state.config.discoveredStairsArrivalMinSteps));
  const maxSteps = getDiscoveredStairsArrivalMaxSteps({
    explorationPercent: getFloorProgress(state, floor).explorationPercent,
    config: state.config,
  });
  const rng = createSeededRng((state.seed + floor * 7919 + state.currentFloor * 104729 + state.dungeon.floors * 131071) >>> 0);
  const span = maxSteps - minSteps + 1;
  return minSteps + Math.floor(rng() * span);
};

const sampleUndiscoveredStairsArrivalTarget = (
  state: ExplorationSessionState,
  floor: number
): number => {
  const maxSteps = getDiscoveredStairsArrivalMaxSteps({
    explorationPercent: getFloorProgress(state, floor).explorationPercent,
    config: state.config,
  });
  const rng = createSeededRng((state.seed + floor * 4001 + state.currentFloor * 4507 + state.dungeon.floors * 5003) >>> 0);
  return 1 + Math.floor(rng() * maxSteps);
};

const resolveStatusAfterStepBudget = (state: ExplorationSessionState): ExplorationSessionState => {
  if (
    state.status === "FLOOR_CLEARED" ||
    state.status === "AWAITING_BOSS_DECISION" ||
    state.status === "AWAITING_BOSS_RESULT"
  ) {
    return state;
  }
  if (state.currentStep >= state.totalSteps) {
    return { ...state, status: "RUN_COMPLETE" };
  }
  return state;
};

type CreateParams = {
  dungeon: DungeonOption;
  party: Unit[];
  floor: number;
  seed: number;
  persistedProgress?: Array<Partial<ExplorationFloorProgress> & { floor: number }>;
  config?: Partial<ExplorationSessionConfig>;
};

export const createExplorationSession = (params: CreateParams): ExplorationSessionState => {
  const config: ExplorationSessionConfig = {
    ...DEFAULT_CONFIG,
    ...(params.config ?? {}),
  };
  const floor = Math.max(1, Math.min(params.dungeon.floors, Math.floor(params.floor)));
  const persisted = (params.persistedProgress ?? []).find((row) => row.floor === floor);

  const state: ExplorationSessionState = {
    seed: params.seed,
    dungeon: params.dungeon,
    party: params.party,
    config,
    currentFloor: floor,
    currentStep: 0,
    totalSteps: Math.max(1, Math.floor(config.stepsPerRun)),
    status: "RUNNING",
    events: [],
    encounterTicks: [],
    encounters: [],
    pendingBossEncounter: null,
    floorProgressMap: {
      [floor]: makeProgressRecord(floor, persisted),
    },
    stairsReachedThisRunMap: {},
    floorStepsThisRunMap: {},
    undiscoveredStairsArrivalTargetMap: {},
    discoveredStairsArrivalTargetMap: {},
    specialBossArrivalTargetMap: {},
    bossEncounterOfferedThisRunMap: {},
  };

  return resolveStatusAfterStepBudget(state);
};

const pushStepEvent = (
  state: ExplorationSessionState,
  event: ExplorationEvent,
  encounter?: EncounterResult
): ExplorationSessionState => {
  let next = appendEvent(state, event);
  if (encounter) {
    next = appendEncounter(next, event.tick, encounter);
  }
  return next;
};

export const advanceExplorationStep = (state: ExplorationSessionState): ExplorationSessionState => {
  if (state.status !== "RUNNING") return state;
  if (state.currentStep >= state.totalSteps) {
    return { ...state, status: "RUN_COMPLETE" };
  }

  const nextTick = state.currentStep + 1;
  const floor = state.currentFloor;
  const prevFloorProgress = getFloorProgress(state, floor);
  let nextFloorProgress = {
    ...prevFloorProgress,
    explorationPercent: clampPercent(prevFloorProgress.explorationPercent + state.config.explorationPercentGainPerStep),
  };
  let nextState: ExplorationSessionState = {
    ...state,
    currentStep: nextTick,
    floorStepsThisRunMap: {
      ...state.floorStepsThisRunMap,
      [floor]: (state.floorStepsThisRunMap[floor] ?? 0) + 1,
    },
  };
  nextState = withFloorProgress(nextState, nextFloorProgress);

  const tickSeed = mixSeed32(
    (state.seed ^ Math.imul(nextTick, 0x9e3779b1) ^ Math.imul(floor, 0x85ebca6b)) >>> 0
  );
  const rng = createSeededRng(tickSeed);
  const rolled = rollExplorationEvent({
    party: state.party,
    dungeon: state.dungeon,
    floor,
    seed: state.seed,
    tick: nextTick,
    rng,
  });

  const hasNextFloor = floor < state.dungeon.floors;
  const canProcessStairs = hasNextFloor && !isSpecialBossGateFloor(state, floor);
  const stairsToFloor = hasNextFloor ? floor + 1 : undefined;
  const hasReachedStairsThisRun = state.stairsReachedThisRunMap[floor] ?? false;
  const isDiscoveredFloor = prevFloorProgress.stairsDiscovered;
  let nextUndiscoveredArrivalTargetMap = nextState.undiscoveredStairsArrivalTargetMap;
  if (
    canProcessStairs &&
    !isDiscoveredFloor &&
    !hasReachedStairsThisRun &&
    nextFloorProgress.explorationPercent > EARLY_STAIRS_DISCOVERY_START_PERCENT &&
    nextUndiscoveredArrivalTargetMap[floor] === undefined
  ) {
    nextUndiscoveredArrivalTargetMap = {
      ...nextUndiscoveredArrivalTargetMap,
      [floor]: (nextState.floorStepsThisRunMap[floor] ?? 0) + sampleUndiscoveredStairsArrivalTarget(nextState, floor),
    };
    nextState = {
      ...nextState,
      undiscoveredStairsArrivalTargetMap: nextUndiscoveredArrivalTargetMap,
    };
  }
  const undiscoveredArrivalTarget = nextUndiscoveredArrivalTargetMap[floor];
  let nextDiscoveredArrivalTargetMap = nextState.discoveredStairsArrivalTargetMap;
  if (
    canProcessStairs &&
    isDiscoveredFloor &&
    !hasReachedStairsThisRun &&
    nextDiscoveredArrivalTargetMap[floor] === undefined
  ) {
    nextDiscoveredArrivalTargetMap = {
      ...nextDiscoveredArrivalTargetMap,
      [floor]: sampleDiscoveredStairsArrivalTarget(state, floor),
    };
    nextState = {
      ...nextState,
      discoveredStairsArrivalTargetMap: nextDiscoveredArrivalTargetMap,
    };
  }
  const discoveredArrivalTarget = nextDiscoveredArrivalTargetMap[floor];
  const reachedStairs =
    canProcessStairs &&
    !hasReachedStairsThisRun &&
    (isDiscoveredFloor
      ? (nextState.floorStepsThisRunMap[floor] ?? 0) >=
        (discoveredArrivalTarget ?? state.config.discoveredStairsArrivalMinSteps)
      : undiscoveredArrivalTarget !== undefined
        ? (nextState.floorStepsThisRunMap[floor] ?? 0) >= undiscoveredArrivalTarget
        : nextFloorProgress.explorationPercent >= state.config.stairsDiscoveryThresholdPercent);
  let stairsEvent: ExplorationEvent | null = null;
  if (reachedStairs) {
    const isFirstDiscovery = !prevFloorProgress.stairsDiscovered;
    if (isFirstDiscovery) {
      nextFloorProgress = { ...nextFloorProgress, stairsDiscovered: true };
      nextState = withFloorProgress(nextState, nextFloorProgress);
      stairsEvent = {
        tick: nextTick,
        type: "STAIRS_DISCOVERED",
        floor,
        messageId: "exploration.event.stairs.discovered",
        payload: { explorationPercent: nextFloorProgress.explorationPercent, toFloor: stairsToFloor },
      };
    } else {
      stairsEvent = {
        tick: nextTick,
        type: "STAIRS_REACHED",
        floor,
        messageId: "exploration.event.stairs.reached",
        payload: { explorationPercent: nextFloorProgress.explorationPercent, toFloor: stairsToFloor },
      };
    }
  }

  let nextSpecialBossArrivalTargetMap = nextState.specialBossArrivalTargetMap;
  const canSampleSpecialBossArrivalTarget =
    isSpecialBossGateFloor(state, floor) &&
    nextFloorProgress.explorationPercent >= state.config.stairsDiscoveryThresholdPercent &&
    !nextFloorProgress.stairsDiscovered &&
    !(state.bossEncounterOfferedThisRunMap[floor] ?? false) &&
    nextSpecialBossArrivalTargetMap[floor] === undefined;
  if (canSampleSpecialBossArrivalTarget) {
    nextSpecialBossArrivalTargetMap = {
      ...nextSpecialBossArrivalTargetMap,
      [floor]: sampleDiscoveredStairsArrivalTarget(nextState, floor),
    };
    nextState = {
      ...nextState,
      specialBossArrivalTargetMap: nextSpecialBossArrivalTargetMap,
    };
  }
  const specialBossArrivalTarget = nextSpecialBossArrivalTargetMap[floor];

  const shouldOfferSpecialBossEncounter =
    isSpecialBossGateFloor(state, floor) &&
    nextFloorProgress.explorationPercent >= state.config.stairsDiscoveryThresholdPercent &&
    !nextFloorProgress.stairsDiscovered &&
    !(state.bossEncounterOfferedThisRunMap[floor] ?? false) &&
    (nextState.floorStepsThisRunMap[floor] ?? 0) >= (specialBossArrivalTarget ?? state.config.discoveredStairsArrivalMinSteps);
  if (shouldOfferSpecialBossEncounter) {
    const bossEncounter = createBossEncounter({
      dungeonId: state.dungeon.id,
      floor,
      seed: (state.seed ^ Math.imul(nextTick, 4099) ^ Math.imul(floor, 65537)) >>> 0,
    });
    nextState = appendEvent(nextState, {
      tick: nextTick,
      type: "BOSS_ENCOUNTER",
      floor,
      messageId: "exploration.event.boss.encounter",
      payload: { bossName: bossEncounter.rollMeta.bossName ?? bossEncounter.enemies[0]?.name ?? "?" },
    });
    nextState = {
      ...nextState,
      status: "AWAITING_BOSS_DECISION",
      pendingBossEncounter: bossEncounter,
      bossEncounterOfferedThisRunMap: {
        ...nextState.bossEncounterOfferedThisRunMap,
        [floor]: true,
      },
    };
    return resolveStatusAfterStepBudget(nextState);
  }

  if (stairsEvent) {
    nextState = appendEvent(nextState, stairsEvent);
    nextState = {
      ...nextState,
      stairsReachedThisRunMap: {
        ...nextState.stairsReachedThisRunMap,
        [floor]: true,
      },
    };
    return resolveStatusAfterStepBudget(nextState);
  }

  const justCompletedFloor =
    prevFloorProgress.explorationPercent < state.config.fullExplorationPercent &&
    nextFloorProgress.explorationPercent >= state.config.fullExplorationPercent;
  if (justCompletedFloor) {
    nextState = appendEvent(nextState, {
      tick: nextTick,
      type: "FLOOR_COMPLETE",
      floor,
      messageId: "exploration.event.floor.complete",
      payload: { explorationPercent: nextFloorProgress.explorationPercent },
    });
    return resolveStatusAfterStepBudget(nextState);
  }

  nextState = pushStepEvent(nextState, rolled.event, rolled.encounter);

  return resolveStatusAfterStepBudget(nextState);
};

export const applyBossEncounterDecision = (
  state: ExplorationSessionState,
  decision: BossEncounterDecision
): ExplorationSessionState => {
  if (state.status !== "AWAITING_BOSS_DECISION" || !state.pendingBossEncounter) {
    return state;
  }
  if (decision === "CONTINUE") {
    return resolveStatusAfterStepBudget({
      ...state,
      status: "RUNNING",
      pendingBossEncounter: null,
    });
  }
  return {
    ...state,
    status: "AWAITING_BOSS_RESULT",
  };
};

export const applyBossBattleResult = (
  state: ExplorationSessionState,
  outcome: BossBattleOutcome
): ExplorationSessionState => {
  if (state.status !== "AWAITING_BOSS_RESULT") return state;

  if (outcome !== "WIN") {
    return resolveStatusAfterStepBudget({
      ...state,
      status: "RUNNING",
      pendingBossEncounter: null,
    });
  }

  const floor = state.currentFloor;
  let nextState = state;
  const currentFloorProgress = getFloorProgress(nextState, floor);
  const nextFloorProgress = currentFloorProgress.stairsDiscovered
    ? currentFloorProgress
    : { ...currentFloorProgress, stairsDiscovered: true };
  if (!currentFloorProgress.stairsDiscovered) {
    nextState = withFloorProgress(nextState, nextFloorProgress);
  }

  nextState = appendEvent(nextState, {
    tick: state.currentStep,
    type: "STAIRS_DISCOVERED",
    floor,
    messageId: "exploration.event.stairs.discovered",
    payload: {
      explorationPercent: nextFloorProgress.explorationPercent,
      toFloor: floor < state.dungeon.floors ? floor + 1 : undefined,
    },
  });
  nextState = appendEvent(nextState, {
    tick: state.currentStep,
    type: "FLOOR_CLEAR",
    floor,
    messageId: "exploration.event.floor.clear",
  });

  return {
    ...nextState,
    status: "FLOOR_CLEARED",
    pendingBossEncounter: null,
  };
};

export const toExplorationResult = (state: ExplorationSessionState): ExplorationResult => ({
  seed: state.seed,
  events: state.events,
  encounterTicks: state.encounterTicks,
  encounters: state.encounters,
  totalTicks: state.totalSteps,
});
