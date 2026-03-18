import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Image,
  ImageBackground,
  ImageSourcePropType,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Pause, Play } from "lucide-react-native";
import { BattleEffectLayer } from "@/components/battle/BattleEffectLayer";
import { preloadBattleSounds, unloadBattleSounds } from "@/features/battle/audio/battleSounds";
import { battleRepository } from "@/db/repositories/battleRepository";
import { characterEquipmentRepository } from "@/db/repositories/characterEquipmentRepository";
import { DEFAULT_PARTY_ID, charactersRepository } from "@/db/repositories/charactersRepository";
import { equipmentInventoryRepository } from "@/db/repositories/equipmentInventoryRepository";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import { tacticsRepository } from "@/db/repositories/tacticsRepository";
import { walletRepository } from "@/db/repositories/walletRepository";
import { DungeonPartyPanel } from "@/components/common/DungeonPartyPanel";
import { getAttackTrailPreset } from "@/features/battle/animation/presets";
import type {
  BattleAttackStyle,
  BattleEffectRect,
  BattleVisualEvent,
} from "@/features/battle/animation/types";
import { Unit } from "@/game/battle";
import { formatBattleLogMessage } from "@/game/battleLog";
import { DEFAULT_SKILLS, createBattleSessionId, createSkillMap } from "@/game/battleSetup";
import { BattleOutcome, BattleReplayState, simulateBattle } from "@/game/battleSimulation";
import { EncounterResult, generateEncounter } from "@/game/encounter";
import { computeCharacterDerivedStats, toBaseResource, toBattleResource } from "@/game/equipment/equipmentStatsService";
import { rollMonsterDrops } from "@/game/loot/equipmentLootRoller";
import { getMonsterDropGold } from "@/game/loot/monsterDropTableService";
import { toPartyUnits } from "@/game/partyMapper";
import { applyExperienceToCharacter, calculateBattleExp } from "@/game/progression";
import { useI18n } from "@/i18n";
import { CharacterRecord, TacticsRuleRecord } from "@/types/models";
import { BATTLE_SPEED_OPTIONS, BattleSpeedMultiplier } from "@/constants/battleSpeed";
import { getEnemyImage, getEnemySizeScale, isBossEnemyId } from "@/constants/enemyImages";
import { resolveBattleLogActorImage } from "@/features/battle/log/actorIcon";
import { useBattleStore } from "@/stores/battleStore";
import { parchment } from "@/theme/parchment";

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
  goldGained: number;
  expGained: number;
  expRecipientCount: number;
  levelUps: BattleResultLevelUp[];
  drops: string[];
};

const BATTLE_BG = require("@/assets/images/backgrounds/dungeon_exploration.jpg");
const BATTLE_SCREEN_OPTIONS = { headerShown: false, animation: "none" as const };
const RESULT_AUTO_RETURN_BASE_DELAY_MS = 1200;
const BATTLE_LOG_BASE_REVEAL_INTERVAL_MS = 900;
const BATTLE_RESULT_I18N_KEY = {
  WIN: "battle.result.win",
  LOSE: "battle.result.lose",
  DRAW: "battle.result.draw",
} as const;


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

const BASE_ENEMY_IMAGE_SIZE = 72;

type BattleEnemyViewModel = {
  id: string;
  name: string;
  image: ImageSourcePropType;
  isBoss: boolean;
  sizeScale: number;
  hp: number;
  maxHp: number;
};

const BattleEnemyCard = ({
  enemy,
  enemyHpText,
  hitPulse,
  hitStyle,
  onLayout,
}: {
  enemy: BattleEnemyViewModel;
  enemyHpText: string;
  hitPulse: number;
  hitStyle?: BattleAttackStyle;
  onLayout?: (event: LayoutChangeEvent) => void;
}) => {
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (hitPulse <= 0) return;
    const amplitude = getAttackTrailPreset(hitStyle).hitReactionAmplitude;
    translateX.value = withSequence(
      withTiming(-amplitude, { duration: 45, easing: Easing.out(Easing.quad) }),
      withTiming(amplitude * 0.7, { duration: 55, easing: Easing.inOut(Easing.quad) }),
      withTiming(-amplitude * 0.4, { duration: 45, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: 55, easing: Easing.out(Easing.quad) })
    );
  }, [hitPulse, hitStyle, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const imageSize = Math.round(BASE_ENEMY_IMAGE_SIZE * enemy.sizeScale);
  const containerWidth = imageSize + 18;

  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.enemyItem, { width: containerWidth }, animatedStyle]}
    >
      <Image
        source={enemy.image}
        style={{ width: imageSize, height: imageSize }}
        resizeMode="contain"
      />
      <Text style={styles.enemyLabel} numberOfLines={1}>
        {enemy.name}
      </Text>
      <View style={[styles.enemyHpBar, { width: imageSize }]}>
        <View
          style={[
            styles.enemyHpFill,
            { width: `${Math.max(0, Math.min(100, (enemy.hp / Math.max(1, enemy.maxHp)) * 100))}%` },
          ]}
        />
      </View>
      <Text style={styles.enemyHpText}>{enemyHpText}</Text>
    </Animated.View>
  );
};

