import { JobId } from "@/types/models";
import { ImageSourcePropType } from "react-native";

export type ClassInfo = {
  id: JobId;
  name: string;
  description: string;
  image: ImageSourcePropType;
  stats: {
    hp: number;
    mp: number;
    atk: number;
    def: number;
  };
  hiringCost: number;
};

export const CLASS_DATA: ClassInfo[] = [
  {
    id: "GUARDIAN",
    name: "Knight",
    description: "High defense frontline tank",
    image: require("@/assets/images/class/gurdian.png"),
    stats: { hp: 120, mp: 20, atk: 8, def: 10 },
    hiringCost: 5000,
  },
  {
    id: "ARCANE",
    name: "Mage",
    description: "Powerful magic damage dealer",
    image: require("@/assets/images/class/witch.png"),
    stats: { hp: 75, mp: 30, atk: 6, def: 5 },
    hiringCost: 6000,
  },
  {
    id: "BLADE",
    name: "Thief",
    description: "Fast and agile attacker",
    image: require("@/assets/images/class/thief.png"),
    stats: { hp: 90, mp: 25, atk: 12, def: 5 },
    hiringCost: 5500,
  },
  {
    id: "CLERIC",
    name: "Healer",
    description: "Support and healing specialist",
    image: require("@/assets/images/class/priest.png"),
    stats: { hp: 80, mp: 35, atk: 5, def: 6 },
    hiringCost: 7000,
  },
];
