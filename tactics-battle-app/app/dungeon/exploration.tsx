import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/common/Button";
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

const formatEvent = (event: ExplorationEvent): string => {
  if (event.type === "TREASURE") {
    return `${event.message} (${event.payload?.itemId ?? "unknown"})`;
  }
  if (event.type === "TRAP") {
    return `${event.message} (DMG:${event.payload?.damage ?? 0} / ${event.payload?.debuffType ?? "none"})`;
  }
  return event.message;
};

export default function ExplorationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dungeonId?: string; floor?: string }>();

  const resolvedDungeonId = params.dungeonId ?? DUNGEONS[0]?.id ?? "crestoria_dungeon_1_4";
  const floor = Math.max(1, Number.parseInt(params.floor ?? "1", 10) || 1);

  const [currentTick, setCurrentTick] = useState(0);
  const [result, setResult] = useState<ExplorationResult | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
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
    };

    void init();

    return () => {
      mounted = false;
    };
  }, [floor, resolvedDungeonId]);

  useEffect(() => {
    if (!result) return;
    if (currentTick >= result.totalTicks) return;

    const timer = setInterval(() => {
      setCurrentTick((prev) => {
        if (!result) return prev;
        return Math.min(prev + 1, result.totalTicks);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentTick, result]);

  useEffect(() => {
    if (!result || isNavigating) return;
    if (result.encounterTick === null) return;
    if (currentTick < result.encounterTick) return;

    setIsNavigating(true);
    router.replace({
      pathname: "/dungeon/battle",
      params: { dungeonId: resolvedDungeonId, floor: String(floor), explorationSeed: String(result.seed) },
    });
  }, [currentTick, floor, isNavigating, resolvedDungeonId, result, router]);

  const displayedEvents = useMemo(
    () => (result ? result.events.filter((event) => event.tick <= currentTick).slice(-30) : []),
    [currentTick, result]
  );

  if (!result) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>探索準備中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>探索</Text>
      <Text style={styles.elapsed}>Tick: {currentTick}/{result.totalTicks}</Text>
      <Text style={styles.seed}>Seed: {result.seed}</Text>
      <View style={styles.actionWrap}>
        <Button
          label="即時接敵して戦闘へ"
          onPress={() =>
            router.replace({
              pathname: "/dungeon/battle",
              params: { dungeonId: resolvedDungeonId, floor: String(floor), explorationSeed: String(result.seed) },
            })
          }
        />
      </View>
      <ScrollView style={styles.logBox} contentContainerStyle={styles.logContent}>
        {displayedEvents.map((event, index) => (
          <Text key={`${event.tick}-${event.type}-${index}`} style={styles.logLine}>
            [{event.tick}] {formatEvent(event)}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#09090b",
  },
  loadingText: { color: "#d4d4d8" },
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  title: { marginBottom: 8, fontSize: 20, fontWeight: "600", color: "#ffffff" },
  elapsed: { color: "#a1a1aa" },
  seed: { marginBottom: 12, color: "#71717a", fontSize: 12 },
  actionWrap: { marginBottom: 12 },
  logBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
  },
  logContent: { padding: 12 },
  logLine: { marginBottom: 8, color: "#e4e4e7" },
});
