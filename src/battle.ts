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
  maxMp: number;
  mpRegen: number;
};

export type StatEffect = {
  kind: "STAT";
  id: string;
  stat: "atk" | "def";
  amount: number;
  remainingTurns: number | null;
  source: string;
};

export type DamageReductionEffect = {
  kind: "DAMAGE_REDUCTION";
  id: string;
  multiplier: number;
  remainingTurns: number | null;
  source: string;
};

export type Effect = StatEffect | DamageReductionEffect;

export type Unit = {
  id: string;
  name: string;
  stats: Stats;
  hp: number;
  mp: number;
  statusEffects: StatusEffect[];
  effects: Effect[];
  cooldowns: Record<string, number>;
  jobId?: string;
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
  return Math.max(
    1,
    power + getEffectiveStat(attacker, "atk") - getEffectiveStat(defender, "def")
  );
};

export const applyDamage = (target: Unit, amount: number): number => {
  const adjusted =
    amount <= 0
      ? 0
      : Math.max(1, Math.floor(amount * getDamageTakenMultiplier(target)));
  const actual = Math.max(0, Math.min(target.hp, adjusted));
  target.hp -= actual;
  return actual;
};

export const applyFixedDamage = (target: Unit, amount: number): number => {
  const adjusted = amount <= 0 ? 0 : Math.max(1, Math.floor(amount));
  const actual = Math.max(0, Math.min(target.hp, adjusted));
  target.hp -= actual;
  return actual;
};

export const applyHealing = (target: Unit, amount: number): number => {
  const actual = Math.max(0, Math.min(target.stats.maxHp - target.hp, amount));
  target.hp += actual;
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

export const getEffectiveStat = (unit: Unit, stat: "atk" | "def"): number => {
  const base = unit.stats[stat];
  const modifierSum = unit.effects
    .filter((effect): effect is StatEffect => effect.kind === "STAT" && effect.stat === stat)
    .reduce((sum, effect) => sum + effect.amount, 0);
  return base + modifierSum;
};

export const getDamageTakenMultiplier = (unit: Unit): number => {
  return unit.effects
    .filter(
      (effect): effect is DamageReductionEffect => effect.kind === "DAMAGE_REDUCTION"
    )
    .reduce((multiplier, effect) => multiplier * effect.multiplier, 1);
};

export const applyEffect = (unit: Unit, effect: Effect): void => {
  const existing = unit.effects.find(
    (entry) =>
      entry.kind === effect.kind &&
      entry.id === effect.id &&
      (entry.kind !== "STAT" || (effect.kind === "STAT" && entry.stat === effect.stat))
  );

  if (!existing) {
    unit.effects.push({ ...effect });
    return;
  }

  if (existing.remainingTurns !== null && effect.remainingTurns !== null) {
    existing.remainingTurns = Math.max(existing.remainingTurns, effect.remainingTurns);
  } else {
    existing.remainingTurns = null;
  }

  if (existing.kind === "STAT" && effect.kind === "STAT") {
    const currentMagnitude = Math.abs(existing.amount);
    const incomingMagnitude = Math.abs(effect.amount);
    if (incomingMagnitude >= currentMagnitude) {
      existing.amount = effect.amount;
    }
  }

  if (existing.kind === "DAMAGE_REDUCTION" && effect.kind === "DAMAGE_REDUCTION") {
    existing.multiplier = Math.min(existing.multiplier, effect.multiplier);
  }
};

export const tickEffectsOnTurnStart = (unit: Unit): string[] => {
  const expired: string[] = [];
  for (const effect of unit.effects) {
    if (effect.remainingTurns !== null) {
      effect.remainingTurns -= 1;
    }
  }

  for (let i = unit.effects.length - 1; i >= 0; i -= 1) {
    const effect = unit.effects[i];
    if (effect.remainingTurns !== null && effect.remainingTurns <= 0) {
      expired.push(effect.id);
      unit.effects.splice(i, 1);
    }
  }

  return expired;
};

export const tickCooldownsOnTurnStart = (unit: Unit): void => {
  for (const [key, value] of Object.entries(unit.cooldowns)) {
    unit.cooldowns[key] = Math.max(0, value - 1);
  }
};

export const regenerateMp = (unit: Unit): number => {
  const actual = Math.max(0, Math.min(unit.stats.maxMp - unit.mp, unit.stats.mpRegen));
  unit.mp += actual;
  return actual;
};

export const tickStatusesOnTurnStart = (unit: Unit): StatusTickResult => {
  let poisonedDamage = 0;
  let skippedAction = false;
  const expired: StatusType[] = [];

  for (const status of unit.statusEffects) {
    if (status.type === "POISON") {
      poisonedDamage += status.potency ?? 0;
    }

    if (status.type === "STUN") {
      skippedAction = true;
    }

    status.remainingTurns -= 1;
  }

  if (poisonedDamage > 0) {
    applyFixedDamage(unit, poisonedDamage);
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

    tickCooldownsOnTurnStart(actor);
    regenerateMp(actor);
    tickEffectsOnTurnStart(actor);
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
