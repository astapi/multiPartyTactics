import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DUNGEONS } from "@/constants/dungeons";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { dungeonRepository } from "@/db/repositories/dungeonRepository";
import {
  ExplorationEvent,
  ExplorationResult,
  generateExplorationResult,
} from "@/game/exploration";
import { toUnit } from "@/game/partyMapper";
import { generateTimeSeed } from "@/utils/rng";

const HERO_IMAGE = require("@/assets/images/backgrounds/dungeon_exploration.jpg");

const EVENT_PREFIX: Record<ExplorationEvent["type"], string> = {
  LOG: "⋄",
  ENCOUNTER: "✖",
  TREASURE: "✦",
  TRAP: "⚠",
};

const formatEvent = (event: ExplorationEvent): string => {
  if (event.type === "TREASURE") {
    return `${event.message} (${event.payload?.itemId ?? "Unknown"})`;
  }
  if (event.type === "TRAP") {
    return `${event.message} (DMG:${event.payload?.damage ?? 0} / ${event.payload?.debuffType ?? "None"})`;
  }
  return event.message;
};

const formatClock = (tick: number): string => {
  const total = tick * 8;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export default function ExplorationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dungeonId?: string; floor?: string }>();

  const resolvedDungeonId = params.dungeonId ?? DUNGEONS[0]?.id ?? "crestoria_dungeon_1_4";
  const floor = Math.max(1, Number.parseInt(params.floor ?? "1", 10) || 1);

  const [currentTick, setCurrentTick] = useState(0);
  const [nextEncounterIndex, setNextEncounterIndex] = useState(0);
  const [result, setResult] = useState<ExplorationResult | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const logScrollRef = useRef<ScrollView | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const list = await dungeonRepository.list();
        const found = list.find((row) => row.dungeonId === resolvedDungeonId);
        const nextProgress = found ?? {
          dungeonId: resolvedDungeonId,
          lastEnteredFloor: floor,
          maxClearedFloor: 0,
          clearCount: 0,
          updatedAt: "",
        };
        await dungeonRepository.upsert({
          ...nextProgress,
          lastEnteredFloor: floor,
        });

        const partyRecords = await charactersRepository.listPartyMembers();
        if (partyRecords.length === 0) {
          if (mounted) {
            setError("パーティメンバーがいません。ギルドでキャラクターを追加してください。");
          }
          return;
        }
        const party = partyRecords.map(toUnit);
        const dungeon = DUNGEONS.find((d) => d.id === resolvedDungeonId) ?? DUNGEONS[0];
        const seed = generateTimeSeed();
        const nextResult = generateExplorationResult({
          party,
          dungeon,
          floor,
          seed,
        });

        if (!mounted) return;
        setResult(nextResult);
        setCurrentTick(0);
        setNextEncounterIndex(0);
        setIsPaused(false);
      } catch (err) {
        console.error("Failed to initialize exploration:", err);
        if (mounted) {
          setError("探索の初期化に失敗しました。");
        }
      }
    };

    void init();

    return () => {
      mounted = false;
    };
  }, [floor, resolvedDungeonId]);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      setIsNavigating(false);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    if (!result) return;
    if (!isFocused || isNavigating || isPaused) return;
    if (currentTick >= result.totalTicks) return;

    const timer = setInterval(() => {
      setCurrentTick((prev) => {
        if (!result) return prev;
        return Math.min(prev + 1, result.totalTicks);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentTick, isFocused, isNavigating, isPaused, result]);

  useEffect(() => {
    if (!result || isNavigating) return;
    if (!isFocused) return;
    const nextTick = result.encounterTicks[nextEncounterIndex];
    const nextEncounter = result.encounters[nextEncounterIndex];
    if (nextTick === undefined || !nextEncounter) return;
    if (currentTick < nextTick) return;

    const encounterPayload = JSON.stringify(nextEncounter);
    setNextEncounterIndex((prev) => prev + 1);
    setIsNavigating(true);
    router.push({
      pathname: "/dungeon/battle",
      params: {
        dungeonId: resolvedDungeonId,
        floor: String(floor),
        explorationSeed: String(result.seed),
        encounter: encounterPayload,
      },
    });
  }, [currentTick, floor, isFocused, isNavigating, nextEncounterIndex, resolvedDungeonId, result, router]);

  const displayedEvents = useMemo(
    () => (result ? result.events.filter((event) => event.tick <= currentTick).slice(-30) : []),
    [currentTick, result]
  );
  const treasureCount = useMemo(
    () => displayedEvents.filter((event) => event.type === "TREASURE").length,
    [displayedEvents]
  );

  useEffect(() => {
    if (!isFocused) return;
    if (displayedEvents.length === 0) return;
    requestAnimationFrame(() => {
      logScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [displayedEvents.length, isFocused]);

  if (error) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.stateMessageWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!result) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.stateMessageWrap}>
            <Text style={styles.loadingText}>探索準備中...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.title}>{`B${floor}F - Exploring`}</Text>
          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeText}>{formatClock(currentTick)}</Text>
          </View>
        </View>

        <ImageBackground source={HERO_IMAGE} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay}>
            <Text style={styles.heroMain}>The air grows damp. Water drips from the cavern ceiling.</Text>
            <Text style={styles.heroSub}>{`B${floor}F  •  ${treasureCount} treasure`}</Text>
          </View>
        </ImageBackground>

        <ScrollView
          ref={logScrollRef}
          style={styles.logBox}
          contentContainerStyle={styles.logContent}
          onContentSizeChange={() => logScrollRef.current?.scrollToEnd({ animated: true })}
        >
          {displayedEvents.map((event, index) => (
            <Text key={`${event.tick}-${event.type}-${index}`} style={styles.logLine}>
              {`${EVENT_PREFIX[event.type]}  ${formatEvent(event)}`}
            </Text>
          ))}
        </ScrollView>

        <View style={styles.footerMeta}>
          <Text style={styles.footerLeft}>Items</Text>
          <Text style={styles.footerRight}>{`${currentTick} / ${result.totalTicks}`}</Text>
        </View>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, styles.retreatButton]}
            onPress={() => router.back()}
          >
            <Text style={styles.retreatText}>Retreat</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.pauseButton]}
            onPress={() => setIsPaused((prev) => !prev)}
          >
            <Text style={styles.pauseText}>
              {isPaused ? "Resume" : "Pause"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f2f2" },
  stateMessageWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#6b7280", fontSize: 14 },
  errorText: { color: "#ef4444", textAlign: "center", paddingHorizontal: 24, fontSize: 14 },
  container: { flex: 1, backgroundColor: "#f2f2f2", padding: 12, paddingBottom: 6 },
  topRow: { marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 26, fontWeight: "800", color: "#121212" },
  timeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9d9d9",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timeBadgeText: { fontSize: 12, color: "#3a3a3a", fontWeight: "600" },
  hero: {
    height: 125,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  heroImage: { resizeMode: "cover" },
  heroOverlay: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroMain: { color: "#ffffff", fontSize: 12, lineHeight: 16 },
  heroSub: { color: "#d4d4d8", marginTop: 4, fontSize: 10 },
  logBox: {
    flex: 1,
    borderTopWidth: 1,
    borderColor: "#d8d8d8",
    backgroundColor: "#f2f2f2",
  },
  logContent: { paddingVertical: 8, paddingHorizontal: 4 },
  logLine: { marginBottom: 12, color: "#404040", fontSize: 13, lineHeight: 16 },
  footerMeta: {
    marginTop: 4,
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: "#d8d8d8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerLeft: { fontSize: 12, color: "#5f5f5f", fontWeight: "500" },
  footerRight: { fontSize: 12, color: "#121212", fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  retreatButton: {
    borderWidth: 1,
    borderColor: "#cfcfcf",
    backgroundColor: "#e6e6e6",
  },
  pauseButton: { backgroundColor: "#121212" },
  disabledButton: { backgroundColor: "#8a8a8a" },
  retreatText: { color: "#4a4a4a", fontSize: 16, fontWeight: "600" },
  pauseText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
