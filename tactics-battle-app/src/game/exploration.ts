import { DungeonOption } from "@/constants/dungeons";
import difficultyConfig from "@/data/difficultyConfig.json";
import dungeonEnemyTableData from "@/data/dungeonEnemyTable.json";
import { Unit } from "@/game/battle";
import { EncounterResult, generateEncounter } from "@/game/encounter";
import { rollTreasureChestEquipment } from "@/game/loot/equipmentLootRoller";
import type { EquipmentReward } from "@/types/equipment";
import { createSeededRng } from "@/utils/rng";

const cfg = difficultyConfig.exploration;

type DungeonEncounterRateTable = {
  dungeonId: string;
  floors: Array<{
    floor: number;
    encounterChance?: number;
  }>;
};

const DUNGEON_ENCOUNTER_RATE_TABLES = dungeonEnemyTableData.dungeons as DungeonEncounterRateTable[];
const CRESTORIA_DUNGEON_ID = "crestoria_dungeon_1_200";
const CRESTORIA_FIXED_BUNDLE_ENCOUNTER_CHANCE = 0.16;

export type ExplorationEventType =
  | "LOG"
  | "ENCOUNTER"
  | "BOSS_ENCOUNTER"
  | "TREASURE"
  | "TRAP"
  | "STAIRS_DISCOVERED"
  | "SHORTCUT"
  | "FLOOR_DESCEND"
  | "FLOOR_CLEAR";
export type ExplorationMessageId =
  | "exploration.event.log.cautious_advance"
  | "exploration.event.log.advance_in_silence"
  | "exploration.event.log.watch_footing"
  | "exploration.event.log.distant_noise"
  | "exploration.event.encounter.spotted_enemy"
  | "exploration.event.boss.encounter"
  | "exploration.event.treasure.found_chest"
  | "exploration.event.trap.triggered"
  | "exploration.event.stairs.discovered"
  | "exploration.event.shortcut.used"
  | "exploration.event.floor.descend"
  | "exploration.event.floor.clear";

export type ExplorationEvent = {
  tick: number;
  type: ExplorationEventType;
  messageId: ExplorationMessageId;
  floor?: number;
  payload?: {
    reward?: EquipmentReward;
    damage?: number;
    debuffType?: string;
    bossName?: string;
    fromFloor?: number;
    toFloor?: number;
    explorationPercent?: number;
    stepCost?: number;
  };
};

export type ExplorationResult = {
  seed: number;
  events: ExplorationEvent[];
  encounterTicks: number[];
  encounters: EncounterResult[];
  totalTicks: number;
};

export type ExplorationParams = {
  party: Unit[];
  dungeon: DungeonOption;
  floor: number;
  seed: number;
};

export type ExplorationEventRollParams = {
  party: Unit[];
  dungeon: DungeonOption;
  floor: number;
  seed: number;
  tick: number;
  rng: () => number;
};

