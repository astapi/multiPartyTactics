import type { Unit } from "@/game/battle";
import type { BattleAttackStyle } from "./types";

export const mapAttackStyleFromUnit = (unit: Unit): BattleAttackStyle => {
  switch (unit.classId) {
    case "SWORDMAN":
    case "GUARDIAN":
      return "sword";
    case "THIEF":
      return "dagger";
    case "BERSERKER":
      return "axe2h";
    default:
      return "generic";
  }
};
