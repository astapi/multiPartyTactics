import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Compass, Package, Pause, Play } from "lucide-react-native";
import { DungeonPartyPanel, DungeonPartyPanelMember } from "@/components/common/DungeonPartyPanel";
import { DUNGEONS } from "@/constants/dungeons";
import { characterEquipmentRepository } from "@/db/repositories/characterEquipmentRepository";
import { DEFAULT_PARTY_ID, charactersRepository } from "@/db/repositories/charactersRepository";
import { dungeonExplorationProgressRepository } from "@/db/repositories/dungeonExplorationProgressRepository";
import { dungeonRepository } from "@/db/repositories/dungeonRepository";
import { equipmentInventoryRepository } from "@/db/repositories/equipmentInventoryRepository";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import { ExplorationSpeedMultiplier } from "@/constants/battleSpeed";
import { ExplorationEvent, ExplorationResult } from "@/game/exploration";
import {
  calculateDungeonItemCapacity,
  DEFAULT_DUNGEON_RETURN_CONDITION,
  DEFAULT_DUNGEON_ITEM_CAPACITY,
  hasAnyDownMember,
  isPartyWiped,
  normalizeDungeonReturnCondition,
} from "@/game/explorationReturn";
import {
  ExplorationSessionState,
  advanceExplorationStep,
  applyBossBattleResult,
  applyBossEncounterDecision,
  createExplorationSession,
  toExplorationResult,
} from "@/game/explorationSession";
import { useI18n } from "@/i18n";
import { useBattleStore } from "@/stores/battleStore";
import { useExplorationRunStore } from "@/stores/explorationRunStore";
import { parchment, parchmentImages, parchmentShadow } from "@/theme/parchment";
import type { BattleStatus, DungeonReturnCondition } from "@/types/models";
import type { EquipmentReward } from "@/types/equipment";
import { toPartyUnits } from "@/game/partyMapper";
import { generateTimeSeed } from "@/utils/rng";

const HERO_IMAGE = parchmentImages.dungeonEncounter;
const EXPLORATION_SCREEN_OPTIONS = { headerShown: false, animation: "none" as const };

type ExplorationEndReason =
  | "ANY_MEMBER_DOWN"
  | "INVENTORY_FULL"
  | "BEFORE_BOSS"
  | "PARTY_WIPED";

const EVENT_PREFIX: Record<ExplorationEvent["type"], string> = {
  LOG: "⋄",
  ENCOUNTER: "✖",
  BOSS_ENCOUNTER: "☠",
  TREASURE: "✦",
  TRAP: "⚠",
  STAIRS_DISCOVERED: "⇣",
  SHORTCUT: "➜",
  FLOOR_DESCEND: "↓",
  FLOOR_CLEAR: "★",
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
  const stairsToFloor =
    typeof event.payload?.toFloor === "number" ? event.payload.toFloor : typeof event.floor === "number" ? event.floor + 1 : "?";
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
  if (event.type === "BOSS_ENCOUNTER") {
    return `B${event.floor ?? "?"}Fでボス「${event.payload?.bossName ?? "?"}」が出現`;
  }
  if (event.type === "STAIRS_DISCOVERED") {
    return `B${stairsToFloor}Fへの下り階段を発見`;
  }
  if (event.type === "SHORTCUT") {
    return `発見済み階段でB${event.payload?.toFloor ?? "?"}Fへ移動 (-${event.payload?.stepCost ?? 0}step)`;
  }
  if (event.type === "FLOOR_DESCEND") {
    return `B${event.payload?.toFloor ?? "?"}Fへ降りた`;
  }
  if (event.type === "FLOOR_CLEAR") {
    return "階層探索を完了した";
  }
  return t(event.messageId as any);
};

