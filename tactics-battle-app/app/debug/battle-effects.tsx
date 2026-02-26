import { Stack } from "expo-router";
import { useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BattleEffectLayer } from "@/components/battle/BattleEffectLayer";
import type {
  BattleAttackStyle,
  BattleEffectRect,
  BattleVisualEvent,
} from "@/features/battle/animation/types";

type EnemyRectMap = Record<string, BattleEffectRect>;

const colors = {
  screen: "#09090b",
  panel: "#18181b",
  panelBorder: "#27272a",
  stage: "#111827",
  stageBorder: "#334155",
  enemy: "#1f2937",
  enemyBorder: "#64748b",
  text: "#f4f4f5",
  subtext: "#a1a1aa",
  button: "#27272a",
  buttonBorder: "#3f3f46",
  accent: "#f59e0b",
} as const;

const makeEnemyRects = (stageWidth: number, stageHeight: number): EnemyRectMap => ({
  enemy1: {
    x: Math.round(stageWidth * 0.08),
    y: Math.round(stageHeight * 0.18),
    width: Math.round(stageWidth * 0.22),
    height: Math.round(stageHeight * 0.34),
  },
  enemy2: {
    x: Math.round(stageWidth * 0.39),
    y: Math.round(stageHeight * 0.1),
    width: Math.round(stageWidth * 0.22),
    height: Math.round(stageHeight * 0.36),
  },
  enemy3: {
    x: Math.round(stageWidth * 0.7),
    y: Math.round(stageHeight * 0.22),
    width: Math.round(stageWidth * 0.22),
    height: Math.round(stageHeight * 0.34),
  },
});

const addLogBatch = ({
  nextLogIndexRef,
  setVisualEvents,
  setRevealedLogCount,
  events,
}: {
  nextLogIndexRef: MutableRefObject<number>;
  setVisualEvents: Dispatch<SetStateAction<BattleVisualEvent[]>>;
  setRevealedLogCount: Dispatch<SetStateAction<number>>;
  events: Omit<BattleVisualEvent, "logIndex" | "turn">[];
}) => {
  const logIndex = nextLogIndexRef.current;
  nextLogIndexRef.current += 1;
  setVisualEvents((prev) => [
    ...prev,
    ...events.map((event) => ({
      ...event,
      turn: 1,
      logIndex,
    })),
  ]);
  setRevealedLogCount(nextLogIndexRef.current);
};

