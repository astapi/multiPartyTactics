import { JobId } from "@/types/models";

type BaseStats = {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  maxMp: number;
  mpRegen: number;
};

export const BASE_STATS_BY_JOB: Record<JobId, BaseStats> = {
  GUARDIAN: { maxHp: 120, atk: 8, def: 10, spd: 8, maxMp: 20, mpRegen: 2 },
  CLERIC: { maxHp: 80, atk: 5, def: 6, spd: 10, maxMp: 35, mpRegen: 2 },
  BLADE: { maxHp: 90, atk: 12, def: 5, spd: 12, maxMp: 25, mpRegen: 2 },
  ARCANE: { maxHp: 75, atk: 6, def: 5, spd: 11, maxMp: 30, mpRegen: 2 },
};
