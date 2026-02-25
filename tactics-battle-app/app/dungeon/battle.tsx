import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image, ImageBackground, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pause, Play } from "lucide-react-native";
import { battleRepository } from "@/db/repositories/battleRepository";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { equipmentInventoryRepository } from "@/db/repositories/equipmentInventoryRepository";
import { tacticsRepository } from "@/db/repositories/tacticsRepository";
import { PartyStatusStrip } from "@/components/common/PartyStatusStrip";
import { Unit } from "@/game/battle";
import { formatBattleLogMessage } from "@/game/battleLog";
import { DEFAULT_SKILLS, createBattleSessionId, createSkillMap } from "@/game/battleSetup";
import { simulateBattle } from "@/game/battleSimulation";
import { EncounterResult, generateEncounter } from "@/game/encounter";
import { rollMonsterDrops } from "@/game/loot/equipmentLootRoller";
import { toUnit } from "@/game/partyMapper";
import { applyExperienceToCharacter, calculateBattleExp } from "@/game/progression";
import { useI18n } from "@/i18n";
import { TacticsRuleRecord } from "@/types/models";
import { useBattleStore } from "@/stores/battleStore";

type BattlePhase = "LOADING" | "ENCOUNTER" | "SIMULATING" | "RESULT" | "ERROR";
const BATTLE_BG = require("@/assets/images/backgrounds/dungeon_exploration.jpg");
const BATTLE_SCREEN_OPTIONS = { headerShown: false, animation: "none" as const };

const DUNGEON_NAME_I18N_KEY = {
  hakusla_dungeon_1_200: "dungeon.name.hakusla_dungeon_1_200",
  crestoria_dungeon_1_4: "dungeon.name.crestoria_dungeon_1_4",
  crestoria_dungeon_5_9: "dungeon.name.crestoria_dungeon_5_9",
} as const;
const BATTLE_RESULT_I18N_KEY = {
  WIN: "battle.result.win",
  LOSE: "battle.result.lose",
  DRAW: "battle.result.draw",
} as const;

