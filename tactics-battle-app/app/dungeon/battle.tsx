import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image, ImageBackground, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pause, Play } from "lucide-react-native";
import { battleRepository } from "@/db/repositories/battleRepository";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { tacticsRepository } from "@/db/repositories/tacticsRepository";
import { Unit } from "@/game/battle";
import { DEFAULT_SKILLS, createBattleSessionId, createSkillMap } from "@/game/battleSetup";
import { simulateBattle } from "@/game/battleSimulation";
import { EncounterResult, generateEncounter } from "@/game/encounter";
import { toUnit } from "@/game/partyMapper";
import { useI18n } from "@/i18n";
import { TacticsRuleRecord } from "@/types/models";
import { useBattleStore } from "@/stores/battleStore";

type BattlePhase = "LOADING" | "ENCOUNTER" | "SIMULATING" | "RESULT" | "ERROR";
const BATTLE_BG = require("@/assets/images/backgrounds/dungeon_exploration.jpg");
const CLASS_IMAGE: Record<string, ImageSourcePropType> = {
  GUARDIAN: require("@/assets/images/class/gurdian.png"),
  SWORDMAN: require("@/assets/images/class/swordman.png"),
  BERSERKER: require("@/assets/images/class/berserker.png"),
  CLERIC: require("@/assets/images/class/cleric.png"),
  WITCH: require("@/assets/images/class/witch.png"),
  THIEF: require("@/assets/images/class/thief.png"),
};

const DUNGEON_NAME_I18N_KEY = {
  crestoria_dungeon_1_4: "dungeon.name.crestoria_dungeon_1_4",
  crestoria_dungeon_5_9: "dungeon.name.crestoria_dungeon_5_9",
} as const;

const getEnemyImage = (enemyId: string): ImageSourcePropType => {
  const id = enemyId.toLowerCase();
  if (id.includes("goblin")) return require("@/assets/images/enemies/goblin.png");
  if (id.includes("slime")) return require("@/assets/images/enemies/slime.png");
  if (id.includes("poison_toad") || id.includes("poison_frog")) return require("@/assets/images/enemies/poison_frog.png");
  return require("@/assets/images/enemies/slime.png");
};
const getClassImage = (classId?: string): ImageSourcePropType =>
  (classId && CLASS_IMAGE[classId]) || CLASS_IMAGE.SWORDMAN;

const parseEncounter = (raw: string | undefined): EncounterResult | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EncounterResult;
  } catch {
    return null;
  }
};

