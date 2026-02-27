import { describe, expect, it } from "vitest";
import { DUNGEONS } from "@/constants/dungeons";
import {
  advanceExplorationStep,
  applyBossBattleResult,
  applyBossEncounterDecision,
  createExplorationSession,
  getDiscoveredStairsArrivalMaxSteps,
} from "@/game/explorationSession";
import { makeUnit } from "./helpers";

describe("game/explorationSession", () => {
  const dungeon = DUNGEONS.find((d) => d.id === "crestoria_dungeon_1_200") ?? DUNGEONS[0];
  const party = [makeUnit()];

  it("階段を発見しても降下待ちにならず探索を継続する", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 1,
      seed: 1,
      config: { explorationPercentGainPerStep: 5, stairsDiscoveryThresholdPercent: 50, stepsPerRun: 40 },
    });
    for (let i = 0; i < 12; i += 1) {
      state = advanceExplorationStep(state);
    }

    expect(state.currentFloor).toBe(1);
    expect(state.floorProgressMap[1]?.stairsDiscovered).toBe(true);
    expect(state.events.some((event) => event.type === "STAIRS_DISCOVERED")).toBe(true);
    expect(state.status).toBe("RUNNING");
  });

  it("近傍seedで7連戦以上が多発しない", () => {
    let longStreakRuns = 0;

    for (let seed = 1; seed <= 200; seed += 1) {
      let state = createExplorationSession({
        dungeon,
        party,
        floor: 1,
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

  it("階段発見時も1tickあたりイベントは1件", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 1,
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
    expect(["STAIRS_DISCOVERED", "STAIRS_REACHED"]).toContain(state.events.at(-1)?.type);
    expect(state.status).toBe("RUNNING");
  });

  it("発見済み階段フロア再開時は5-18stepで到達イベントが発生する", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 1,
      seed: 44,
      persistedProgress: [{ floor: 1, explorationPercent: 60, stairsDiscovered: true }],
      config: { explorationPercentGainPerStep: 1, stairsDiscoveryThresholdPercent: 50 },
    });
    expect(state.currentFloor).toBe(1);
    state = advanceExplorationStep(state);
    let stepsSpent = 1;
    while (state.status === "RUNNING" && stepsSpent < 30) {
      state = advanceExplorationStep(state);
      stepsSpent += 1;
      if (state.events.some((event) => event.type === "STAIRS_REACHED")) break;
    }

    expect(stepsSpent).toBeGreaterThanOrEqual(5);
    expect(stepsSpent).toBeLessThanOrEqual(18);
    expect(state.events.some((event) => event.type === "STAIRS_REACHED")).toBe(true);
    expect(state.status).toBe("RUNNING");
  });

  it("探索率上昇に応じて階段到達max stepが短縮される", () => {
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

  it("STEP上限到達でRUN_COMPLETEになる", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 1,
      seed: 12,
      config: { stepsPerRun: 3, explorationPercentGainPerStep: 0 },
    });
    state = advanceExplorationStep(state);
    state = advanceExplorationStep(state);
    state = advanceExplorationStep(state);

    expect(state.currentStep).toBe(3);
    expect(state.status).toBe("RUN_COMPLETE");
  });

  it("B5はしきい値到達後にボス遭遇を提示する", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 5,
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
    expect(state.events.some((event) => event.type === "STAIRS_DISCOVERED")).toBe(false);
  });

  it("B5ボス見送り後は同一ランで再提示しない", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 5,
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
    expect(state.status).not.toBe("FLOOR_CLEARED");
  });

  it("B5ボス勝利で階段発見済みになりFLOOR_CLEAREDになる", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 5,
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
    expect(state.status).toBe("FLOOR_CLEARED");
    expect(state.events.some((event) => event.type === "FLOOR_CLEAR")).toBe(true);
  });

  it("B5ボス敗北/引分ではFLOOR_CLEAREDにならない", () => {
    let loseState = createExplorationSession({
      dungeon,
      party,
      floor: 5,
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
    expect(loseState.events.some((event) => event.type === "FLOOR_CLEAR")).toBe(false);

    let drawState = createExplorationSession({
      dungeon,
      party,
      floor: 5,
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
    expect(drawState.events.some((event) => event.type === "FLOOR_CLEAR")).toBe(false);
  });

  it("B5は到達直後ではなく設定step経過後にボス提示される", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 5,
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
