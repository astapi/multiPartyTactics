import { DungeonOption } from "@/constants/dungeons";
import { Unit } from "@/game/battle";
import { getDungeonBossFloors } from "@/game/dungeonBundles";
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
  | "FLOOR_CLEARED";

export type BossEncounterDecision = "FIGHT" | "CONTINUE";
export type BossBattleOutcome = "WIN" | "LOSE" | "DRAW";
export type ExplorationSessionMode = "PROGRESSION" | "LOOP";

export type ExplorationSessionConfig = {
  explorationPercentGainPerStep: number;
};

export type ExplorationSessionState = {
  seed: number;
  dungeon: DungeonOption;
  party: Unit[];
  config: ExplorationSessionConfig;
  mode: ExplorationSessionMode;
  currentFloor: number;
  currentStep: number;
  loopExitPercent: number;
  status: ExplorationSessionStatus;
  events: ExplorationEvent[];
  encounterTicks: number[];
  encounters: EncounterResult[];
  pendingBossEncounter: EncounterResult | null;
  floorProgressMap: Record<number, ExplorationFloorProgress>;
  floorStepsThisRunMap: Record<number, number>;
  bossEncounterOfferedThisRunMap: Record<number, boolean>;
};

const DEFAULT_CONFIG: ExplorationSessionConfig = {
  explorationPercentGainPerStep: 0.4,
};

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

const isBossGateFloor = (state: Pick<ExplorationSessionState, "dungeon">, floor: number): boolean =>
  getDungeonBossFloors(state.dungeon.id).includes(floor);

export const isStairsDiscoveredForFloor = (progress: Pick<ExplorationFloorProgress, "stairsDiscovered">): boolean =>
  progress.stairsDiscovered;

export const isFloorFullyExplored = (
  progress: Pick<ExplorationFloorProgress, "explorationPercent">
): boolean => progress.explorationPercent >= 100;

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

type CreateParams = {
  dungeon: DungeonOption;
  party: Unit[];
  floor: number;
  seed: number;
  persistedProgress?: Array<Partial<ExplorationFloorProgress> & { floor: number }>;
  config?: Partial<ExplorationSessionConfig>;
};

export const createExplorationSession = (params: CreateParams): ExplorationSessionState => {
  const mergedConfig: ExplorationSessionConfig = {
    ...DEFAULT_CONFIG,
    ...(params.config ?? {}),
  };
  const config: ExplorationSessionConfig = {
    explorationPercentGainPerStep: Math.max(0.01, mergedConfig.explorationPercentGainPerStep),
  };
  const floor = Math.max(1, Math.min(params.dungeon.floors, Math.floor(params.floor)));
  const persisted = (params.persistedProgress ?? []).find((row) => row.floor === floor);
  const initialProgress = makeProgressRecord(floor, persisted);
  const mode: ExplorationSessionMode = initialProgress.stairsDiscovered ? "LOOP" : "PROGRESSION";

  const state: ExplorationSessionState = {
    seed: params.seed,
    dungeon: params.dungeon,
    party: params.party,
    config,
    mode,
    currentFloor: floor,
    currentStep: 0,
    loopExitPercent: 0,
    status: "RUNNING",
    events: [],
    encounterTicks: [],
    encounters: [],
    pendingBossEncounter: null,
    floorProgressMap: {
      [floor]: initialProgress,
    },
    floorStepsThisRunMap: {},
    bossEncounterOfferedThisRunMap: {},
  };

  return state;
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

  const nextTick = state.currentStep + 1;
  const floor = state.currentFloor;
  const prevFloorProgress = getFloorProgress(state, floor);
  const isLoopMode = state.mode === "LOOP";
  let nextFloorProgress = isLoopMode
    ? prevFloorProgress
    : {
        ...prevFloorProgress,
        explorationPercent: clampPercent(prevFloorProgress.explorationPercent + state.config.explorationPercentGainPerStep),
      };
  let nextState: ExplorationSessionState = {
    ...state,
    currentStep: nextTick,
    loopExitPercent: isLoopMode
      ? clampPercent(state.loopExitPercent + state.config.explorationPercentGainPerStep)
      : state.loopExitPercent,
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

  const shouldOfferSpecialBossEncounter =
    isBossGateFloor(state, floor) &&
    nextFloorProgress.explorationPercent >= 100 &&
    !nextFloorProgress.stairsDiscovered &&
    !(state.bossEncounterOfferedThisRunMap[floor] ?? false) &&
    !state.pendingBossEncounter;
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
    return nextState;
  }

  const isNormalFloorClear =
    !isBossGateFloor(state, floor) &&
    prevFloorProgress.explorationPercent < 100 &&
    nextFloorProgress.explorationPercent >= 100 &&
    !prevFloorProgress.stairsDiscovered;
  if (isNormalFloorClear) {
    const toFloor = floor < state.dungeon.floors ? floor + 1 : undefined;
    nextFloorProgress = { ...nextFloorProgress, stairsDiscovered: true };
    nextState = withFloorProgress(nextState, nextFloorProgress);
    nextState = appendEvent(nextState, {
      tick: nextTick,
      type: "STAIRS_DISCOVERED",
      floor,
      messageId: "exploration.event.stairs.discovered",
      payload: { explorationPercent: nextFloorProgress.explorationPercent, toFloor },
    });
    nextState = appendEvent(nextState, {
      tick: nextTick,
      type: "FLOOR_CLEAR",
      floor,
      messageId: "exploration.event.floor.clear",
    });
    return {
      ...nextState,
      status: "FLOOR_CLEARED",
    };
  }

  const isLoopFloorClear =
    isLoopMode &&
    state.loopExitPercent < 100 &&
    nextState.loopExitPercent >= 100;
  if (isLoopFloorClear) {
    nextState = appendEvent(nextState, {
      tick: nextTick,
      type: "FLOOR_CLEAR",
      floor,
      messageId: "exploration.event.floor.clear",
    });
    return {
      ...nextState,
      status: "FLOOR_CLEARED",
    };
  }

  nextState = pushStepEvent(nextState, rolled.event, rolled.encounter);

  return nextState;
};

export const applyBossEncounterDecision = (
  state: ExplorationSessionState,
  decision: BossEncounterDecision
): ExplorationSessionState => {
  if (state.status !== "AWAITING_BOSS_DECISION" || !state.pendingBossEncounter) {
    return state;
  }
  if (decision === "CONTINUE") {
    return {
      ...state,
      status: "RUNNING",
      pendingBossEncounter: null,
    };
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
    return {
      ...state,
      status: "RUNNING",
      pendingBossEncounter: null,
    };
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
  totalTicks: state.currentStep,
});
