import { useEffect, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { resetDatabase } from "@/db/database";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import { tacticsRepository } from "@/db/repositories/tacticsRepository";
import { buildDefaultTacticsForClass } from "@/game/tactics/defaults";
import { getBaseStatsForClassLevel } from "@/game/progression";
import { getRandomConstellationId } from "@/constants/constellations";
import { useI18n } from "@/i18n";
import { Locale } from "@/i18n/locale";
import { useLocaleStore } from "@/stores/localeStore";
import { generateEncounter } from "@/game/encounter";
import { BATTLE_SPEED_OPTIONS, BattleSpeedMultiplier } from "@/constants/battleSpeed";
import { ClassId } from "@/types/models";
import { generateId } from "@/utils/id";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textMuted: "#aaaaaa",
  borderDefault: "#e0e0e0",
} as const;

type DebugEncounterTransitionType = 1 | 2 | 3;

type PendingBattleRoute = {
  dungeonId: string;
  floor: number;
  explorationSeed: number;
  encounter: string;
};

const clamp01 = (value: number) => {
  "worklet";
  return Math.max(0, Math.min(1, value));
};

const EncounterSlashBand = ({
  progress,
  index,
}: {
  progress: SharedValue<number>;
  index: number;
}) => {
  const bandStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const start = index * 0.08;
    const local = clamp01((p - start) / 0.35);
    const fade = clamp01((0.95 - p) / 0.2);
    const x = (1 - local) * 360 - 180 + index * 6;
    const opacity = local > 0 ? Math.min(1, fade + 0.15) : 0;
    return {
      opacity,
      transform: [{ translateX: x }, { rotate: "-18deg" }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.encounterSlashBand,
        { top: 120 + index * 54, backgroundColor: index % 2 === 0 ? "#ffffff" : "#f0f0f0" },
        styles.encounterSlashBandAlt,
        bandStyle,
      ]}
    />
  );
};

