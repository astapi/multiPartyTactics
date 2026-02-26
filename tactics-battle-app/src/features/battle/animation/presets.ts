import type { AnimationObject } from "lottie-react-native";
import type { BattleAttackStyle } from "./types";

export type AttackTrailPreset = {
  stroke: string;
  glow: string;
  strokeWidth: number;
  durationMs: number;
  scaleFrom: number;
  opacityPeak: number;
  hitReactionAmplitude: number;
  variant: "single" | "double" | "heavy";
  lottieSource: AnimationObject | null;
  lottieSpeed: number;
};

export type HitImpactPreset = {
  durationMs: number;
  lottieSource: AnimationObject | null;
  lottieSpeed: number;
};

const PRESETS: Record<BattleAttackStyle, AttackTrailPreset> = {
  sword: {
    stroke: "#f8fafc",
    glow: "rgba(148, 163, 184, 0.6)",
    strokeWidth: 3,
    durationMs: 160,
    scaleFrom: 0.9,
    opacityPeak: 0.95,
    hitReactionAmplitude: 8,
    variant: "single",
    lottieSource: require("@/assets/animations/battle/slash_sword.json"),
    lottieSpeed: 1,
  },
  dagger: {
    stroke: "#fef3c7",
    glow: "rgba(251, 191, 36, 0.5)",
    strokeWidth: 2.5,
    durationMs: 110,
    scaleFrom: 0.95,
    opacityPeak: 0.9,
    hitReactionAmplitude: 5,
    variant: "double",
    lottieSource: require("@/assets/animations/battle/slash_dagger.json"),
    lottieSpeed: 1,
  },
  axe2h: {
    stroke: "#fde68a",
    glow: "rgba(245, 158, 11, 0.55)",
    strokeWidth: 4.5,
    durationMs: 220,
    scaleFrom: 0.85,
    opacityPeak: 0.98,
    hitReactionAmplitude: 12,
    variant: "heavy",
    lottieSource: require("@/assets/animations/battle/slash_axe_heavy.json"),
    lottieSpeed: 1,
  },
  cleave: {
    stroke: "#e2e8f0",
    glow: "rgba(180, 190, 210, 0.55)",
    strokeWidth: 3.5,
    durationMs: 180,
    scaleFrom: 0.94,
    opacityPeak: 0.95,
    hitReactionAmplitude: 9,
    variant: "single",
    lottieSource: require("@/assets/animations/battle/cleave.json"),
    lottieSpeed: 1,
  },
  lightning: {
    stroke: "#93c5fd",
    glow: "rgba(96, 165, 250, 0.55)",
    strokeWidth: 3,
    durationMs: 150,
    scaleFrom: 0.92,
    opacityPeak: 0.95,
    hitReactionAmplitude: 10,
    variant: "single",
    lottieSource: require("@/assets/animations/battle/lightning.json"),
    lottieSpeed: 1,
  },
  fireball: {
    stroke: "#fbbf24",
    glow: "rgba(249, 115, 22, 0.55)",
    strokeWidth: 4,
    durationMs: 200,
    scaleFrom: 0.88,
    opacityPeak: 0.96,
    hitReactionAmplitude: 10,
    variant: "heavy",
    lottieSource: require("@/assets/animations/battle/fireball.json"),
    lottieSpeed: 1,
  },
  generic: {
    stroke: "#e2e8f0",
    glow: "rgba(148, 163, 184, 0.45)",
    strokeWidth: 2.5,
    durationMs: 140,
    scaleFrom: 0.92,
    opacityPeak: 0.88,
    hitReactionAmplitude: 6,
    variant: "single",
    lottieSource: require("@/assets/animations/battle/slash_generic.json"),
    lottieSpeed: 1,
  },
};

export const HIT_IMPACT_PRESET: HitImpactPreset = {
  durationMs: 210,
  lottieSource: require("@/assets/animations/battle/hit_impact.json"),
  lottieSpeed: 1,
};

export const getAttackTrailPreset = (style: BattleAttackStyle | undefined): AttackTrailPreset =>
  PRESETS[style ?? "generic"] ?? PRESETS.generic;
