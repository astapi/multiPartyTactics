export const BATTLE_SPEED_OPTIONS = [1, 1.5, 2] as const;

export type BattleSpeedMultiplier = (typeof BATTLE_SPEED_OPTIONS)[number];

export const isBattleSpeedMultiplier = (value: number): value is BattleSpeedMultiplier => {
  return BATTLE_SPEED_OPTIONS.includes(value as BattleSpeedMultiplier);
};