export default function BattleScreen() {
  const router = useRouter();
  const { locale, t } = useI18n();
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
  const [resolvedDungeonId, setResolvedDungeonId] = useState("crestoria_dungeon_1_200");
  const [resolvedFloor, setResolvedFloor] = useState(1);
  const [resolvedSeed, setResolvedSeed] = useState<number | null>(null);
  const [battleCompleted, setBattleCompleted] = useState(false);
  const [battleResultSummary, setBattleResultSummary] = useState<BattleResultSummary | null>(null);
  const [revealedLogCount, setRevealedLogCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [battleSpeedMultiplier, setBattleSpeedMultiplier] = useState<BattleSpeedMultiplier>(1);
  const [party, setParty] = useState<Unit[]>([]);
  const [enemies, setEnemies] = useState<Unit[]>([]);
  const [turns, setTurns] = useState(0);
  const [partyUiMetaById, setPartyUiMetaById] = useState<Record<string, { level: number }>>({});
  const [replayStates, setReplayStates] = useState<BattleReplayState[]>([]);
  const [visualEvents, setVisualEvents] = useState<BattleVisualEvent[]>([]);
  const [enemyRectsById, setEnemyRectsById] = useState<Record<string, BattleEffectRect>>({});
  const [enemyHitPulseById, setEnemyHitPulseById] = useState<Record<string, number>>({});
  const [enemyLastHitStyleById, setEnemyLastHitStyleById] = useState<Record<string, BattleAttackStyle>>({});
  const [combatOutcomeRevealLogCount, setCombatOutcomeRevealLogCount] = useState<number | null>(null);
  const [finalOutcome, setFinalOutcome] = useState<BattleOutcome | null>(null);
  const logScrollRef = useRef<ScrollView | null>(null);
  const autoReturnTriggeredRef = useRef(false);
  const setSessionId = useBattleStore((s) => s.setSessionId);
  const setLogs = useBattleStore((s) => s.setLogs);
  const setStatus = useBattleStore((s) => s.setStatus);
  const setLatestBattleRewards = useBattleStore((s) => s.setLatestBattleRewards);
  const pendingExplorationPartySync = useBattleStore((s) => s.pendingExplorationPartySync);
  const setPendingExplorationPartySync = useBattleStore((s) => s.setPendingExplorationPartySync);
  const setLatestBattlePartySync = useBattleStore((s) => s.setLatestBattlePartySync);
  const logs = useBattleStore((s) => s.logs);
  const reset = useBattleStore((s) => s.reset);
  const isOutcomeBadgeVisible =
    phase === "RESULT" &&
    finalOutcome !== null &&
    combatOutcomeRevealLogCount !== null &&
    revealedLogCount >= combatOutcomeRevealLogCount;
  const resultLabel =
    isOutcomeBadgeVisible && finalOutcome ? t(BATTLE_RESULT_I18N_KEY[finalOutcome]) : null;
  const logRevealIntervalMs = Math.round(BATTLE_LOG_BASE_REVEAL_INTERVAL_MS / battleSpeedMultiplier);
  const autoReturnDelayMs = Math.max(100, Math.round(RESULT_AUTO_RETURN_BASE_DELAY_MS / battleSpeedMultiplier));
  const handleCycleBattleSpeed = () => {
    const currentIndex = BATTLE_SPEED_OPTIONS.indexOf(battleSpeedMultiplier);
    const nextIndex = (currentIndex + 1) % BATTLE_SPEED_OPTIONS.length;
    const nextSpeed = BATTLE_SPEED_OPTIONS[nextIndex];
    setBattleSpeedMultiplier(nextSpeed);
    void settingsRepository.setBattleSpeedMultiplier(nextSpeed).catch((error) => {
      console.error("Failed to persist battle speed setting:", error);
    });
  };

  const skillMap = useMemo(() => createSkillMap(DEFAULT_SKILLS), []);

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

  useEffect(() => {
    void preloadBattleSounds();
    return () => {
      unloadBattleSounds();
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      reset();
      setPhase("LOADING");
      setError(null);
      const parsedFloor = Math.max(1, Number.parseInt(floor ?? "1", 10) || 1);
      const parsedSeed = explorationSeed ? Number.parseInt(explorationSeed, 10) : Date.now();
      const nextDungeonId = dungeonId ?? "crestoria_dungeon_1_200";
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
        const equippedByCharacterId = await characterEquipmentRepository.getByCharacterIds(
          selected.map((member) => member.id)
        );
        const syncedSelected =
          pendingExplorationPartySync &&
          pendingExplorationPartySync.explorationSeed === (Number.isFinite(parsedSeed) ? parsedSeed : null) &&
          pendingExplorationPartySync.partyId === nextPartyId
            ? selected.map((member) => {
                const synced = pendingExplorationPartySync.members.find((row) => row.id === member.id);
                if (!synced) return member;
                const derived = computeCharacterDerivedStats(member, equippedByCharacterId[member.id] ?? {});
                return {
                  ...member,
                  currentHp: toBaseResource(synced.hp, member.baseMaxHp, derived.bonus.hp),
                  currentMp: toBaseResource(synced.mp, member.baseMaxMp, derived.bonus.mp),
                };
              })
            : selected;
        const nextPartyUiMetaById = syncedSelected.reduce<Record<string, { level: number }>>((acc, member) => {
          acc[member.id] = { level: member.level };
          return acc;
        }, {});
        const units = toPartyUnits(syncedSelected, equippedByCharacterId);
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
        setPendingExplorationPartySync(null);
        setBattleCompleted(false);
        setBattleResultSummary(null);
        setRevealedLogCount(0);
        setIsPaused(false);
        setReplayStates([]);
        setVisualEvents([]);
        setEnemyRectsById({});
        setEnemyHitPulseById({});
        setEnemyLastHitStyleById({});
        setCombatOutcomeRevealLogCount(null);
        setFinalOutcome(null);
        autoReturnTriggeredRef.current = false;
        setPhase("ENCOUNTER");
      } catch (error) {
        console.error("Failed to load battle:", error);
        setError("戦闘の初期化に失敗しました。");
        setStatus("IDLE");
        setPhase("ERROR");
      }
    };
    void load();
  }, [
    dungeonId,
    encounter,
    explorationSeed,
    floor,
    partyId,
    pendingExplorationPartySync,
    reset,
    setLogs,
    setPendingExplorationPartySync,
    setSessionId,
    setStatus,
    skillMap,
  ]);

  const onStartBattle = async () => {
    if (!encounterData || phase !== "ENCOUNTER") return;
    setPhase("SIMULATING");
    setStatus("IN_PROGRESS");
    setVisualEvents([]);
    setEnemyHitPulseById({});
    setEnemyLastHitStyleById({});
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
        goldGained: 0,
        expGained: 0,
        expRecipientCount: 0,
        levelUps: [],
        drops: [],
      };
      const currentPartyId = partyId ?? DEFAULT_PARTY_ID;
      const partyRecords = await charactersRepository.listPartyMembers(currentPartyId);
      const equippedByCharacterId = await characterEquipmentRepository.getByCharacterIds(
        partyRecords.map((record) => record.id)
      );
      const persistedPartyById = new Map<string, CharacterRecord>(
        partyRecords.map((record) => [record.id, record] as const)
      );
      const finalPartyById = new Map(result.finalParty.map((member) => [member.id, member] as const));
      const nextPartyUiMetaById: Record<string, { level: number }> = {
        ...partyUiMetaById,
      };
      const resultStatLabelByKeyForLog: Record<LevelUpStatKey, string> = {
        maxHp: t("battle.result.stat.maxHp"),
        atk: t("battle.result.stat.atk"),
        def: t("battle.result.stat.def"),
        spd: t("battle.result.stat.spd"),
        maxMp: t("battle.result.stat.maxMp"),
        mpRegen: t("battle.result.stat.mpRegen"),
      };
      if (result.outcome === "WIN") {
        const goldGain = encounterData.enemies.reduce(
          (sum, enemy) => sum + getMonsterDropGold(enemy.enemyId),
          0
        );
        nextResultSummary.goldGained = goldGain;
        if (goldGain > 0) {
          await walletRepository.addGold(goldGain);
        }
        const alivePartyIds = new Set(
          result.finalParty.filter((member) => member.hp > 0).map((member) => member.id)
        );
        if (alivePartyIds.size > 0) {
          const expGain = calculateBattleExp({
            floor: resolvedFloor,
            enemyCount: encounterData.enemies.length,
          });
          nextResultSummary.expGained = expGain;
          nextResultSummary.expRecipientCount = alivePartyIds.size;
          for (const record of partyRecords) {
            if (!alivePartyIds.has(record.id)) continue;
            const progression = applyExperienceToCharacter(record, expGain);
            persistedPartyById.set(record.id, progression.character);
            nextPartyUiMetaById[record.id] = { level: progression.newLevel };
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
        }

        const dropResults = rollMonsterDrops({
          dungeonId: resolvedDungeonId,
          floor: resolvedFloor,
          battleSessionId: nextSessionId,
          encounter: encounterData,
          seed: (resolvedSeed ?? Date.now()) >>> 0,
        });
        for (const drop of dropResults) {
          if (!drop.reward) continue;
          const applyResult = await equipmentInventoryRepository.applyGrantIfAbsent({
            grant: {
              grantKey: drop.reward.grantKey,
              sourceType: drop.reward.sourceType,
              baseItemId: drop.reward.baseItemId,
              mutationPrefixId: drop.reward.mutationPrefixId,
              grantedStats: drop.reward.grantedStats,
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
        }
      }

      const resultSummaryLogRecords: typeof result.logs = [];
      const resultLogTurn = Math.max(0, result.turns);
      resultSummaryLogRecords.push({
        battleSessionId: nextSessionId,
        turn: resultLogTurn,
        actorName: "RESULT",
        actionType: "RESULT_GOLD",
        targetName: null,
        damage: 0,
        healing: 0,
        logMessage:
          locale === "ja"
            ? `${t("battle.result.goldTitle")}: ${t("battle.result.goldValue", { gold: nextResultSummary.goldGained })}`
            : `${t("battle.result.goldTitle")}: ${t("battle.result.goldValue", { gold: nextResultSummary.goldGained })}`,
      });
      resultSummaryLogRecords.push({
        battleSessionId: nextSessionId,
        turn: resultLogTurn,
        actorName: "RESULT",
        actionType: "RESULT_EXP",
        targetName: null,
        damage: 0,
        healing: 0,
        logMessage:
          locale === "ja"
            ? `獲得EXP: +${nextResultSummary.expGained} EXP`
            : `EXP Gained: +${nextResultSummary.expGained} EXP`,
      });
      for (const levelUp of nextResultSummary.levelUps) {
        const levelLine = t("battle.result.levelUpName", {
          name: levelUp.name,
          prev: levelUp.previousLevel,
          next: levelUp.newLevel,
        });
        const statLine = levelUp.statUps
          .map((stat) => `${resultStatLabelByKeyForLog[stat.statKey]} +${stat.amount}`)
          .join(" / ");
        resultSummaryLogRecords.push({
          battleSessionId: nextSessionId,
          turn: resultLogTurn,
          actorName: "RESULT",
          actionType: "RESULT_LEVEL_UP",
          targetName: levelUp.name,
          damage: 0,
          healing: 0,
          logMessage: statLine.length > 0 ? `${levelLine} (${statLine})` : levelLine,
        });
      }
      for (const dropName of nextResultSummary.drops) {
        resultSummaryLogRecords.push({
          battleSessionId: nextSessionId,
          turn: resultLogTurn,
          actorName: "RESULT",
          actionType: "RESULT_DROP",
          targetName: null,
          damage: 0,
          healing: 0,
          logMessage: `${t("battle.result.dropTitle")}: ${dropName}`,
        });
      }
      if (resultSummaryLogRecords.length > 0) {
        await battleRepository.appendLogs(resultSummaryLogRecords);
        combinedLogs = [...combinedLogs, ...resultSummaryLogRecords];
        const lastReplayState =
          combinedReplayStates[combinedReplayStates.length - 1] ??
          ({
            turn: result.turns,
            party: result.finalParty,
            enemies: result.finalEnemies,
          } satisfies BattleReplayState);
        combinedReplayStates = [
          ...combinedReplayStates,
          ...resultSummaryLogRecords.map(() => cloneReplayState(lastReplayState)),
        ];
      }

      for (const record of partyRecords) {
        const finalMember = finalPartyById.get(record.id);
        if (!finalMember) continue;
        const baseRecord = persistedPartyById.get(record.id) ?? record;
        const derived = computeCharacterDerivedStats(
          baseRecord,
          equippedByCharacterId[record.id] ?? {}
        );
        const nextRecord = {
          ...baseRecord,
          currentHp: toBaseResource(finalMember.hp, baseRecord.baseMaxHp, derived.bonus.hp),
          currentMp: toBaseResource(finalMember.mp, baseRecord.baseMaxMp, derived.bonus.mp),
        };
        await charactersRepository.upsert(nextRecord);
        persistedPartyById.set(record.id, nextRecord);
        nextPartyUiMetaById[record.id] = { level: nextRecord.level };
      }

      setParty(result.finalParty);
      setEnemies(result.finalEnemies);
      setPartyUiMetaById(nextPartyUiMetaById);
      setSessionId(nextSessionId);
      setStatus(result.outcome);
      setLogs(combinedLogs);
      setBattleResultSummary(nextResultSummary);
      setLatestBattleRewards({
        sessionId: nextSessionId,
        explorationSeed: resolvedSeed,
        gold: nextResultSummary.goldGained,
        drops: nextResultSummary.drops,
      });
      setLatestBattlePartySync({
        battleSessionId: nextSessionId,
        explorationSeed: resolvedSeed,
        partyId: currentPartyId,
        members: result.finalParty.map((member) => {
          const persisted = persistedPartyById.get(member.id);
          if (!persisted) {
            return {
              id: member.id,
              name: member.name,
              classId: member.classId,
              hp: Math.max(0, Math.floor(member.hp)),
              mp: Math.max(0, Math.floor(member.mp)),
              maxHp: Math.max(1, Math.floor(member.stats.maxHp)),
              maxMp: Math.max(0, Math.floor(member.stats.maxMp)),
              level: nextPartyUiMetaById[member.id]?.level ?? null,
            };
          }
          const derived = computeCharacterDerivedStats(persisted, equippedByCharacterId[member.id] ?? {});
          return {
            id: member.id,
            name: member.name,
            classId: member.classId,
            hp: toBattleResource(persisted.currentHp, persisted.baseMaxHp, derived.bonus.hp),
            mp: toBattleResource(persisted.currentMp, persisted.baseMaxMp, derived.bonus.mp),
            maxHp: derived.battle.maxHp,
            maxMp: derived.battle.maxMp,
            level: nextPartyUiMetaById[member.id]?.level ?? null,
          };
        }),
      });
      setReplayStates(combinedReplayStates);
      setVisualEvents(result.visualEvents);
      setCombatOutcomeRevealLogCount(result.outcomeRevealLogCount);
      setFinalOutcome(result.outcome);
      setTurns(result.turns);
      setRevealedLogCount(0);
      setEnemyHitPulseById({});
      setEnemyLastHitStyleById({});
      autoReturnTriggeredRef.current = false;
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
    }, logRevealIntervalMs);
    return () => clearInterval(timer);
  }, [battleCompleted, isPaused, logRevealIntervalMs, logs.length, phase, revealedLogCount]);

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
  const canAutoReturn = phase === "RESULT" && battleCompleted && (logs.length === 0 || revealedLogCount >= logs.length);

  useEffect(() => {
    if (renderedLogCount <= 0) return;
    requestAnimationFrame(() => {
      logScrollRef.current?.scrollToEnd({ animated: false });
    });
  }, [renderedLogCount]);

  useEffect(() => {
    if (!canAutoReturn || phase !== "RESULT") return;
    if (autoReturnTriggeredRef.current) return;
    autoReturnTriggeredRef.current = true;
    const timer = setTimeout(() => {
      router.back();
    }, autoReturnDelayMs);
    return () => clearTimeout(timer);
  }, [autoReturnDelayMs, canAutoReturn, phase, router]);

  const handleEnemyItemLayout = (enemyId: string, event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    const nextRect = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
    setEnemyRectsById((prev) => {
      const prevRect = prev[enemyId];
      if (
        prevRect &&
        prevRect.x === nextRect.x &&
        prevRect.y === nextRect.y &&
        prevRect.width === nextRect.width &&
        prevRect.height === nextRect.height
      ) {
        return prev;
      }
      return { ...prev, [enemyId]: nextRect };
    });
  };

  const handlePlayHitReaction = (params: { targetIds: string[]; attackStyle: BattleAttackStyle }) => {
    const validTargetIds = params.targetIds.filter((id) => enemyRectsById[id]);
    if (validTargetIds.length === 0) return;
    setEnemyLastHitStyleById((prev) => {
      const next = { ...prev };
      for (const id of validTargetIds) {
        next[id] = params.attackStyle;
      }
      return next;
    });
    setEnemyHitPulseById((prev) => {
      const next = { ...prev };
      for (const id of validTargetIds) {
        next[id] = (next[id] ?? 0) + 1;
      }
      return next;
    });
  };

  if (phase === "LOADING") {
    if (encounterData) {
      return renderBattleLayout({
        floor: encounterData.rollMeta.floor,
        enemies: encounterData.enemies.map((enemy, idx) => ({
          id: `${enemy.enemyId}-${idx}`,
          name: enemy.name,
          image: getEnemyImage(enemy.enemyId),
          isBoss: isBossEnemyId(enemy.enemyId),
          sizeScale: getEnemySizeScale(enemy.enemyId),
          hp: enemy.stats.maxHp,
          maxHp: enemy.stats.maxHp,
        })),
        party,
        logs: [],
        turnText: "Turn --",
        isPaused,
        resultSummary: null,
        onPausePress: () => setIsPaused((prev) => !prev),
      });
    }
    return renderBattleSkeleton();
  }

  if (phase === "SIMULATING") {
    if (encounterData) {
      return renderBattleLayout({
        floor: encounterData.rollMeta.floor,
        enemies: encounterData.enemies.map((enemy, idx) => ({
          id: `${enemy.enemyId}-${idx}`,
          name: enemy.name,
          image: getEnemyImage(enemy.enemyId),
          isBoss: isBossEnemyId(enemy.enemyId),
          sizeScale: getEnemySizeScale(enemy.enemyId),
          hp: enemy.stats.maxHp,
          maxHp: enemy.stats.maxHp,
        })),
        party,
        logs: [],
        turnText: "Turn --",
        isPaused,
        resultSummary: null,
        onPausePress: () => setIsPaused((prev) => !prev),
      });
    }
    return renderBattleSkeleton();
  }

  if (phase === "ERROR") {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
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
      enemies: encounterData.enemies.map((enemy, idx) => ({
        id: `${enemy.enemyId}-${idx}`,
        name: enemy.name,
        image: getEnemyImage(enemy.enemyId),
        isBoss: isBossEnemyId(enemy.enemyId),
        sizeScale: getEnemySizeScale(enemy.enemyId),
        hp: enemy.stats.maxHp,
        maxHp: enemy.stats.maxHp,
      })),
      party,
      logs,
      turnText: "Turn --",
      isPaused,
      resultSummary: null,
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
    enemies: displayEnemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      image: getEnemyImage(enemy.id),
      isBoss: isBossEnemyId(enemy.id),
      sizeScale: getEnemySizeScale(enemy.id),
      hp: enemy.hp,
      maxHp: enemy.stats.maxHp,
    })),
    party: displayParty,
    logs: visibleLogs,
    turnText: displayTurn > 0 ? `Turn ${displayTurn}` : "Turn --",
    isPaused,
    resultSummary: battleResultSummary,
    onPausePress: () => setIsPaused((prev) => !prev),
  });

  function renderBattleLayout(params: {
    floor: number;
    enemies: BattleEnemyViewModel[];
    party: Unit[];
    logs: typeof logs;
    turnText: string;
    isPaused: boolean;
    resultSummary: BattleResultSummary | null;
    onPausePress: () => void;
  }) {
    const logRows = params.logs;
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <Stack.Screen options={BATTLE_SCREEN_OPTIONS} />
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{`B${params.floor}`}</Text>
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
            <View style={styles.headerRightControls}>
              <View style={styles.speedControl}>
                <Text style={styles.speedLabel}>{t("battle.ui.speedLabel")}</Text>
                <Pressable
                  onPress={handleCycleBattleSpeed}
                  style={[styles.speedButton, styles.speedButtonActive]}
                  hitSlop={6}
                >
                  <Text style={[styles.speedButtonText, styles.speedButtonTextActive]}>
                    {`${battleSpeedMultiplier}x`}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={params.onPausePress}
                style={[styles.autoBadge, params.isPaused && styles.autoBadgePaused]}
                hitSlop={8}
              >
                {params.isPaused ? <Play size={10} color="#555555" /> : <Pause size={10} color="#555555" />}
                <Text style={styles.autoBadgeText}>AUTO</Text>
              </Pressable>
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
                <Text style={styles.logTitle}>{t("battle.ui.logTitle")}</Text>
                <Text style={styles.turnText}>{params.turnText}</Text>
              </View>
              <ScrollView
                ref={logScrollRef}
                style={styles.logScroll}
                contentContainerStyle={styles.logContent}
                showsVerticalScrollIndicator={false}
              >
                {logRows.length === 0 ? (
                  <View style={styles.logLineRow}>
                    <Text style={styles.logLinePrefix}>·</Text>
                    <Text style={styles.logLine}>{t("battle.ui.logWaiting")}</Text>
                  </View>
                ) : (
                  logRows.map((log, idx) => {
                    const actorImage = resolveBattleLogActorImage(log, params.party, params.enemies);
                    return (
                      <View key={`${log.turn}-${idx}`} style={styles.logLineRow}>
                        <View style={styles.logIconWrap}>
                          {actorImage ? (
                            <Image source={actorImage} style={styles.logIcon} resizeMode="cover" />
                          ) : (
                            <View style={styles.logIconPlaceholder} />
                          )}
                        </View>
                        <Text style={styles.logLine}>{formatBattleLogMessage(log, t)}</Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>

          <View style={styles.sectionDividerCompact}>
            <View style={styles.sectionDividerCompactLine} />
            <View style={styles.sectionDividerCompactDiamond} />
            <View style={styles.sectionDividerCompactLine} />
          </View>

          <ImageBackground source={BATTLE_BG} style={styles.enemyArea} imageStyle={styles.enemyAreaImage}>
            <View style={styles.enemyAreaOverlay}>
              <View style={styles.enemyRow}>
                {params.enemies.slice(0, 3).map((enemy) => (
                  <BattleEnemyCard
                    key={enemy.id}
                    enemy={enemy}
                    enemyHpText={t("battle.ui.enemyHp", { hp: enemy.hp, maxHp: enemy.maxHp })}
                    hitPulse={enemyHitPulseById[enemy.id] ?? 0}
                    hitStyle={enemyLastHitStyleById[enemy.id]}
                    onLayout={(event) => handleEnemyItemLayout(enemy.id, event)}
                  />
                ))}
                <BattleEffectLayer
                  enemyRects={enemyRectsById}
                  visualEvents={visualEvents}
                  revealedLogCount={revealedLogCount}
                  onPlayHitReaction={handlePlayHitReaction}
                />
              </View>
            </View>
          </ImageBackground>

          <DungeonPartyPanel
            members={params.party.map((member) => ({
              id: member.id,
              name: member.name,
              classId: member.classId,
              hp: member.hp,
              mp: member.mp,
              maxHp: member.stats.maxHp,
              maxMp: member.stats.maxMp,
              level: partyUiMetaById[member.id]?.level,
            }))}
          />
        </View>
      </SafeAreaView>
    );
  }

  function renderBattleSkeleton() {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <Stack.Screen options={BATTLE_SCREEN_OPTIONS} />
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={[styles.skeletonBlock, styles.skeletonFloorBadge]} />
            <View style={[styles.skeletonBlock, styles.skeletonHeaderTitle]} />
            <View style={[styles.skeletonBlock, styles.skeletonAutoBadge]} />
          </View>

          <View style={styles.sectionDivider}>
            <View style={styles.sectionDividerLine} />
            <View style={styles.sectionDividerDiamond} />
            <View style={styles.sectionDividerLine} />
          </View>

          <View style={styles.logSection}>
            <View style={styles.logBox}>
              <View style={styles.logHeader}>
                <View style={[styles.skeletonBlock, styles.skeletonLogLabel]} />
                <View style={[styles.skeletonBlock, styles.skeletonTurnLabel]} />
              </View>
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

          <View style={styles.sectionDividerCompact}>
            <View style={styles.sectionDividerCompactLine} />
            <View style={styles.sectionDividerCompactDiamond} />
            <View style={styles.sectionDividerCompactLine} />
          </View>

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
  screen: { flex: 1, backgroundColor: parchment.background },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: parchment.background,
  },
  loadingText: { color: parchment.inkSoft, fontSize: 14 },
  errorText: { color: parchment.danger, textAlign: "center", paddingHorizontal: 24 },
  container: { flex: 1, backgroundColor: parchment.background, position: "relative" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: parchment.headerBar,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  floorBadge: {
    borderRadius: 8,
    backgroundColor: "#111111",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  floorBadgeText: { color: "#efefef", fontWeight: "700", fontSize: 11 },
  headerTitle: { flex: 1, color: "#2c2114", fontSize: 20, fontWeight: "700" },
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
  headerRightControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  speedControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(122,107,85,0.18)",
    backgroundColor: "rgba(244,236,221,0.86)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  speedLabel: {
    color: parchment.inkMuted,
    fontWeight: "700",
    fontSize: 9,
  },
  speedButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  speedButton: {
    borderRadius: 10,
    backgroundColor: "rgba(43,29,16,0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  speedButtonActive: {
    backgroundColor: "#111111",
  },
  speedButtonText: {
    color: "#555555",
    fontWeight: "600",
    fontSize: 9,
  },
  speedButtonTextActive: {
    color: "#f5f5f5",
  },
  autoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(122,107,85,0.18)",
    backgroundColor: "rgba(244,236,221,0.86)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  autoBadgePaused: {
    backgroundColor: "rgba(239,227,207,0.96)",
  },
  autoBadgeText: { color: parchment.inkSoft, fontWeight: "700", fontSize: 10, letterSpacing: 0.4 },
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
  resultSummaryCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3e8b3",
    backgroundColor: "#fff9db",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resultSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultSummaryLabel: {
    color: "#7c5b00",
    fontSize: 12,
    fontWeight: "700",
  },
  resultSummaryValue: {
    color: "#5b4300",
    fontSize: 16,
    fontWeight: "800",
  },
  logSection: {
    flex: 1,
    minHeight: 180,
    paddingTop: 0,
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
  turnText: {
    color: parchment.inkMuted,
    fontSize: 11,
    fontWeight: "700",
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
  logScroll: { flex: 1 },
  logContent: {
    paddingBottom: 16,
  },
  logLineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  logIconWrap: {
    width: 20,
    height: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logIcon: {
    width: 18,
    height: 18,
  },
  logIconPlaceholder: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#8b5327",
  },
  logLine: {
    color: parchment.inkSoft,
    fontSize: 11,
    lineHeight: 17,
    flex: 1,
  },
  logLineMuted: {
    color: parchment.inkSoft,
    fontSize: 12,
  },
  enemyArea: {
    height: 220,
    width: "100%",
    marginBottom: 8,
  },
  enemyAreaImage: {
    resizeMode: "cover",
  },
  enemyAreaOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(26, 14, 5, 0.06)",
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  enemyRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 28,
    position: "relative",
    overflow: "visible",
  },
  enemyItem: {
    alignItems: "center",
  },
  enemyLabel: {
    marginTop: 2,
    color: "#efefef",
    textShadowColor: "#000000",
    textShadowRadius: 3,
    fontSize: 10,
    fontWeight: "500",
  },
  enemyHpBar: {
    marginTop: 3,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
  },
  enemyHpFill: {
    height: "100%",
    backgroundColor: "#22c55e",
  },
  enemyHpText: {
    marginTop: 3,
    color: "#f5f5f5",
    textShadowColor: "#000000",
    textShadowRadius: 3,
    fontSize: 10,
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
    marginTop: 18,
    backgroundColor: "rgba(244,236,221,0.28)",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  skeletonPartyColumn: {
    width: "31%",
    minWidth: 0,
    alignItems: "flex-start",
    gap: 4,
    paddingBottom: 8,
  },
  skeletonPartyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
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
    width: "100%",
    height: 11,
  },
});
