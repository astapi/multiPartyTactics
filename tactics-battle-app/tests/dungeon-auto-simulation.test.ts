import { describe, expect, it } from "vitest";
import { calculateSimulationLoss, runDungeonAutoSimulation } from "@/game/dungeonAutoSimulation";

describe("game/dungeonAutoSimulation", () => {
  it("小さい目標階層なら到達まで進める", () => {
    const result = runDungeonAutoSimulation({
      targetFloor: 3,
      maxFailuresPerFloor: 5,
      baseSeed: 1,
      explorationConfig: {
        stepsPerRun: 40,
        stairsDiscoveryThresholdPercent: 40,
        explorationPercentGainPerStep: 20,
        discoveredStairsArrivalMinSteps: 1,
        discoveredStairsArrivalMaxSteps: 1,
      },
    });

    expect(result.completion).toBe("TARGET_REACHED");
    expect(result.reachedFloor).toBe(3);
    expect(result.explorationRuns).toBeGreaterThan(0);
    expect(result.finalParty).toHaveLength(6);
    expect(Number.isFinite(result.loss.total)).toBe(true);
  });

  it("同一階層の失敗上限に達したら終了する", () => {
    const result = runDungeonAutoSimulation({
      startFloor: 5,
      targetFloor: 6,
      maxFailuresPerFloor: 1,
      battleMaxTurns: 0,
      baseSeed: 7,
      explorationConfig: {
        stepsPerRun: 10,
        stairsDiscoveryThresholdPercent: 50,
        explorationPercentGainPerStep: 100,
        discoveredStairsArrivalMinSteps: 1,
        discoveredStairsArrivalMaxSteps: 1,
      },
    });

    expect(result.completion).toBe("FAILURE_LIMIT_REACHED");
    expect(result.reachedFloor).toBe(5);
    expect(result.failureCountOnFinalFloor).toBe(1);
    expect(result.floorAttempts.find((row) => row.floor === 5)?.failures).toBe(1);
  });

  it("階段発見済みフロアで停止せず次階層へ進める", () => {
    const result = runDungeonAutoSimulation({
      startFloor: 1,
      targetFloor: 30,
      baseSeed: 1,
    });

    expect(result.reachedFloor).toBeGreaterThanOrEqual(15);
    expect(result.floorAttempts.some((row) => row.floor === 15)).toBe(true);
    expect(result.floorAttempts.some((row) => row.floor === 14)).toBe(true);
  });

  it("目標階層到達時はLv100に近いほどlossが良くなる", () => {
    const common = {
      targetFloor: 200 as const,
      reachedFloor: 200 as const,
      explorationRuns: 100,
      totalFailures: 20,
      failureCountOnFinalFloor: 0,
    };

    const nearTarget = calculateSimulationLoss({
      ...common,
      finalParty: Array.from({ length: 6 }, (_, index) => ({
        id: `near-${index}`,
        name: `Near ${index}`,
        classId: "SWORDMAN" as const,
        constellationId: "ARIES" as const,
        level: 98,
        exp: 0,
        stats: { maxHp: 1, atk: 1, def: 1, spd: 1, maxMp: 1, mpRegen: 1 },
        currentHp: 1,
        currentMp: 1,
        statusEffects: [],
      })),
    });

    const farFromTarget = calculateSimulationLoss({
      ...common,
      finalParty: Array.from({ length: 6 }, (_, index) => ({
        id: `far-${index}`,
        name: `Far ${index}`,
        classId: "SWORDMAN" as const,
        constellationId: "ARIES" as const,
        level: 55,
        exp: 0,
        stats: { maxHp: 1, atk: 1, def: 1, spd: 1, maxMp: 1, mpRegen: 1 },
        currentHp: 1,
        currentMp: 1,
        statusEffects: [],
      })),
    });

    expect(nearTarget.targetLevelDeviationPenalty).toBeLessThan(
      farFromTarget.targetLevelDeviationPenalty
    );
    expect(nearTarget.total).toBeLessThan(farFromTarget.total);
  });

  it("目標冒険回数に近いほどlossが良くなる", () => {
    const common = {
      targetFloor: 200 as const,
      reachedFloor: 200 as const,
      battleCount: 100,
      averageBattleTurns: 4,
      totalFailures: 999,
      failureCountOnFinalFloor: 999,
      finalParty: Array.from({ length: 6 }, (_, index) => ({
        id: `member-${index}`,
        name: `Member ${index}`,
        classId: "SWORDMAN" as const,
        constellationId: "ARIES" as const,
        level: 100,
        exp: 0,
        stats: { maxHp: 1, atk: 1, def: 1, spd: 1, maxMp: 1, mpRegen: 1 },
        currentHp: 1,
        currentMp: 1,
        statusEffects: [],
      })),
    };

    const nearTargetRuns = calculateSimulationLoss({
      ...common,
      explorationRuns: 8000,
    });
    const farTargetRuns = calculateSimulationLoss({
      ...common,
      explorationRuns: 2000,
    });

    expect(nearTargetRuns.explorationRunDeviationPenalty).toBeLessThan(
      farTargetRuns.explorationRunDeviationPenalty
    );
    expect(nearTargetRuns.total).toBeLessThan(farTargetRuns.total);
  });

  it("平均戦闘ターン数が4に近いほどlossが良くなる", () => {
    const common = {
      targetFloor: 200 as const,
      reachedFloor: 200 as const,
      explorationRuns: 8000,
      battleCount: 100,
      totalFailures: 999,
      failureCountOnFinalFloor: 999,
      finalParty: Array.from({ length: 6 }, (_, index) => ({
        id: `member-turn-${index}`,
        name: `Member Turn ${index}`,
        classId: "SWORDMAN" as const,
        constellationId: "ARIES" as const,
        level: 100,
        exp: 0,
        stats: { maxHp: 1, atk: 1, def: 1, spd: 1, maxMp: 1, mpRegen: 1 },
        currentHp: 1,
        currentMp: 1,
        statusEffects: [],
      })),
    };

    const nearTargetTurns = calculateSimulationLoss({
      ...common,
      averageBattleTurns: 4.2,
    });
    const farTargetTurns = calculateSimulationLoss({
      ...common,
      averageBattleTurns: 8,
    });

    expect(nearTargetTurns.battleTurnDeviationPenalty).toBeLessThan(
      farTargetTurns.battleTurnDeviationPenalty
    );
    expect(nearTargetTurns.total).toBeLessThan(farTargetTurns.total);
  });

  it("モンスター階層スケールを強くすると到達階層が下がりやすい", () => {
    const baseResult = runDungeonAutoSimulation({
      startFloor: 1,
      targetFloor: 30,
      baseSeed: 1,
    });
    const scaledResult = runDungeonAutoSimulation({
      startFloor: 1,
      targetFloor: 30,
      baseSeed: 1,
      monsterScaling: {
        statScaleMultiplier: 1.2,
        hpScaleMultiplier: 1.5,
        statScalePerFloorAdd: 0.01,
        hpScalePerFloorAdd: 0.02,
      },
    });

    expect(scaledResult.monsterScaling.statScaleMultiplier).toBe(1.2);
    expect(scaledResult.monsterScaling.hpScalePerFloorAdd).toBe(0.02);
    expect(scaledResult.reachedFloor).toBeLessThanOrEqual(baseResult.reachedFloor);
  });

  it("失敗したrunでは階段発見を次回へ持ち越さない", () => {
    const result = runDungeonAutoSimulation({
      startFloor: 5,
      targetFloor: 6,
      maxFailuresPerFloor: 5,
      battleMaxTurns: 0,
      baseSeed: 1,
      explorationConfig: {
        stepsPerRun: 40,
        stairsDiscoveryThresholdPercent: 40,
        explorationPercentGainPerStep: 20,
        discoveredStairsArrivalMinSteps: 1,
        discoveredStairsArrivalMaxSteps: 1,
      },
    });

    expect(result.completion).toBe("FAILURE_LIMIT_REACHED");
    expect(result.floorProgress.find((row) => row.floor === 5)?.stairsDiscovered).toBe(false);
    expect(result.floorAttempts.find((row) => row.floor === 5)?.stairsDiscovered).toBe(false);
  });

  it("戦闘勝利なしでは成功runでも階層前進しない", () => {
    const result = runDungeonAutoSimulation({
      startFloor: 1,
      targetFloor: 2,
      maxFailuresPerFloor: 3,
      baseSeed: 1,
      explorationConfig: {
        stepsPerRun: 1,
        stairsDiscoveryThresholdPercent: 0,
        explorationPercentGainPerStep: 0,
        discoveredStairsArrivalMinSteps: 1,
        discoveredStairsArrivalMaxSteps: 1,
      },
    });

    expect(result.completion).toBe("FAILURE_LIMIT_REACHED");
    expect(result.reachedFloor).toBe(1);
    expect(result.floorProgress.find((row) => row.floor === 1)?.stairsDiscovered).toBe(false);
    expect(result.floorAttempts.find((row) => row.floor === 1)?.failures).toBe(3);
  });
});
