import { Unit } from "@/game/battle";
import {
  Skill,
  VENOM_TYRANT_SKILLS,
  getHpPercent,
  getSkillById,
  hasEffect,
  isSkillUsable,
} from "@/game/skills";

export type BossDecision = {
  skill: Skill;
  target: Unit;
};

const pickHighestHp = (units: Unit[]): Unit =>
  units.reduce((best, unit) => (unit.hp > best.hp ? unit : best));

const pickLowestHpPercent = (units: Unit[]): Unit =>
  units.reduce((best, unit) =>
    getHpPercent(unit) < getHpPercent(best) ? unit : best
  );

const pickTank = (units: Unit[]): Unit | null =>
  units.find((unit) => unit.jobId === "GUARDIAN") ?? null;

const pickNonPoisonedLowestHp = (units: Unit[]): Unit | null => {
  const candidates = units.filter(
    (unit) => !unit.statusEffects.some((status) => status.type === "POISON")
  );
  if (candidates.length === 0) return null;
  return pickLowestHpPercent(candidates);
};

export const selectVenomTyrantAction = (
  boss: Unit,
  allies: Unit[],
  turn: number
): BossDecision => {
  const enrage = getSkillById(VENOM_TYRANT_SKILLS, "enrage");
  if (
    enrage &&
    getHpPercent(boss) <= 0.4 &&
    !hasEffect(boss, "ENRAGED") &&
    isSkillUsable(boss, enrage)
  ) {
    return { skill: enrage, target: boss };
  }

  const crushingSlam = getSkillById(VENOM_TYRANT_SKILLS, "crushing_slam");
  if (crushingSlam && isSkillUsable(boss, crushingSlam)) {
    const tank = pickTank(allies);
    const highestHp = pickHighestHp(allies);
    if (turn % 3 === 0 || (tank && highestHp.id === tank.id)) {
      return { skill: crushingSlam, target: highestHp };
    }
  }

  const venomSpit = getSkillById(VENOM_TYRANT_SKILLS, "venom_spit");
  if (venomSpit && isSkillUsable(boss, venomSpit)) {
    const target = pickNonPoisonedLowestHp(allies);
    if (target) return { skill: venomSpit, target };
  }

  const claw = getSkillById(VENOM_TYRANT_SKILLS, "claw");
  if (!claw) {
    throw new Error("Venom Tyrant is missing Claw.");
  }
  return { skill: claw, target: pickLowestHpPercent(allies) };
};
