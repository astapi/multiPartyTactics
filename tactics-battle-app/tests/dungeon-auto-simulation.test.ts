import { describe, expect, it } from "vitest";
import { DEFAULT_SIMULATION_PARTY, calculateSimulationLoss, runDungeonAutoSimulation } from "@/game/dungeonAutoSimulation";

const highLevelParty = DEFAULT_SIMULATION_PARTY.map((member) => ({
  ...member,
  level: 25,
}));

describe("game/dungeonAutoSimulation", () => {
  it("同一階層の失敗上限に達したら終了する", () => {
    const result = runDungeonAutoSimulation({
      startFloor: 5,
      targetFloor: 6,
      maxFailuresPerFloor: 1,
      battleMaxTurns: 10,
      baseSeed: 7,
      partyTemplates: highLevelParty,
      explorationConfig: {
        explorationPercentGainPerStep: 100,
      },
      monsterScaling: {
        statScaleMultiplier: 10,
        hpScaleMultiplier: 10,
      },
    });

    expect(result.completion).toBe("FAILURE_LIMIT_REACHED");
    expect(result.reachedFloor).toBe(5);
    expect(result.failureCountOnFinalFloor).toBe(1);
    expect(result.floorAttempts.find((row) => row.floor === 5)?.failures).toBe(1);
  });

  it("失敗したrunでは階段発見を次回へ持ち越さない", () => {
    const result = runDungeonAutoSimulation({
      startFloor: 5,
      targetFloor: 6,
      maxFailuresPerFloor: 2,
      battleMaxTurns: 10,
      baseSeed: 1,
      partyTemplates: highLevelParty,
      explorationConfig: {
        explorationPercentGainPerStep: 20,
      },
      monsterScaling: {
        statScaleMultiplier: 10,
        hpScaleMultiplier: 10,
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
      partyTemplates: highLevelParty,
      explorationConfig: {
        explorationPercentGainPerStep: 100,
      },
    });

    expect(result.completion).toBe("FAILURE_LIMIT_REACHED");
    expect(result.reachedFloor).toBe(1);
    expect(result.floorProgress.find((row) => row.floor === 1)?.stairsDiscovered).toBe(false);
    expect(result.floorAttempts.find((row) => row.floor === 1)?.failures).toBe(3);
  });

  it("目標階層到達時はLv100に近いほどlossが良くなる", () => {
    const common = {
      targetFloor: 120 as const,
      reachedFloor: 120 as const,
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
});
