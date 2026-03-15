import { ClassId } from "@/types/models";
import { CLASS_MASTER } from "./classes";

type BaseStats = {
  maxHp: number;
  atk: number;
  def: number;
  spi: number;
  spd: number;
  maxMp: number;
  mpRegen: number;
};

export const BASE_STATS_BY_CLASS: Record<ClassId, BaseStats> = CLASS_MASTER.reduce(
  (acc, classInfo) => {
    acc[classInfo.id] = classInfo.baseStats;
    return acc;
  },
  {} as Record<ClassId, BaseStats>
);
