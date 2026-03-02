import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Compass, Crown, MapPin, Repeat, Shield, Square, Swords } from "lucide-react-native";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { getClassById } from "@/constants/classes";
import { DUNGEONS } from "@/constants/dungeons";
import { dungeonExplorationProgressRepository } from "@/db/repositories/dungeonExplorationProgressRepository";
import { dungeonPartyUiRepository } from "@/db/repositories/dungeonPartyUiRepository";
import { partiesRepository } from "@/db/repositories/partiesRepository";
import { buildDungeonPartyCardState, DungeonPartyCardAction } from "@/features/dungeon/partyCardState";
import { useI18n } from "@/i18n";
import { DungeonFloorExplorationProgressRecord, DungeonPartyUiStateRecord, PartyWithMembers } from "@/types/models";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgSubtle: "#fafafa",
  bgElevated: "#e5e5e5",
  bgDark: "#1a1a1a",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  textMuted: "#aaaaaa",
  textDisabled: "#cccccc",
  borderDefault: "#e0e0e0",
  borderStrong: "#d0d0d0",
  overlay: "rgba(0,0,0,0.28)",
} as const;

const DEFAULT_DUNGEON_ID = DUNGEONS[0]?.id ?? "crestoria_dungeon_1_200";
const DEFAULT_EXPLORATION_STEP_COUNT = 40;
const EXPLORATION_STEP_COUNT_OPTIONS = [20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

const clampFloor = (floor: number, maxFloor: number) => Math.max(1, Math.min(Math.max(1, maxFloor), floor));
const sanitizeSelectedFloor = (params: {
  floor: number | null;
  maxUnlockedFloor: number;
  maxFloor: number;
}): number | null => {
  if (params.floor === null) return null;
  const normalized = clampFloor(params.floor, params.maxFloor);
  return normalized <= params.maxUnlockedFloor ? normalized : null;
};

const formatElapsedShort = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

const buildFloorCandidates = (params: {
  maxFloor: number;
  maxUnlockedFloor: number;
  selectedFloor: number | null;
}): number[] => {
  const maxFloor = Math.max(1, params.maxFloor);
  const anchorBase = params.selectedFloor ?? params.maxUnlockedFloor;
  const anchor = clampFloor(anchorBase || 1, maxFloor);
  const frontier = clampFloor(params.maxUnlockedFloor, maxFloor);
  const values = new Set<number>([1, frontier, anchor]);
  for (let delta = -5; delta <= 5; delta += 1) {
    values.add(clampFloor(anchor + delta, maxFloor));
  }
  return Array.from(values)
    .filter((value) => value <= params.maxUnlockedFloor)
    .sort((a, b) => a - b);
};

const computeMaxUnlockedFloor = (params: {
  maxFloor: number;
  floorProgressList: DungeonFloorExplorationProgressRecord[];
}): number => {
  const maxFloor = Math.max(1, params.maxFloor);
  const progressMap = new Map(params.floorProgressList.map((row) => [row.floor, row] as const));
  let unlockedFloor = 1;
  for (let floor = 1; floor < maxFloor; floor += 1) {
    if (progressMap.get(floor)?.stairsDiscovered) {
      unlockedFloor = floor + 1;
      continue;
    }
    break;
  }
  return clampFloor(unlockedFloor, maxFloor);
};
const normalizeStepCount = (value: number | null | undefined): number => {
  const parsed = Math.max(1, Math.floor(value ?? DEFAULT_EXPLORATION_STEP_COUNT));
  return EXPLORATION_STEP_COUNT_OPTIONS.includes(parsed as (typeof EXPLORATION_STEP_COUNT_OPTIONS)[number])
    ? parsed
    : DEFAULT_EXPLORATION_STEP_COUNT;
};

const defaultUiState = (partyId: string, dungeonId: string): DungeonPartyUiStateRecord => ({
  partyId,
  dungeonId,
  selectedFloor: null,
  stepCount: DEFAULT_EXPLORATION_STEP_COUNT,
  mode: "IDLE",
  autoRunCount: 0,
  autoLootCount: 0,
  autoElapsedSeconds: 0,
  updatedAt: "",
});

export default function DungeonScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [parties, setParties] = useState<PartyWithMembers[]>([]);
  const [floorProgressList, setFloorProgressList] = useState<DungeonFloorExplorationProgressRecord[]>([]);
  const [uiStateMap, setUiStateMap] = useState<Record<string, DungeonPartyUiStateRecord>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerPartyId, setPickerPartyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const [partyRows, floorProgressRows] = await Promise.all([
            partiesRepository.listWithMembers(),
            dungeonExplorationProgressRepository.listByDungeon(DEFAULT_DUNGEON_ID),
          ]);

          await dungeonPartyUiRepository.ensureDefaultsForParties({
            dungeonId: DEFAULT_DUNGEON_ID,
            partyIds: partyRows.map((row) => row.party.id),
          });
          const uiRows = await dungeonPartyUiRepository.listByDungeon(DEFAULT_DUNGEON_ID);
          if (!active) return;
          setParties(partyRows);
          setFloorProgressList(floorProgressRows);
          setUiStateMap(
            uiRows.reduce<Record<string, DungeonPartyUiStateRecord>>((acc, row) => {
              acc[row.partyId] = row;
              return acc;
            }, {})
          );
        } catch (loadError) {
          console.error("Failed to load dungeon screen:", loadError);
          if (!active) return;
          setError("ダンジョン画面の読み込みに失敗しました。");
        } finally {
          if (active) {
            setIsLoading(false);
          }
        }
      };
      void load();
      return () => {
        active = false;
      };
    }, [])
  );

  const selectedDungeon = DUNGEONS.find((d) => d.id === DEFAULT_DUNGEON_ID) ?? DUNGEONS[0];
  const maxFloor = selectedDungeon?.floors ?? 1;
  const maxUnlockedFloor = useMemo(
    () => computeMaxUnlockedFloor({ maxFloor, floorProgressList }),
    [floorProgressList, maxFloor]
  );
  const floorProgressMap = useMemo(
    () => new Map(floorProgressList.map((row) => [row.floor, row] as const)),
    [floorProgressList]
  );
  const partyById = useMemo(
    () => new Map(parties.map((entry) => [entry.party.id, entry] as const)),
    [parties]
  );
  const pickerParty = pickerPartyId ? partyById.get(pickerPartyId) ?? null : null;
  const pickerUiState = pickerPartyId ? uiStateMap[pickerPartyId] ?? defaultUiState(pickerPartyId, DEFAULT_DUNGEON_ID) : null;
  const pickerStepCount = normalizeStepCount(pickerUiState?.stepCount);
  const pickerSelectedFloor = useMemo(
    () =>
      sanitizeSelectedFloor({
        floor: pickerUiState?.selectedFloor ?? null,
        maxUnlockedFloor,
        maxFloor,
      }),
    [maxFloor, maxUnlockedFloor, pickerUiState?.selectedFloor]
  );
  const floorCandidates = useMemo(
    () =>
      buildFloorCandidates({
        maxFloor,
        maxUnlockedFloor,
        selectedFloor: pickerSelectedFloor,
      }),
    [maxFloor, maxUnlockedFloor, pickerSelectedFloor]
  );

  const upsertUiState = useCallback(
    async (next: Omit<DungeonPartyUiStateRecord, "updatedAt">) => {
      await dungeonPartyUiRepository.upsert(next);
      setUiStateMap((prev) => ({
        ...prev,
        [next.partyId]: {
          ...next,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    []
  );

  const openFloorPicker = useCallback((partyId: string) => {
    setPickerPartyId(partyId);
  }, []);

  const closeFloorPicker = useCallback(() => {
    setPickerPartyId(null);
  }, []);

  const handleSelectFloor = useCallback(
    async (partyId: string, floor: number) => {
      const current = uiStateMap[partyId] ?? defaultUiState(partyId, DEFAULT_DUNGEON_ID);
      const clampedFloor = clampFloor(floor, maxFloor);
      if (clampedFloor > maxUnlockedFloor) {
        return;
      }
      await upsertUiState({
        partyId,
        dungeonId: DEFAULT_DUNGEON_ID,
        selectedFloor: clampedFloor,
        stepCount: normalizeStepCount(current.stepCount),
        mode: "IDLE",
        autoRunCount: current.autoRunCount,
        autoLootCount: current.autoLootCount,
        autoElapsedSeconds: current.autoElapsedSeconds,
      });
      setPickerPartyId(null);
    },
    [maxFloor, maxUnlockedFloor, uiStateMap, upsertUiState]
  );

  const handleSelectStepCount = useCallback(
    async (partyId: string, stepCount: number) => {
      const current = uiStateMap[partyId] ?? defaultUiState(partyId, DEFAULT_DUNGEON_ID);
      await upsertUiState({
        ...current,
        partyId,
        dungeonId: DEFAULT_DUNGEON_ID,
        stepCount: normalizeStepCount(stepCount),
      });
    },
    [uiStateMap, upsertUiState]
  );

  const handlePartyAction = useCallback(
    async (partyId: string, action: DungeonPartyCardAction) => {
      const current = uiStateMap[partyId] ?? defaultUiState(partyId, DEFAULT_DUNGEON_ID);
      const selectedFloor = sanitizeSelectedFloor({
        floor: current.selectedFloor,
        maxUnlockedFloor,
        maxFloor,
      });

      if (action === "selectFloor") {
        openFloorPicker(partyId);
        return;
      }
      if (!selectedFloor) {
        openFloorPicker(partyId);
        return;
      }

      if (action === "autoStart") {
        await upsertUiState({
          ...current,
          partyId,
          dungeonId: DEFAULT_DUNGEON_ID,
          mode: "AUTO",
          selectedFloor,
          stepCount: normalizeStepCount(current.stepCount),
        });
        return;
      }

      if (action === "autoStop") {
        await upsertUiState({
          ...current,
          partyId,
          dungeonId: DEFAULT_DUNGEON_ID,
          mode: "IDLE",
          selectedFloor,
          stepCount: normalizeStepCount(current.stepCount),
        });
        return;
      }

      if (action === "explore" || action === "resumeExplore") {
        await upsertUiState({
          ...current,
          partyId,
          dungeonId: DEFAULT_DUNGEON_ID,
          mode: "EXPLORE",
          selectedFloor,
          stepCount: normalizeStepCount(current.stepCount),
        });
        router.push({
          pathname: "/dungeon/exploration",
          params: {
            dungeonId: DEFAULT_DUNGEON_ID,
            floor: String(selectedFloor),
            partyId,
            steps: String(normalizeStepCount(current.stepCount)),
          },
        });
      }
    },
    [maxFloor, maxUnlockedFloor, openFloorPicker, router, uiStateMap, upsertUiState]
  );

  const renderActionButton = useCallback(
    (params: {
      action: DungeonPartyCardAction;
      fullWidth?: boolean;
      disabled?: boolean;
      onPress: () => void;
      variant?: "primary" | "outline";
    }) => {
      const { action, fullWidth, disabled, onPress, variant = "outline" } = params;
      const labelText =
        action === "selectFloor"
          ? t("dungeon.ui.action.selectFloor")
          : action === "resumeExplore"
            ? t("dungeon.ui.action.resumeExplore")
            : action === "explore"
              ? t("dungeon.ui.action.explore")
              : action === "autoStart"
                ? t("dungeon.ui.action.autoStart")
                : t("dungeon.ui.action.autoStop");
      const icon =
        action === "selectFloor" ? (
          <MapPin size={14} stroke={variant === "primary" ? "#ffffff" : colors.textSecondary} />
        ) : action === "autoStart" ? (
          <Repeat size={14} stroke={variant === "primary" ? "#ffffff" : colors.textSecondary} />
        ) : action === "autoStop" ? (
          <Square size={14} stroke={variant === "primary" ? "#ffffff" : colors.textSecondary} />
        ) : (
          <Compass size={14} stroke={variant === "primary" ? "#ffffff" : colors.textSecondary} />
        );
      return (
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={[
            styles.actionButton,
            variant === "primary" ? styles.actionButtonPrimary : styles.actionButtonOutline,
            fullWidth ? styles.actionButtonFill : null,
            disabled ? styles.actionButtonDisabled : null,
          ]}
        >
          {icon}
          <Text
            style={[
              styles.actionButtonText,
              variant === "primary" ? styles.actionButtonTextPrimary : styles.actionButtonTextOutline,
              disabled ? styles.actionButtonTextDisabled : null,
            ]}
            numberOfLines={1}
          >
            {labelText}
          </Text>
        </Pressable>
      );
    },
    [t]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>{t("dungeon.ui.headerSub")}</Text>
          <Text style={styles.headerTitle}>{t("dungeon.ui.headerTitle")}</Text>
        </View>
      </View>

      <FlashList
        data={isLoading || error || parties.length === 0 ? [] : parties}
        keyExtractor={(item) => item.party.id}
        estimatedItemSize={180}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.sharedDungeonCard}>
              <View style={styles.sharedDungeonTop}>
                <Text style={styles.sharedDungeonTitle}>{t("dungeon.ui.shared.title")}</Text>
                <Text style={styles.sharedDungeonMeta}>{`B1-B${maxUnlockedFloor}F`}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.stateWrap}>
              <Text style={styles.stateText}>{t("dungeon.ui.loading")}</Text>
            </View>
          ) : error ? (
            <View style={styles.stateWrap}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.stateWrap}>
              <Text style={styles.stateText}>{t("dungeon.ui.emptyParties")}</Text>
            </View>
          )
        }
        renderItem={({ item: entry, index }) => {
          const uiState = uiStateMap[entry.party.id] ?? defaultUiState(entry.party.id, DEFAULT_DUNGEON_ID);
          const stepCount = normalizeStepCount(uiState.stepCount);
          const safeSelectedFloor = sanitizeSelectedFloor({
            floor: uiState.selectedFloor,
            maxUnlockedFloor,
            maxFloor,
          });
          const cardState = buildDungeonPartyCardState({
            selectedFloor: safeSelectedFloor,
            mode: uiState.mode,
            maxUnlockedFloor,
          });
          const memberCount = entry.members.length;
          const isIdleCard = cardState.displayStatus === "idle";
          const hasMembers = memberCount > 0;
          const memberBySlot = new Map(entry.members.map((member) => [member.slotIndex, member] as const));
          const memberSlots = Array.from({ length: 6 }).map((_, slotIndex) => memberBySlot.get(slotIndex) ?? null);
          const primaryActionEnabled =
            (cardState.primaryAction === "selectFloor" || cardState.isExploreEnabled || cardState.primaryAction === "autoStop") &&
            (hasMembers || cardState.primaryAction === "selectFloor");
          const secondaryActionEnabled = !!cardState.secondaryAction && cardState.isAutoEnabled && hasMembers;

          return (
            <View
              style={[styles.partyCard, isIdleCard ? styles.partyCardIdle : styles.partyCardActiveLike]}
            >
              <View style={styles.partyCardTop}>
                <View style={styles.partyTopRow}>
                  <Text style={styles.partyName} numberOfLines={1}>{entry.party.name}</Text>
                  <View style={styles.partyBadgeRow}>
                    <Pressable
                      style={styles.badgeWrap}
                      onPress={() =>
                        router.push({
                          pathname: "/dungeon/party",
                          params: { partyId: entry.party.id },
                        })
                      }
                    >
                      <Text style={styles.badgeText}>{t("dungeon.ui.action.editParty")}</Text>
                    </Pressable>
                    {cardState.showAutoBadge ? (
                      <View style={styles.badgeWrap}>
                        <Repeat size={12} stroke={colors.textSecondary} />
                        <Text style={styles.badgeText}>{t("dungeon.ui.auto.badge")}</Text>
                      </View>
                    ) : cardState.displayStatus === "idle" ? (
                      <View style={[styles.badgeWrap, styles.badgeIdle]}>
                        <Text style={[styles.badgeText, styles.badgeIdleText]}>{t("dungeon.ui.status.idle")}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.membersRow}>
                  {memberSlots.map((member, slotIndex) => {
                    const empty = member === null;
                    return (
                      <View key={`party-member-${entry.party.id}-${slotIndex}`} style={styles.memberItem}>
                        <View style={[styles.memberAvatar, empty ? styles.memberAvatarEmpty : null]}>
                          {empty ? (
                            <Shield size={12} stroke={colors.borderDefault} />
                          ) : (
                            <Image source={getClassById(member.classId).image} style={styles.memberAvatarImage} resizeMode="contain" />
                          )}
                        </View>
                        <Text style={empty ? styles.memberLevelEmpty : styles.memberLevel}>
                          {empty ? "" : `Lv${member.level}`}
                        </Text>
                        <Text style={empty ? styles.memberNameEmpty : styles.memberName} numberOfLines={1}>
                          {empty ? t("guild.party.empty") : member.name}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.partyCardBottom}>
                {cardState.floor && cardState.floorLabelType ? (
                  <View style={styles.floorRow}>
                    <MapPin size={14} stroke={colors.textTertiary} />
                    <Text style={styles.floorRowText} numberOfLines={1}>
                      {cardState.floorLabelType === "deepest"
                        ? t("dungeon.ui.floor.deepest", { floor: cardState.floor })
                        : cardState.floorLabelType === "target"
                          ? t("dungeon.ui.floor.target", { floor: cardState.floor })
                          : t("dungeon.ui.floor.auto", { floor: cardState.floor })}
                    </Text>
                    {cardState.showFloorChangeChip ? (
                      <Pressable style={styles.floorChip} onPress={() => openFloorPicker(entry.party.id)}>
                        <Text style={styles.floorChipText}>{t("dungeon.ui.action.changeFloor")}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable style={styles.floorChip} onPress={() => openFloorPicker(entry.party.id)}>
                      <Text style={styles.floorChipText}>{t("dungeon.ui.step.short", { steps: stepCount })}</Text>
                    </Pressable>
                  </View>
                ) : null}

                {cardState.showAutoStats ? (
                  <View style={styles.autoStatsRow}>
                    <View style={styles.autoStatItem}>
                      <Text style={styles.autoStatLabel}>{t("dungeon.ui.auto.statRuns")}</Text>
                      <Text style={styles.autoStatValue}>{uiState.autoRunCount}</Text>
                    </View>
                    <View style={styles.autoStatItem}>
                      <Text style={styles.autoStatLabel}>{t("dungeon.ui.auto.statLoot")}</Text>
                      <Text style={styles.autoStatValue}>{uiState.autoLootCount}</Text>
                    </View>
                    <View style={styles.autoStatItem}>
                      <Text style={styles.autoStatLabel}>{t("dungeon.ui.auto.statElapsed")}</Text>
                      <Text style={styles.autoStatValue}>{formatElapsedShort(uiState.autoElapsedSeconds)}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  {renderActionButton({
                    action: cardState.primaryAction,
                    onPress: () => void handlePartyAction(entry.party.id, cardState.primaryAction),
                    variant:
                      cardState.primaryAction === "resumeExplore" || cardState.primaryAction === "explore"
                        ? "primary"
                        : "outline",
                    fullWidth: cardState.secondaryAction === null,
                    disabled: !primaryActionEnabled,
                  })}
                  {cardState.secondaryAction
                    ? renderActionButton({
                        action: cardState.secondaryAction,
                        onPress: () => void handlePartyAction(entry.party.id, cardState.secondaryAction!),
                        fullWidth: true,
                        disabled: !secondaryActionEnabled,
                        variant: "outline",
                      })
                    : null}
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal transparent visible={pickerPartyId !== null} animationType="fade" onRequestClose={closeFloorPicker}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("dungeon.ui.floorPicker.title")}</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>
              {pickerParty ? pickerParty.party.name : ""}
            </Text>

            <View style={styles.quickRow}>
              <Pressable
                style={styles.quickButton}
                onPress={() =>
                  pickerPartyId && void handleSelectFloor(pickerPartyId, 1)
                }
              >
                <Text style={styles.quickButtonText}>{t("dungeon.ui.floorPicker.quickB1")}</Text>
              </Pressable>
              <Pressable
                style={styles.quickButton}
                onPress={() =>
                  pickerPartyId &&
                  void handleSelectFloor(pickerPartyId, maxUnlockedFloor)
                }
              >
                <Text style={styles.quickButtonText}>{t("dungeon.ui.floorPicker.quickFrontier")}</Text>
              </Pressable>
            </View>

            <View style={styles.stepPickerSection}>
              <Text style={styles.stepPickerTitle}>{t("dungeon.ui.stepPicker.title")}</Text>
              <View style={styles.stepPickerOptions}>
                {EXPLORATION_STEP_COUNT_OPTIONS.map((stepCount) => {
                  const active = stepCount === pickerStepCount;
                  return (
                    <Pressable
                      key={`picker-step-${stepCount}`}
                      style={[styles.stepPickerOption, active ? styles.stepPickerOptionActive : null]}
                      onPress={() => pickerPartyId && void handleSelectStepCount(pickerPartyId, stepCount)}
                    >
                      <Text style={[styles.stepPickerOptionText, active ? styles.stepPickerOptionTextActive : null]}>
                        {t("dungeon.ui.step.short", { steps: stepCount })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <ScrollView style={styles.floorList} contentContainerStyle={styles.floorListContent}>
              {floorCandidates.map((floor) => {
                const active = floor === pickerSelectedFloor;
                const row = floorProgressMap.get(floor);
                const isCleared = (row?.explorationPercent ?? 0) >= 100;
                const isFrontier = floor === maxUnlockedFloor;
                return (
                  <Pressable
                    key={`picker-floor-${floor}`}
                    style={[styles.floorListItem, active ? styles.floorListItemActive : null]}
                    onPress={() => pickerPartyId && void handleSelectFloor(pickerPartyId, floor)}
                  >
                    <Text style={[styles.floorListItemTitle, active ? styles.floorListItemTitleActive : null]}>
                      {`B${floor}`}
                    </Text>
                    <Text style={[styles.floorListItemSub, active ? styles.floorListItemSubActive : null]}>
                      {isFrontier
                        ? t("dungeon.ui.floorPicker.status.frontier")
                        : isCleared
                          ? t("dungeon.ui.floorPicker.status.cleared")
                          : t("dungeon.ui.floorPicker.status.uncleared")}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.modalCancelButton} onPress={closeFloorPicker}>
              <Text style={styles.modalCancelButtonText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingTop: 16, paddingRight: 20, paddingBottom: 12, paddingLeft: 20 },
  headerSub: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  headerTitle: { color: colors.textPrimary, fontSize: 30, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  listHeader: { marginBottom: 12 },
  listSeparator: { height: 12 },
  sharedDungeonCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  sharedDungeonTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sharedDungeonTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  sharedDungeonMeta: { color: colors.textSecondary, fontSize: 11, fontWeight: "500" },
  stateWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  stateText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: "#b91c1c", fontSize: 13 },
  partyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    overflow: "hidden",
  },
  partyCardActiveLike: { backgroundColor: colors.bgSurface },
  partyCardIdle: { backgroundColor: colors.bgPrimary },
  partyCardTop: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  partyTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  partyBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  partyName: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  membersRow: { flexDirection: "row", gap: 4 },
  memberItem: { flex: 1, minWidth: 0, alignItems: "center", gap: 2, paddingVertical: 2 },
  memberAvatar: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  memberAvatarImage: { width: "122%", height: "122%" },
  memberAvatarEmpty: { backgroundColor: colors.bgPrimary, borderWidth: 1, borderColor: colors.borderStrong },
  memberLevel: { color: colors.textTertiary, fontSize: 8, fontWeight: "500" },
  memberLevelEmpty: { color: colors.textDisabled, fontSize: 8, fontWeight: "500", minHeight: 10 },
  memberName: { color: colors.textPrimary, fontSize: 9, fontWeight: "600" },
  memberNameEmpty: { color: colors.textDisabled, fontSize: 9, fontWeight: "500" },
  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { color: colors.textSecondary, fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  badgeIdle: { backgroundColor: colors.bgSurface },
  badgeIdleText: { letterSpacing: 0 },
  cardDivider: { height: 1, backgroundColor: colors.borderDefault },
  partyCardBottom: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 10 },
  floorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  floorRowText: { flex: 1, color: "#555555", fontSize: 12, fontWeight: "500" },
  floorChip: {
    borderRadius: 6,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  floorChipText: { color: colors.textSecondary, fontSize: 10, fontWeight: "500" },
  autoStatsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  autoStatItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  autoStatLabel: { color: colors.textTertiary, fontSize: 10, fontWeight: "500" },
  autoStatValue: { color: colors.textPrimary, fontSize: 10, fontWeight: "700" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionButton: {
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionButtonPrimary: { backgroundColor: colors.bgDark },
  actionButtonOutline: {
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  actionButtonFill: { flex: 1 },
  actionButtonDisabled: { opacity: 0.45 },
  actionButtonText: { fontSize: 13, fontWeight: "600" },
  actionButtonTextPrimary: { color: "#ffffff" },
  actionButtonTextOutline: { color: "#444444" },
  actionButtonTextDisabled: { color: colors.textMuted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 16,
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: 16,
    gap: 12,
    maxHeight: "72%",
  },
  modalTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  modalSubtitle: { color: colors.textSecondary, fontSize: 12 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickButtonText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
  stepPickerSection: { gap: 8, marginTop: 6, marginBottom: 10 },
  stepPickerTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  stepPickerOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepPickerOption: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepPickerOptionActive: {
    backgroundColor: colors.bgDark,
    borderColor: colors.bgDark,
  },
  stepPickerOptionText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  stepPickerOptionTextActive: { color: "#ffffff" },
  floorList: { maxHeight: 240 },
  floorListContent: { gap: 8 },
  floorListItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  floorListItemActive: {
    backgroundColor: colors.bgDark,
    borderColor: colors.bgDark,
  },
  floorListItemTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  floorListItemTitleActive: { color: "#ffffff" },
  floorListItemSub: { color: colors.textTertiary, fontSize: 10 },
  floorListItemSubActive: { color: "#cfcfcf" },
  modalCancelButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
});
