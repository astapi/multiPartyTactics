import difficultyConfig from "@/data/difficultyConfig.json";
import { DungeonOption } from "@/constants/dungeons";
import { Unit } from "@/game/battle";
import { DungeonBundleRange } from "@/game/dungeonBundles";
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
  | "AWAITING_DECISION"
  | "AWAITING_BOSS_DECISION"
  | "AWAITING_BOSS_RESULT"
  | "RUN_COMPLETE"
  | "BUNDLE_CLEARED";

export type FloorDecision = "DESCEND" | "CONTINUE";
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
  bundle: DungeonBundleRange;
  config: ExplorationSessionConfig;
  currentFloor: number;
  currentStep: number;
  totalSteps: number;
  status: ExplorationSessionStatus;
  pendingDecisionFloor: number | null;
  events: ExplorationEvent[];
  encounterTicks: number[];
  encounters: EncounterResult[];
  pendingBossEncounter: EncounterResult | null;
  floorProgressMap: Record<number, ExplorationFloorProgress>;
  stairsReachedThisRunMap: Record<number, boolean>;
  floorStepsThisRunMap: Record<number, number>;
  discoveredStairsArrivalTargetMap: Record<number, number>;
  bossEncounterOfferedThisRunMap: Record<number, boolean>;
};

const DEFAULT_CONFIG: ExplorationSessionConfig = {
  stepsPerRun: difficultyConfig.exploration.maxTicks,
  stairsDiscoveryThresholdPercent: 50,
  fullExplorationPercent: 100,
  explorationPercentGainPerStep: 0.25,
  shortcutStepCostPerDiscoveredFloor: 2,
  discoveredStairsArrivalMinSteps: 5,
  discoveredStairsArrivalMaxSteps: 20,
};

const SPECIAL_B5_BOSS_DUNGEON_ID = "hakusla_dungeon_1_200";
const SPECIAL_B5_BOSS_FLOOR = 5;

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

const isSpecialBossGateFloor = (state: Pick<ExplorationSessionState, "dungeon" | "bundle">, floor: number): boolean =>
  state.dungeon.id === SPECIAL_B5_BOSS_DUNGEON_ID &&
  floor === SPECIAL_B5_BOSS_FLOOR &&
  floor === state.bundle.bossFloor;

export const isStairsDiscoveredForFloor = (progress: Pick<ExplorationFloorProgress, "stairsDiscovered">): boolean =>
  progress.stairsDiscovered;

export const isFloorFullyExplored = (
  progress: Pick<ExplorationFloorProgress, "explorationPercent">,
  fullPercent = DEFAULT_CONFIG.fullExplorationPercent
): boolean => progress.explorationPercent >= fullPercent;

export const buildShortcutTraversalPlan = (params: {
  bundle: DungeonBundleRange;
  floorProgressMap: Record<number, ExplorationFloorProgress>;
  remainingSteps: number;
  shortcutStepCostPerDiscoveredFloor: number;
}): Array<{ fromFloor: number; toFloor: number; stepCost: number }> => {
  const actions: Array<{ fromFloor: number; toFloor: number; stepCost: number }> = [];
  let remaining = Math.max(0, Math.floor(params.remainingSteps));
  const stepCost = Math.max(1, Math.floor(params.shortcutStepCostPerDiscoveredFloor));
  for (let floor = params.bundle.startFloor; floor < params.bundle.bossFloor; floor += 1) {
    const progress = params.floorProgressMap[floor];
    if (!progress?.stairsDiscovered) break;
    if (remaining < stepCost) break;
    remaining -= stepCost;
    actions.push({ fromFloor: floor, toFloor: floor + 1, stepCost });
  }
  return actions;
};

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
  const rng = createSeededRng(
    (state.seed + floor * 7919 + state.bundle.startFloor * 104729 + state.bundle.bossFloor * 131071) >>> 0
  );
  const span = maxSteps - minSteps + 1;
  return minSteps + Math.floor(rng() * span);
};

