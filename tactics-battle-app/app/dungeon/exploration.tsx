import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Package } from "lucide-react-native";
import { PartyStatusStrip, PartyStatusStripMember } from "@/components/common/PartyStatusStrip";
import { DUNGEONS } from "@/constants/dungeons";
import { DEFAULT_PARTY_ID, charactersRepository } from "@/db/repositories/charactersRepository";
import { dungeonExplorationProgressRepository } from "@/db/repositories/dungeonExplorationProgressRepository";
import { dungeonRepository } from "@/db/repositories/dungeonRepository";
import { equipmentInventoryRepository } from "@/db/repositories/equipmentInventoryRepository";
import { DungeonBundleRange, findBundleByFloor, formatBundleLabel } from "@/game/dungeonBundles";
import { ExplorationEvent, ExplorationResult } from "@/game/exploration";
import {
  ExplorationSessionState,
  advanceExplorationStep,
  applyFloorDecision,
  createExplorationSession,
  toExplorationResult,
} from "@/game/explorationSession";
import { useI18n } from "@/i18n";
import { useBattleStore } from "@/stores/battleStore";
import type { EquipmentReward } from "@/types/equipment";
import { toUnit } from "@/game/partyMapper";
import { generateTimeSeed } from "@/utils/rng";

const HERO_IMAGE = require("@/assets/images/backgrounds/dungeon_exploration.jpg");
const EXPLORATION_SCREEN_OPTIONS = { headerShown: false, animation: "none" as const };
const DEFAULT_EXPLORATION_STEP_COUNT = 40;

const EVENT_PREFIX: Record<ExplorationEvent["type"], string> = {
  LOG: "⋄",
  ENCOUNTER: "✖",
  TREASURE: "✦",
  TRAP: "⚠",
  STAIRS_DISCOVERED: "⇣",
  STAIRS_REACHED: "⇣",
  SHORTCUT: "➜",
  FLOOR_DESCEND: "↓",
  FLOOR_COMPLETE: "✓",
  BUNDLE_CLEAR: "★",
};

const getTreasureItemLabel = (
  reward: EquipmentReward | undefined,
  locale: ReturnType<typeof useI18n>["locale"],
  t: ReturnType<typeof useI18n>["t"]
): string => {
  if (!reward) return t("exploration.item.unknown");
  return locale === "ja" ? reward.displayName.jp : reward.displayName.en;
};

const getTrapDebuffLabel = (
  debuffType: string | undefined,
  t: ReturnType<typeof useI18n>["t"]
): string => {
  switch (debuffType) {
    case "POISON":
      return t("exploration.debuff.poison");
    case "SLOW":
      return t("exploration.debuff.slow");
    case "WEAKEN":
      return t("exploration.debuff.weaken");
    default:
      return t("exploration.debuff.none");
  }
};

const formatEvent = (
  event: ExplorationEvent,
  locale: ReturnType<typeof useI18n>["locale"],
  t: ReturnType<typeof useI18n>["t"]
): string => {
  if (event.type === "TREASURE") {
    return t(event.messageId as any, {
      itemId: getTreasureItemLabel(event.payload?.reward, locale, t),
    });
  }
  if (event.type === "TRAP") {
    return t(event.messageId as any, {
      damage: event.payload?.damage ?? 0,
      debuffType: getTrapDebuffLabel(event.payload?.debuffType, t),
    });
  }
  if (event.type === "STAIRS_DISCOVERED") {
    return `B${event.floor ?? "?"}Fで下り階段を発見`;
  }
  if (event.type === "STAIRS_REACHED") {
    return `B${event.floor ?? "?"}Fの下り階段に到着`;
  }
  if (event.type === "SHORTCUT") {
    return `発見済み階段でB${event.payload?.toFloor ?? "?"}Fへ移動 (-${event.payload?.stepCost ?? 0}step)`;
  }
  if (event.type === "FLOOR_DESCEND") {
    return `B${event.payload?.toFloor ?? "?"}Fへ降りた`;
  }
  if (event.type === "FLOOR_COMPLETE") {
    return `B${event.floor ?? "?"}F の探索度が ${event.payload?.explorationPercent ?? 100}% に到達`;
  }
  if (event.type === "BUNDLE_CLEAR") {
    return "区間探索を完了した";
  }
  return t(event.messageId as any);
};

