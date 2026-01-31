export type StatusType = "POISON" | "STUN";

export type StatusEffect = {
  type: StatusType;
  remainingTurns: number;
  potency?: number;
};

export type Stats = {
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
};

export type Unit = {
  id: string;
  name: string;
  stats: Stats;
  hp: number;
  statusEffects: StatusEffect[];
  order: number;
};

export type TurnOrderEntry = {
  unit: Unit;
  order: number;
};

export type Action =
  | {
      kind: "ATTACK";
      power: number;
      target: Unit;
      statusToApply?: StatusEffect;
    }
  | {
      kind: "WAIT";
    };

export type StatusTickResult = {
  poisonedDamage: number;
  skippedAction: boolean;
  expired: StatusType[];
};

export type TurnResult = {
  actor: Unit;
  action: Action | null;
  skipped: boolean;
  poisonDamage: number;
  damageDealt: number;
  statusApplied: StatusEffect | null;
  expiredStatuses: StatusType[];
};

export const calculatePhysicalDamage = (
  attacker: Unit,
  defender: Unit,
  power: number
): number => {
  return Math.max(1, power + attacker.stats.atk - defender.stats.def);
};

export const applyDamage = (target: Unit, amount: number): number => {
  const actual = Math.max(0, Math.min(target.hp, amount));
  target.hp -= actual;
  return actual;
};

export const applyStatus = (target: Unit, effect: StatusEffect): void => {
  const existing = target.statusEffects.find((status) => status.type === effect.type);
  if (!existing) {
    target.statusEffects.push({ ...effect });
    return;
  }

  existing.remainingTurns = Math.max(existing.remainingTurns, effect.remainingTurns);
  if (effect.type === "POISON") {
    const existingPotency = existing.potency ?? 0;
    const incomingPotency = effect.potency ?? 0;
    existing.potency = Math.max(existingPotency, incomingPotency);
  }
};

export const getTurnOrder = (units: Unit[]): TurnOrderEntry[] => {
  return units
    .map((unit) => ({ unit, order: unit.order }))
    .sort((a, b) => {
      if (b.unit.stats.spd !== a.unit.stats.spd) {
        return b.unit.stats.spd - a.unit.stats.spd;
      }
      return a.order - b.order;
    });
};

export const tickStatusesOnTurnStart = (unit: Unit): StatusTickResult => {
  let poisonedDamage = 0;
  let skippedAction = false;
  const expired: StatusType[] = [];

  for (const status of unit.statusEffects) {
    if (status.type === "POISON") {
      const damage = status.potency ?? 0;
      poisonedDamage += damage;
    }

    if (status.type === "STUN") {
      skippedAction = true;
    }

    status.remainingTurns -= 1;
  }

  if (poisonedDamage > 0) {
    applyDamage(unit, poisonedDamage);
  }

  for (let i = unit.statusEffects.length - 1; i >= 0; i -= 1) {
    const status = unit.statusEffects[i];
    if (status.remainingTurns <= 0) {
      expired.push(status.type);
      unit.statusEffects.splice(i, 1);
    }
  }

  return { poisonedDamage, skippedAction, expired };
};

export const canAct = (unit: Unit): boolean => {
  return !unit.statusEffects.some((status) => status.type === "STUN");
};

export const performAction = (actor: Unit, action: Action): TurnResult => {
  if (action.kind === "WAIT") {
    return {
      actor,
      action,
      skipped: false,
      poisonDamage: 0,
      damageDealt: 0,
      statusApplied: null,
      expiredStatuses: [],
    };
  }

  const damage = calculatePhysicalDamage(actor, action.target, action.power);
  const actualDamage = applyDamage(action.target, damage);
  if (action.statusToApply) {
    applyStatus(action.target, action.statusToApply);
  }

  return {
    actor,
    action,
    skipped: false,
    poisonDamage: 0,
    damageDealt: actualDamage,
    statusApplied: action.statusToApply ?? null,
    expiredStatuses: [],
  };
};

export const runTurn = (
  units: Unit[],
  resolveAction: (actor: Unit, units: Unit[]) => Action
): TurnResult[] => {
  const results: TurnResult[] = [];
  const order = getTurnOrder(units);

  for (const entry of order) {
    const actor = entry.unit;
    if (actor.hp <= 0) {
      results.push({
        actor,
        action: null,
        skipped: true,
        poisonDamage: 0,
        damageDealt: 0,
        statusApplied: null,
        expiredStatuses: [],
      });
      continue;
    }

    const statusResult = tickStatusesOnTurnStart(actor);
    if (actor.hp <= 0) {
      results.push({
        actor,
        action: null,
        skipped: true,
        poisonDamage: statusResult.poisonedDamage,
        damageDealt: 0,
        statusApplied: null,
        expiredStatuses: statusResult.expired,
      });
      continue;
    }

    if (statusResult.skippedAction) {
      results.push({
        actor,
        action: null,
        skipped: true,
        poisonDamage: statusResult.poisonedDamage,
        damageDealt: 0,
        statusApplied: null,
        expiredStatuses: statusResult.expired,
      });
      continue;
    }

    const action = resolveAction(actor, units);
    const actionResult = performAction(actor, action);
    results.push({
      ...actionResult,
      poisonDamage: statusResult.poisonedDamage,
      expiredStatuses: statusResult.expired,
    });
  }

  return results;
};