export default function BattleScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { dungeonId, floor, explorationSeed, encounter } = useLocalSearchParams<{
    dungeonId?: string;
    floor?: string;
    explorationSeed?: string;
    encounter?: string;
  }>();

  const [phase, setPhase] = useState<BattlePhase>("LOADING");
  const [error, setError] = useState<string | null>(null);
  const [initialParty, setInitialParty] = useState<Unit[]>([]);
  const [encounterData, setEncounterData] = useState<EncounterResult | null>(null);
  const [tacticsByCharacter, setTacticsByCharacter] = useState<Record<string, TacticsRuleRecord[]>>({});
  const [resolvedDungeonId, setResolvedDungeonId] = useState("crestoria_dungeon_1_4");
  const [resolvedFloor, setResolvedFloor] = useState(1);
  const [resolvedSeed, setResolvedSeed] = useState<number | null>(null);
  const [battleCompleted, setBattleCompleted] = useState(false);
  const [revealedLogCount, setRevealedLogCount] = useState(0);
  const [autoReturned, setAutoReturned] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [party, setParty] = useState<Unit[]>([]);
  const [enemies, setEnemies] = useState<Unit[]>([]);
  const [turns, setTurns] = useState(0);
  const logScrollRef = useRef<ScrollView | null>(null);
  const setSessionId = useBattleStore((s) => s.setSessionId);
  const setLogs = useBattleStore((s) => s.setLogs);
  const setStatus = useBattleStore((s) => s.setStatus);
  const status = useBattleStore((s) => s.status);
  const logs = useBattleStore((s) => s.logs);
  const reset = useBattleStore((s) => s.reset);
  const dungeonTitle = t(
    DUNGEON_NAME_I18N_KEY[resolvedDungeonId as keyof typeof DUNGEON_NAME_I18N_KEY] ??
      "dungeon.name.crestoria_dungeon_1_4"
  );

  const skillMap = useMemo(() => createSkillMap(DEFAULT_SKILLS), []);

  useEffect(() => {
    const load = async () => {
      reset();
      setPhase("LOADING");
      setError(null);
      try {
        const selected = await charactersRepository.listPartyMembers();
        if (selected.length === 0) {
          setError("パーティメンバーがいないため戦闘を開始できません。");
          setStatus("IDLE");
          setPhase("ERROR");
          return;
        }
        const units = selected.map(toUnit);
        const map: Record<string, TacticsRuleRecord[]> = {};
        for (const unit of units) {
          map[unit.id] = await tacticsRepository.listByCharacter(unit.id);
        }
        const parsedFloor = Math.max(1, Number.parseInt(floor ?? "1", 10) || 1);
        const parsedSeed = explorationSeed ? Number.parseInt(explorationSeed, 10) : Date.now();
        const nextDungeonId = dungeonId ?? "crestoria_dungeon_1_4";
        const nextEncounterData =
          parseEncounter(encounter) ??
          generateEncounter({
            dungeonId: nextDungeonId,
            floor: parsedFloor,
            seed: (parsedSeed + parsedFloor * 1009) >>> 0,
          });

        setInitialParty(units);
        setParty(units);
        setTacticsByCharacter(map);
        setEncounterData(nextEncounterData);
        setResolvedDungeonId(nextDungeonId);
        setResolvedFloor(parsedFloor);
        setResolvedSeed(Number.isFinite(parsedSeed) ? parsedSeed : null);
        setLogs([]);
        setStatus("IDLE");
        setBattleCompleted(false);
        setRevealedLogCount(0);
        setAutoReturned(false);
        setIsPaused(false);
        setPhase("ENCOUNTER");
      } catch (error) {
        console.error("Failed to load battle:", error);
        setError("戦闘の初期化に失敗しました。");
        setStatus("IDLE");
        setPhase("ERROR");
      }
    };
    void load();
  }, [dungeonId, encounter, explorationSeed, floor, reset, setLogs, setSessionId, setStatus, skillMap]);

  const onStartBattle = async () => {
    if (!encounterData || phase !== "ENCOUNTER") return;
    setPhase("SIMULATING");
    setStatus("IN_PROGRESS");
    try {
      const nextSessionId = createBattleSessionId();
      await battleRepository.createSession({
        id: nextSessionId,
        dungeonId: resolvedDungeonId,
        floor: resolvedFloor,
        turn: 1,
        status: "IN_PROGRESS",
        explorationSeed: resolvedSeed,
        startedAt: new Date().toISOString(),
        endedAt: null,
      });

      const result = simulateBattle({
        sessionId: nextSessionId,
        seed: ((resolvedSeed ?? Date.now()) + 17) >>> 0,
        party: initialParty,
        enemies: encounterData.enemies,
        tacticsByCharacter,
        skillMap,
        maxTurns: 50,
      });

      await battleRepository.appendLogs(result.logs);
      await battleRepository.updateSessionStatus(nextSessionId, result.outcome);

      setParty(result.finalParty);
      setEnemies(result.finalEnemies);
      setSessionId(nextSessionId);
      setStatus(result.outcome);
      setLogs(result.logs);
      setTurns(result.turns);
      setRevealedLogCount(0);
      setBattleCompleted(true);
      setPhase("RESULT");
    } catch (startError) {
      console.error("Failed to run battle:", startError);
      setError("戦闘シミュレーションに失敗しました。");
      setStatus("IDLE");
      setPhase("ERROR");
    }
  };

  useEffect(() => {
    if (!battleCompleted || phase !== "RESULT" || isPaused) return;
    if (revealedLogCount >= logs.length) return;
    const timer = setInterval(() => {
      setRevealedLogCount((prev) => Math.min(prev + 1, logs.length));
    }, 50);
    return () => clearInterval(timer);
  }, [battleCompleted, isPaused, logs.length, phase, revealedLogCount]);

  useEffect(() => {
    if (!battleCompleted || autoReturned || phase !== "RESULT" || isPaused) return;
    if (logs.length > 0 && revealedLogCount < logs.length) return;
    const timeout = setTimeout(() => {
      setAutoReturned(true);
      router.back();
    }, 900);
    return () => clearTimeout(timeout);
  }, [autoReturned, battleCompleted, isPaused, logs.length, phase, revealedLogCount, router]);

  useEffect(() => {
    if (!encounterData || phase !== "ENCOUNTER") return;
    void onStartBattle();
  }, [encounterData, phase]);

  const renderedLogCount = phase === "RESULT" ? Math.min(revealedLogCount, logs.length) : logs.length;

  useEffect(() => {
    if (renderedLogCount <= 0) return;
    requestAnimationFrame(() => {
      logScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [renderedLogCount]);

  if (phase === "LOADING") {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>戦闘準備中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "SIMULATING") {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>戦闘シミュレーション中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "ERROR") {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error ?? "不明なエラーが発生しました。"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "ENCOUNTER" && encounterData) {
    return renderBattleLayout({
      floor: encounterData.rollMeta.floor,
      title: dungeonTitle,
      enemies: encounterData.enemies.map((enemy, idx) => ({
        id: `${enemy.enemyId}-${idx}`,
        name: enemy.name,
        image: getEnemyImage(enemy.enemyId),
      })),
      party,
      logs,
      turnText: "Turn --",
      isPaused,
      onPausePress: () => setIsPaused((prev) => !prev),
    });
  }

  const visibleLogs = logs.slice(0, revealedLogCount);
  return renderBattleLayout({
    floor: resolvedFloor,
    title: dungeonTitle,
    enemies: enemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      image: getEnemyImage(enemy.id),
    })),
    party,
    logs: visibleLogs,
    turnText: `Turn ${turns}`,
    isPaused,
    onPausePress: () => setIsPaused((prev) => !prev),
  });

  function renderBattleLayout(params: {
    floor: number;
    title: string;
    enemies: Array<{ id: string; name: string; image: ImageSourcePropType }>;
    party: Unit[];
    logs: typeof logs;
    turnText: string;
    isPaused: boolean;
    onPausePress: () => void;
  }) {
    const logRows = params.logs;
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.floorBadge}>
              <Text style={styles.floorBadgeText}>{`B${params.floor}F`}</Text>
            </View>
            <Text style={styles.headerTitle}>{params.title}</Text>
            <View style={styles.autoBadge}>
              <Text style={styles.autoBadgeText}>AUTO</Text>
            </View>
          </View>

          <ImageBackground source={BATTLE_BG} style={styles.scene} imageStyle={styles.sceneImage}>
            <View style={styles.enemyRow}>
              {params.enemies.slice(0, 3).map((enemy) => (
                <View key={enemy.id} style={styles.enemyItem}>
                  <Image source={enemy.image} style={styles.enemyImage} resizeMode="contain" />
                  <Text style={styles.enemyLabel}>{enemy.name}</Text>
                </View>
              ))}
            </View>
          </ImageBackground>
          <Text style={styles.partyLabel}>PARTY</Text>
          <View style={styles.partyGrid}>
            {params.party.slice(0, 6).map((member) => {
              const hpRate = member.stats.maxHp > 0 ? Math.max(0, Math.min(1, member.hp / member.stats.maxHp)) : 0;
              return (
                <View key={member.id} style={styles.partyCard}>
                  <Image source={getClassImage(member.classId)} style={styles.partyPortrait} resizeMode="contain" />
                  <Text style={styles.partyName} numberOfLines={1}>
                    {member.name}
                  </Text>
                  <Text style={styles.partyClass} numberOfLines={1}>
                    {member.classId ?? "Adventurer"}
                  </Text>
                  <View style={styles.hpTrack}>
                    <View style={[styles.hpFill, { width: `${Math.floor(hpRate * 100)}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.logHeader}>
            <Text style={styles.logTitle}>Battle Log</Text>
            <Text style={styles.turnText}>{params.turnText}</Text>
          </View>
          <ScrollView
            ref={logScrollRef}
            style={styles.logBox}
            contentContainerStyle={styles.logContent}
            onContentSizeChange={() => logScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {logRows.length === 0 ? (
              <Text style={styles.logLineMuted}>Waiting for command...</Text>
            ) : (
              logRows.map((log, idx) => (
                <Text key={`${log.turn}-${idx}`} style={styles.logLine}>
                  {log.logMessage}
                </Text>
              ))
            )}
          </ScrollView>

          <View style={styles.actionRow}>
            <Pressable style={[styles.controlButton, styles.pauseButton]} onPress={params.onPausePress}>
              {params.isPaused ? <Play size={24} color="#1a1a1a" /> : <Pause size={24} color="#1a1a1a" />}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#efefef" },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#efefef",
  },
  loadingText: { color: "#525252", fontSize: 14 },
  errorText: { color: "#ef4444", textAlign: "center", paddingHorizontal: 24 },
  container: { flex: 1, backgroundColor: "#efefef", paddingHorizontal: 8, paddingVertical: 6 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  floorBadge: {
    borderRadius: 8,
    backgroundColor: "#111111",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  floorBadgeText: { color: "#efefef", fontWeight: "700", fontSize: 11 },
  headerTitle: { flex: 1, color: "#121212", fontSize: 21, fontWeight: "700" },
  autoBadge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cccccc",
    backgroundColor: "#f7f7f7",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  autoBadgeText: { color: "#4b4b4b", fontWeight: "600", fontSize: 10 },
  scene: {
    height: 144,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
    justifyContent: "flex-end",
  },
  sceneImage: { resizeMode: "cover" },
  enemyRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingBottom: 6,
    paddingHorizontal: 10,
  },
  enemyItem: { alignItems: "center", width: 80 },
  enemyImage: { width: 58, height: 58 },
  enemyLabel: { color: "#efefef", textShadowColor: "#000000", textShadowRadius: 3, fontSize: 11 },
  partyLabel: { color: "#9b9b9b", fontSize: 10, letterSpacing: 1, marginBottom: 6 },
  partyGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 8, rowGap: 6 },
  partyCard: {
    width: "32.2%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 5,
    paddingHorizontal: 4,
  },
  partyPortrait: { width: 28, height: 28, marginBottom: 2 },
  partyName: { color: "#1a1a1a", fontSize: 11, fontWeight: "600" },
  partyClass: { color: "#9b9b9b", fontSize: 9, marginBottom: 4 },
  hpTrack: {
    width: "100%",
    height: 4,
    borderRadius: 999,
    backgroundColor: "#cccccc",
    overflow: "hidden",
  },
  hpFill: { height: "100%", backgroundColor: "#4b4b4b" },
  logHeader: {
    borderTopWidth: 1,
    borderColor: "#d8d8d8",
    paddingTop: 6,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  logTitle: { color: "#5b5b5b", fontSize: 12, letterSpacing: 1 },
  turnText: { color: "#2a2a2a", fontSize: 12 },
  logBox: {
    flex: 1,
    minHeight: 60,
  },
  logContent: { paddingBottom: 6 },
  logLine: { color: "#5b5b5b", fontSize: 11, lineHeight: 15 },
  logLineMuted: { color: "#9b9b9b", fontSize: 11 },
  actionRow: {
    flexDirection: "row",
    marginTop: 8,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  controlButton: {
    width: 104,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseButton: {
    backgroundColor: "#e4e4e4",
    borderWidth: 1,
    borderColor: "#d2d2d2",
  },
});