export default function SettingsScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const setLocale = useLocaleStore((state) => state.setLocale);
  const [isResetting, setIsResetting] = useState(false);
  const [isCreatingDefaults, setIsCreatingDefaults] = useState(false);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  const [isSavingBattleSpeed, setIsSavingBattleSpeed] = useState(false);
  const [battleSpeedMultiplier, setBattleSpeedMultiplier] = useState<BattleSpeedMultiplier>(1);
  const [bgmOn, setBgmOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [transitionType, setTransitionType] = useState<DebugEncounterTransitionType | null>(null);
  const [isTransitionPlaying, setIsTransitionPlaying] = useState(false);
  const transitionProgress = useSharedValue(0);
  const pendingBattleRouteRef = useRef<PendingBattleRoute | null>(null);

  const debugDefaults: Array<{ name: string; classId: ClassId; level: number; slotIndex: number }> = [
    { name: "Aria", classId: "GUARDIAN", level: 1, slotIndex: 0 },
    { name: "Rune", classId: "SWORDMAN", level: 1, slotIndex: 1 },
    { name: "Finn", classId: "THIEF", level: 1, slotIndex: 2 },
    { name: "Lily", classId: "CLERIC", level: 1, slotIndex: 3 },
    { name: "Grim", classId: "BERSERKER", level: 1, slotIndex: 4 },
    { name: "Odin", classId: "WITCH", level: 1, slotIndex: 5 },
  ];

  useEffect(() => {
    let cancelled = false;
    const loadBattleSpeed = async () => {
      try {
        const saved = await settingsRepository.getBattleSpeedMultiplier();
        if (!cancelled) {
          setBattleSpeedMultiplier(saved);
        }
      } catch (error) {
        console.error("Failed to load battle speed setting:", error);
      }
    };
    void loadBattleSpeed();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSelectLanguage = async (nextLocale: Locale) => {
    if (isSavingLanguage || locale === nextLocale) return;
    setIsSavingLanguage(true);
    try {
      await settingsRepository.setLanguage(nextLocale);
      setLocale(nextLocale);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(t("settings.alert.failTitle"), `${t("settings.alert.failBody")}\n${message}`);
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const runReset = async () => {
    setIsResetting(true);
    try {
      await resetDatabase();
      Alert.alert(t("settings.alert.doneTitle"), t("settings.alert.doneBody"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(t("settings.alert.failTitle"), `${t("settings.alert.failBody")}\n${message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const onPressBattleSpeed = async () => {
    if (isSavingBattleSpeed) return;
    const currentIndex = BATTLE_SPEED_OPTIONS.indexOf(battleSpeedMultiplier);
    const nextIndex = (currentIndex + 1) % BATTLE_SPEED_OPTIONS.length;
    const nextSpeed = BATTLE_SPEED_OPTIONS[nextIndex];

    setIsSavingBattleSpeed(true);
    setBattleSpeedMultiplier(nextSpeed);
    try {
      await settingsRepository.setBattleSpeedMultiplier(nextSpeed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(t("settings.alert.failTitle"), `${t("settings.alert.failBody")}\n${message}`);
      setBattleSpeedMultiplier(battleSpeedMultiplier);
    } finally {
      setIsSavingBattleSpeed(false);
    }
  };

  const onPressReset = () => {
    Alert.alert(t("settings.reset.title"), t("settings.reset.body"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.reset.confirm"), style: "destructive", onPress: () => void runReset() },
    ]);
  };

  const createDefaultCharacters = async () => {
    if (isCreatingDefaults) return;
    setIsCreatingDefaults(true);
    try {
      const existing = await charactersRepository.list();
      const byName = new Map(existing.map((character) => [character.name, character]));
      let createdCount = 0;

      for (const preset of debugDefaults) {
        let characterId = byName.get(preset.name)?.id;
        if (!characterId) {
          const constellationId = getRandomConstellationId();
          const base = getBaseStatsForClassLevel(preset.classId, preset.level, constellationId);
          const id = generateId("char");
          await charactersRepository.upsert({
            id,
            slotIndex: null,
            name: preset.name,
            classId: preset.classId,
            constellationId,
            level: preset.level,
            exp: 0,
            baseMaxHp: base.maxHp,
            baseAtk: base.atk,
            baseDef: base.def,
            baseSpd: base.spd,
            baseMaxMp: base.maxMp,
            baseMpRegen: base.mpRegen,
            currentHp: base.maxHp,
            currentMp: base.maxMp,
          });
          const defaultTactics = buildDefaultTacticsForClass(id, preset.classId);
          if (defaultTactics.length > 0) {
            await tacticsRepository.replaceForCharacter(id, defaultTactics);
          }
          characterId = id;
          createdCount += 1;
        }
        if (characterId) {
          await charactersRepository.assignToSlot(characterId, preset.slotIndex);
        }
      }

      Alert.alert(
        t("settings.debug.doneTitle"),
        t("settings.debug.doneBody", { created: createdCount, total: debugDefaults.length })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(t("settings.debug.failTitle"), `${t("settings.debug.failBody")}\n${message}`);
    } finally {
      setIsCreatingDefaults(false);
    }
  };

  const commitDebugBattleTransition = () => {
    const nextRoute = pendingBattleRouteRef.current;
    pendingBattleRouteRef.current = null;
    setIsTransitionPlaying(false);
    setTransitionType(null);
    transitionProgress.value = 0;
    if (!nextRoute) return;

    router.push({
      pathname: "/dungeon/battle",
      params: {
        dungeonId: nextRoute.dungeonId,
        floor: String(nextRoute.floor),
        explorationSeed: String(nextRoute.explorationSeed),
        encounter: nextRoute.encounter,
      },
    });
  };

  const triggerDebugEncounterTransition = (type: DebugEncounterTransitionType) => {
    if (isTransitionPlaying) return;

    const dungeonId = "crestoria_dungeon_1_200";
    const floor = 1;
    const explorationSeed = Date.now() >>> 0;
    const encounter = generateEncounter({
      dungeonId,
      floor,
      seed: (explorationSeed + 1009) >>> 0,
    });

    pendingBattleRouteRef.current = {
      dungeonId,
      floor,
      explorationSeed,
      encounter: JSON.stringify(encounter),
    };

    setTransitionType(type);
    setIsTransitionPlaying(true);
    transitionProgress.value = 0;

    const duration = type === 1 ? 380 : type === 2 ? 460 : 520;
    transitionProgress.value = withTiming(
      1,
      {
        duration,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(commitDebugBattleTransition)();
        }
      }
    );
  };

  const contentMotionStyle = useAnimatedStyle(() => {
    const p = transitionProgress.value;
    if (!transitionType || p <= 0) return { transform: [{ scale: 1 }, { translateX: 0 }, { translateY: 0 }] };

    if (transitionType === 1) {
      const shake = Math.sin(p * Math.PI * 18) * (1 - p) * 10;
      const scale = 1 + Math.sin(clamp01(p * 1.05) * Math.PI) * 0.035;
      return {
        transform: [{ scale }, { translateX: shake }, { translateY: 0 }],
      };
    }

    if (transitionType === 2) {
      const scale = 1 + p * 0.015;
      return {
        transform: [{ scale }, { translateX: 0 }, { translateY: 0 }],
      };
    }

    const scale = 1 + p * 0.02;
    const nudge = -6 * clamp01((p - 0.55) / 0.45);
    return {
      transform: [{ scale }, { translateX: 0 }, { translateY: nudge }],
    };
  });

  const encounterFlashStyle = useAnimatedStyle(() => {
    const p = transitionProgress.value;
    if (!transitionType) return { opacity: 0 };

    let opacity = 0;
    if (transitionType === 1) {
      const first = 1 - clamp01(Math.abs(p - 0.12) / 0.12);
      const second = 1 - clamp01(Math.abs(p - 0.3) / 0.13);
      opacity = Math.max(first, second) * 0.95;
    } else if (transitionType === 2) {
      opacity = clamp01((p - 0.08) / 0.12) * clamp01((0.75 - p) / 0.35) * 0.6;
    } else {
      const pulse = 1 - clamp01(Math.abs(p - 0.18) / 0.16);
      opacity = pulse * 0.9;
    }
    return { opacity };
  });

  const encounterDarkFadeStyle = useAnimatedStyle(() => {
    const p = transitionProgress.value;
    if (!transitionType) return { opacity: 0 };
    const start = transitionType === 3 ? 0.35 : 0.55;
    return { opacity: clamp01((p - start) / (1 - start)) };
  });

  const shutterTopStyle = useAnimatedStyle(() => {
    const p = transitionProgress.value;
    if (transitionType !== 3) return { transform: [{ translateY: -220 }] };
    const local = clamp01((p - 0.15) / 0.55);
    return { transform: [{ translateY: -220 + local * 220 }] };
  });
  const shutterBottomStyle = useAnimatedStyle(() => {
    const p = transitionProgress.value;
    if (transitionType !== 3) return { transform: [{ translateY: 220 }] };
    const local = clamp01((p - 0.15) / 0.55);
    return { transform: [{ translateY: 220 - local * 220 }] };
  });
  const shutterLeftStyle = useAnimatedStyle(() => {
    const p = transitionProgress.value;
    if (transitionType !== 3) return { transform: [{ translateX: -220 }] };
    const local = clamp01((p - 0.22) / 0.58);
    return { transform: [{ translateX: -220 + local * 220 }] };
  });
  const shutterRightStyle = useAnimatedStyle(() => {
    const p = transitionProgress.value;
    if (transitionType !== 3) return { transform: [{ translateX: 220 }] };
    const local = clamp01((p - 0.22) / 0.58);
    return { transform: [{ translateX: 220 - local * 220 }] };
  });

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View style={[styles.screenContent, contentMotionStyle]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("settings.header")}</Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("tab.more")}</Text>
            <View style={styles.card}>
              <Pressable style={styles.row} onPress={() => router.push("/inventory")}>
                <Text style={styles.rowText}>{locale === "ja" ? "倉庫" : "Inventory"}</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.row} onPress={() => router.push("../debug")}>
                <Text style={styles.rowText}>{locale === "ja" ? "デバッグ画面" : "Debug Screen"}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("settings.language")}</Text>
            <View style={styles.card}>
              <Pressable style={styles.row} onPress={() => void onSelectLanguage("ja")}>
                <Text style={styles.rowText}>{t("settings.lang.ja")}</Text>
                <Text style={locale === "ja" ? styles.check : styles.muted}>{locale === "ja" ? "●" : "○"}</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.row} onPress={() => void onSelectLanguage("en")}>
                <Text style={styles.rowText}>{t("settings.lang.en")}</Text>
                <Text style={locale === "en" ? styles.check : styles.muted}>{locale === "en" ? "●" : "○"}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("settings.audio")}</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowText}>{t("settings.audio.bgm")}</Text>
                <Switch value={bgmOn} onValueChange={setBgmOn} />
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowText}>{t("settings.audio.sfx")}</Text>
                <Switch value={sfxOn} onValueChange={setSfxOn} />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("settings.battle")}</Text>
            <View style={styles.card}>
              <Pressable
                style={[styles.row, isSavingBattleSpeed && styles.rowDisabled]}
                disabled={isSavingBattleSpeed}
                onPress={() => void onPressBattleSpeed()}
              >
                <Text style={styles.rowText}>{t("settings.battle.speed")}</Text>
                <Text style={styles.rowValueText}>{`${battleSpeedMultiplier}x`}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("settings.account")}</Text>
            <View style={styles.card}>
              <Pressable style={styles.row} onPress={onPressReset}>
                <Text style={styles.rowText}>{isResetting ? t("settings.reset.loading") : t("settings.reset.button")}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("settings.debug")}</Text>
            <View style={styles.card}>
              <Pressable style={styles.row} onPress={() => void createDefaultCharacters()}>
                <Text style={styles.rowText}>
                  {isCreatingDefaults ? t("settings.debug.loading") : t("settings.debug.createDefaults")}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                style={[styles.row, isTransitionPlaying && styles.rowDisabled]}
                disabled={isTransitionPlaying}
                onPress={() => triggerDebugEncounterTransition(1)}
              >
                <Text style={styles.rowText}>
                  {isTransitionPlaying ? "Playing..." : "Battle Transition Test 1 (Flash)"}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                style={[styles.row, isTransitionPlaying && styles.rowDisabled]}
                disabled={isTransitionPlaying}
                onPress={() => triggerDebugEncounterTransition(2)}
              >
                <Text style={styles.rowText}>
                  {isTransitionPlaying ? "Playing..." : "Battle Transition Test 2 (Slashes)"}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                style={[styles.row, isTransitionPlaying && styles.rowDisabled]}
                disabled={isTransitionPlaying}
                onPress={() => triggerDebugEncounterTransition(3)}
              >
                <Text style={styles.rowText}>
                  {isTransitionPlaying ? "Playing..." : "Battle Transition Test 3 (Shutter)"}
                </Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.row} onPress={() => router.push("/debug/battle-effects")}>
                <Text style={styles.rowText}>Battle Effect Debug</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.versionWrap}>
            <Text style={styles.versionText}>Dungeon Tactics v1.0.0</Text>
            <Text style={styles.versionText}>Player ID: ADV-2024-0815</Text>
          </View>
        </ScrollView>
      </Animated.View>

      {transitionType ? (
        <View pointerEvents="none" style={styles.encounterOverlayRoot}>
          <Animated.View style={[styles.encounterDarkFade, encounterDarkFadeStyle]} />
          <Animated.View style={[styles.encounterFlash, encounterFlashStyle]} />

          {transitionType === 2 ? (
            <View style={styles.encounterSlashLayer}>
              {Array.from({ length: 7 }).map((_, idx) => (
                <EncounterSlashBand key={`slash-${idx}`} progress={transitionProgress} index={idx} />
              ))}
            </View>
          ) : null}

          {transitionType === 3 ? (
            <View style={styles.encounterShutterLayer}>
              <Animated.View style={[styles.encounterShutterHorizontal, styles.encounterShutterTop, shutterTopStyle]} />
              <Animated.View style={[styles.encounterShutterHorizontal, styles.encounterShutterBottom, shutterBottomStyle]} />
              <Animated.View style={[styles.encounterShutterVertical, styles.encounterShutterLeft, shutterLeftStyle]} />
              <Animated.View style={[styles.encounterShutterVertical, styles.encounterShutterRight, shutterRightStyle]} />
            </View>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  screenContent: { flex: 1 },
  header: { paddingVertical: 12, paddingHorizontal: 20 },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 20 },
  section: { gap: 8 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  card: { borderRadius: 20, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, overflow: "hidden" },
  row: { minHeight: 50, paddingHorizontal: 16, alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  rowDisabled: { opacity: 0.55 },
  rowText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  rowValueText: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.borderDefault },
  muted: { color: colors.textMuted },
  check: { color: colors.textPrimary },
  versionWrap: { alignItems: "center", gap: 4, paddingTop: 24 },
  versionText: { color: colors.textMuted, fontSize: 11 },
  encounterOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  encounterDarkFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    opacity: 0,
  },
  encounterFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
    opacity: 0,
  },
  encounterSlashLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  encounterSlashBand: {
    position: "absolute",
    left: -160,
    width: 520,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  encounterSlashBandAlt: {
    opacity: 0.9,
  },
  encounterShutterLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  encounterShutterHorizontal: {
    position: "absolute",
    left: 0,
    width: "100%",
    height: "24%",
    backgroundColor: "#111111",
  },
  encounterShutterTop: {
    top: 0,
  },
  encounterShutterBottom: {
    bottom: 0,
  },
  encounterShutterVertical: {
    position: "absolute",
    top: "24%",
    bottom: "24%",
    width: "26%",
    backgroundColor: "#111111",
  },
  encounterShutterLeft: {
    left: 0,
  },
  encounterShutterRight: {
    right: 0,
  },
});
