import { DungeonOption } from "@/constants/dungeons";
import difficultyConfig from "@/data/difficultyConfig.json";
import { Unit } from "@/game/battle";
import { EncounterResult, generateEncounter } from "@/game/encounter";
import { createSeededRng } from "@/utils/rng";

const cfg = difficultyConfig.exploration;

export type ExplorationEventType = "LOG" | "ENCOUNTER" | "TREASURE" | "TRAP";

export type ExplorationEvent = {
  tick: number;
  type: ExplorationEventType;
  message: string;
  payload?: {
    itemId?: string;
    damage?: number;
    debuffType?: string;
  };
};

export type ExplorationResult = {
  seed: number;
  events: ExplorationEvent[];
  encounterTick: number | null;
  encounter: EncounterResult | null;
  totalTicks: number;
};

export type ExplorationParams = {
  party: Unit[];
  dungeon: DungeonOption;
  floor: number;
  seed: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const LOG_MESSAGES = [
  "慎重に前進した。",
  "静寂の中を進んでいる。",
  "足元を確認しながら進む。",
  "遠くから物音が聞こえる。",
];

const TRAP_DEBUFFS = ["POISON", "SLOW", "WEAKEN"] as const;
const TREASURE_ITEMS = ["potion_small", "ether_small", "gold_cache"] as const;

export const generateExplorationResult = (
  params: ExplorationParams
): ExplorationResult => {
  const rng = createSeededRng(params.seed);
  const events: ExplorationEvent[] = [];
  const floor = Math.max(1, params.floor);
  const dungeonDepthFactor = clamp(params.dungeon.floors / 10, 0.8, 2);
  const partySize = params.party.length;
  const avgPower =
    partySize > 0
      ? params.party.reduce((sum, unit) => sum + unit.stats.atk + unit.stats.def + unit.stats.spd, 0) /
        partySize
      : 0;

  const partyPenalty = (6 - Math.min(6, partySize)) * cfg.partyPenaltyPerMissing;
  const powerFactor = clamp(
    1 - avgPower * cfg.powerFactorMultiplier,
    cfg.powerFactorMin,
    cfg.powerFactorMax
  );
  const baseEncounter = clamp(
    (cfg.baseEncounterChance + floor * cfg.floorEncounterMultiplier * dungeonDepthFactor + partyPenalty) * powerFactor,
    cfg.encounterChanceMin,
    cfg.encounterChanceMax
  );
  const treasureChance = clamp(
    cfg.treasureChanceBase - floor * cfg.treasureChanceFloorReduction,
    cfg.treasureChanceMin,
    cfg.treasureChanceMax
  );
  const trapChance = clamp(
    cfg.trapChanceBase + floor * cfg.trapChanceFloorIncrease,
    cfg.trapChanceMin,
    cfg.trapChanceMax
  );
  const maxTicks = cfg.maxTicks;

  let encounterTick: number | null = null;
  let encounter: EncounterResult | null = null;

  for (let tick = 1; tick <= maxTicks; tick += 1) {
    const ramp = Math.min(cfg.encounterRampMax, tick * cfg.encounterRampPerTick);
    const encounterChance = clamp(baseEncounter + ramp, cfg.encounterChanceMin, cfg.finalEncounterMax);

    if (rng() < encounterChance) {
      encounterTick = tick;
      encounter = generateEncounter({
        dungeonId: params.dungeon.id,
        floor,
        seed: (params.seed + tick * 1009) >>> 0,
      });
      events.push({
        tick,
        type: "ENCOUNTER",
        message: "敵影を発見！戦闘に移行します。",
      });
      break;
    }

    if (rng() < treasureChance) {
      const itemId = TREASURE_ITEMS[Math.floor(rng() * TREASURE_ITEMS.length)];
      events.push({
        tick,
        type: "TREASURE",
        message: "宝箱を発見した。",
        payload: { itemId },
      });
      continue;
    }

    if (rng() < trapChance) {
      const damage = Math.max(
        1,
        Math.floor(cfg.trapBaseDamage + floor * cfg.trapFloorDamageMultiplier + rng() * cfg.trapRandomDamageRange)
      );
      const debuffType = TRAP_DEBUFFS[Math.floor(rng() * TRAP_DEBUFFS.length)];
      events.push({
        tick,
        type: "TRAP",
        message: "罠が発動した。",
        payload: { damage, debuffType },
      });
      continue;
    }

    const message = LOG_MESSAGES[Math.floor(rng() * LOG_MESSAGES.length)];
    events.push({ tick, type: "LOG", message });
  }

  const totalTicks = encounterTick ?? maxTicks;
  return { seed: params.seed, events, encounterTick, encounter, totalTicks };
};
