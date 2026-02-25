import { describe, expect, it } from "vitest";
import { DUNGEONS } from "@/constants/dungeons";
import { findBundleByFloor } from "@/game/dungeonBundles";
import {
  advanceExplorationStep,
  applyFloorDecision,
  buildShortcutTraversalPlan,
  createExplorationSession,
} from "@/game/explorationSession";
import { makeUnit } from "./helpers";

describe("game/explorationSession", () => {
  const dungeon = DUNGEONS.find((d) => d.id === "hakusla_dungeon_1_200") ?? DUNGEONS[0];
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

  it("on resumed run with discovered stairs, stairs are reached probabilistically after 5-20 steps", () => {
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
    expect(stepsSpent).toBeLessThanOrEqual(20);
    expect(state.status).toBe("AWAITING_DECISION");
    expect(state.currentFloor).toBe(1);
    expect(state.events.some((event) => event.type === "STAIRS_REACHED")).toBe(true);
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
      dungeon: DUNGEONS.find((d) => d.id === "crestoria_dungeon_1_4") ?? DUNGEONS[1],
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
});