export type ExplorationEventRollResult = {
  event: ExplorationEvent;
  encounter?: EncounterResult;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const LOG_MESSAGE_IDS: ExplorationMessageId[] = [
  "exploration.event.log.cautious_advance",
  "exploration.event.log.advance_in_silence",
  "exploration.event.log.watch_footing",
  "exploration.event.log.distant_noise",
];

const TRAP_DEBUFFS = ["POISON", "SLOW", "WEAKEN"] as const;

const getFloorEncounterChanceOverride = (dungeonId: string, floor: number): number | null => {
  const dungeon = DUNGEON_ENCOUNTER_RATE_TABLES.find((row) => row.dungeonId === dungeonId);
  const floorRow = dungeon?.floors.find((row) => row.floor === floor);
  const configured = floorRow?.encounterChance;
  if (!Number.isFinite(configured)) return null;
  return clamp(configured as number, 0, 1);
};

const getBundleEncounterChanceOverride = (dungeonId: string, floor: number): number | null => {
  if (dungeonId !== CRESTORIA_DUNGEON_ID) return null;
  const configured = CRESTORIA_FIXED_BUNDLE_ENCOUNTER_CHANCE;
  if (!Number.isFinite(configured)) return null;
  return clamp(configured, 0, 1);
};

const buildEncounterChanceContext = (party: Unit[], dungeon: DungeonOption, floor: number) => {
  const safeFloor = Math.max(1, floor);
  const dungeonDepthFactor = clamp(dungeon.floors / 10, 0.8, 2);
  const partySize = party.length;
  const avgPower =
    partySize > 0
      ? party.reduce((sum, unit) => sum + unit.stats.atk + unit.stats.def + unit.stats.spd, 0) / partySize
      : 0;

  const partyPenalty = (6 - Math.min(6, partySize)) * cfg.partyPenaltyPerMissing;
  const powerFactor = clamp(
    1 - avgPower * cfg.powerFactorMultiplier,
    cfg.powerFactorMin,
    cfg.powerFactorMax
  );
  const baseEncounter = clamp(
    (cfg.baseEncounterChance + safeFloor * cfg.floorEncounterMultiplier * dungeonDepthFactor + partyPenalty) *
      powerFactor,
    cfg.encounterChanceMin,
    cfg.encounterChanceMax
  );
  const treasureChance = clamp(
    cfg.treasureChanceBase - safeFloor * cfg.treasureChanceFloorReduction,
    cfg.treasureChanceMin,
    cfg.treasureChanceMax
  );
  const trapChance = clamp(
    cfg.trapChanceBase + safeFloor * cfg.trapChanceFloorIncrease,
    cfg.trapChanceMin,
    cfg.trapChanceMax
  );

  return { floor: safeFloor, baseEncounter, treasureChance, trapChance };
};

export const rollExplorationEvent = (
  params: ExplorationEventRollParams
): ExplorationEventRollResult => {
  const { floor, baseEncounter, treasureChance, trapChance } = buildEncounterChanceContext(
    params.party,
    params.dungeon,
    params.floor
  );
  const configuredEncounterChance = getFloorEncounterChanceOverride(params.dungeon.id, floor);
  const bundleEncounterChance = getBundleEncounterChanceOverride(params.dungeon.id, floor);
  const encounterChance = configuredEncounterChance ?? bundleEncounterChance ?? baseEncounter;

  if (params.rng() < encounterChance) {
    const encounter = generateEncounter({
      dungeonId: params.dungeon.id,
      floor,
      seed: (params.seed + params.tick * 1009) >>> 0,
    });
    return {
      event: {
        tick: params.tick,
        floor,
        type: "ENCOUNTER",
        messageId: "exploration.event.encounter.spotted_enemy",
      },
      encounter,
    };
  }

  if (params.rng() < treasureChance) {
    const reward = rollTreasureChestEquipment({
      dungeonId: params.dungeon.id,
      floor,
      explorationSeed: params.seed,
      tick: params.tick,
    });
    return {
      event: {
        tick: params.tick,
        floor,
        type: "TREASURE",
        messageId: "exploration.event.treasure.found_chest",
        payload: { reward },
      },
    };
  }

  if (params.rng() < trapChance) {
    const damage = Math.max(
      1,
      Math.floor(cfg.trapBaseDamage + floor * cfg.trapFloorDamageMultiplier + params.rng() * cfg.trapRandomDamageRange)
    );
    const debuffType = TRAP_DEBUFFS[Math.floor(params.rng() * TRAP_DEBUFFS.length)];
    return {
      event: {
        tick: params.tick,
        floor,
        type: "TRAP",
        messageId: "exploration.event.trap.triggered",
        payload: { damage, debuffType },
      },
    };
  }

  const messageId = LOG_MESSAGE_IDS[Math.floor(params.rng() * LOG_MESSAGE_IDS.length)];
  return {
    event: {
      tick: params.tick,
      floor,
      type: "LOG",
      messageId,
    },
  };
};

export const generateExplorationResult = (params: ExplorationParams): ExplorationResult => {
  const rng = createSeededRng(params.seed);
  const events: ExplorationEvent[] = [];
  const encounterTicks: number[] = [];
  const encounters: EncounterResult[] = [];
  const totalTicks = cfg.maxTicks;
  const floor = Math.max(1, params.floor);

  for (let tick = 1; tick <= totalTicks; tick += 1) {
    const rolled = rollExplorationEvent({
      party: params.party,
      dungeon: params.dungeon,
      floor,
      seed: params.seed,
      tick,
      rng,
    });
    events.push(rolled.event);
    if (rolled.encounter) {
      encounterTicks.push(tick);
      encounters.push(rolled.encounter);
    }
  }

  return { seed: params.seed, events, encounterTicks, encounters, totalTicks };
};
