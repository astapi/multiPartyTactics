import { ClassId } from "@/types/models";
import { CLASS_MASTER } from "./classes";

type BaseStats = {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  maxMp: number;
  mpRegen: number;
};

export const BASE_STATS_BY_CLASS: Record<ClassId, BaseStats> = {
  ...Object.fromEntries(
    CLASS_MASTER.map((classInfo) => [classInfo.id, classInfo.baseStats])
  ),
} as Record<ClassId, BaseStats>;
