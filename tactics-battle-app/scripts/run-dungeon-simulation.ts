import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_SIMULATION_PARTY,
  runDungeonAutoSimulation,
  type SimulationParameters,
} from "../src/game/dungeonAutoSimulation";

const DEFAULT_OUTPUT_PATH = "simulation-output/dungeon-simulation-result.json";

const parseNumberArg = (value: string | undefined, flag: string): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flag} must be a valid number.`);
  }
  return parsed;
};

const parseArgs = (argv: string[]): { outputPath: string; parameters: SimulationParameters } => {
  const parameters: SimulationParameters = {};
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (const arg of argv) {
    const [flag, rawValue] = arg.split("=", 2);
    const value = rawValue?.trim();
    switch (flag) {
      case "--output":
        outputPath = value || DEFAULT_OUTPUT_PATH;
        break;
      case "--dungeon-id":
        parameters.dungeonId = value;
        break;
      case "--start-floor":
        parameters.startFloor = parseNumberArg(value, flag);
        break;
      case "--target-floor":
        parameters.targetFloor = parseNumberArg(value, flag);
        break;
      case "--max-failures":
        parameters.maxFailuresPerFloor = parseNumberArg(value, flag);
        break;
      case "--base-seed":
        parameters.baseSeed = parseNumberArg(value, flag);
        break;
      case "--battle-max-turns":
        parameters.battleMaxTurns = parseNumberArg(value, flag);
        break;
      case "--exploration-gain":
        parameters.explorationConfig = {
          ...parameters.explorationConfig,
          explorationPercentGainPerStep: parseNumberArg(value, flag),
        };
        break;
      case "--stat-scale-multiplier":
      case "--statScaleMultiplier":
        parameters.monsterScaling = {
          ...parameters.monsterScaling,
          statScaleMultiplier: parseNumberArg(value, flag),
        };
        break;
      case "--stat-scale-add":
      case "--statScaleAdd":
        parameters.monsterScaling = {
          ...parameters.monsterScaling,
          statScaleAdd: parseNumberArg(value, flag),
        };
        break;
      case "--stat-scale-per-floor-add":
      case "--statScalePerFloorAdd":
        parameters.monsterScaling = {
          ...parameters.monsterScaling,
          statScalePerFloorAdd: parseNumberArg(value, flag),
        };
        break;
      case "--hp-scale-multiplier":
      case "--hpScaleMultiplier":
        parameters.monsterScaling = {
          ...parameters.monsterScaling,
          hpScaleMultiplier: parseNumberArg(value, flag),
        };
        break;
      case "--hp-scale-add":
      case "--hpScaleAdd":
        parameters.monsterScaling = {
          ...parameters.monsterScaling,
          hpScaleAdd: parseNumberArg(value, flag),
        };
        break;
      case "--hp-scale-per-floor-add":
      case "--hpScalePerFloorAdd":
        parameters.monsterScaling = {
          ...parameters.monsterScaling,
          hpScalePerFloorAdd: parseNumberArg(value, flag),
        };
        break;
      case "--enemy-scale-no-boss":
      case "--enemyScaleNoBoss":
        parameters.monsterScaling = {
          ...parameters.monsterScaling,
          applyToBoss: false,
        };
        break;
      case "--party-level": {
        const partyLevel = parseNumberArg(value, flag);
        parameters.partyTemplates = DEFAULT_SIMULATION_PARTY.map((member) => ({
          ...member,
          level: partyLevel,
        }));
        break;
      }
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return { outputPath, parameters };
};

const main = () => {
  const { outputPath, parameters } = parseArgs(process.argv.slice(2));
  const result = runDungeonAutoSimulation(parameters);
  const absoluteOutputPath = resolve(process.cwd(), outputPath);

  mkdirSync(dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, JSON.stringify(result, null, 2), "utf8");

  console.log(`saved: ${absoluteOutputPath}`);
  console.log(
    JSON.stringify(
      {
        completion: result.completion,
        baseSeed: result.baseSeed,
        reachedFloor: result.reachedFloor,
        explorationRuns: result.explorationRuns,
        averageBattleTurns: result.averageBattleTurns,
        totalFailures: result.totalFailures,
        monsterScaling: result.monsterScaling,
        loss: result.loss.total,
      },
      null,
      2
    )
  );
};

main();
