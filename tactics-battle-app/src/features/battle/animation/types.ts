export type BattleAttackStyle = "sword" | "dagger" | "axe2h" | "cleave" | "lightning" | "fireball" | "generic";

export type BattleVisualEventKind =
  | "attack_trail"
  | "hit_flash"
  | "hit_reaction"
  | "damage_number";

export type BattleVisualEvent = {
  kind: BattleVisualEventKind;
  turn: number;
  logIndex: number;
  actorId?: string;
  targetIds: string[];
  amount?: number;
  attackStyle?: BattleAttackStyle;
};

export type BattleEffectRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
