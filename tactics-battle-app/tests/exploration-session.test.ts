import { describe, expect, it } from "vitest";
import { DUNGEONS } from "@/constants/dungeons";
import { findBundleByFloor } from "@/game/dungeonBundles";
import {
  advanceExplorationStep,
  applyBossBattleResult,
  applyBossEncounterDecision,
  applyFloorDecision,
  buildShortcutTraversalPlan,
  createExplorationSession,
  getDiscoveredStairsArrivalMaxSteps,
} from "@/game/explorationSession";
import { makeUnit } from "./helpers";

describe("game/explorationSession", () => {
  const dungeon = DUNGEONS.find((d) => d.id === "crestoria_dungeon_1_200") ?? DUNGEONS[0];
  const party = [makeUnit()];
  const bundle = findBundleByFloor(dungeon.id, 1);

  it("increases floor exploration percent and discovers stairs before full clear", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      bundle,
      seed: 1,
      config: { explorationPercentGainPerStep: 5, stairsDiscoveryThresholdPercent: 50 },
    });
    for (let i = 0; i < 10; i += 1) {
      state = advanceExplorationStep(state);
      if (state.status === "AWAITING_DECISION") break;
    }
    expect(state.currentFloor).toBe(1);
    expect(state.floorProgressMap[1]?.stairsDiscovered).toBe(true);
    expect((state.floorProgressMap[1]?.explorationPercent ?? 0)).toBeGreaterThanOrEqual(50);
    expect((state.floorProgressMap[1]?.explorationPercent ?? 0)).toBeLessThan(100);
    expect(state.status).toBe("AWAITING_DECISION");
  });

  it("does not frequently produce 7+ consecutive encounters across nearby seeds", () => {
    let longStreakRuns = 0;

    for (let seed = 1; seed <= 200; seed += 1) {
      let state = createExplorationSession({
        dungeon,
        party,
        bundle,
        seed,
        config: {
          stepsPerRun: 40,
          explorationPercentGainPerStep: 0,
          stairsDiscoveryThresholdPercent: 101,
        },
      });

      while (state.status === "RUNNING") {
        state = advanceExplorationStep(state);
      }

      let streak = 0;
      let maxStreak = 0;
      for (const event of state.events) {
        if (event.type === "ENCOUNTER") {
          streak += 1;
          if (streak > maxStreak) maxStreak = streak;
        } else {
          streak = 0;
        }
      }
      if (maxStreak >= 7) longStreakRuns += 1;
    }

    expect(longStreakRuns).toBeLessThan(10);
  });

  it("emits only one event per tick even when stair discovery also triggers", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      bundle,
      seed: 101,
      config: {
        explorationPercentGainPerStep: 50,
        stairsDiscoveryThresholdPercent: 10,
        fullExplorationPercent: 100,
      },
    });
    const beforeEventCount = state.events.length;
    state = advanceExplorationStep(state);
    const afterEventCount = state.events.length;

    expect(afterEventCount - beforeEventCount).toBe(1);
    expect(state.status).toBe("AWAITING_DECISION");
    expect(["STAIRS_DISCOVERED", "STAIRS_REACHED"]).toContain(state.events.at(-1)?.type);
  });

  it("continues current floor when decision is CONTINUE", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      bundle,
      seed: 2,
      config: { explorationPercentGainPerStep: 10, stairsDiscoveryThresholdPercent: 20 },
    });
    while (state.status === "RUNNING") state = advanceExplorationStep(state);
    const beforeFloor = state.currentFloor;
    state = applyFloorDecision(state, "CONTINUE");
    expect(state.currentFloor).toBe(beforeFloor);
    expect(state.status).toBe("RUNNING");
  });

  it("descends to next floor when decision is DESCEND", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      bundle,
      seed: 3,
      config: { explorationPercentGainPerStep: 10, stairsDiscoveryThresholdPercent: 20 },
    });
    while (state.status === "RUNNING") state = advanceExplorationStep(state);
    state = applyFloorDecision(state, "DESCEND");
    expect(state.currentFloor).toBe(2);
    expect(state.status).toBe("RUNNING");
    expect(state.events.some((event) => event.type === "FLOOR_DESCEND")).toBe(true);
  });

  it("starts from bundle head on next run and still requires stair reach/decision flow", () => {
    const state = createExplorationSession({
      dungeon,
      party,
      bundle,
      seed: 4,
      persistedProgress: [
        { floor: 1, explorationPercent: 100, stairsDiscovered: true },
        { floor: 2, explorationPercent: 60, stairsDiscovered: true },
      ],
      config: { shortcutStepCostPerDiscoveredFloor: 2 },
    });
    expect(state.currentFloor).toBe(1);
    expect(state.currentStep).toBe(0);
    expect(state.events.filter((event) => event.type === "SHORTCUT")).toHaveLength(0);
  });

  it("on resumed run with 60% explored discovered stairs, stairs are reached probabilistically after 5-18 steps", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      bundle,
      seed: 44,
      persistedProgress: [{ floor: 1, explorationPercent: 60, stairsDiscovered: true }],
      config: { explorationPercentGainPerStep: 1, stairsDiscoveryThresholdPercent: 50 },
    });
    expect(state.currentFloor).toBe(1);
    expect(state.status).toBe("RUNNING");
    state = advanceExplorationStep(state);
    expect(state.status).toBe("RUNNING");
    let stepsSpent = 1;
    while (state.status === "RUNNING" && stepsSpent < 30) {
      state = advanceExplorationStep(state);
      stepsSpent += 1;
    }
    expect(stepsSpent).toBeGreaterThanOrEqual(5);
    expect(stepsSpent).toBeLessThanOrEqual(18);
    expect(state.status).toBe("AWAITING_DECISION");
    expect(state.currentFloor).toBe(1);
    expect(state.events.some((event) => event.type === "STAIRS_REACHED")).toBe(true);
  });

  it("reduces discovered stairs arrival max steps as exploration percent increases", () => {
    const config = {
      stairsDiscoveryThresholdPercent: 50,
      discoveredStairsArrivalMinSteps: 5,
      discoveredStairsArrivalMaxSteps: 20,
    } as const;

    expect(getDiscoveredStairsArrivalMaxSteps({ explorationPercent: 50, config })).toBe(20);
    expect(getDiscoveredStairsArrivalMaxSteps({ explorationPercent: 60, config })).toBe(18);
    expect(getDiscoveredStairsArrivalMaxSteps({ explorationPercent: 70, config })).toBe(17);
    expect(getDiscoveredStairsArrivalMaxSteps({ explorationPercent: 80, config })).toBe(16);
    expect(getDiscoveredStairsArrivalMaxSteps({ explorationPercent: 90, config })).toBe(15);
    expect(getDiscoveredStairsArrivalMaxSteps({ explorationPercent: 100, config })).toBe(14);
  });

  it("builds shortcut traversal only for consecutive discovered stairs and available steps", () => {
    const actions = buildShortcutTraversalPlan({
      bundle,
      floorProgressMap: {
        1: { floor: 1, explorationPercent: 50, stairsDiscovered: true },
        2: { floor: 2, explorationPercent: 50, stairsDiscovered: true },
        3: { floor: 3, explorationPercent: 10, stairsDiscovered: false },
      },
      remainingSteps: 3,
      shortcutStepCostPerDiscoveredFloor: 2,
    });
    expect(actions).toEqual([{ fromFloor: 1, toFloor: 2, stepCost: 2 }]);
  });

  it("clears a bundle when the boss floor reaches 100%", () => {
    const bossOnlyBundle = { startFloor: 1, bossFloor: 1 };
    let state = createExplorationSession({
      dungeon: DUNGEONS.find((d) => d.id === "crestoria_dungeon_1_200") ?? DUNGEONS[0],
      party,
      bundle: bossOnlyBundle,
      seed: 5,
      config: { explorationPercentGainPerStep: 50 },
    });
    state = advanceExplorationStep(state);
    state = advanceExplorationStep(state);
    expect(state.floorProgressMap[1]?.explorationPercent).toBe(100);
    expect(state.status).toBe("BUNDLE_CLEARED");
    expect(state.events.some((event) => event.type === "BUNDLE_CLEAR")).toBe(true);
  });

  it("on crestoria B5, reaching stairs discovery threshold triggers boss encounter decision", () => {
    const bossOnlyBundle = { startFloor: 5, bossFloor: 5 };
    let state = createExplorationSession({
      dungeon,
      party,
      bundle: bossOnlyBundle,
      seed: 501,
      config: {
        explorationPercentGainPerStep: 25,
        stairsDiscoveryThresholdPercent: 50,
        fullExplorationPercent: 100,
        discoveredStairsArrivalMinSteps: 2,
        discoveredStairsArrivalMaxSteps: 2,
        stepsPerRun: 10,
      },
    });
    state = advanceExplorationStep(state);
    state = advanceExplorationStep(state);

    expect(state.floorProgressMap[5]?.explorationPercent).toBe(50);
    expect(state.status).toBe("AWAITING_BOSS_DECISION");
    expect(state.pendingBossEncounter?.enemies).toHaveLength(1);
    expect(state.pendingBossEncounter?.enemies[0]?.name).toBe("レプス");
    expect(state.events.some((event) => event.type === "BOSS_ENCOUNTER")).toBe(true);
    expect(state.events.some((event) => event.type === "BUNDLE_CLEAR")).toBe(false);
  });

  it("does not re-offer B5 boss in the same run after skipping", () => {
    const bossOnlyBundle = { startFloor: 5, bossFloor: 5 };
    let state = createExplorationSession({
      dungeon,
      party,
      bundle: bossOnlyBundle,
      seed: 502,
      config: {
        explorationPercentGainPerStep: 100,
        fullExplorationPercent: 100,
        discoveredStairsArrivalMinSteps: 1,
        discoveredStairsArrivalMaxSteps: 1,
        stepsPerRun: 10,
      },
    });
    state = advanceExplorationStep(state);
    expect(state.status).toBe("AWAITING_BOSS_DECISION");

    state = applyBossEncounterDecision(state, "CONTINUE");
    expect(state.status).toBe("RUNNING");

    const bossEventCountBefore = state.events.filter((event) => event.type === "BOSS_ENCOUNTER").length;
    state = advanceExplorationStep(state);
    const bossEventCountAfter = state.events.filter((event) => event.type === "BOSS_ENCOUNTER").length;

    expect(bossEventCountAfter).toBe(bossEventCountBefore);
    expect(state.status).not.toBe("AWAITING_BOSS_DECISION");
    expect(state.status).not.toBe("BUNDLE_CLEARED");
  });

  it("clears bundle and discovers stairs when B5 boss is defeated", () => {
    const bossOnlyBundle = { startFloor: 5, bossFloor: 5 };
    let state = createExplorationSession({
      dungeon,
      party,
      bundle: bossOnlyBundle,
      seed: 503,
      config: {
        explorationPercentGainPerStep: 100,
        fullExplorationPercent: 100,
        discoveredStairsArrivalMinSteps: 1,
        discoveredStairsArrivalMaxSteps: 1,
        stepsPerRun: 10,
      },
    });
    state = advanceExplorationStep(state);
    state = applyBossEncounterDecision(state, "FIGHT");
    state = applyBossBattleResult(state, "WIN");

    expect(state.floorProgressMap[5]?.stairsDiscovered).toBe(true);
    expect(state.status).toBe("BUNDLE_CLEARED");
    expect(state.events.some((event) => event.type === "STAIRS_DISCOVERED")).toBe(true);
    expect(state.events.some((event) => event.type === "BUNDLE_CLEAR")).toBe(true);
  });

  it("does not clear bundle when B5 boss battle outcome is not WIN", () => {
    const bossOnlyBundle = { startFloor: 5, bossFloor: 5 };
    let loseState = createExplorationSession({
      dungeon,
      party,
      bundle: bossOnlyBundle,
      seed: 504,
      config: {
        explorationPercentGainPerStep: 100,
        fullExplorationPercent: 100,
        discoveredStairsArrivalMinSteps: 1,
        discoveredStairsArrivalMaxSteps: 1,
        stepsPerRun: 10,
      },
    });
    loseState = advanceExplorationStep(loseState);
    loseState = applyBossEncounterDecision(loseState, "FIGHT");
    loseState = applyBossBattleResult(loseState, "LOSE");
    expect(loseState.status).toBe("RUNNING");
    expect(loseState.floorProgressMap[5]?.stairsDiscovered).toBe(false);
    expect(loseState.events.some((event) => event.type === "BUNDLE_CLEAR")).toBe(false);

    let drawState = createExplorationSession({
      dungeon,
      party,
      bundle: bossOnlyBundle,
      seed: 505,
      config: {
        explorationPercentGainPerStep: 100,
        fullExplorationPercent: 100,
        discoveredStairsArrivalMinSteps: 1,
        discoveredStairsArrivalMaxSteps: 1,
        stepsPerRun: 10,
      },
    });
    drawState = advanceExplorationStep(drawState);
    drawState = applyBossEncounterDecision(drawState, "FIGHT");
    drawState = applyBossBattleResult(drawState, "DRAW");
    expect(drawState.status).toBe("RUNNING");
    expect(drawState.floorProgressMap[5]?.stairsDiscovered).toBe(false);
    expect(drawState.events.some((event) => event.type === "BUNDLE_CLEAR")).toBe(false);
  });

  it("does not trigger B5 boss immediately on arrival even if threshold is already met", () => {
    const bossOnlyBundle = { startFloor: 5, bossFloor: 5 };
    let state = createExplorationSession({
      dungeon,
      party,
      bundle: bossOnlyBundle,
      seed: 506,
      persistedProgress: [{ floor: 5, explorationPercent: 100, stairsDiscovered: false }],
      config: {
        explorationPercentGainPerStep: 0,
        stairsDiscoveryThresholdPercent: 40,
        discoveredStairsArrivalMinSteps: 3,
        discoveredStairsArrivalMaxSteps: 3,
        stepsPerRun: 10,
      },
    });

    state = advanceExplorationStep(state);
    expect(state.status).toBe("RUNNING");
    state = advanceExplorationStep(state);
    expect(state.status).toBe("RUNNING");
    state = advanceExplorationStep(state);

    expect(state.status).toBe("AWAITING_BOSS_DECISION");
    expect(state.events.some((event) => event.type === "BOSS_ENCOUNTER")).toBe(true);
  });
});