const resolveStatusAfterStepBudget = (state: ExplorationSessionState): ExplorationSessionState => {
  if (
    state.status === "BUNDLE_CLEARED" ||
    state.status === "AWAITING_DECISION" ||
    state.status === "AWAITING_BOSS_DECISION" ||
    state.status === "AWAITING_BOSS_RESULT"
  ) {
    return state;
  }
  if (state.currentStep >= state.totalSteps) {
    return { ...state, status: "RUN_COMPLETE", pendingDecisionFloor: null };
  }
  return state;
};

type CreateParams = {
  dungeon: DungeonOption;
  party: Unit[];
  bundle: DungeonBundleRange;
  seed: number;
  persistedProgress?: Array<Partial<ExplorationFloorProgress> & { floor: number }>;
  config?: Partial<ExplorationSessionConfig>;
};

export const createExplorationSession = (params: CreateParams): ExplorationSessionState => {
  const config: ExplorationSessionConfig = {
    ...DEFAULT_CONFIG,
    ...(params.config ?? {}),
  };
  const initialFloorProgressMap: Record<number, ExplorationFloorProgress> = {};
  for (let floor = params.bundle.startFloor; floor <= params.bundle.bossFloor; floor += 1) {
    initialFloorProgressMap[floor] = makeProgressRecord(floor);
  }
  for (const row of params.persistedProgress ?? []) {
    if (row.floor < params.bundle.startFloor || row.floor > params.bundle.bossFloor) continue;
    initialFloorProgressMap[row.floor] = makeProgressRecord(row.floor, row);
  }

  let state: ExplorationSessionState = {
    seed: params.seed,
    dungeon: params.dungeon,
    party: params.party,
    bundle: params.bundle,
    config,
    currentFloor: params.bundle.startFloor,
    currentStep: 0,
    totalSteps: Math.max(1, Math.floor(config.stepsPerRun)),
    status: "RUNNING",
    pendingDecisionFloor: null,
    events: [],
    encounterTicks: [],
    encounters: [],
    pendingBossEncounter: null,
    floorProgressMap: initialFloorProgressMap,
    stairsReachedThisRunMap: {},
    floorStepsThisRunMap: {},
    discoveredStairsArrivalTargetMap: {},
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

  const rng = createSeededRng((state.seed + nextTick * 2654435761 + floor * 97) >>> 0);
  const rolled = rollExplorationEvent({
    party: state.party,
    dungeon: state.dungeon,
    floor,
    seed: state.seed,
    tick: nextTick,
    rng,
  });

  const hasReachedStairsThisRun = state.stairsReachedThisRunMap[floor] ?? false;
  const isDiscoveredFloor = prevFloorProgress.stairsDiscovered;
  let nextDiscoveredArrivalTargetMap = nextState.discoveredStairsArrivalTargetMap;
  if (
    isDiscoveredFloor &&
    !hasReachedStairsThisRun &&
    floor < state.bundle.bossFloor &&
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
    !hasReachedStairsThisRun &&
    floor < state.bundle.bossFloor &&
    (isDiscoveredFloor
      ? (nextState.floorStepsThisRunMap[floor] ?? 0) >=
        (discoveredArrivalTarget ?? state.config.discoveredStairsArrivalMinSteps)
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
        payload: { explorationPercent: nextFloorProgress.explorationPercent },
      };
    } else {
      stairsEvent = {
        tick: nextTick,
        type: "STAIRS_REACHED",
        floor,
        messageId: "exploration.event.stairs.reached",
        payload: { explorationPercent: nextFloorProgress.explorationPercent },
      };
    }
  }

  const justCompletedFloor =
    prevFloorProgress.explorationPercent < state.config.fullExplorationPercent &&
    nextFloorProgress.explorationPercent >= state.config.fullExplorationPercent;
  const floorCompleteEvent = justCompletedFloor
    ? ({
      tick: nextTick,
      type: "FLOOR_COMPLETE",
      floor,
      messageId: "exploration.event.floor.complete",
      payload: { explorationPercent: nextFloorProgress.explorationPercent },
    } satisfies ExplorationEvent)
    : null;

  const shouldClearBundle =
    floor === state.bundle.bossFloor &&
    nextFloorProgress.explorationPercent >= state.config.fullExplorationPercent &&
    (!isSpecialBossGateFloor(state, floor) || nextFloorProgress.stairsDiscovered);
  const shouldOfferSpecialBossEncounter =
    isSpecialBossGateFloor(state, floor) &&
    nextFloorProgress.explorationPercent >= state.config.fullExplorationPercent &&
    !nextFloorProgress.stairsDiscovered &&
    !(state.bossEncounterOfferedThisRunMap[floor] ?? false);
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
      pendingDecisionFloor: null,
      pendingBossEncounter: bossEncounter,
      bossEncounterOfferedThisRunMap: {
        ...nextState.bossEncounterOfferedThisRunMap,
        [floor]: true,
      },
    };
    return resolveStatusAfterStepBudget(nextState);
  }

  if (shouldClearBundle) {
    nextState = appendEvent(nextState, {
      tick: nextTick,
      type: "BUNDLE_CLEAR",
      floor,
      messageId: "exploration.event.bundle.clear",
    });
    nextState = {
      ...nextState,
      status: "BUNDLE_CLEARED",
      pendingDecisionFloor: null,
      pendingBossEncounter: null,
    };
    return nextState;
  }

  if (stairsEvent) {
    nextState = appendEvent(nextState, stairsEvent);
    nextState = {
      ...nextState,
      status: "AWAITING_DECISION",
      pendingDecisionFloor: floor,
      stairsReachedThisRunMap: {
        ...nextState.stairsReachedThisRunMap,
        [floor]: true,
      },
    };
    return resolveStatusAfterStepBudget(nextState);
  }

  if (floorCompleteEvent) {
    nextState = appendEvent(nextState, floorCompleteEvent);
    return resolveStatusAfterStepBudget(nextState);
  }

  nextState = pushStepEvent(nextState, rolled.event, rolled.encounter);

  return resolveStatusAfterStepBudget(nextState);
};

