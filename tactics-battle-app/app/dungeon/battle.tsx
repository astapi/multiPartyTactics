import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image, ImageBackground, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Pause, Play } from "lucide-react-native";
import { battleRepository } from "@/db/repositories/battleRepository";
import { DEFAULT_PARTY_ID, charactersRepository } from "@/db/repositories/charactersRepository";
import { equipmentInventoryRepository } from "@/db/repositories/equipmentInventoryRepository";
import { tacticsRepository } from "@/db/repositories/tacticsRepository";
import { PartyStatusStrip } from "@/components/common/PartyStatusStrip";
import { Unit } from "@/game/battle";
import { formatBattleLogMessage } from "@/game/battleLog";
import { DEFAULT_SKILLS, createBattleSessionId, createSkillMap } from "@/game/battleSetup";
import { BattleOutcome, BattleReplayState, simulateBattle } from "@/game/battleSimulation";
import { EncounterResult, generateEncounter } from "@/game/encounter";
import { rollMonsterDrops } from "@/game/loot/equipmentLootRoller";
import { toUnit } from "@/game/partyMapper";
import { applyExperienceToCharacter, calculateBattleExp } from "@/game/progression";
import { useI18n } from "@/i18n";
import { CharacterRecord, TacticsRuleRecord } from "@/types/models";
import { useBattleStore } from "@/stores/battleStore";

type BattlePhase = "LOADING" | "ENCOUNTER" | "SIMULATING" | "RESULT" | "ERROR";
type LevelUpStatKey = "maxHp" | "atk" | "def" | "spd" | "maxMp" | "mpRegen";
type BattleResultLevelUp = {
  characterId: string;
  name: string;
  previousLevel: number;
  newLevel: number;
  statUps: Array<{ statKey: LevelUpStatKey; amount: number }>;
};
type BattleResultSummary = {
  expGained: number;
  expRecipientCount: number;
  levelUps: BattleResultLevelUp[];
  drops: string[];
};

const BATTLE_BG = require("@/assets/images/backgrounds/dungeon_exploration.jpg");
const BATTLE_SCREEN_OPTIONS = { headerShown: false, animation: "none" as const };
const RESULT_SHEET_COLLAPSED_PEEK_HEIGHT = 44;
const RESULT_SHEET_ANIMATION_MS = 220;
const RESULT_SHEET_PARTY_STRIP_OFFSET = 10;

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

const cloneReplayUnit = (unit: Unit): Unit => ({
  ...unit,
  stats: { ...unit.stats },
  statusEffects: unit.statusEffects.map((status) => ({ ...status })),
  effects: unit.effects.map((effect) => ({ ...effect })),
  cooldowns: { ...unit.cooldowns },
});

const cloneReplayState = (state: BattleReplayState): BattleReplayState => ({
  turn: state.turn,
  party: state.party.map(cloneReplayUnit),
  enemies: state.enemies.map(cloneReplayUnit),
});

const buildLevelUpStatDiffs = (
  previous: CharacterRecord,
  next: CharacterRecord
): BattleResultLevelUp["statUps"] => {
  const diffs: BattleResultLevelUp["statUps"] = [];
  const pairs: Array<{ statKey: LevelUpStatKey; previous: number; next: number }> = [
    { statKey: "maxHp", previous: previous.baseMaxHp, next: next.baseMaxHp },
    { statKey: "atk", previous: previous.baseAtk, next: next.baseAtk },
    { statKey: "def", previous: previous.baseDef, next: next.baseDef },
    { statKey: "spd", previous: previous.baseSpd, next: next.baseSpd },
    { statKey: "maxMp", previous: previous.baseMaxMp, next: next.baseMaxMp },
    { statKey: "mpRegen", previous: previous.baseMpRegen, next: next.baseMpRegen },
  ];
  for (const pair of pairs) {
    const amount = Math.max(0, pair.next - pair.previous);
    if (amount <= 0) continue;
    diffs.push({ statKey: pair.statKey, amount });
  }
  return diffs;
};

