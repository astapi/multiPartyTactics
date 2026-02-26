import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";
import LottieView from "lottie-react-native";
import type { AnimationObject } from "lottie-react-native";
import { getAttackTrailPreset, HIT_IMPACT_PRESET } from "@/features/battle/animation/presets";
import type {
  BattleAttackStyle,
  BattleEffectRect,
  BattleVisualEvent,
} from "@/features/battle/animation/types";

type BattleEffectLayerProps = {
  enemyRects: Record<string, BattleEffectRect>;
  visualEvents: BattleVisualEvent[];
  revealedLogCount: number;
  onPlayHitReaction?: (params: { targetIds: string[]; attackStyle: BattleAttackStyle }) => void;
};

type ActiveFlash = {
  id: string;
  rect: BattleEffectRect;
};

type ActiveTrail = {
  id: string;
  rect: BattleEffectRect;
  style: BattleAttackStyle;
};

type ActiveDamageNumber = {
  id: string;
  rect: BattleEffectRect;
  amount: number;
  indexOffset: number;
};

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedText = Animated.createAnimatedComponent(Text);

const MAX_CONCURRENT_FLASHES = 12;
const MAX_CONCURRENT_TRAILS = 8;
const MAX_CONCURRENT_DAMAGE_NUMBERS = 16;

/* ---------- SVG Fallback components ---------- */

const SvgFlashEffect = ({ rect, onDone }: { rect: BattleEffectRect; onDone: () => void }) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(0.78, { duration: 70, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 100, easing: Easing.in(Easing.quad) })
    );
    const timer = setTimeout(onDone, 210);
    return () => clearTimeout(timer);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <AnimatedView
      pointerEvents="none"
      style={[
        styles.flash,
        {
          left: rect.x + 8,
          top: rect.y,
          width: Math.max(24, rect.width - 16),
          height: Math.max(24, rect.height * 0.78),
          borderRadius: Math.min(18, rect.width * 0.18),
        },
        animatedStyle,
      ]}
    />
  );
};