export const applyFloorDecision = (
  state: ExplorationSessionState,
  decision: FloorDecision
): ExplorationSessionState => {
  if (state.status !== "AWAITING_DECISION" || state.pendingDecisionFloor === null) {
    return state;
  }
  if (decision === "CONTINUE") {
    return resolveStatusAfterStepBudget({
      ...state,
      status: "RUNNING",
      pendingDecisionFloor: null,
    });
  }

  const fromFloor = state.pendingDecisionFloor;
  if (fromFloor >= state.bundle.bossFloor) {
    return resolveStatusAfterStepBudget({
      ...state,
      status: "RUNNING",
      pendingDecisionFloor: null,
    });
  }
  const toFloor = fromFloor + 1;
  const next = appendEvent(
    {
      ...state,
      currentFloor: toFloor,
      status: "RUNNING",
      pendingDecisionFloor: null,
    },
    {
      tick: state.currentStep,
      type: "FLOOR_DESCEND",
      floor: toFloor,
      messageId: "exploration.event.floor.descend",
      payload: { fromFloor, toFloor },
    }
  );
  return resolveStatusAfterStepBudget(next);
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
    payload: { explorationPercent: nextFloorProgress.explorationPercent },
  });
  nextState = appendEvent(nextState, {
    tick: state.currentStep,
    type: "BUNDLE_CLEAR",
    floor,
    messageId: "exploration.event.bundle.clear",
  });

  return {
    ...nextState,
    status: "BUNDLE_CLEARED",
    pendingDecisionFloor: null,
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
