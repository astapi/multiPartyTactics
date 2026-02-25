import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Compass, Crown, MapPin, Repeat, Shield, Square, Swords } from "lucide-react-native";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DUNGEONS } from "@/constants/dungeons";
import { dungeonRepository } from "@/db/repositories/dungeonRepository";
import { dungeonPartyUiRepository } from "@/db/repositories/dungeonPartyUiRepository";
import { partiesRepository } from "@/db/repositories/partiesRepository";
import { buildDungeonPartyCardState, DungeonPartyCardAction } from "@/features/dungeon/partyCardState";
import { useI18n } from "@/i18n";
import { DungeonPartyUiStateRecord, DungeonProgressRecord, PartyWithMembers } from "@/types/models";

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
  borderDefault: "#e0e0e0",
  overlay: "rgba(0,0,0,0.28)",
} as const;

const DUNGEON_NAME_I18N_KEY = {
  hakusla_dungeon_1_200: "dungeon.name.hakusla_dungeon_1_200",
  crestoria_dungeon_1_4: "dungeon.name.crestoria_dungeon_1_4",
  crestoria_dungeon_5_9: "dungeon.name.crestoria_dungeon_5_9",
} as const;

const DEFAULT_DUNGEON_ID = DUNGEONS[0]?.id ?? "hakusla_dungeon_1_200";

type PartyIconKey = "shield" | "swords" | "crown";

const PARTY_ICON_ORDER: PartyIconKey[] = ["shield", "swords", "crown"];

const getPartyIcon = (kind: PartyIconKey) => {
  switch (kind) {
    case "shield":
      return <Shield size={18} stroke="#999999" />;
    case "swords":
      return <Swords size={18} stroke="#999999" />;
    case "crown":
      return <Crown size={18} stroke="#cccccc" />;
    default:
      return <Shield size={18} stroke="#999999" />;
  }
};

const clampFloor = (floor: number, maxFloor: number) => Math.max(1, Math.min(Math.max(1, maxFloor), floor));

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
  maxClearedFloor: number;
  selectedFloor: number | null;
}): number[] => {
  const maxFloor = Math.max(1, params.maxFloor);
  const anchorBase = params.selectedFloor ?? (params.maxClearedFloor + 1);
  const anchor = clampFloor(anchorBase || 1, maxFloor);
  const frontier = clampFloor(params.maxClearedFloor + 1, maxFloor);
  const deepest = clampFloor(Math.max(1, params.maxClearedFloor), maxFloor);
  const values = new Set<number>([1, deepest, frontier, anchor]);
  for (let delta = -5; delta <= 5; delta += 1) {
    values.add(clampFloor(anchor + delta, maxFloor));
  }
  return Array.from(values).sort((a, b) => a - b);
};