const formatClock = (tick: number): string => {
  const total = tick * 8;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

type ExplorationResultItem = {
  key: string;
  source: "BATTLE" | "TREASURE";
  label: string;
};

export default function ExplorationScreen() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const params = useLocalSearchParams<{
    dungeonId?: string;
    floor?: string;
    partyId?: string;
    returnCondition?: string;
  }>();

  const resolvedDungeonId = params.dungeonId ?? DUNGEONS[0]?.id ?? "crestoria_dungeon_1_200";
  const floor = Math.max(1, Number.parseInt(params.floor ?? "1", 10) || 1);
  const resolvedPartyId = params.partyId ?? DEFAULT_PARTY_ID;
  const returnCondition: DungeonReturnCondition = normalizeDungeonReturnCondition(
    params.returnCondition ?? DEFAULT_DUNGEON_RETURN_CONDITION
  );

  const [nextEncounterIndex, setNextEncounterIndex] = useState(0);
  const [session, setSession] = useState<ExplorationSessionState | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [explorationSpeedMultiplier, setExplorationSpeedMultiplier] = useState<ExplorationSpeedMultiplier>(1);
  const logScrollRef = useRef<ScrollView | null>(null);
  const appliedRewardGrantKeysRef = useRef<Set<string>>(new Set());
  const processedBattleRewardSessionIdsRef = useRef<Set<string>>(new Set());
  const processedTrapDamageEventKeysRef = useRef<Set<string>>(new Set());
  const processedBattlePartySyncSessionIdsRef = useRef<Set<string>>(new Set());
  const hasAppliedFloorClearRef = useRef(false);
  const awaitingBossBattleReturnRef = useRef(false);
  const [endReason, setEndReason] = useState<ExplorationEndReason | null>(null);
  const [resultItems, setResultItems] = useState<ExplorationResultItem[]>([]);
  const [resultGoldTotal, setResultGoldTotal] = useState(0);
  const [itemCapacity, setItemCapacity] = useState(DEFAULT_DUNGEON_ITEM_CAPACITY);
  const latestBattleSessionId = useBattleStore((s) => s.latestBattleSessionId);
  const latestBattleExplorationSeed = useBattleStore((s) => s.latestBattleExplorationSeed);
  const latestBattleGold = useBattleStore((s) => s.latestBattleGold);
  const latestBattleDrops = useBattleStore((s) => s.latestBattleDrops);
  const latestBattlePartySync = useBattleStore((s) => s.latestBattlePartySync);
  const latestBattleStatus = useBattleStore((s) => s.status);
  const setBattleStoreStatus = useBattleStore((s) => s.setStatus);
  const setPendingExplorationPartySync = useBattleStore((s) => s.setPendingExplorationPartySync);
  const explorationRunMembers = useExplorationRunStore((s) => s.members);
  const startExplorationRun = useExplorationRunStore((s) => s.startRun);
  const replaceExplorationMembersForRun = useExplorationRunStore((s) => s.replaceMembersForRun);
  const applyPartyWideTrapDamage = useExplorationRunStore((s) => s.applyPartyWideTrapDamage);

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
        const equippedByCharacterId = await characterEquipmentRepository.getByCharacterIds(
          partyRecords.map((record) => record.id)
        );
        const party = toPartyUnits(partyRecords, equippedByCharacterId);
        const nextPartySnapshot = party.map((member) => ({
          id: member.id,
          name: member.name,
          classId: member.classId,
          hp: member.hp,
          mp: member.mp,
          maxHp: member.stats.maxHp,
          maxMp: member.stats.maxMp,
          level: partyRecords.find((record) => record.id === member.id)?.level ?? null,
        }));
        const dungeon = DUNGEONS.find((d) => d.id === resolvedDungeonId) ?? DUNGEONS[0];
        const seed = generateTimeSeed();
        const persistedProgressList = await dungeonExplorationProgressRepository.listByDungeon(resolvedDungeonId);
        const persistedProgress = persistedProgressList.find((row) => row.floor === floor);
        const nextSession = createExplorationSession({
          party,
          dungeon,
          floor,
          seed,
          persistedProgress: persistedProgress
            ? [
                {
                  floor: persistedProgress.floor,
                  explorationPercent: persistedProgress.explorationPercent,
                  stairsDiscovered: persistedProgress.stairsDiscovered,
                },
              ]
            : [],
        });

        if (!mounted) return;
        appliedRewardGrantKeysRef.current = new Set();
        processedBattleRewardSessionIdsRef.current = new Set();
        processedTrapDamageEventKeysRef.current = new Set();
        processedBattlePartySyncSessionIdsRef.current = new Set();
        hasAppliedFloorClearRef.current = false;
        awaitingBossBattleReturnRef.current = false;
        setPendingExplorationPartySync(null);
        setSession(nextSession);
        startExplorationRun({
          explorationSeed: nextSession.seed,
          partyId: resolvedPartyId,
          members: nextPartySnapshot,
        });
        setResultItems([]);
        setResultGoldTotal(0);
        setNextEncounterIndex(0);
        setIsPaused(false);
        setEndReason(null);
        setItemCapacity(calculateDungeonItemCapacity(partyRecords));
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
  }, [floor, resolvedDungeonId, resolvedPartyId, setPendingExplorationPartySync, startExplorationRun]);

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
    let cancelled = false;
    const loadExplorationSpeed = async () => {
      try {
        const saved = await settingsRepository.getExplorationSpeedMultiplier();
        if (!cancelled) {
          setExplorationSpeedMultiplier(saved);
        }
      } catch (loadError) {
        console.error("Failed to load exploration speed setting:", loadError);
      }
    };
    void loadExplorationSpeed();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    if (!isFocused || isNavigating || isPaused) return;
    if (session.status !== "RUNNING") return;

    const timer = setInterval(() => {
      setSession((prev) => (prev ? advanceExplorationStep(prev) : prev));
    }, Math.max(100, Math.round(1000 / explorationSpeedMultiplier)));

    return () => clearInterval(timer);
  }, [explorationSpeedMultiplier, isFocused, isNavigating, isPaused, session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const persist = async () => {
      try {
        await dungeonExplorationProgressRepository.upsertMany(
          Object.values(session.floorProgressMap)
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
  }, [resolvedDungeonId, session]);

  const result = useMemo<ExplorationResult | null>(() => (session ? toExplorationResult(session) : null), [session]);
  const currentTick = session?.currentStep ?? 0;

  useEffect(() => {
    if (!result) return;
    if (!latestBattleSessionId) return;
    if (latestBattleExplorationSeed !== result.seed) return;
    if (processedBattleRewardSessionIdsRef.current.has(latestBattleSessionId)) return;

    processedBattleRewardSessionIdsRef.current.add(latestBattleSessionId);
    if ((!latestBattleDrops || latestBattleDrops.length === 0) && latestBattleGold <= 0) return;
    if (latestBattleGold > 0) {
      setResultGoldTotal((prev) => prev + latestBattleGold);
    }
    setResultItems((prev) => {
      const next = [...prev];
      for (let index = 0; index < latestBattleDrops.length; index += 1) {
        next.push({
          key: `battle:${latestBattleSessionId}:${index}`,
          source: "BATTLE" as const,
          label: latestBattleDrops[index],
        });
      }
      return next;
    });
  }, [latestBattleDrops, latestBattleExplorationSeed, latestBattleGold, latestBattleSessionId, result]);

  useEffect(() => {
    if (endReason) return;
    if (returnCondition !== "INVENTORY_FULL") return;
    if (resultItems.length < itemCapacity) return;
    setIsPaused(true);
    setEndReason("INVENTORY_FULL");
  }, [endReason, itemCapacity, resultItems.length, returnCondition]);

  useEffect(() => {
    if (!result) return;
    if (!latestBattlePartySync) return;
    if (latestBattlePartySync.explorationSeed !== result.seed) return;
    if (latestBattlePartySync.partyId && latestBattlePartySync.partyId !== resolvedPartyId) return;
    if (!latestBattlePartySync.battleSessionId) return;
    if (processedBattlePartySyncSessionIdsRef.current.has(latestBattlePartySync.battleSessionId)) return;

    processedBattlePartySyncSessionIdsRef.current.add(latestBattlePartySync.battleSessionId);
    replaceExplorationMembersForRun({
      explorationSeed: result.seed,
      partyId: resolvedPartyId,
      members: latestBattlePartySync.members,
    });
  }, [latestBattlePartySync, replaceExplorationMembersForRun, resolvedPartyId, result]);

  useEffect(() => {
    if (!result) return;
    for (let i = 0; i < result.events.length; i += 1) {
      const event = result.events[i];
      if (event.tick > currentTick) break;
      if (event.type !== "TRAP") continue;
      const eventKey = `${result.seed}:${i}`;
      if (processedTrapDamageEventKeysRef.current.has(eventKey)) continue;
      processedTrapDamageEventKeysRef.current.add(eventKey);
      applyPartyWideTrapDamage({
        explorationSeed: result.seed,
        partyId: resolvedPartyId,
        damage: Math.max(0, Math.floor(event.payload?.damage ?? 0)),
      });
    }
  }, [applyPartyWideTrapDamage, currentTick, resolvedPartyId, result]);

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
              grantedStats: reward.grantedStats,
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
    if (!session || !result) return;
    if (endReason) return;
    if (session.status !== "AWAITING_BOSS_RESULT") return;
    if (!awaitingBossBattleReturnRef.current) return;
    if (latestBattleExplorationSeed !== result.seed) return;
    if (!["WIN", "LOSE", "DRAW"].includes(latestBattleStatus)) return;

    awaitingBossBattleReturnRef.current = false;
    setSession((prev) => {
      if (!prev) return prev;
      return applyBossBattleResult(prev, latestBattleStatus as Exclude<BattleStatus, "IDLE" | "IN_PROGRESS">);
    });
  }, [endReason, latestBattleExplorationSeed, latestBattleStatus, result, session]);

  useEffect(() => {
    if (endReason) return;
    if (explorationRunMembers.length === 0) return;
    if (returnCondition === "ANY_MEMBER_DOWN" && hasAnyDownMember(explorationRunMembers)) {
      setIsPaused(true);
      setEndReason("ANY_MEMBER_DOWN");
      return;
    }
    if (isPartyWiped(explorationRunMembers)) {
      setIsPaused(true);
      setEndReason("PARTY_WIPED");
    }
  }, [endReason, explorationRunMembers, returnCondition]);

  useEffect(() => {
    if (endReason) return;
    if (returnCondition !== "BEFORE_BOSS") return;
    if (session?.status !== "AWAITING_BOSS_DECISION") return;
    setIsPaused(true);
    setEndReason("BEFORE_BOSS");
  }, [endReason, returnCondition, session?.status]);

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
    setPendingExplorationPartySync({
      battleSessionId: null,
      explorationSeed: result.seed,
      partyId: resolvedPartyId,
      members: explorationRunMembers,
    });
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
    explorationRunMembers,
    setPendingExplorationPartySync,
    session?.currentFloor,
  ]);

  useEffect(() => {
    if (!session) return;
    if (session.status !== "FLOOR_CLEARED") return;
    if (hasAppliedFloorClearRef.current) return;
    hasAppliedFloorClearRef.current = true;

    let cancelled = false;
    const persistClear = async () => {
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
          maxClearedFloor: Math.max(nextProgress.maxClearedFloor, floor),
          clearCount:
            floor > nextProgress.maxClearedFloor
              ? nextProgress.clearCount
              : nextProgress.clearCount + 1,
        });
        if (!cancelled) {
          setIsPaused(true);
        }
      } catch (persistError) {
        if (!cancelled) {
          console.error("Failed to persist floor clear:", persistError);
        }
      }
    };
    void persistClear();
    return () => {
      cancelled = true;
    };
  }, [floor, resolvedDungeonId, session]);

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
  const currentFloor = session?.currentFloor ?? floor;
  const currentFloorProgress = session?.floorProgressMap[currentFloor];
  const currentFloorExplorationPercent = currentFloorProgress?.explorationPercent ?? 0;
  const currentFloorExplorationPercentDisplay = Math.floor(currentFloorExplorationPercent);
  const currentFloorStairsDiscovered = currentFloorProgress?.stairsDiscovered ?? false;
  const isAwaitingBossDecision = session?.status === "AWAITING_BOSS_DECISION";
  const isExplorationResultVisible = endReason !== null || session?.status === "FLOOR_CLEARED";
  const isBossDecisionModalVisible = isFocused && !isNavigating && isAwaitingBossDecision && !isExplorationResultVisible;
  const isExplorationResultModalVisible = isFocused && !isNavigating && !!isExplorationResultVisible;
  const pendingBossEncounter = session?.pendingBossEncounter ?? null;
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
  const displayedPartyMembers = useMemo<DungeonPartyPanelMember[]>(
    () =>
      explorationRunMembers.map((member) => ({
        id: member.id,
        name: member.name,
        classId: member.classId,
        hp: member.hp,
        mp: member.mp,
        maxHp: member.maxHp,
        maxMp: member.maxMp,
        level: member.level,
      })),
    [explorationRunMembers]
  );
  const inventoryUsageText = `${resultItems.length}/${itemCapacity}`;
  const logTitle = locale === "ja" ? "探索記録" : "Exploration Log";
  const explorationStateText =
    session?.status === "FLOOR_CLEARED"
      ? locale === "ja"
        ? "探索完了"
        : "Exploration Complete"
      : isPaused
        ? locale === "ja"
          ? "探索停止中"
          : "Paused"
        : locale === "ja"
          ? "探索中..."
          : "Exploring...";
  const resultTitle =
    session?.status === "FLOOR_CLEARED"
      ? "階層探索完了"
      : endReason === "ANY_MEMBER_DOWN"
        ? "戦闘不能で帰還"
        : endReason === "INVENTORY_FULL"
          ? "持ち物が満杯になった"
          : endReason === "BEFORE_BOSS"
            ? "ボス前で帰還"
            : endReason === "PARTY_WIPED"
              ? "全滅で探索終了"
              : "探索リザルト";
  const resultSubtitle =
    session?.status === "FLOOR_CLEARED"
      ? `B${floor}F / クリア`
      : endReason === "INVENTORY_FULL"
        ? `B${currentFloor}F / ${inventoryUsageText}`
        : `B${currentFloor}F / ${currentTick} step`;

  useEffect(() => {
    if (!isFocused) return;
    if (displayedEvents.length === 0) return;
    requestAnimationFrame(() => {
      logScrollRef.current?.scrollToEnd({ animated: false });
    });
  }, [displayedEvents.length, isFocused]);

  const handleStartBossBattle = useCallback(() => {
    if (!session?.pendingBossEncounter) return;
    const bossEncounter = session.pendingBossEncounter;
    setSession((prev) => (prev ? applyBossEncounterDecision(prev, "FIGHT") : prev));
    awaitingBossBattleReturnRef.current = true;
    setBattleStoreStatus("IDLE");
    setIsNavigating(true);
    setPendingExplorationPartySync({
      battleSessionId: null,
      explorationSeed: result?.seed ?? 0,
      partyId: resolvedPartyId,
      members: explorationRunMembers,
    });
    router.push({
      pathname: "/dungeon/battle",
      params: {
        dungeonId: resolvedDungeonId,
        floor: String(session.currentFloor ?? floor),
        partyId: resolvedPartyId,
        explorationSeed: String(result?.seed ?? 0),
        encounter: JSON.stringify(bossEncounter),
      },
    });
  }, [
    floor,
    explorationRunMembers,
    resolvedDungeonId,
    resolvedPartyId,
    result?.seed,
    router,
    session,
    setBattleStoreStatus,
    setPendingExplorationPartySync,
  ]);

  if (error) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
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
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
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
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={EXPLORATION_SCREEN_OPTIONS} />
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <View style={styles.topRow}>
            <View style={styles.titleWrap}>
              <View style={styles.floorBadge}>
                <Text style={styles.floorBadgeText}>{`B${floor}F`}</Text>
              </View>
              <Text style={styles.title}>
                {locale === "ja" ? "探索記録" : "Dungeon Exploration"}
              </Text>
            </View>
            <View style={styles.headerControls}>
              <View style={styles.speedBadge}>
                <Text style={styles.speedBadgeLabel}>{locale === "ja" ? "速度" : "SPD"}</Text>
                <Text style={styles.speedBadgeValue}>{`${explorationSpeedMultiplier}x`}</Text>
              </View>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>{formatClock(currentTick)}</Text>
              </View>
              <Pressable
                style={[styles.autoBadge, isPaused ? styles.autoBadgePaused : null]}
                onPress={() => setIsPaused((prev) => !prev)}
                disabled={session?.status === "FLOOR_CLEARED"}
              >
                {isPaused ? <Play size={11} color={parchment.inkSoft} /> : <Pause size={11} color={parchment.inkSoft} />}
                <Text style={styles.autoBadgeText}>{isPaused ? "PAUSED" : "AUTO"}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.sectionDivider}>
          <View style={styles.sectionDividerLine} />
          <View style={styles.sectionDividerDiamond} />
          <View style={styles.sectionDividerLine} />
        </View>

        <View style={styles.logSection}>
          <View style={styles.logBox}>
            <View style={styles.logBase} />
            <View style={styles.logHeader}>
              <Text style={styles.logTitle}>{logTitle}</Text>
              <Text style={styles.logHeaderMeta}>{`B${currentFloor}F`}</Text>
            </View>
            <ScrollView
              ref={logScrollRef}
              style={styles.logScroll}
              contentContainerStyle={styles.logContent}
              showsVerticalScrollIndicator={false}
            >
              {displayedEvents.length === 0 ? (
                <View style={styles.logLineRow}>
                  <Text style={styles.logLinePrefix}>·</Text>
                  <Text style={styles.logLine}>{locale === "ja" ? "まだ記録はありません。" : "No records yet."}</Text>
                </View>
              ) : (
                displayedEvents.map((event, index) => (
                  <View key={`${event.tick}-${event.type}-${index}`} style={styles.logLineRow}>
                    <Text style={styles.logLinePrefix}>{EVENT_PREFIX[event.type]}</Text>
                    <Text style={styles.logLine}>{formatEvent(event, locale, t)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>

        <View style={styles.sectionDividerCompact}>
          <View style={styles.sectionDividerCompactLine} />
          <View style={styles.sectionDividerCompactDiamond} />
          <View style={styles.sectionDividerCompactLine} />
        </View>

        <ImageBackground source={HERO_IMAGE} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay}>
            <View style={styles.heroStatusCard}>
              <Text style={styles.heroMain}>
                {`現在 B${currentFloor}F`}
              </Text>
              <Text style={styles.heroSubLabel}>{t(`dungeon.ui.returnCondition.${returnCondition}` as any)}</Text>
              <View style={styles.heroProgressWrap}>
                <View style={styles.heroProgressTrack}>
                  <View
                    style={[
                      styles.heroProgressFill,
                      { width: `${Math.floor((Math.min(resultItems.length, itemCapacity) / itemCapacity) * 100)}%` },
                    ]}
                  />
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
            <View style={styles.heroInventoryBadge}>
              <Package size={16} color="#f3ebdc" />
              <Text style={styles.heroInventoryValue}>{inventoryUsageText}</Text>
            </View>
            <View style={styles.heroCenterBadge}>
              <Compass size={18} color="#f3ebdc" />
              <Text style={styles.heroCenterBadgeText}>{explorationStateText}</Text>
            </View>
          </View>
        </ImageBackground>

        <DungeonPartyPanel members={displayedPartyMembers} />

        <Modal
          visible={isBossDecisionModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            /* ボス遭遇中は明示選択 */
          }}
        >
          <View style={styles.decisionModalBackdrop}>
            <View style={styles.decisionModalSheet}>
              <Text style={styles.decisionModalTitle}>ボスが現れた</Text>
              <Text style={styles.decisionModalSub}>
                {`B${currentFloor}Fでボス「${pendingBossEncounter?.rollMeta.bossName ?? "レプス"}」と遭遇。戦いますか？`}
              </Text>
              <Pressable style={styles.decisionTextButton} onPress={handleStartBossBattle}>
                <Text style={styles.decisionTextButtonPrimary}>戦う</Text>
              </Pressable>
              <Pressable
                style={styles.decisionTextButton}
                onPress={() => {
                  setSession((prev) => (prev ? applyBossEncounterDecision(prev, "CONTINUE") : prev));
                  setIsPaused(true);
                  setEndReason("BEFORE_BOSS");
                }}
              >
                <Text style={styles.decisionTextButtonSecondary}>見送る</Text>
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
                {resultTitle}
              </Text>
              <Text style={styles.resultModalSub}>
                {resultSubtitle}
              </Text>

              <Text style={styles.resultSectionTitle}>{t("battle.result.goldTitle")}</Text>
              <View style={styles.resultGoldCard}>
                <Text style={styles.resultGoldValue}>
                  {t("battle.result.goldValue", { gold: resultGoldTotal })}
                </Text>
              </View>

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
  screen: { flex: 1, backgroundColor: parchment.background },
  stateMessageWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: parchment.inkSoft, fontSize: 14 },
  errorText: { color: parchment.danger, textAlign: "center", paddingHorizontal: 24, fontSize: 14 },
  container: { flex: 1, backgroundColor: parchment.background },
  headerSection: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  floorBadge: {
    borderRadius: 8,
    backgroundColor: "#8b5327",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  floorBadgeText: { color: "#f7efdf", fontSize: 11, fontWeight: "800" },
  title: { fontSize: 20, fontWeight: "700", color: parchment.ink },
  headerControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  speedBadge: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(122,107,85,0.2)",
    backgroundColor: "rgba(244,236,221,0.78)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  speedBadgeLabel: { fontSize: 9, color: parchment.inkMuted, fontWeight: "700", letterSpacing: 0.5 },
  speedBadgeValue: { fontSize: 11, color: parchment.ink, fontWeight: "700" },
  timeBadge: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    backgroundColor: "rgba(244,236,221,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  timeBadgeText: { fontSize: 12, color: parchment.ink, fontWeight: "800" },
  autoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(122,107,85,0.16)",
    backgroundColor: "rgba(244,236,221,0.78)",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  autoBadgePaused: {
    backgroundColor: "rgba(239,227,207,0.96)",
  },
  autoBadgeText: {
    fontSize: 10,
    color: parchment.inkSoft,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingBottom: 6,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(139,83,39,0.18)",
  },
  sectionDividerDiamond: {
    width: 6,
    height: 6,
    backgroundColor: "rgba(139,83,39,0.55)",
    transform: [{ rotate: "45deg" }],
  },
  sectionDividerCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 40,
  },
  sectionDividerCompactLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(139,83,39,0.12)",
  },
  sectionDividerCompactDiamond: {
    width: 5,
    height: 5,
    backgroundColor: "rgba(139,83,39,0.4)",
    transform: [{ rotate: "45deg" }],
  },
  hero: {
    height: 220,
    width: "100%",
    marginBottom: 8,
    borderRadius: 0,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  heroImage: { resizeMode: "cover" },
  heroOverlay: {
    flex: 1,
    justifyContent: "space-between",
    backgroundColor: "rgba(26, 14, 5, 0.16)",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  heroStatusCard: {
    alignSelf: "stretch",
    marginTop: "auto",
    borderRadius: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  heroMain: { color: "#f7efdf", fontSize: 20, lineHeight: 24, fontWeight: "800" },
  heroSubLabel: { marginTop: 4, color: "#eadfcb", fontSize: 11, fontWeight: "600" },
  heroProgressWrap: { marginTop: 8, gap: 4 },
  heroProgressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(245,237,224,0.18)",
    overflow: "hidden",
  },
  heroProgressFill: {
    height: "100%",
    backgroundColor: parchment.gold,
  },
  floorStatusRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floorStatusText: { color: "#f5ede0", fontSize: 11, fontWeight: "600" },
  floorStatusFound: { color: "#d4efc2" },
  floorProgressTrack: {
    marginTop: 6,
    width: "100%",
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(245,237,224,0.2)",
  },
  floorProgressFill: {
    height: "100%",
    backgroundColor: parchment.success,
  },
  heroCenterBadge: {
    alignSelf: "center",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  heroCenterBadgeText: {
    color: "#f3ebdc",
    fontSize: 14,
    fontWeight: "700",
  },
  heroInventoryBadge: {
    position: "absolute",
    right: 14,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "rgba(43, 29, 16, 0.56)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroInventoryValue: {
    color: "#f7efdf",
    fontSize: 14,
    fontWeight: "800",
  },
  logSection: {
    flex: 1,
    minHeight: 180,
    paddingTop: 0,
  },
  logBox: {
    flex: 1,
    minHeight: 180,
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: parchment.background,
  },
  logBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: parchment.background,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  logTitle: {
    color: "#7f6b50",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
  },
  logHeaderMeta: {
    color: parchment.inkSoft,
    fontSize: 11,
    fontWeight: "700",
  },
  logScroll: { flex: 1 },
  logContent: { paddingBottom: 12 },
  logLineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: "rgba(122,107,85,0.13)",
  },
  logLinePrefix: {
    width: 14,
    color: "#8b5327",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  logLine: {
    flex: 1,
    color: parchment.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  decisionModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(26, 14, 5, 0.42)",
  },
  decisionModalSheet: {
    backgroundColor: parchment.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: parchment.goldLine,
  },
  decisionModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: parchment.ink,
    textAlign: "center",
  },
  decisionModalSub: {
    marginTop: 6,
    fontSize: 12,
    color: parchment.inkSoft,
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
    color: "#8b5327",
  },
  decisionTextButtonSecondary: {
    fontSize: 17,
    fontWeight: "600",
    color: parchment.ink,
  },
  resultModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(26,14,5,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  resultModalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    backgroundColor: parchment.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  resultModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: parchment.ink,
    textAlign: "center",
  },
  resultModalSub: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 12,
    color: parchment.inkSoft,
    textAlign: "center",
  },
  resultSectionTitle: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: parchment.ink,
  },
  resultGoldCard: {
    borderWidth: 1,
    borderColor: parchment.goldLine,
    borderRadius: 10,
    backgroundColor: "rgba(196,168,112,0.14)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  resultGoldValue: {
    color: "#5b4300",
    fontSize: 18,
    fontWeight: "800",
  },
  resultListBox: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    borderRadius: 10,
    backgroundColor: "rgba(244,236,221,0.75)",
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
    color: parchment.ink,
    fontSize: 13,
    fontWeight: "500",
  },
  resultListRowValue: {
    color: parchment.ink,
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
    color: parchment.inkSoft,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 8,
  },
  resultCloseButton: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: parchment.headerBar,
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
