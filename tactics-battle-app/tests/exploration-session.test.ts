import { describe, expect, it } from "vitest";
import { DUNGEONS } from "@/constants/dungeons";
import {
  advanceExplorationStep,
  applyBossBattleResult,
  applyBossEncounterDecision,
  createExplorationSession,
} from "@/game/explorationSession";
import { makeUnit } from "./helpers";

describe("game/explorationSession", () => {
  const dungeon = DUNGEONS.find((d) => d.id === "crestoria_dungeon_1_200") ?? DUNGEONS[0];
  const party = [makeUnit()];

  it("通常階は探索度100%到達で階段発見とフロアクリアが確定する", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 1,
      seed: 1,
      config: {
        explorationPercentGainPerStep: 25,
      },
    });

    while (state.status === "RUNNING") {
      state = advanceExplorationStep(state);
    }

    expect(state.currentFloor).toBe(1);
    expect(state.floorProgressMap[1]?.explorationPercent).toBe(100);
    expect(state.floorProgressMap[1]?.stairsDiscovered).toBe(true);
    expect(state.status).toBe("FLOOR_CLEARED");
    expect(state.events.at(-2)?.type).toBe("STAIRS_DISCOVERED");
    expect(state.events.at(-1)?.type).toBe("FLOOR_CLEAR");
    expect(state.events.at(-2)?.payload?.toFloor).toBe(2);
  });

  it("通常階は探索度100%未満では探索継続する", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 1,
      seed: 2,
      config: {
        explorationPercentGainPerStep: 20,
      },
    });

    state = advanceExplorationStep(state);
    state = advanceExplorationStep(state);
    state = advanceExplorationStep(state);

    expect(state.floorProgressMap[1]?.explorationPercent).toBe(60);
    expect(state.floorProgressMap[1]?.stairsDiscovered).toBe(false);
    expect(state.status).toBe("RUNNING");
    expect(state.events.some((event) => event.type === "FLOOR_CLEAR")).toBe(false);
  });

  it("通常階クリアtickではクリアイベントのみが追加される", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 1,
      seed: 3,
      config: {
        explorationPercentGainPerStep: 20,
      },
      persistedProgress: [{ floor: 1, explorationPercent: 80, stairsDiscovered: false }],
    });

    const beforeEventCount = state.events.length;
    state = advanceExplorationStep(state);

    expect(state.events.length - beforeEventCount).toBe(2);
    expect(state.events.at(-2)?.type).toBe("STAIRS_DISCOVERED");
    expect(state.events.at(-1)?.type).toBe("FLOOR_CLEAR");
    expect(state.status).toBe("FLOOR_CLEARED");
  });

  it("探索率上昇量が0以下でも完了不能な設定にはならない", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 1,
      seed: 4,
      config: {
        explorationPercentGainPerStep: 0,
      },
    });

    for (let i = 0; i < 10000 && state.status === "RUNNING"; i += 1) {
      state = advanceExplorationStep(state);
    }

    expect(state.status).toBe("FLOOR_CLEARED");
    expect(state.floorProgressMap[1]?.stairsDiscovered).toBe(true);
  });

  it("クリア済み通常階は周回モードで進行し100%で終了する", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 1,
      seed: 40,
      config: {
        explorationPercentGainPerStep: 25,
      },
      persistedProgress: [{ floor: 1, explorationPercent: 100, stairsDiscovered: true }],
    });

    expect(state.mode).toBe("LOOP");
    expect(state.loopExitPercent).toBe(0);

    while (state.status === "RUNNING") {
      state = advanceExplorationStep(state);
    }

    expect(state.floorProgressMap[1]?.explorationPercent).toBe(100);
    expect(state.floorProgressMap[1]?.stairsDiscovered).toBe(true);
    expect(state.loopExitPercent).toBe(100);
    expect(state.status).toBe("FLOOR_CLEARED");
    expect(state.events.at(-1)?.type).toBe("FLOOR_CLEAR");
    expect(state.events.some((event) => event.type === "STAIRS_DISCOVERED")).toBe(false);
  });

  it("クリア済み通常階の周回モードでは探索度を再進行しない", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 1,
      seed: 41,
      config: {
        explorationPercentGainPerStep: 20,
      },
      persistedProgress: [{ floor: 1, explorationPercent: 100, stairsDiscovered: true }],
    });

    state = advanceExplorationStep(state);
    state = advanceExplorationStep(state);

    expect(state.mode).toBe("LOOP");
    expect(state.floorProgressMap[1]?.explorationPercent).toBe(100);
    expect(state.loopExitPercent).toBe(40);
    expect(state.status).toBe("RUNNING");
  });

  it("ボス階は探索度100%到達でボス遭遇を提示する", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 10,
      seed: 501,
      config: {
        explorationPercentGainPerStep: 25,
      },
    });

    state = advanceExplorationStep(state);
    state = advanceExplorationStep(state);
    state = advanceExplorationStep(state);
    state = advanceExplorationStep(state);

    expect(state.floorProgressMap[10]?.explorationPercent).toBe(100);
    expect(state.status).toBe("AWAITING_BOSS_DECISION");
    expect(state.pendingBossEncounter?.enemies).toHaveLength(1);
    expect(state.pendingBossEncounter?.enemies[0]?.name).toBe("星霊導師アリエス");
    expect(state.events.some((event) => event.type === "BOSS_ENCOUNTER")).toBe(true);
    expect(state.events.some((event) => event.type === "STAIRS_DISCOVERED")).toBe(false);
    expect(state.events.some((event) => event.type === "FLOOR_CLEAR")).toBe(false);
  });

  it("ボス見送り後は同一ランで再提示しない", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 10,
      seed: 502,
      config: {
        explorationPercentGainPerStep: 100,
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
    expect(state.status).toBe("RUNNING");
    expect(state.floorProgressMap[10]?.stairsDiscovered).toBe(false);
  });

  it("ボス勝利で階段発見済みになりFLOOR_CLEAREDになる", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 10,
      seed: 503,
      config: {
        explorationPercentGainPerStep: 100,
      },
    });

    state = advanceExplorationStep(state);
    state = applyBossEncounterDecision(state, "FIGHT");
    state = applyBossBattleResult(state, "WIN");

    expect(state.floorProgressMap[10]?.stairsDiscovered).toBe(true);
    expect(state.status).toBe("FLOOR_CLEARED");
    expect(state.events.at(-2)?.type).toBe("STAIRS_DISCOVERED");
    expect(state.events.at(-1)?.type).toBe("FLOOR_CLEAR");
  });

  it("クリア済みボス階も周回モードで進行しボス再戦を要求しない", () => {
    let state = createExplorationSession({
      dungeon,
      party,
      floor: 10,
      seed: 506,
      config: {
        explorationPercentGainPerStep: 50,
      },
      persistedProgress: [{ floor: 10, explorationPercent: 100, stairsDiscovered: true }],
    });

    expect(state.mode).toBe("LOOP");

    state = advanceExplorationStep(state);
    expect(state.status).toBe("RUNNING");
    expect(state.events.some((event) => event.type === "BOSS_ENCOUNTER")).toBe(false);

    state = advanceExplorationStep(state);
    expect(state.loopExitPercent).toBe(100);
    expect(state.status).toBe("FLOOR_CLEARED");
  });

  it("ボス敗北/引分ではFLOOR_CLEAREDにならない", () => {
    let loseState = createExplorationSession({
      dungeon,
      party,
      floor: 10,
      seed: 504,
      config: {
        explorationPercentGainPerStep: 100,
      },
    });
    loseState = advanceExplorationStep(loseState);
    loseState = applyBossEncounterDecision(loseState, "FIGHT");
    loseState = applyBossBattleResult(loseState, "LOSE");
    expect(loseState.status).toBe("RUNNING");
    expect(loseState.floorProgressMap[10]?.stairsDiscovered).toBe(false);
    expect(loseState.events.some((event) => event.type === "FLOOR_CLEAR")).toBe(false);

    let drawState = createExplorationSession({
      dungeon,
      party,
      floor: 10,
      seed: 505,
      config: {
        explorationPercentGainPerStep: 100,
      },
    });
    drawState = advanceExplorationStep(drawState);
    drawState = applyBossEncounterDecision(drawState, "FIGHT");
    drawState = applyBossBattleResult(drawState, "DRAW");
    expect(drawState.status).toBe("RUNNING");
    expect(drawState.floorProgressMap[10]?.stairsDiscovered).toBe(false);
    expect(drawState.events.some((event) => event.type === "FLOOR_CLEAR")).toBe(false);
  });
});