const getEnemyImage = (enemyId: string): ImageSourcePropType => {
  const id = enemyId.toLowerCase();
  if (id.includes("goblin")) return require("@/assets/images/enemies/goblin.png");
  if (id.includes("slime")) return require("@/assets/images/enemies/slime.png");
  if (id.includes("poison_toad") || id.includes("poison_frog")) return require("@/assets/images/enemies/poison_frog.png");
  return require("@/assets/images/enemies/slime.png");
};
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
  const { locale, t } = useI18n();
  const { dungeonId, floor, explorationSeed, encounter } = useLocalSearchParams<{
    dungeonId?: string;
    floor?: string;
    explorationSeed?: string;
    encounter?: string;
  }>();

  const [phase, setPhase] = useState<BattlePhase>("LOADING");
  const [error, setError] = useState<string | null>(null);
  const [initialParty, setInitialParty] = useState<Unit[]>([]);
  const [encounterData, setEncounterData] = useState<EncounterResult | null>(() => parseEncounter(encounter));
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
  const [partyUiMetaById, setPartyUiMetaById] = useState<Record<string, { level: number }>>({});
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
  const resultLabel =
    phase === "RESULT" && (status === "WIN" || status === "LOSE" || status === "DRAW")
      ? t(BATTLE_RESULT_I18N_KEY[status])
      : null;

  const skillMap = useMemo(() => createSkillMap(DEFAULT_SKILLS), []);

  useEffect(() => {
    const load = async () => {
      reset();
      setPhase("LOADING");
      setError(null);
      const parsedFloor = Math.max(1, Number.parseInt(floor ?? "1", 10) || 1);
      const parsedSeed = explorationSeed ? Number.parseInt(explorationSeed, 10) : Date.now();
      const nextDungeonId = dungeonId ?? "crestoria_dungeon_1_4";
      const parsedEncounter = parseEncounter(encounter);
      setResolvedDungeonId(nextDungeonId);
      setResolvedFloor(parsedFloor);
      setResolvedSeed(Number.isFinite(parsedSeed) ? parsedSeed : null);
      setEncounterData(parsedEncounter);
      try {
        const selected = await charactersRepository.listPartyMembers();
        if (selected.length === 0) {
          setError("パーティメンバーがいないため戦闘を開始できません。");
          setStatus("IDLE");
          setPhase("ERROR");
          return;
        }
        const nextPartyUiMetaById = selected.reduce<Record<string, { level: number }>>((acc, member) => {
          acc[member.id] = { level: member.level };
          return acc;
        }, {});
        const units = selected.map(toUnit);
        const map: Record<string, TacticsRuleRecord[]> = {};
        for (const unit of units) {
          map[unit.id] = await tacticsRepository.listByCharacter(unit.id);
        }
        const nextEncounterData =
          parsedEncounter ??
          generateEncounter({
            dungeonId: nextDungeonId,
            floor: parsedFloor,
            seed: (parsedSeed + parsedFloor * 1009) >>> 0,
          });

        setInitialParty(units);
        setParty(units);
        setPartyUiMetaById(nextPartyUiMetaById);
        setTacticsByCharacter(map);
        setEncounterData(nextEncounterData);
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

      let combinedLogs = result.logs;
      if (result.outcome === "WIN") {
        const alivePartyIds = new Set(
          result.finalParty.filter((member) => member.hp > 0).map((member) => member.id)
        );
        if (alivePartyIds.size > 0) {
          const partyRecords = await charactersRepository.listPartyMembers();
          const expGain = calculateBattleExp({
            floor: resolvedFloor,
            enemyCount: encounterData.enemies.length,
          });
          const leveledPartyUiMetaById: Record<string, { level: number }> = {
            ...partyUiMetaById,
          };
          for (const record of partyRecords) {
            if (!alivePartyIds.has(record.id)) continue;
            const progression = applyExperienceToCharacter(record, expGain);
            await charactersRepository.upsert(progression.character);
            leveledPartyUiMetaById[record.id] = { level: progression.newLevel };
          }
          setPartyUiMetaById(leveledPartyUiMetaById);
        }

        const dropResults = rollMonsterDrops({
          dungeonId: resolvedDungeonId,
          floor: resolvedFloor,
          battleSessionId: nextSessionId,
          encounter: encounterData,
          seed: (resolvedSeed ?? Date.now()) >>> 0,
        });
        const lootLogRecords: typeof result.logs = [];
        for (const drop of dropResults) {
          if (!drop.reward) continue;
          const applyResult = await equipmentInventoryRepository.applyGrantIfAbsent({
            grant: {
              grantKey: drop.reward.grantKey,
              sourceType: drop.reward.sourceType,
              baseItemId: drop.reward.baseItemId,
              mutationPrefixId: drop.reward.mutationPrefixId,
              quantity: 1,
              contextJson: JSON.stringify({
                dungeonId: resolvedDungeonId,
                floor: resolvedFloor,
                battleSessionId: nextSessionId,
                enemyIndex: drop.enemyIndex,
              }),
            },
          });
          if (!applyResult.applied) continue;
          const itemName = locale === "ja" ? drop.reward.displayName.jp : drop.reward.displayName.en;
          lootLogRecords.push({
            battleSessionId: nextSessionId,
            turn: result.turns,
            actorName: "LOOT",
            actionType: "loot",
            targetName: null,
            damage: 0,
            healing: 0,
            logMessage: locale === "ja" ? `獲得: ${itemName}` : `Loot: ${itemName}`,
          });
        }
        combinedLogs = [...result.logs, ...lootLogRecords];
      }

      setParty(result.finalParty);
      setEnemies(result.finalEnemies);
      setSessionId(nextSessionId);
      setStatus(result.outcome);
      setLogs(combinedLogs);
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
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (!cancelled) {
        void onStartBattle();
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [encounterData, phase]);

  const renderedLogCount = phase === "RESULT" ? Math.min(revealedLogCount, logs.length) : logs.length;

  useEffect(() => {
    if (renderedLogCount <= 0) return;
    requestAnimationFrame(() => {
      logScrollRef.current?.scrollToEnd({ animated: false });
    });
  }, [renderedLogCount]);

  if (phase === "LOADING") {
    if (encounterData) {
      return renderBattleLayout({
        floor: encounterData.rollMeta.floor,
        title: dungeonTitle,
        enemies: encounterData.enemies.map((enemy, idx) => ({
          id: `${enemy.enemyId}-${idx}`,
          name: enemy.name,
          image: getEnemyImage(enemy.enemyId),
          hp: enemy.stats.maxHp,
          maxHp: enemy.stats.maxHp,
        })),
        party,
        logs: [],
        turnText: "Turn --",
        isPaused,
        onPausePress: () => setIsPaused((prev) => !prev),
      });
    }
    return renderBattleSkeleton();
  }

  if (phase === "SIMULATING") {
    if (encounterData) {
      return renderBattleLayout({
        floor: encounterData.rollMeta.floor,
        title: dungeonTitle,
        enemies: encounterData.enemies.map((enemy, idx) => ({
          id: `${enemy.enemyId}-${idx}`,
          name: enemy.name,
          image: getEnemyImage(enemy.enemyId),
          hp: enemy.stats.maxHp,
          maxHp: enemy.stats.maxHp,
        })),
        party,
        logs: [],
        turnText: "Turn --",
        isPaused,
        onPausePress: () => setIsPaused((prev) => !prev),
      });
    }
    return renderBattleSkeleton();
  }

  if (phase === "ERROR") {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={BATTLE_SCREEN_OPTIONS} />
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
        hp: enemy.stats.maxHp,
        maxHp: enemy.stats.maxHp,
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
      hp: enemy.hp,
      maxHp: enemy.stats.maxHp,
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
    enemies: Array<{ id: string; name: string; image: ImageSourcePropType; hp: number; maxHp: number }>;
    party: Unit[];
    logs: typeof logs;
    turnText: string;
    isPaused: boolean;
    onPausePress: () => void;
  }) {
    const logRows = params.logs;
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={BATTLE_SCREEN_OPTIONS} />
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.floorBadge}>
              <Text style={styles.floorBadgeText}>{`B${params.floor}F`}</Text>
            </View>
            <Text style={styles.headerTitle}>{params.title}</Text>
            {resultLabel ? (
              <View
                style={[
                  styles.resultBadge,
                  status === "WIN" && styles.resultBadgeWin,
                  status === "LOSE" && styles.resultBadgeLose,
                  status === "DRAW" && styles.resultBadgeDraw,
                ]}
              >
                <Text style={styles.resultBadgeText}>{resultLabel}</Text>
              </View>
            ) : null}
            <Pressable
              onPress={params.onPausePress}
              style={[styles.autoBadge, params.isPaused && styles.autoBadgePaused]}
              hitSlop={8}
            >
              {params.isPaused ? <Play size={10} color="#555555" /> : <Pause size={10} color="#555555" />}
              <Text style={styles.autoBadgeText}>AUTO</Text>
            </Pressable>
          </View>

          <View style={styles.logSection}>
            <View style={styles.logHeader}>
              <Text style={styles.logTitle}>{t("battle.ui.logTitle")}</Text>
              <Text style={styles.turnText}>{params.turnText}</Text>
            </View>
            <ScrollView
              ref={logScrollRef}
              style={styles.logBox}
              contentContainerStyle={styles.logContent}
              showsVerticalScrollIndicator={false}
            >
              {logRows.length === 0 ? (
                <Text style={styles.logLineMuted}>{t("battle.ui.logWaiting")}</Text>
              ) : (
                logRows.map((log, idx) => (
                  <Text key={`${log.turn}-${idx}`} style={styles.logLine}>
                    {formatBattleLogMessage(log, t)}
                  </Text>
                ))
              )}
            </ScrollView>
          </View>

          <ImageBackground source={BATTLE_BG} style={styles.enemyArea} imageStyle={styles.enemyAreaImage}>
            <View style={styles.enemyAreaOverlay}>
              <View style={styles.enemyRow}>
                {params.enemies.slice(0, 3).map((enemy) => (
                  <View key={enemy.id} style={styles.enemyItem}>
                    <Image source={enemy.image} style={styles.enemyImage} resizeMode="contain" />
                    <Text style={styles.enemyLabel} numberOfLines={1}>
                      {enemy.name}
                    </Text>
                    <View style={styles.enemyHpBar}>
                      <View
                        style={[
                          styles.enemyHpFill,
                          { width: `${Math.max(0, Math.min(100, (enemy.hp / Math.max(1, enemy.maxHp)) * 100))}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.enemyHpText}>{t("battle.ui.enemyHp", { hp: enemy.hp, maxHp: enemy.maxHp })}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ImageBackground>

          <PartyStatusStrip
            members={params.party.map((member) => ({
              id: member.id,
              name: member.name,
              classId: member.classId,
              hp: member.hp,
              mp: member.mp,
              level: partyUiMetaById[member.id]?.level,
            }))}
          />
        </View>
      </SafeAreaView>
    );
  }

  function renderBattleSkeleton() {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={BATTLE_SCREEN_OPTIONS} />
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={[styles.skeletonBlock, styles.skeletonFloorBadge]} />
            <View style={[styles.skeletonBlock, styles.skeletonHeaderTitle]} />
            <View style={[styles.skeletonBlock, styles.skeletonAutoBadge]} />
          </View>

          <View style={styles.logSection}>
            <View style={styles.logHeader}>
              <View style={[styles.skeletonBlock, styles.skeletonLogLabel]} />
              <View style={[styles.skeletonBlock, styles.skeletonTurnLabel]} />
            </View>
            <View style={styles.logBox}>
              <View style={styles.skeletonLogContent}>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <View
                    key={`log-skel-${idx}`}
                    style={[
                      styles.skeletonBlock,
                      styles.skeletonLogLine,
                      idx % 3 === 0 && styles.skeletonLogLineShort,
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          <View style={styles.enemyArea}>
            <ImageBackground source={BATTLE_BG} style={styles.enemyArea} imageStyle={styles.enemyAreaImage}>
              <View style={[styles.enemyAreaOverlay, styles.skeletonEnemyOverlay]}>
                <View style={styles.enemyRow}>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <View key={`enemy-skel-${idx}`} style={styles.enemyItem}>
                      <View style={[styles.skeletonBlock, styles.skeletonEnemySprite]} />
                      <View style={[styles.skeletonBlock, styles.skeletonEnemyName]} />
                    </View>
                  ))}
                </View>
              </View>
            </ImageBackground>
          </View>

          <View style={styles.skeletonPartySection}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <View key={`party-skel-${idx}`} style={styles.skeletonPartyColumn}>
                <View style={styles.skeletonPartyHeader}>
                  <View style={[styles.skeletonBlock, styles.skeletonPartyAvatar]} />
                  <View style={[styles.skeletonBlock, styles.skeletonPartyName]} />
                </View>
                <View style={[styles.skeletonBlock, styles.skeletonPartyStat]} />
                <View style={[styles.skeletonBlock, styles.skeletonPartyStat]} />
                <View style={[styles.skeletonBlock, styles.skeletonPartyStat]} />
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  loadingText: { color: "#525252", fontSize: 14 },
  errorText: { color: "#ef4444", textAlign: "center", paddingHorizontal: 24 },
  container: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  floorBadge: {
    borderRadius: 8,
    backgroundColor: "#111111",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  floorBadgeText: { color: "#efefef", fontWeight: "700", fontSize: 11 },
  headerTitle: { flex: 1, color: "#1a1a1a", fontSize: 18, fontWeight: "700" },
  resultBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    backgroundColor: "#e5e7eb",
  },
  resultBadgeWin: {
    backgroundColor: "#dcfce7",
  },
  resultBadgeLose: {
    backgroundColor: "#fee2e2",
  },
  resultBadgeDraw: {
    backgroundColor: "#e0e7ff",
  },
  resultBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.4,
  },
  autoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  autoBadgePaused: {
    backgroundColor: "#ececec",
  },
  autoBadgeText: { color: "#555555", fontWeight: "600", fontSize: 10 },
  logSection: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logTitle: {
    color: "#666666",
    fontSize: 10,
    letterSpacing: 1,
  },
  turnText: {
    color: "#1a1a1a",
    fontSize: 10,
    fontWeight: "500",
  },
  logBox: {
    flex: 1,
    minHeight: 60,
  },
  logContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingVertical: 4,
  },
  logLine: {
    color: "#666666",
    fontSize: 13,
    lineHeight: 19,
  },
  logLineMuted: {
    color: "#9b9b9b",
    fontSize: 13,
  },
  enemyArea: {
    height: 220,
    width: "100%",
  },
  enemyAreaImage: {
    resizeMode: "cover",
  },
  enemyAreaOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.10)",
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  enemyRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 20,
  },
  enemyItem: {
    alignItems: "center",
    width: 90,
  },
  enemyImage: { width: 72, height: 72 },
  enemyLabel: {
    marginTop: 4,
    color: "#efefef",
    textShadowColor: "#000000",
    textShadowRadius: 3,
    fontSize: 10,
  },
  enemyHpBar: {
    marginTop: 4,
    width: 72,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
  },
  enemyHpFill: {
    height: "100%",
    backgroundColor: "#22c55e",
  },
  enemyHpText: {
    marginTop: 2,
    color: "#f5f5f5",
    textShadowColor: "#000000",
    textShadowRadius: 3,
    fontSize: 9,
  },
  skeletonBlock: {
    backgroundColor: "#e7e7e7",
    borderRadius: 6,
  },
  skeletonFloorBadge: {
    width: 40,
    height: 20,
    borderRadius: 8,
  },
  skeletonHeaderTitle: {
    flex: 1,
    height: 20,
    marginHorizontal: 8,
    maxWidth: 180,
  },
  skeletonAutoBadge: {
    width: 48,
    height: 20,
    borderRadius: 8,
  },
  skeletonLogLabel: {
    width: 64,
    height: 10,
  },
  skeletonTurnLabel: {
    width: 48,
    height: 10,
  },
  skeletonLogContent: {
    flex: 1,
    justifyContent: "flex-end",
    paddingVertical: 4,
  },
  skeletonLogLine: {
    height: 10,
    marginBottom: 8,
    width: "100%",
  },
  skeletonLogLineShort: {
    width: "78%",
  },
  skeletonEnemyOverlay: {
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  skeletonEnemySprite: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  skeletonEnemyName: {
    width: 56,
    height: 10,
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  skeletonPartySection: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  skeletonPartyColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 2,
  },
  skeletonPartyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    width: "100%",
  },
  skeletonPartyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 999,
  },
  skeletonPartyName: {
    width: 32,
    height: 11,
  },
  skeletonPartyStat: {
    width: 44,
    height: 11,
  },
});