export default function BattleEffectsDebugScreen() {
  const { width } = useWindowDimensions();
  const stageWidth = Math.min(Math.max(width - 32, 280), 460);
  const stageHeight = 260;
  const enemyRects = useMemo(() => makeEnemyRects(stageWidth, stageHeight), [stageHeight, stageWidth]);
  const [visualEvents, setVisualEvents] = useState<BattleVisualEvent[]>([]);
  const [revealedLogCount, setRevealedLogCount] = useState(0);
  const [lastActionLabel, setLastActionLabel] = useState("Ready");
  const nextLogIndexRef = useRef(0);

  const fireAttack = (attackStyle: BattleAttackStyle, targetId: keyof EnemyRectMap, amount: number) => {
    setLastActionLabel(`${attackStyle} -> ${targetId} (${amount})`);
    addLogBatch({
      nextLogIndexRef,
      setVisualEvents,
      setRevealedLogCount,
      events: [
        {
          kind: "attack_trail",
          targetIds: [targetId],
          attackStyle,
        },
        {
          kind: "hit_flash",
          targetIds: [targetId],
        },
        {
          kind: "damage_number",
          targetIds: [targetId],
          amount,
        },
      ],
    });
  };

  const fireAoe = (attackStyle: BattleAttackStyle, amount: number) => {
    setLastActionLabel(`${attackStyle} -> all (${amount})`);
    addLogBatch({
      nextLogIndexRef,
      setVisualEvents,
      setRevealedLogCount,
      events: [
        {
          kind: "attack_trail",
          targetIds: ["enemy1", "enemy2", "enemy3"],
          attackStyle,
        },
        {
          kind: "hit_flash",
          targetIds: ["enemy1", "enemy2", "enemy3"],
        },
        {
          kind: "damage_number",
          targetIds: ["enemy1", "enemy2", "enemy3"],
          amount,
        },
      ],
    });
  };

  const fireAreaHit = () => {
    setLastActionLabel("AoE flash + damage");
    addLogBatch({
      nextLogIndexRef,
      setVisualEvents,
      setRevealedLogCount,
      events: [
        {
          kind: "hit_flash",
          targetIds: ["enemy1", "enemy2", "enemy3"],
        },
        {
          kind: "damage_number",
          targetIds: ["enemy1", "enemy2", "enemy3"],
          amount: 24,
        },
      ],
    });
  };

  const clearPreview = () => {
    nextLogIndexRef.current = 0;
    setVisualEvents([]);
    setRevealedLogCount(0);
    setLastActionLabel("Reset");
  };

  const buttons: Array<{
    label: string;
    onPress: () => void;
  }> = [
    { label: "Sword", onPress: () => fireAttack("sword", "enemy2", 18) },
    { label: "Dagger", onPress: () => fireAttack("dagger", "enemy1", 12) },
    { label: "Axe 2H", onPress: () => fireAttack("axe2h", "enemy3", 26) },
    { label: "Cleave", onPress: () => fireAoe("cleave", 20) },
    { label: "Lightning", onPress: () => fireAoe("lightning", 22) },
    { label: "Fireball", onPress: () => fireAttack("fireball", "enemy3", 28) },
    { label: "Generic", onPress: () => fireAttack("generic", "enemy2", 15) },
    { label: "AoE", onPress: fireAreaHit },
    { label: "Reset", onPress: clearPreview },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: "Battle Effect Debug" }} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Battle Effect Preview</Text>
          <Text style={styles.panelSubtext}>
            ボタンでエフェクトを再生して、軌跡・ヒットフラッシュ・ダメージ数値を確認します。
          </Text>
          <Text style={styles.panelSubtext}>
            Logs: {revealedLogCount} / Events: {visualEvents.length} / Last: {lastActionLabel}
          </Text>
        </View>

        <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
          <View style={styles.stageGrid} pointerEvents="none" />

          {Object.entries(enemyRects).map(([id, rect], index) => (
            <View
              key={id}
              style={[
                styles.enemyCard,
                {
                  left: rect.x,
                  top: rect.y,
                  width: rect.width,
                  height: rect.height,
                },
              ]}
            >
              <Text style={styles.enemyLabel}>Enemy {index + 1}</Text>
              <Text style={styles.enemyId}>{id}</Text>
            </View>
          ))}

          <BattleEffectLayer
            enemyRects={enemyRects}
            visualEvents={visualEvents}
            revealedLogCount={revealedLogCount}
          />
        </View>

        <View style={styles.buttonGrid}>
          {buttons.map((button) => (
            <Pressable key={button.label} style={styles.button} onPress={button.onPress}>
              <Text style={styles.buttonText}>{button.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  content: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  panel: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.panel,
    padding: 14,
    gap: 6,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  panelSubtext: {
    color: colors.subtext,
    fontSize: 12,
    lineHeight: 16,
  },
  stage: {
    position: "relative",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stageBorder,
    backgroundColor: colors.stage,
    overflow: "hidden",
  },
  stageGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    backgroundColor: "#60a5fa",
  },
  enemyCard: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.enemyBorder,
    backgroundColor: colors.enemy,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 6,
  },
  enemyLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  enemyId: {
    color: colors.subtext,
    fontSize: 10,
  },
  buttonGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  button: {
    minWidth: 96,
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    backgroundColor: colors.button,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  buttonText: {
    color: colors.text,
    fontWeight: "700",
  },
});