const formatClock = (tick: number): string => {
  const total = tick * 8;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

type ExplorationPartySnapshotMember = PartyStatusStripMember & {
  baseHp: number;
  baseMp: number;
};

type ExplorationResultItem = {
  key: string;
  source: "BATTLE" | "TREASURE";
  label: string;
};

export default function ExplorationScreen() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const params = useLocalSearchParams<{ dungeonId?: string; floor?: string; partyId?: string; steps?: string }>();

  const resolvedDungeonId = params.dungeonId ?? DUNGEONS[0]?.id ?? "crestoria_dungeon_1_4";
  const floor = Math.max(1, Number.parseInt(params.floor ?? "1", 10) || 1);
  const resolvedPartyId = params.partyId ?? DEFAULT_PARTY_ID;
  const requestedSteps = Number.parseInt(params.steps ?? String(DEFAULT_EXPLORATION_STEP_COUNT), 10);
  const explorationStepCount = Math.max(1, Number.isFinite(requestedSteps) ? requestedSteps : DEFAULT_EXPLORATION_STEP_COUNT);

  const [nextEncounterIndex, setNextEncounterIndex] = useState(0);
  const [session, setSession] = useState<ExplorationSessionState | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const logScrollRef = useRef<ScrollView | null>(null);
  const appliedRewardGrantKeysRef = useRef<Set<string>>(new Set());
  const processedBattleRewardSessionIdsRef = useRef<Set<string>>(new Set());
  const hasAppliedBundleClearRef = useRef(false);
  const [partySnapshot, setPartySnapshot] = useState<ExplorationPartySnapshotMember[]>([]);
  const [bundleRange, setBundleRange] = useState<DungeonBundleRange | null>(null);
  const [resultItems, setResultItems] = useState<ExplorationResultItem[]>([]);
  const latestBattleSessionId = useBattleStore((s) => s.latestBattleSessionId);
  const latestBattleExplorationSeed = useBattleStore((s) => s.latestBattleExplorationSeed);
  const latestBattleDrops = useBattleStore((s) => s.latestBattleDrops);

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

        const partyRecords = await charactersRepository.listPartyMembers(resolvedPartyId);
        if (partyRecords.length === 0) {
          if (mounted) {
            setError("パーティメンバーがいません。ギルドでキャラクターを追加してください。");
          }
          return;
        }
        const nextPartySnapshot: ExplorationPartySnapshotMember[] = partyRecords.map((record) => ({
          id: record.id,
          name: record.name,
          classId: record.classId,
          hp: record.currentHp,
          mp: record.currentMp,
          level: record.level,
          baseHp: record.currentHp,
          baseMp: record.currentMp,
        }));
        const party = partyRecords.map(toUnit);
        const dungeon = DUNGEONS.find((d) => d.id === resolvedDungeonId) ?? DUNGEONS[0];
        const seed = generateTimeSeed();
        const bundle = findBundleByFloor(dungeon.id, floor);
        const persistedBundleProgress = await dungeonExplorationProgressRepository.listByDungeonAndRange({
          dungeonId: resolvedDungeonId,
          startFloor: bundle.startFloor,
          endFloor: bundle.bossFloor,
        });
        const nextSession = createExplorationSession({
          party,
          dungeon,
          bundle,
          seed,
          config: { stepsPerRun: explorationStepCount },
          persistedProgress: persistedBundleProgress.map((row) => ({
            floor: row.floor,
            explorationPercent: row.explorationPercent,
            stairsDiscovered: row.stairsDiscovered,
          })),
        });

        if (!mounted) return;
        appliedRewardGrantKeysRef.current = new Set();
        processedBattleRewardSessionIdsRef.current = new Set();
        hasAppliedBundleClearRef.current = false;
        setSession(nextSession);
        setBundleRange(bundle);
        setPartySnapshot(nextPartySnapshot);
        setResultItems([]);
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
  }, [explorationStepCount, floor, resolvedDungeonId, resolvedPartyId]);

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
    if (!session) return;
    if (!isFocused || isNavigating || isPaused) return;
    if (session.status !== "RUNNING") return;

    const timer = setInterval(() => {
      setSession((prev) => (prev ? advanceExplorationStep(prev) : prev));
    }, 1000);

    return () => clearInterval(timer);
  }, [isFocused, isNavigating, isPaused, session]);

  useEffect(() => {
    if (!session || !bundleRange) return;
    let cancelled = false;
    const persist = async () => {
      try {
        await dungeonExplorationProgressRepository.upsertMany(
          Object.values(session.floorProgressMap)
            .filter((row) => row.floor >= bundleRange.startFloor && row.floor <= bundleRange.bossFloor)
            .map((row) => ({
              dungeonId: resolvedDungeonId,
              floor: row.floor,
              explorationPercent: row.explorationPercent,
              stairsDiscovered: row.stairsDiscovered,
            }))
        );
      } catch (persistError) {
        if (!cancelled) {
          console.error("Failed to persist floor exploration progress:", persistError);
        }
      }
    };
    void persist();
    return () => {
      cancelled = true;
    };
  }, [bundleRange, resolvedDungeonId, session]);

  const result = useMemo<ExplorationResult | null>(() => (session ? toExplorationResult(session) : null), [session]);
  const currentTick = session?.currentStep ?? 0;

  useEffect(() => {
    if (!result) return;
    if (!latestBattleSessionId) return;
    if (latestBattleExplorationSeed !== result.seed) return;
    if (processedBattleRewardSessionIdsRef.current.has(latestBattleSessionId)) return;

    processedBattleRewardSessionIdsRef.current.add(latestBattleSessionId);
    if (!latestBattleDrops || latestBattleDrops.length === 0) return;
    setResultItems((prev) => [
      ...prev,
      ...latestBattleDrops.map((label, index) => ({
        key: `battle:${latestBattleSessionId}:${index}`,
        source: "BATTLE" as const,
        label,
      })),
    ]);
  }, [latestBattleDrops, latestBattleExplorationSeed, latestBattleSessionId, result]);

  useEffect(() => {
    if (!result) return;
    const dueTreasureEvents = result.events.filter(
      (event) => event.tick <= currentTick && event.type === "TREASURE" && event.payload?.reward
    );
    if (dueTreasureEvents.length === 0) return;

    let cancelled = false;
    const persist = async () => {
      for (const event of dueTreasureEvents) {
        const reward = event.payload?.reward;
        if (!reward) continue;
        if (appliedRewardGrantKeysRef.current.has(reward.grantKey)) continue;
        try {
          await equipmentInventoryRepository.applyGrantIfAbsent({
            grant: {
              grantKey: reward.grantKey,
              sourceType: reward.sourceType,
              baseItemId: reward.baseItemId,
              mutationPrefixId: reward.mutationPrefixId,
              quantity: 1,
              contextJson: JSON.stringify({
                dungeonId: resolvedDungeonId,
                floor: event.floor ?? floor,
                explorationSeed: result.seed,
                tick: event.tick,
              }),
            },
          });
          if (cancelled) return;
          appliedRewardGrantKeysRef.current.add(reward.grantKey);
          setResultItems((prev) => {
            if (prev.some((item) => item.key === reward.grantKey)) return prev;
            return [
              ...prev,
              {
                key: reward.grantKey,
                source: "TREASURE",
                label: getTreasureItemLabel(reward, locale, t),
              },
            ];
          });
        } catch (persistError) {
          console.error("Failed to persist treasure reward:", persistError);
        }
      }
    };

    void persist();

    return () => {
      cancelled = true;
    };
  }, [currentTick, floor, locale, resolvedDungeonId, result, t]);

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
        floor: String(session?.currentFloor ?? floor),
        partyId: resolvedPartyId,
        explorationSeed: String(result.seed),
        encounter: encounterPayload,
      },
    });
  }, [
    currentTick,
    floor,
    isFocused,
    isNavigating,
    nextEncounterIndex,
    resolvedDungeonId,
    resolvedPartyId,
    result,
    router,
    session?.currentFloor,
  ]);

  useEffect(() => {
    if (!session || !bundleRange) return;
    if (session.status !== "BUNDLE_CLEARED") return;
    if (hasAppliedBundleClearRef.current) return;
    hasAppliedBundleClearRef.current = true;

    let cancelled = false;
    const persistClear = async () => {
      try {
        const list = await dungeonRepository.list();
        const found = list.find((row) => row.dungeonId === resolvedDungeonId);
        const nextProgress = found ?? {
          dungeonId: resolvedDungeonId,
          lastEnteredFloor: bundleRange.startFloor,
          maxClearedFloor: 0,
          clearCount: 0,
          updatedAt: "",
        };
        await dungeonRepository.upsert({
          ...nextProgress,
          lastEnteredFloor: bundleRange.startFloor,
          maxClearedFloor: Math.max(nextProgress.maxClearedFloor, bundleRange.bossFloor),
          clearCount:
            bundleRange.bossFloor > nextProgress.maxClearedFloor
              ? nextProgress.clearCount
              : nextProgress.clearCount + 1,
        });
        if (!cancelled) {
          setIsPaused(true);
        }
      } catch (persistError) {
        if (!cancelled) {
          console.error("Failed to persist bundle clear:", persistError);
        }
      }
    };
    void persistClear();
    return () => {
      cancelled = true;
    };
  }, [bundleRange, resolvedDungeonId, session]);

  const displayedEvents = useMemo(
    () => (result ? result.events.filter((event) => event.tick <= currentTick).slice(-30) : []),
    [currentTick, result]
  );
  const treasureCount = useMemo(
    () => displayedEvents.filter((event) => event.type === "TREASURE").length,
    [displayedEvents]
  );
  const totalTreasureCount = useMemo(
    () => (result ? result.events.filter((event) => event.type === "TREASURE").length : 0),
    [result]
  );
  const stepProgressRatio = useMemo(() => {
    if (!result || result.totalTicks <= 0) return 0;
    return Math.max(0, Math.min(1, currentTick / result.totalTicks));
  }, [currentTick, result]);
  const currentFloor = session?.currentFloor ?? floor;
  const currentFloorProgress = session?.floorProgressMap[currentFloor];
  const currentFloorExplorationPercent = currentFloorProgress?.explorationPercent ?? 0;
  const currentFloorExplorationPercentDisplay = Math.floor(currentFloorExplorationPercent);
  const currentFloorStairsDiscovered = currentFloorProgress?.stairsDiscovered ?? false;
  const isAwaitingFloorDecision = session?.status === "AWAITING_DECISION";
  const canDescend = isAwaitingFloorDecision && !!bundleRange && currentFloor < bundleRange.bossFloor;
  const isExplorationResultVisible = session?.status === "RUN_COMPLETE" || session?.status === "BUNDLE_CLEARED";
  const isFloorDecisionModalVisible = isFocused && !isNavigating && isAwaitingFloorDecision && !isExplorationResultVisible;
  const isExplorationResultModalVisible = isFocused && !isNavigating && !!isExplorationResultVisible;
  const exploredFloorProgressRows = useMemo(() => {
    if (!session) return [];
    return Object.entries(session.floorStepsThisRunMap)
      .filter(([, steps]) => steps > 0)
      .map(([floorText]) => Number(floorText))
      .sort((a, b) => a - b)
      .map((floorNum) => ({
        floor: floorNum,
        explorationPercent: Math.floor(session.floorProgressMap[floorNum]?.explorationPercent ?? 0),
      }));
  }, [session]);
  const displayedPartyMembers = useMemo<PartyStatusStripMember[]>(() => {
    if (partySnapshot.length === 0) return [];
    const members = partySnapshot.map((member) => ({
      id: member.id,
      name: member.name,
      classId: member.classId,
      hp: member.baseHp,
      mp: member.baseMp,
      level: member.level,
    }));
    if (!result) return members;

    for (const event of result.events) {
      if (event.tick > currentTick) break;
      if (event.type !== "TRAP") continue;
      const damage = Math.max(0, Math.floor(event.payload?.damage ?? 0));
      if (damage <= 0) continue;
      for (const member of members) {
        member.hp = Math.max(0, member.hp - damage);
      }
    }

    return members;
  }, [currentTick, partySnapshot, result]);

  useEffect(() => {
    if (!isFocused) return;
    if (displayedEvents.length === 0) return;
    requestAnimationFrame(() => {
      logScrollRef.current?.scrollToEnd({ animated: false });
    });
  }, [displayedEvents.length, isFocused]);

  if (error) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <Stack.Screen options={EXPLORATION_SCREEN_OPTIONS} />
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
        <Stack.Screen options={EXPLORATION_SCREEN_OPTIONS} />
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
      <Stack.Screen options={EXPLORATION_SCREEN_OPTIONS} />
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <View style={styles.topRow}>
            <Text style={styles.title}>
              {bundleRange ? `${formatBundleLabel(bundleRange)} 探索` : `B${floor}F - Exploring`}
            </Text>
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>{formatClock(currentTick)}</Text>
            </View>
          </View>
        </View>

        <ImageBackground source={HERO_IMAGE} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay}>
            <Text style={styles.heroMain}>
              {bundleRange
                ? `${formatBundleLabel(bundleRange)} / 現在 B${currentFloor}F`
                : `現在 B${currentFloor}F`}
            </Text>
            <View style={styles.heroProgressWrap}>
              <Text style={styles.heroProgressLabel}>{`${currentTick} / ${result.totalTicks} steps`}</Text>
              <View style={styles.heroProgressTrack}>
                <View style={[styles.heroProgressFill, { width: `${Math.floor(stepProgressRatio * 100)}%` }]} />
              </View>
            </View>
            <View style={styles.floorStatusRow}>
              <Text style={styles.floorStatusText}>{`探索度 ${currentFloorExplorationPercentDisplay}%`}</Text>
              <Text style={[styles.floorStatusText, currentFloorStairsDiscovered ? styles.floorStatusFound : null]}>
                {currentFloorStairsDiscovered ? "階段発見済み" : "階段未発見"}
              </Text>
            </View>
            <View style={styles.floorProgressTrack}>
              <View style={[styles.floorProgressFill, { width: `${currentFloorExplorationPercent}%` }]} />
            </View>
          </View>
        </ImageBackground>

        <View style={styles.logSection}>
          <ScrollView
            ref={logScrollRef}
            style={styles.logBox}
            contentContainerStyle={styles.logContent}
          >
            {displayedEvents.map((event, index) => (
              <Text key={`${event.tick}-${event.type}-${index}`} style={styles.logLine}>
                {`${EVENT_PREFIX[event.type]}  ${formatEvent(event, locale, t)}`}
              </Text>
            ))}
          </ScrollView>
        </View>

        <PartyStatusStrip members={displayedPartyMembers} containerStyle={styles.partyStrip} />

        <View style={styles.footerMeta}>
          <View style={styles.footerMetaLeft}>
            <Package size={18} color="#666666" />
            <Text style={styles.footerLeft}>Treasure</Text>
          </View>
          <View style={styles.footerMetaRight}>
            <Text style={styles.footerCountCurrent}>{String(treasureCount)}</Text>
            <Text style={styles.footerCountSlash}>/</Text>
            <Text style={styles.footerCountMax}>{String(totalTreasureCount)}</Text>
          </View>
        </View>
        <View style={styles.actionSection}>
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
              disabled={session?.status === "BUNDLE_CLEARED" || session?.status === "RUN_COMPLETE"}
            >
              <Text style={styles.pauseText}>
                {session?.status === "BUNDLE_CLEARED" || session?.status === "RUN_COMPLETE"
                  ? "Complete"
                  : isPaused
                    ? "Resume"
                    : "Pause"}
              </Text>
            </Pressable>
          </View>
        </View>

        <Modal
          visible={isFloorDecisionModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            /* 階段選択中は明示的に選択させる */
          }}
        >
          <View style={styles.decisionModalBackdrop}>
            <View style={styles.decisionModalSheet}>
              <Text style={styles.decisionModalTitle}>下り階段に到着しました</Text>
              <Text style={styles.decisionModalSub}>{`B${currentFloor}Fを降りますか？`}</Text>
              {canDescend ? (
                <Pressable
                  style={styles.decisionTextButton}
                  onPress={() => setSession((prev) => (prev ? applyFloorDecision(prev, "DESCEND") : prev))}
                >
                  <Text style={styles.decisionTextButtonPrimary}>降りる</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.decisionTextButton}
                onPress={() => setSession((prev) => (prev ? applyFloorDecision(prev, "CONTINUE") : prev))}
              >
                <Text style={styles.decisionTextButtonSecondary}>探索継続</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isExplorationResultModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            /* 明示操作で閉じる */
          }}
        >
          <View style={styles.resultModalBackdrop}>
            <View style={styles.resultModalCard}>
              <Text style={styles.resultModalTitle}>
                {session?.status === "BUNDLE_CLEARED" ? "区間探索完了" : "探索リザルト"}
              </Text>
              <Text style={styles.resultModalSub}>
                {bundleRange ? formatBundleLabel(bundleRange) : `B${floor}F`} / {currentTick} step
              </Text>

              <Text style={styles.resultSectionTitle}>探索した階の探索度</Text>
              <ScrollView
                style={styles.resultListBox}
                contentContainerStyle={styles.resultListContent}
                showsVerticalScrollIndicator={false}
              >
                {exploredFloorProgressRows.length === 0 ? (
                  <Text style={styles.resultEmptyText}>探索した階はありません</Text>
                ) : (
                  exploredFloorProgressRows.map((row) => (
                    <View key={`floor-progress-${row.floor}`} style={styles.resultListRow}>
                      <Text style={styles.resultListRowLabel}>{`B${row.floor}F`}</Text>
                      <Text style={styles.resultListRowValue}>{`${row.explorationPercent}%`}</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <Text style={styles.resultSectionTitle}>入手アイテム（戦闘/宝箱）</Text>
              <ScrollView
                style={styles.resultListBox}
                contentContainerStyle={styles.resultListContent}
                showsVerticalScrollIndicator={false}
              >
                {resultItems.length === 0 ? (
                  <Text style={styles.resultEmptyText}>入手アイテムなし</Text>
                ) : (
                  resultItems.map((item) => (
                    <View key={item.key} style={styles.resultListRow}>
                      <Text style={styles.resultListRowLabel}>{item.label}</Text>
                      <Text
                        style={[
                          styles.resultItemSource,
                          item.source === "TREASURE" ? styles.resultItemSourceTreasure : styles.resultItemSourceBattle,
                        ]}
                      >
                        {item.source === "TREASURE" ? "宝箱" : "戦闘"}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <Pressable
                style={styles.resultCloseButton}
                onPress={() => router.replace("/(tabs)/dungeon")}
              >
                <Text style={styles.resultCloseButtonText}>ダンジョンタブへ戻る</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f2f2" },
  stateMessageWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#6b7280", fontSize: 14 },
  errorText: { color: "#ef4444", textAlign: "center", paddingHorizontal: 24, fontSize: 14 },
  container: { flex: 1, backgroundColor: "#f2f2f2" },
  headerSection: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
    marginBottom: 0,
    borderRadius: 0,
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
  heroProgressWrap: {
    marginTop: 6,
    gap: 4,
  },
  heroProgressLabel: {
    color: "#d4d4d8",
    fontSize: 10,
    fontWeight: "500",
  },
  heroProgressTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  heroProgressFill: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  heroSub: { color: "#d4d4d8", marginTop: 4, fontSize: 10 },
  floorStatusRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floorStatusText: { color: "#e5e7eb", fontSize: 10, fontWeight: "600" },
  floorStatusFound: { color: "#bbf7d0" },
  floorProgressTrack: {
    marginTop: 4,
    width: "100%",
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  floorProgressFill: {
    height: "100%",
    backgroundColor: "#86efac",
  },
  logSection: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  logBox: {
    flex: 1,
    borderTopWidth: 1,
    borderColor: "#d8d8d8",
    backgroundColor: "#f2f2f2",
  },
  logContent: { paddingVertical: 8, paddingHorizontal: 4 },
  logLine: { marginBottom: 12, color: "#404040", fontSize: 13, lineHeight: 16 },
  partyStrip: {
    marginTop: 0,
  },
  footerMeta: {
    marginTop: 0,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#f5f5f5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerMetaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerLeft: { fontSize: 13, color: "#666666", fontWeight: "500" },
  footerMetaRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerCountCurrent: { fontSize: 15, color: "#1a1a1a", fontWeight: "700" },
  footerCountSlash: { fontSize: 13, color: "#aaaaaa", fontWeight: "400" },
  footerCountMax: { fontSize: 15, color: "#888888", fontWeight: "700" },
  actionSection: { paddingHorizontal: 12, paddingBottom: 6 },
  actionRow: { flexDirection: "row", gap: 10 },
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
  descendButton: { backgroundColor: "#1d4ed8" },
  continueButton: {
    borderWidth: 1,
    borderColor: "#cfcfcf",
    backgroundColor: "#e6e6e6",
  },
  decisionModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  decisionModalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
  },
  decisionModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  decisionModalSub: {
    marginTop: 6,
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  decisionTextButton: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  decisionTextButtonPrimary: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  decisionTextButtonSecondary: {
    fontSize: 17,
    fontWeight: "600",
    color: "#374151",
  },
  resultModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  resultModalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  resultModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  resultModalSub: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  resultSectionTitle: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  resultListBox: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fafafa",
  },
  resultListContent: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  resultListRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  resultListRowLabel: {
    flex: 1,
    color: "#111827",
    fontSize: 13,
    fontWeight: "500",
  },
  resultListRowValue: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "700",
  },
  resultItemSource: {
    fontSize: 11,
    fontWeight: "700",
  },
  resultItemSourceTreasure: { color: "#b45309" },
  resultItemSourceBattle: { color: "#1d4ed8" },
  resultEmptyText: {
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 8,
  },
  resultCloseButton: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: "#111827",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  resultCloseButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  disabledButton: { backgroundColor: "#8a8a8a" },
  retreatText: { color: "#4a4a4a", fontSize: 16, fontWeight: "600" },
  pauseText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  continueText: { color: "#3f3f46", fontSize: 16, fontWeight: "700" },
});