export default function BattleScreen() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const insets = useSafeAreaInsets();
  const { dungeonId, floor, explorationSeed, encounter, partyId } = useLocalSearchParams<{
    dungeonId?: string;
    floor?: string;
    explorationSeed?: string;
    encounter?: string;
    partyId?: string;
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
  const [isPaused, setIsPaused] = useState(false);
  const [battleResultSummary, setBattleResultSummary] = useState<BattleResultSummary | null>(null);
  const [party, setParty] = useState<Unit[]>([]);
  const [enemies, setEnemies] = useState<Unit[]>([]);
  const [turns, setTurns] = useState(0);
  const [partyUiMetaById, setPartyUiMetaById] = useState<Record<string, { level: number }>>({});
  const [replayStates, setReplayStates] = useState<BattleReplayState[]>([]);
  const [combatOutcomeRevealLogCount, setCombatOutcomeRevealLogCount] = useState<number | null>(null);
  const [finalOutcome, setFinalOutcome] = useState<BattleOutcome | null>(null);
  const [resultSheetHeight, setResultSheetHeight] = useState(0);
  const logScrollRef = useRef<ScrollView | null>(null);
  const prevCanOpenResultSummaryRef = useRef(false);
  const resultSheetTranslateY = useSharedValue(0);
  const resultSheetMaxTranslateY = useSharedValue(0);
  const resultSheetDragStartY = useSharedValue(0);
  const setSessionId = useBattleStore((s) => s.setSessionId);
  const setLogs = useBattleStore((s) => s.setLogs);
  const setStatus = useBattleStore((s) => s.setStatus);
  const setLatestBattleRewards = useBattleStore((s) => s.setLatestBattleRewards);
  const logs = useBattleStore((s) => s.logs);
  const reset = useBattleStore((s) => s.reset);
  const dungeonTitle = t(
    DUNGEON_NAME_I18N_KEY[resolvedDungeonId as keyof typeof DUNGEON_NAME_I18N_KEY] ??
      "dungeon.name.crestoria_dungeon_1_4"
  );
  const isOutcomeBadgeVisible =
    phase === "RESULT" &&
    finalOutcome !== null &&
    combatOutcomeRevealLogCount !== null &&
    revealedLogCount >= combatOutcomeRevealLogCount;
  const resultLabel =
    isOutcomeBadgeVisible && finalOutcome ? t(BATTLE_RESULT_I18N_KEY[finalOutcome]) : null;

  const skillMap = useMemo(() => createSkillMap(DEFAULT_SKILLS), []);

  useEffect(() => {
    const load = async () => {
      reset();
      setPhase("LOADING");
      setError(null);
      const parsedFloor = Math.max(1, Number.parseInt(floor ?? "1", 10) || 1);
      const parsedSeed = explorationSeed ? Number.parseInt(explorationSeed, 10) : Date.now();
      const nextDungeonId = dungeonId ?? "crestoria_dungeon_1_4";
      const nextPartyId = partyId ?? DEFAULT_PARTY_ID;
      const parsedEncounter = parseEncounter(encounter);
      setResolvedDungeonId(nextDungeonId);
      setResolvedFloor(parsedFloor);
      setResolvedSeed(Number.isFinite(parsedSeed) ? parsedSeed : null);
      setEncounterData(parsedEncounter);
      try {
        const selected = await charactersRepository.listPartyMembers(nextPartyId);
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
        setIsPaused(false);
        setBattleResultSummary(null);
        setReplayStates([]);
        setCombatOutcomeRevealLogCount(null);
        setFinalOutcome(null);
        setResultSheetHeight(0);
        resultSheetTranslateY.value = 0;
        resultSheetMaxTranslateY.value = 0;
        setPhase("ENCOUNTER");
      } catch (error) {
        console.error("Failed to load battle:", error);
        setError("戦闘の初期化に失敗しました。");
        setStatus("IDLE");
        setPhase("ERROR");
      }
    };
    void load();
  }, [dungeonId, encounter, explorationSeed, floor, partyId, reset, setLogs, setSessionId, setStatus, skillMap]);

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
      let combinedReplayStates = result.replayStates;
      const nextResultSummary: BattleResultSummary = {
        expGained: 0,
        expRecipientCount: 0,
        levelUps: [],
        drops: [],
      };
      if (result.outcome === "WIN") {
        const alivePartyIds = new Set(
          result.finalParty.filter((member) => member.hp > 0).map((member) => member.id)
        );
        if (alivePartyIds.size > 0) {
          const partyRecords = await charactersRepository.listPartyMembers(partyId ?? DEFAULT_PARTY_ID);
          const expGain = calculateBattleExp({
            floor: resolvedFloor,
            enemyCount: encounterData.enemies.length,
          });
          nextResultSummary.expGained = expGain;
          nextResultSummary.expRecipientCount = alivePartyIds.size;
          const leveledPartyUiMetaById: Record<string, { level: number }> = {
            ...partyUiMetaById,
          };
          for (const record of partyRecords) {
            if (!alivePartyIds.has(record.id)) continue;
            const progression = applyExperienceToCharacter(record, expGain);
            await charactersRepository.upsert(progression.character);
            leveledPartyUiMetaById[record.id] = { level: progression.newLevel };
            if (progression.leveledUpBy > 0) {
              nextResultSummary.levelUps.push({
                characterId: record.id,
                name: record.name,
                previousLevel: progression.previousLevel,
                newLevel: progression.newLevel,
                statUps: buildLevelUpStatDiffs(record, progression.character),
              });
            }
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
          nextResultSummary.drops.push(itemName);
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
        if (lootLogRecords.length > 0) {
          const lastReplayState =
            combinedReplayStates[combinedReplayStates.length - 1] ??
            ({
              turn: result.turns,
              party: result.finalParty,
              enemies: result.finalEnemies,
            } satisfies BattleReplayState);
          combinedReplayStates = [
            ...combinedReplayStates,
            ...lootLogRecords.map(() => cloneReplayState(lastReplayState)),
          ];
        }
      }

      setParty(result.finalParty);
      setEnemies(result.finalEnemies);
      setSessionId(nextSessionId);
      setStatus(result.outcome);
      setLogs(combinedLogs);
      setLatestBattleRewards({
        sessionId: nextSessionId,
        explorationSeed: resolvedSeed,
        drops: nextResultSummary.drops,
      });
      setReplayStates(combinedReplayStates);
      setCombatOutcomeRevealLogCount(result.outcomeRevealLogCount);
      setFinalOutcome(result.outcome);
      setTurns(result.turns);
      setRevealedLogCount(0);
      setBattleResultSummary(nextResultSummary);
      setResultSheetHeight(0);
      resultSheetTranslateY.value = 0;
      resultSheetMaxTranslateY.value = 0;
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
  const canOpenResultSummary =
    phase === "RESULT" && battleCompleted && (logs.length === 0 || revealedLogCount >= logs.length);
  const isResultSheetVisible = canOpenResultSummary;
  const resultSheetTravel = Math.max(0, resultSheetHeight - RESULT_SHEET_COLLAPSED_PEEK_HEIGHT - insets.bottom);
  const resultSheetCollapsedReservedSpace = isResultSheetVisible
    ? Math.max(0, RESULT_SHEET_COLLAPSED_PEEK_HEIGHT + Math.max(0, insets.bottom) - RESULT_SHEET_PARTY_STRIP_OFFSET)
    : 0;
  const resultStatLabelByKey: Record<LevelUpStatKey, string> = {
    maxHp: t("battle.result.stat.maxHp"),
    atk: t("battle.result.stat.atk"),
    def: t("battle.result.stat.def"),
    spd: t("battle.result.stat.spd"),
    maxMp: t("battle.result.stat.maxMp"),
    mpRegen: t("battle.result.stat.mpRegen"),
  };

  useEffect(() => {
    if (renderedLogCount <= 0) return;
    requestAnimationFrame(() => {
      logScrollRef.current?.scrollToEnd({ animated: false });
    });
  }, [renderedLogCount]);

  useEffect(() => {
    resultSheetMaxTranslateY.value = resultSheetTravel;
    if (!isResultSheetVisible) {
      resultSheetTranslateY.value = 0;
      return;
    }
    if (resultSheetTravel <= 0) {
      resultSheetTranslateY.value = 0;
      return;
    }
    resultSheetTranslateY.value = Math.max(0, Math.min(resultSheetTranslateY.value, resultSheetTravel));
  }, [insets.bottom, isResultSheetVisible, resultSheetTravel, resultSheetMaxTranslateY, resultSheetTranslateY]);

  useEffect(() => {
    if (isResultSheetVisible && !prevCanOpenResultSummaryRef.current) {
      resultSheetTranslateY.value = withTiming(0, {
        duration: RESULT_SHEET_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
      });
    }
    if (!isResultSheetVisible) {
      resultSheetTranslateY.value = 0;
    }
    prevCanOpenResultSummaryRef.current = isResultSheetVisible;
  }, [isResultSheetVisible, resultSheetTranslateY]);

  const resultSheetBackdropStyle = useAnimatedStyle(() => {
    const max = Math.max(1, resultSheetMaxTranslateY.value);
    const opacity = interpolate(resultSheetTranslateY.value, [0, max], [1, 0]);
    return {
      opacity,
    };
  });

  const resultSheetContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: resultSheetTranslateY.value }],
  }));

  const resultSheetPanGesture = Gesture.Pan()
    .enabled(isResultSheetVisible)
    .onBegin(() => {
      resultSheetDragStartY.value = resultSheetTranslateY.value;
    })
    .onUpdate((event) => {
      const max = resultSheetMaxTranslateY.value;
      if (max <= 0) return;
      const next = resultSheetDragStartY.value + event.translationY;
      resultSheetTranslateY.value = Math.max(0, Math.min(max, next));
    })
    .onEnd((event) => {
      const max = resultSheetMaxTranslateY.value;
      if (max <= 0) return;
      const shouldCollapse = event.velocityY > 700 || resultSheetTranslateY.value > max * 0.4;
      resultSheetTranslateY.value = withTiming(shouldCollapse ? max : 0, {
        duration: RESULT_SHEET_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
      });
    });

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
  const replayStateIndex =
    replayStates.length > 0 ? Math.max(0, Math.min(revealedLogCount, replayStates.length - 1)) : null;
  const activeReplayState = replayStateIndex !== null ? replayStates[replayStateIndex] : null;
  const displayParty = activeReplayState?.party ?? party;
  const displayEnemies = activeReplayState?.enemies ?? enemies;
  const displayTurn = activeReplayState?.turn ?? turns;
  return renderBattleLayout({
    floor: resolvedFloor,
    title: dungeonTitle,
    enemies: displayEnemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      image: getEnemyImage(enemy.id),
      hp: enemy.hp,
      maxHp: enemy.stats.maxHp,
    })),
    party: displayParty,
    logs: visibleLogs,
    turnText: displayTurn > 0 ? `Turn ${displayTurn}` : "Turn --",
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
                  finalOutcome === "WIN" && styles.resultBadgeWin,
                  finalOutcome === "LOSE" && styles.resultBadgeLose,
                  finalOutcome === "DRAW" && styles.resultBadgeDraw,
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
            containerStyle={{ marginBottom: resultSheetCollapsedReservedSpace }}
          />

          {isResultSheetVisible ? (
            <>
              <Animated.View pointerEvents="none" style={[styles.resultSheetBackdrop, resultSheetBackdropStyle]} />
              <Animated.View
                style={[styles.resultSheetContainer, { bottom: -insets.bottom }, resultSheetContainerStyle]}
                onLayout={(event) => {
                  const height = Math.round(event.nativeEvent.layout.height);
                  if (height > 0 && height !== resultSheetHeight) {
                    setResultSheetHeight(height);
                  }
                }}
              >
                <View style={styles.resultPanel}>
                  <GestureDetector gesture={resultSheetPanGesture}>
                    <View style={styles.resultSheetHandleArea}>
                      <View style={styles.resultSheetGrabber} />
                    </View>
                  </GestureDetector>

                  <Text style={styles.resultPanelTitle}>{t("battle.result.summaryTitle")}</Text>
                  <ScrollView
                    style={styles.resultPanelScroll}
                    contentContainerStyle={styles.resultPanelContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.resultSection}>
                      <Text style={styles.resultSectionTitle}>{t("battle.result.expTitle")}</Text>
                      <Text style={styles.resultPrimaryLine}>
                        {t("battle.result.expValue", {
                          exp: battleResultSummary?.expGained ?? 0,
                        })}
                      </Text>
                    </View>

                    {(battleResultSummary?.levelUps.length ?? 0) > 0 ? (
                      <View style={styles.resultSection}>
                        <Text style={styles.resultSectionTitle}>{t("battle.result.levelUpTitle")}</Text>
                        {battleResultSummary?.levelUps.map((levelUp) => (
                          <View key={levelUp.characterId} style={styles.levelUpCard}>
                            <Text style={styles.levelUpName}>
                              {t("battle.result.levelUpName", {
                                name: levelUp.name,
                                prev: levelUp.previousLevel,
                                next: levelUp.newLevel,
                              })}
                            </Text>
                            <View style={styles.levelUpStatsRow}>
                              {levelUp.statUps.map((stat) => (
                                <View key={`${levelUp.characterId}-${stat.statKey}`} style={styles.levelUpStatChip}>
                                  <Text style={styles.levelUpStatChipText}>
                                    {resultStatLabelByKey[stat.statKey]} +{stat.amount}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {(battleResultSummary?.drops.length ?? 0) > 0 ? (
                      <View style={styles.resultSection}>
                        <Text style={styles.resultSectionTitle}>{t("battle.result.dropTitle")}</Text>
                        {battleResultSummary?.drops.map((dropName, idx) => (
                          <Text key={`${dropName}-${idx}`} style={styles.resultListLine}>
                            ・{dropName}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </ScrollView>

                  <Pressable
                    onPress={() => router.back()}
                    style={[styles.resultContinueButton, { marginBottom: 16 + insets.bottom }]}
                  >
                    <Text style={styles.resultContinueButtonText}>
                      {t("battle.result.continueExploration")}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            </>
          ) : null}
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
  container: { flex: 1, backgroundColor: "#ffffff", position: "relative" },
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
  resultSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.38)",
  },
  resultSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "88%",
  },
  resultPanel: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  resultSheetHandleArea: {
    height: RESULT_SHEET_COLLAPSED_PEEK_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eef0f3",
    backgroundColor: "#ffffff",
  },
  resultSheetGrabber: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#d1d5db",
  },
  resultPanelTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  resultPanelScroll: {
    maxHeight: 360,
  },
  resultPanelContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  resultSection: {
    gap: 6,
  },
  resultSectionTitle: {
    color: "#4b5563",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  resultPrimaryLine: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  resultMutedLine: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 18,
  },
  resultListLine: {
    color: "#111827",
    fontSize: 13,
    lineHeight: 19,
  },
  levelUpCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 7,
  },
  levelUpName: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  levelUpStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  levelUpStatChip: {
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelUpStatChipText: {
    color: "#1f2937",
    fontSize: 11,
    fontWeight: "600",
  },
  resultContinueButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  resultContinueButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
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
