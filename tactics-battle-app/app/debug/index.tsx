import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BATTLE_SPEED_OPTIONS,
  BattleSpeedMultiplier,
  EXPLORATION_SPEED_OPTIONS,
  ExplorationSpeedMultiplier,
} from "@/constants/battleSpeed";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import { useI18n } from "@/i18n";

const colors = {
  screen: "#09090b",
  surface: "#18181b",
  surfaceBorder: "#27272a",
  rowBorder: "#3f3f46",
  text: "#f4f4f5",
  subtext: "#a1a1aa",
  accent: "#22c55e",
  accentMuted: "#14532d",
} as const;

const SpeedSelector = <T extends number>({
  options,
  value,
  title,
  onSelect,
}: {
  options: readonly T[];
  value: T;
  title: string;
  onSelect: (nextValue: T) => void;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.speedGrid}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            style={[styles.speedChip, active && styles.speedChipActive]}
            onPress={() => onSelect(option)}
          >
            <Text style={[styles.speedChipText, active && styles.speedChipTextActive]}>{`${option}x`}</Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

export default function DebugScreen() {
  const router = useRouter();
  const { locale } = useI18n();
  const [battleSpeedMultiplier, setBattleSpeedMultiplier] = useState<BattleSpeedMultiplier>(1);
  const [explorationSpeedMultiplier, setExplorationSpeedMultiplier] = useState<ExplorationSpeedMultiplier>(1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [battleSpeed, explorationSpeed] = await Promise.all([
          settingsRepository.getBattleSpeedMultiplier(),
          settingsRepository.getExplorationSpeedMultiplier(),
        ]);
        if (!cancelled) {
          setBattleSpeedMultiplier(battleSpeed);
          setExplorationSpeedMultiplier(explorationSpeed);
        }
      } catch (error) {
        console.error("Failed to load debug settings:", error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistBattleSpeed = async (nextSpeed: BattleSpeedMultiplier) => {
    setBattleSpeedMultiplier(nextSpeed);
    try {
      await settingsRepository.setBattleSpeedMultiplier(nextSpeed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(locale === "ja" ? "保存失敗" : "Save failed", message);
    }
  };

  const persistExplorationSpeed = async (nextSpeed: ExplorationSpeedMultiplier) => {
    setExplorationSpeedMultiplier(nextSpeed);
    try {
      await settingsRepository.setExplorationSpeedMultiplier(nextSpeed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(locale === "ja" ? "保存失敗" : "Save failed", message);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen options={{ title: locale === "ja" ? "デバッグ" : "Debug" }} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
          <Text style={styles.title}>{locale === "ja" ? "速度設定" : "Speed Settings"}</Text>
          <Text style={styles.description}>
            {locale === "ja"
              ? "探索と戦闘の進行速度を 1x から 10x まで個別に設定できます。"
              : "Configure exploration and battle speeds independently from 1x to 10x."}
          </Text>
        </View>

        <SpeedSelector
          options={EXPLORATION_SPEED_OPTIONS}
          value={explorationSpeedMultiplier}
          title={locale === "ja" ? "探索速度" : "Exploration Speed"}
          onSelect={(nextSpeed) => void persistExplorationSpeed(nextSpeed)}
        />

        <SpeedSelector
          options={BATTLE_SPEED_OPTIONS}
          value={battleSpeedMultiplier}
          title={locale === "ja" ? "戦闘速度" : "Battle Speed"}
          onSelect={(nextSpeed) => void persistBattleSpeed(nextSpeed)}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{locale === "ja" ? "デバッグツール" : "Debug Tools"}</Text>
          <View style={styles.linkList}>
            <Pressable style={styles.linkRow} onPress={() => router.push("/debug/battle-effects")}>
              <Text style={styles.linkText}>Battle Effect Debug</Text>
            </Pressable>
          </View>
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
    padding: 16,
    gap: 16,
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.surface,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  description: {
    color: colors.subtext,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.surface,
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  speedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  speedChip: {
    minWidth: 60,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.rowBorder,
    alignItems: "center",
    backgroundColor: "#111827",
  },
  speedChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  speedChipText: {
    color: colors.text,
    fontWeight: "600",
  },
  speedChipTextActive: {
    color: "#dcfce7",
  },
  linkList: {
    borderWidth: 1,
    borderColor: colors.rowBorder,
    borderRadius: 12,
    overflow: "hidden",
  },
  linkRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "#111827",
  },
  linkText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
});
