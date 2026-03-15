export const SPEED_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type SpeedMultiplier = (typeof SPEED_OPTIONS)[number];

export const BATTLE_SPEED_OPTIONS = SPEED_OPTIONS;
export type BattleSpeedMultiplier = SpeedMultiplier;

export const EXPLORATION_SPEED_OPTIONS = SPEED_OPTIONS;
export type ExplorationSpeedMultiplier = SpeedMultiplier;

const isSpeedMultiplier = (value: number): value is SpeedMultiplier => {
  return SPEED_OPTIONS.includes(value as SpeedMultiplier);
};

export const isBattleSpeedMultiplier = (value: number): value is BattleSpeedMultiplier => {
  return isSpeedMultiplier(value);
};

export const isExplorationSpeedMultiplier = (value: number): value is ExplorationSpeedMultiplier => {
  return isSpeedMultiplier(value);
};