const SvgTrailEffect = ({
  rect,
  attackStyle,
  onDone,
}: {
  rect: BattleEffectRect;
  attackStyle: BattleAttackStyle;
  onDone: () => void;
}) => {
  const preset = getAttackTrailPreset(attackStyle);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(preset.scaleFrom);
  const rotationDeg =
    attackStyle === "dagger" ? -8 : attackStyle === "axe2h" ? 10 : attackStyle === "sword" ? -15 : -12;

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(preset.opacityPeak, { duration: Math.round(preset.durationMs * 0.35) }),
      withTiming(0, { duration: Math.round(preset.durationMs * 0.65) })
    );
    scale.value = withTiming(1, { duration: preset.durationMs, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(onDone, preset.durationMs + 40);
    return () => clearTimeout(timer);
  }, [opacity, preset, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotationDeg}deg` }],
  }));

  const padX = Math.max(14, rect.width * 0.28);
  const padY = Math.max(12, rect.height * 0.22);
  const box = {
    left: rect.x - padX,
    top: rect.y - padY,
    width: rect.width + padX * 2,
    height: rect.height + padY * 2,
  };

  return (
    <AnimatedView pointerEvents="none" style={[styles.trailContainer, box, animatedStyle]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        {preset.variant === "single" ? (
          <>
            <Line x1="18" y1="78" x2="86" y2="20" stroke={preset.glow} strokeWidth={preset.strokeWidth + 4} />
            <Line
              x1="18"
              y1="78"
              x2="86"
              y2="20"
              stroke={preset.stroke}
              strokeWidth={preset.strokeWidth}
              strokeLinecap="round"
            />
          </>
        ) : null}
        {preset.variant === "double" ? (
          <>
            <Line x1="22" y1="72" x2="72" y2="28" stroke={preset.glow} strokeWidth={preset.strokeWidth + 3} />
            <Line x1="30" y1="84" x2="82" y2="36" stroke={preset.glow} strokeWidth={preset.strokeWidth + 2} />
            <Line
              x1="22"
              y1="72"
              x2="72"
              y2="28"
              stroke={preset.stroke}
              strokeWidth={preset.strokeWidth}
              strokeLinecap="round"
            />
            <Line
              x1="30"
              y1="84"
              x2="82"
              y2="36"
              stroke={preset.stroke}
              strokeWidth={Math.max(1.5, preset.strokeWidth - 0.4)}
              strokeLinecap="round"
            />
          </>
        ) : null}
        {preset.variant === "heavy" ? (
          <>
            <Path
              d="M16 78 Q44 14 86 34"
              fill="none"
              stroke={preset.glow}
              strokeWidth={preset.strokeWidth + 5}
              strokeLinecap="round"
            />
            <Path
              d="M16 78 Q44 14 86 34"
              fill="none"
              stroke={preset.stroke}
              strokeWidth={preset.strokeWidth}
              strokeLinecap="round"
            />
            <Line x1="52" y1="46" x2="78" y2="58" stroke={preset.stroke} strokeWidth={2} strokeLinecap="round" />
          </>
        ) : null}
      </Svg>
    </AnimatedView>
  );
};

/* ---------- Lottie-based components ---------- */

const LottieTrailEffect = ({
  rect,
  attackStyle,
  onDone,
}: {
  rect: BattleEffectRect;
  attackStyle: BattleAttackStyle;
  onDone: () => void;
}) => {
  const preset = getAttackTrailPreset(attackStyle);

  if (preset.lottieSource == null) {
    return <SvgTrailEffect rect={rect} attackStyle={attackStyle} onDone={onDone} />;
  }

  const padX = Math.max(14, rect.width * 0.28);
  const padY = Math.max(12, rect.height * 0.22);
  const box = {
    left: rect.x - padX,
    top: rect.y - padY,
    width: rect.width + padX * 2,
    height: rect.height + padY * 2,
  };

  return (
    <LottieTrailInner
      source={preset.lottieSource}
      speed={preset.lottieSpeed}
      durationMs={preset.durationMs}
      box={box}
      onDone={onDone}
    />
  );
};

const LottieTrailInner = ({
  source,
  speed,
  durationMs,
  box,
  onDone,
}: {
  source: AnimationObject;
  speed: number;
  durationMs: number;
  box: { left: number; top: number; width: number; height: number };
  onDone: () => void;
}) => {
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    const timer = setTimeout(finish, durationMs + 80);
    return () => clearTimeout(timer);
  }, [durationMs]);

  return (
    <View pointerEvents="none" style={[styles.trailContainer, box]}>
      <LottieView
        source={source}
        autoPlay
        loop={false}
        speed={speed}
        onAnimationFinish={finish}
        style={styles.lottieFill}
      />
    </View>
  );
};

const LottieFlashEffect = ({ rect, onDone }: { rect: BattleEffectRect; onDone: () => void }) => {
  const preset = HIT_IMPACT_PRESET;

  if (preset.lottieSource == null) {
    return <SvgFlashEffect rect={rect} onDone={onDone} />;
  }

  return <LottieFlashInner source={preset.lottieSource} speed={preset.lottieSpeed} durationMs={preset.durationMs} rect={rect} onDone={onDone} />;
};

const LottieFlashInner = ({
  source,
  speed,
  durationMs,
  rect,
  onDone,
}: {
  source: AnimationObject;
  speed: number;
  durationMs: number;
  rect: BattleEffectRect;
  onDone: () => void;
}) => {
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    const timer = setTimeout(finish, durationMs + 80);
    return () => clearTimeout(timer);
  }, [durationMs]);

  const size = Math.max(rect.width, rect.height) * 1.2;
  const cx = rect.x + rect.width * 0.5 - size * 0.5;
  const cy = rect.y + rect.height * 0.5 - size * 0.5;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.trailContainer,
        { left: cx, top: cy, width: size, height: size },
      ]}
    >
      <LottieView
        source={source}
        autoPlay
        loop={false}
        speed={speed}
        onAnimationFinish={finish}
        style={styles.lottieFill}
      />
    </View>
  );
};

/* ---------- Damage number (unchanged) ---------- */

const DamageNumberEffect = ({
  rect,
  amount,
  indexOffset,
  onDone,
}: {
  rect: BattleEffectRect;
  amount: number;
  indexOffset: number;
  onDone: () => void;
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(onDone, 560);
    return () => clearTimeout(timer);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const eased = progress.value;
    return {
      opacity: 1 - eased,
      transform: [{ translateY: -22 * eased }, { scale: 1 + (1 - eased) * 0.08 }],
    };
  });

  const baseLeft = rect.x + rect.width * 0.5 - 10;
  const baseTop = rect.y + Math.max(0, rect.height * 0.15);
  const xOffset = (indexOffset % 2 === 0 ? -1 : 1) * (6 + (indexOffset % 3) * 3);

  return (
    <AnimatedText
      pointerEvents="none"
      style={[styles.damageNumber, { left: baseLeft + xOffset, top: baseTop }, animatedStyle]}
    >
      {Math.max(0, Math.floor(amount))}
    </AnimatedText>
  );
};

/* ---------- Main component ---------- */

export function BattleEffectLayer({
  enemyRects,
  visualEvents,
  revealedLogCount,
  onPlayHitReaction,
}: BattleEffectLayerProps) {
  const [flashes, setFlashes] = useState<ActiveFlash[]>([]);
  const [trails, setTrails] = useState<ActiveTrail[]>([]);
  const [damageNumbers, setDamageNumbers] = useState<ActiveDamageNumber[]>([]);
  const lastProcessedLogIndexRef = useRef(-1);
  const seqRef = useRef(0);

  const eventsByLogIndex = useMemo(() => {
    const map = new Map<number, BattleVisualEvent[]>();
    for (const event of visualEvents) {
      const list = map.get(event.logIndex);
      if (list) {
        list.push(event);
      } else {
        map.set(event.logIndex, [event]);
      }
    }
    return map;
  }, [visualEvents]);

  useEffect(() => {
    if (revealedLogCount === 0) {
      lastProcessedLogIndexRef.current = -1;
      setFlashes([]);
      setTrails([]);
      setDamageNumbers([]);
      return;
    }

    const nextLogIndex = revealedLogCount - 1;
    if (nextLogIndex < lastProcessedLogIndexRef.current) {
      lastProcessedLogIndexRef.current = -1;
      setFlashes([]);
      setTrails([]);
      setDamageNumbers([]);
      return;
    }

    for (let index = lastProcessedLogIndexRef.current + 1; index <= nextLogIndex; index += 1) {
      const events = eventsByLogIndex.get(index) ?? [];
      let damageNumberSeq = 0;
      for (const event of events) {
        if (event.kind === "hit_reaction") {
          onPlayHitReaction?.({
            targetIds: event.targetIds,
            attackStyle: event.attackStyle ?? "generic",
          });
          continue;
        }

        if (event.kind === "attack_trail") {
          const targetRects = event.targetIds
            .map((id) => enemyRects[id])
            .filter((r): r is BattleEffectRect => Boolean(r));
          if (targetRects.length === 0) continue;
          const style = event.attackStyle ?? "generic";

          if (style === "cleave" && targetRects.length > 1) {
            // Cleave: 全ターゲットを覆う1本の横薙ぎ
            const merged: BattleEffectRect = {
              x: Math.min(...targetRects.map((r) => r.x)),
              y: Math.min(...targetRects.map((r) => r.y)),
              width:
                Math.max(...targetRects.map((r) => r.x + r.width)) -
                Math.min(...targetRects.map((r) => r.x)),
              height:
                Math.max(...targetRects.map((r) => r.y + r.height)) -
                Math.min(...targetRects.map((r) => r.y)),
            };
            const id = `trail-${seqRef.current++}`;
            setTrails((prev) => [...prev, { id, rect: merged, style }].slice(-MAX_CONCURRENT_TRAILS));
          } else {
            // その他: 各ターゲットに個別エフェクト
            const newTrails = targetRects.map((r) => ({
              id: `trail-${seqRef.current++}`,
              rect: r,
              style,
            }));
            setTrails((prev) => [...prev, ...newTrails].slice(-MAX_CONCURRENT_TRAILS));
          }
          continue;
        }

        if (event.kind === "hit_flash") {
          const nextFlashes = event.targetIds
            .map((id) => enemyRects[id])
            .filter((rect): rect is BattleEffectRect => Boolean(rect))
            .map((rect) => ({ id: `flash-${seqRef.current++}`, rect }));
          if (nextFlashes.length > 0) {
            setFlashes((prev) => [...prev, ...nextFlashes].slice(-MAX_CONCURRENT_FLASHES));
          }
          continue;
        }

        if (event.kind === "damage_number" && (event.amount ?? 0) > 0) {
          const nextNumbers = event.targetIds
            .map((id) => enemyRects[id])
            .filter((rect): rect is BattleEffectRect => Boolean(rect))
            .map((rect) => ({
              id: `dmg-${seqRef.current++}`,
              rect,
              amount: event.amount ?? 0,
              indexOffset: damageNumberSeq++,
            }));
          if (nextNumbers.length > 0) {
            setDamageNumbers((prev) => [...prev, ...nextNumbers].slice(-MAX_CONCURRENT_DAMAGE_NUMBERS));
          }
        }
      }
    }

    lastProcessedLogIndexRef.current = nextLogIndex;
  }, [enemyRects, eventsByLogIndex, onPlayHitReaction, revealedLogCount]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {trails.map((trail) => (
        <LottieTrailEffect
          key={trail.id}
          rect={trail.rect}
          attackStyle={trail.style}
          onDone={() => setTrails((prev) => prev.filter((entry) => entry.id !== trail.id))}
        />
      ))}
      {flashes.map((flash) => (
        <LottieFlashEffect
          key={flash.id}
          rect={flash.rect}
          onDone={() => setFlashes((prev) => prev.filter((entry) => entry.id !== flash.id))}
        />
      ))}
      {damageNumbers.map((entry) => (
        <DamageNumberEffect
          key={entry.id}
          rect={entry.rect}
          amount={entry.amount}
          indexOffset={entry.indexOffset}
          onDone={() => setDamageNumbers((prev) => prev.filter((item) => item.id !== entry.id))}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flash: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(254,226,226,0.9)",
  },
  damageNumber: {
    position: "absolute",
    minWidth: 20,
    color: "#fff7ed",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "#7c2d12",
    textShadowRadius: 5,
  },
  trailContainer: {
    position: "absolute",
  },
  lottieFill: {
    width: "100%",
    height: "100%",
  },
});
