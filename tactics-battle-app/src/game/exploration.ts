import { DungeonOption } from "@/constants/dungeons";
import { Unit } from "@/game/battle";
import { createSeededRng } from "@/utils/rng";

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

  const partyPenalty = (6 - Math.min(6, partySize)) * 0.012;
  const powerFactor = clamp(1 - avgPower * 0.0015, 0.72, 1.08);
  const baseEncounter = clamp(
    (0.08 + floor * 0.015 * dungeonDepthFactor + partyPenalty) * powerFactor,
    0.06,
    0.45
  );
  const treasureChance = clamp(0.08 - floor * 0.003, 0.03, 0.08);
  const trapChance = clamp(0.05 + floor * 0.005, 0.05, 0.2);
  const maxTicks = 40;

  let encounterTick: number | null = null;

  for (let tick = 1; tick <= maxTicks; tick += 1) {
    const ramp = Math.min(0.35, tick * 0.008);
    const encounterChance = clamp(baseEncounter + ramp, 0.06, 0.8);

    if (rng() < encounterChance) {
      encounterTick = tick;
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
      const damage = Math.max(1, Math.floor(4 + floor * 2 + rng() * 8));
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
  return { seed: params.seed, events, encounterTick, totalTicks };
};
