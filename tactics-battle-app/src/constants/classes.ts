import { ClassId } from "@/types/models";
import { ImageSourcePropType } from "react-native";

export type ClassInfo = {
  id: ClassId;
  name: string;
  description: string;
  image: ImageSourcePropType;
  baseStats: {
    maxHp: number;
    atk: number;
    def: number;
    spi: number;
    spd: number;
    maxMp: number;
    mpRegen: number;
  };
  hiringCost: number;
};

export const CLASS_MASTER: ClassInfo[] = [
  {
    id: "GUARDIAN",
    name: "Gurdian",
    description: "High defense frontline tank",
    image: require("@/assets/images/class/gurdian.png"),
    baseStats: { maxHp: 120, atk: 8, def: 10, spi: 5, spd: 8, maxMp: 20, mpRegen: 2 },
    hiringCost: 5000,
  },
  {
    id: "SWORDMAN",
    name: "Swordman",
    description: "Balanced melee fighter",
    image: require("@/assets/images/class/swordman.png"),
    baseStats: { maxHp: 100, atk: 11, def: 8, spi: 6, spd: 10, maxMp: 22, mpRegen: 2 },
    hiringCost: 5500,
  },
  {
    id: "BERSERKER",
    name: "Berserker",
    description: "High-risk, high-damage bruiser",
    image: require("@/assets/images/class/berserker.png"),
    baseStats: { maxHp: 110, atk: 14, def: 6, spi: 4, spd: 9, maxMp: 18, mpRegen: 2 },
    hiringCost: 6000,
  },
  {
    id: "CLERIC",
    name: "Cleric (Preist)",
    description: "Support and healing specialist",
    image: require("@/assets/images/class/cleric.png"),
    baseStats: { maxHp: 80, atk: 5, def: 6, spi: 13, spd: 10, maxMp: 35, mpRegen: 2 },
    hiringCost: 7000,
  },
  {
    id: "WITCH",
    name: "Witch",
    description: "Powerful magic damage dealer",
    image: require("@/assets/images/class/witch.png"),
    baseStats: { maxHp: 75, atk: 6, def: 5, spi: 15, spd: 11, maxMp: 30, mpRegen: 2 },
    hiringCost: 6500,
  },
  {
    id: "THIEF",
    name: "Thief",
    description: "Fast and agile attacker",
    image: require("@/assets/images/class/thief.png"),
    baseStats: { maxHp: 90, atk: 12, def: 5, spi: 6, spd: 12, maxMp: 25, mpRegen: 2 },
    hiringCost: 5500,
  },
  {
    id: "PORTER",
    name: "Porter",
    description: "Carries loot and supports the expedition",
    image: require("@/assets/images/class/thief.png"),
    baseStats: { maxHp: 95, atk: 7, def: 7, spi: 7, spd: 9, maxMp: 18, mpRegen: 2 },
    hiringCost: 4500,
  },
];

const CLASS_MAP = Object.fromEntries(
  CLASS_MASTER.map((classInfo) => [classInfo.id, classInfo])
) as Record<ClassId, ClassInfo>;

export const isClassId = (value: string): value is ClassId => {
  return value in CLASS_MAP;
};

export const getClassById = (id: ClassId): ClassInfo => {
  const classInfo = CLASS_MAP[id];
  if (!classInfo) {
    throw new Error(`Unknown class id: ${id}`);
  }
  return classInfo;
};