const defaultUiState = (partyId: string, dungeonId: string): DungeonPartyUiStateRecord => ({
  partyId,
  dungeonId,
  selectedFloor: null,
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
  const [progressList, setProgressList] = useState<DungeonProgressRecord[]>([]);
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
          const [partyRows, progressRows] = await Promise.all([
            partiesRepository.listWithMembers(),
            dungeonRepository.list(),
          ]);

          await dungeonPartyUiRepository.ensureDefaultsForParties({
            dungeonId: DEFAULT_DUNGEON_ID,
            partyIds: partyRows.map((row) => row.party.id),
          });
          const uiRows = await dungeonPartyUiRepository.listByDungeon(DEFAULT_DUNGEON_ID);
          if (!active) return;
          setParties(partyRows);
          setProgressList(progressRows);
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

  const progressMap = useMemo(() => new Map(progressList.map((p) => [p.dungeonId, p])), [progressList]);
  const selectedDungeon = DUNGEONS.find((d) => d.id === DEFAULT_DUNGEON_ID) ?? DUNGEONS[0];
  const maxFloor = selectedDungeon?.floors ?? 1;
  const progress = progressMap.get(DEFAULT_DUNGEON_ID);
  const maxClearedFloor = progress?.maxClearedFloor ?? 0;
  const dungeonNameKey =
    DUNGEON_NAME_I18N_KEY[(selectedDungeon?.id ?? DEFAULT_DUNGEON_ID) as keyof typeof DUNGEON_NAME_I18N_KEY] ??
    "dungeon.name.hakusla_dungeon_1_200";

  const partyById = useMemo(
    () => new Map(parties.map((entry) => [entry.party.id, entry] as const)),
    [parties]
  );
  const pickerParty = pickerPartyId ? partyById.get(pickerPartyId) ?? null : null;
  const pickerUiState = pickerPartyId ? uiStateMap[pickerPartyId] ?? defaultUiState(pickerPartyId, DEFAULT_DUNGEON_ID) : null;
  const floorCandidates = useMemo(
    () =>
      buildFloorCandidates({
        maxFloor,
        maxClearedFloor,
        selectedFloor: pickerUiState?.selectedFloor ?? null,
      }),
    [maxClearedFloor, maxFloor, pickerUiState?.selectedFloor]
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
      await upsertUiState({
        partyId,
        dungeonId: DEFAULT_DUNGEON_ID,
        selectedFloor: clampedFloor,
        mode: "IDLE",
        autoRunCount: current.autoRunCount,
        autoLootCount: current.autoLootCount,
        autoElapsedSeconds: current.autoElapsedSeconds,
      });
      setPickerPartyId(null);
    },
    [maxFloor, uiStateMap, upsertUiState]
  );

  const handlePartyAction = useCallback(
    async (partyId: string, action: DungeonPartyCardAction) => {
      const current = uiStateMap[partyId] ?? defaultUiState(partyId, DEFAULT_DUNGEON_ID);
      const selectedFloor = current.selectedFloor;

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
        });
        router.push({
          pathname: "/dungeon/exploration",
          params: {
            dungeonId: DEFAULT_DUNGEON_ID,
            floor: String(selectedFloor),
            partyId,
          },
        });
      }
    },
    [openFloorPicker, router, uiStateMap, upsertUiState]
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sharedDungeonCard}>
          <View style={styles.sharedDungeonTop}>
            <Text style={styles.sharedDungeonTitle}>{t(dungeonNameKey)}</Text>
          </View>
          <Text style={styles.sharedDungeonMeta}>
            {t("dungeon.ui.shared.maxCleared", { floor: Math.max(0, maxClearedFloor) })}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateText}>{t("dungeon.ui.loading")}</Text>
          </View>
        ) : error ? (
          <View style={styles.stateWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : parties.length === 0 ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateText}>{t("dungeon.ui.emptyParties")}</Text>
          </View>
        ) : (
          parties.map((entry, index) => {
            const uiState = uiStateMap[entry.party.id] ?? defaultUiState(entry.party.id, DEFAULT_DUNGEON_ID);
            const cardState = buildDungeonPartyCardState({
              selectedFloor: uiState.selectedFloor,
              mode: uiState.mode,
              maxClearedFloor,
            });
            const memberCount = entry.members.length;
            const avgLv =
              memberCount > 0
                ? Math.round(entry.members.reduce((sum, member) => sum + member.level, 0) / memberCount)
                : 0;
            const iconKind = PARTY_ICON_ORDER[index % PARTY_ICON_ORDER.length] ?? "shield";
            const isIdleCard = cardState.displayStatus === "idle";
            const hasMembers = memberCount > 0;
            const primaryActionEnabled =
              (cardState.primaryAction === "selectFloor" || cardState.isExploreEnabled || cardState.primaryAction === "autoStop") &&
              (hasMembers || cardState.primaryAction === "selectFloor");
            const secondaryActionEnabled = !!cardState.secondaryAction && cardState.isAutoEnabled && hasMembers;

            return (
              <View
                key={entry.party.id}
                style={[styles.partyCard, isIdleCard ? styles.partyCardIdle : styles.partyCardActiveLike]}
              >
                <View style={styles.partyCardTop}>
                  <View style={[styles.partyIconWrap, isIdleCard ? styles.partyIconWrapIdle : null]}>
                    {getPartyIcon(iconKind)}
                  </View>
                  <View style={styles.partyTextWrap}>
                    <Text style={styles.partyName} numberOfLines={1}>{entry.party.name}</Text>
                    <Text style={styles.partySub} numberOfLines={1}>
                      {t("dungeon.ui.party.membersAvg", { count: memberCount, avg: avgLv })}
                    </Text>
                  </View>
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
          })
        )}
      </ScrollView>

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
                onPress={() => pickerPartyId && void handleSelectFloor(pickerPartyId, 1)}
              >
                <Text style={styles.quickButtonText}>{t("dungeon.ui.floorPicker.quickB1")}</Text>
              </Pressable>
              <Pressable
                style={styles.quickButton}
                onPress={() => pickerPartyId && void handleSelectFloor(pickerPartyId, clampFloor(maxClearedFloor + 1, maxFloor))}
              >
                <Text style={styles.quickButtonText}>{t("dungeon.ui.floorPicker.quickFrontier")}</Text>
              </Pressable>
              <Pressable
                style={styles.quickButton}
                onPress={() => pickerPartyId && void handleSelectFloor(pickerPartyId, clampFloor(Math.max(1, maxClearedFloor), maxFloor))}
              >
                <Text style={styles.quickButtonText}>{t("dungeon.ui.floorPicker.quickMaxCleared")}</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.floorList} contentContainerStyle={styles.floorListContent}>
              {floorCandidates.map((floor) => {
                const active = floor === (pickerUiState?.selectedFloor ?? null);
                const isCleared = floor <= maxClearedFloor;
                const isFrontier = floor === maxClearedFloor + 1;
                return (
                  <Pressable
                    key={`picker-floor-${floor}`}
                    style={[styles.floorListItem, active ? styles.floorListItemActive : null]}
                    onPress={() => pickerPartyId && void handleSelectFloor(pickerPartyId, floor)}
                  >
                    <Text style={[styles.floorListItemTitle, active ? styles.floorListItemTitleActive : null]}>{`B${floor}`}</Text>
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 12 },
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  partyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  partyIconWrapIdle: { backgroundColor: colors.bgSurface },
  partyTextWrap: { flex: 1, gap: 2 },
  partyName: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  partySub: { color: colors.textTertiary, fontSize: 10 },
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
