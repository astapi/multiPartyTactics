import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Compass, Flag, Layers3, Minus, Plus, Repeat, Square, Users } from "lucide-react-native";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { getClassById } from "@/constants/classes";
import { DUNGEONS } from "@/constants/dungeons";
import { dungeonExplorationProgressRepository } from "@/db/repositories/dungeonExplorationProgressRepository";
import { dungeonPartyUiRepository } from "@/db/repositories/dungeonPartyUiRepository";
import { partiesRepository } from "@/db/repositories/partiesRepository";
import { buildDungeonPartyCardState, DungeonPartyCardAction } from "@/features/dungeon/partyCardState";
import {
  DEFAULT_DUNGEON_RETURN_CONDITION,
  DUNGEON_RETURN_CONDITIONS,
  normalizeDungeonReturnCondition,
} from "@/game/explorationReturn";
import { useI18n } from "@/i18n";
import {
  DungeonFloorExplorationProgressRecord,
  DungeonPartyUiStateRecord,
  DungeonReturnCondition,
  PartyWithMembers,
} from "@/types/models";
import { parchment, parchmentShadow } from "@/theme/parchment";

const colors = {
  bgPrimary: parchment.background,
  bgSurface: parchment.surface,
  bgSubtle: parchment.surfaceMuted,
  bgElevated: parchment.surfaceStrong,
  bgDark: parchment.headerBar,
  textPrimary: parchment.ink,
  textSecondary: parchment.inkSoft,
  textTertiary: parchment.inkMuted,
  textMuted: parchment.inkMuted,
  textDisabled: "#c5baa5",
  borderDefault: parchment.goldLine,
  borderStrong: parchment.borderStrong,
  overlay: parchment.overlay,
} as const;

const DEFAULT_DUNGEON_ID = DUNGEONS[0]?.id ?? "crestoria_dungeon_1_200";

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
const defaultUiState = (partyId: string, dungeonId: string): DungeonPartyUiStateRecord => ({
  partyId,
  dungeonId,
  selectedFloor: null,
  returnCondition: DEFAULT_DUNGEON_RETURN_CONDITION,
  mode: "IDLE",
  autoRunCount: 0,
  autoLootCount: 0,
  autoElapsedSeconds: 0,
  updatedAt: "",
});

export default function DungeonScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [parties, setParties] = useState<PartyWithMembers[]>([]);
  const [floorProgressList, setFloorProgressList] = useState<DungeonFloorExplorationProgressRecord[]>([]);
  const [uiStateMap, setUiStateMap] = useState<Record<string, DungeonPartyUiStateRecord>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerPartyId, setPickerPartyId] = useState<string | null>(null);
  const [draftSelectedFloor, setDraftSelectedFloor] = useState<number | null>(null);
  const [draftReturnCondition, setDraftReturnCondition] = useState<DungeonReturnCondition>(
    DEFAULT_DUNGEON_RETURN_CONDITION
  );

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
  const partyIndexById = useMemo(
    () =>
      new Map(
        parties.map((entry, index) => [entry.party.id, index + 1] as const)
      ),
    [parties]
  );
  const pickerParty = pickerPartyId ? partyById.get(pickerPartyId) ?? null : null;
  const pickerUiState = pickerPartyId ? uiStateMap[pickerPartyId] ?? defaultUiState(pickerPartyId, DEFAULT_DUNGEON_ID) : null;
  const pickerSelectedFloor = useMemo(
    () =>
      sanitizeSelectedFloor({
        floor: pickerUiState?.selectedFloor ?? null,
        maxUnlockedFloor,
        maxFloor,
      }),
    [maxFloor, maxUnlockedFloor, pickerUiState?.selectedFloor]
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
    const current = uiStateMap[partyId] ?? defaultUiState(partyId, DEFAULT_DUNGEON_ID);
    setPickerPartyId(partyId);
    setDraftSelectedFloor(
      sanitizeSelectedFloor({
        floor: current.selectedFloor,
        maxUnlockedFloor,
        maxFloor,
      })
    );
    setDraftReturnCondition(normalizeDungeonReturnCondition(current.returnCondition));
  }, [maxFloor, maxUnlockedFloor, uiStateMap]);

  const closeFloorPicker = useCallback(() => {
    setPickerPartyId(null);
    setDraftSelectedFloor(null);
    setDraftReturnCondition(DEFAULT_DUNGEON_RETURN_CONDITION);
  }, []);

  const handleSelectFloor = useCallback(
    (floor: number) => {
      const clampedFloor = clampFloor(floor, maxFloor);
      if (clampedFloor > maxUnlockedFloor) {
        return;
      }
      setDraftSelectedFloor(clampedFloor);
    },
    [maxFloor, maxUnlockedFloor]
  );

  const handleSelectReturnCondition = useCallback((returnCondition: DungeonReturnCondition) => {
    setDraftReturnCondition(normalizeDungeonReturnCondition(returnCondition));
  }, []);

  const stepDraftFloor = useCallback(
    (delta: number) => {
      const baseFloor = draftSelectedFloor ?? maxUnlockedFloor;
      const nextFloor = clampFloor(baseFloor + delta, maxFloor);
      if (nextFloor > maxUnlockedFloor) {
        return;
      }
      setDraftSelectedFloor(nextFloor);
    },
    [draftSelectedFloor, maxFloor, maxUnlockedFloor]
  );

  const handleSavePicker = useCallback(async () => {
    if (!pickerPartyId) return;
    const current = uiStateMap[pickerPartyId] ?? defaultUiState(pickerPartyId, DEFAULT_DUNGEON_ID);
    await upsertUiState({
      ...current,
      partyId: pickerPartyId,
      dungeonId: DEFAULT_DUNGEON_ID,
      selectedFloor: draftSelectedFloor,
      returnCondition: normalizeDungeonReturnCondition(draftReturnCondition),
      mode: "IDLE",
    });
    closeFloorPicker();
  }, [closeFloorPicker, draftReturnCondition, draftSelectedFloor, pickerPartyId, uiStateMap, upsertUiState]);

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
          returnCondition: normalizeDungeonReturnCondition(current.returnCondition),
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
          returnCondition: normalizeDungeonReturnCondition(current.returnCondition),
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
          returnCondition: normalizeDungeonReturnCondition(current.returnCondition),
        });
        router.push({
          pathname: "/dungeon/exploration",
          params: {
            dungeonId: DEFAULT_DUNGEON_ID,
            floor: String(selectedFloor),
            partyId,
            returnCondition: normalizeDungeonReturnCondition(current.returnCondition),
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
      compact?: boolean;
      disabled?: boolean;
      emphasize?: boolean;
      onPress: () => void;
      variant?: "primary" | "outline";
    }) => {
      const { action, fullWidth, compact, disabled, emphasize, onPress, variant = "outline" } = params;
      const labelText =
        action === "selectFloor"
          ? t("dungeon.ui.action.selectFloor")
          : action === "resumeExplore"
            ? locale === "ja"
              ? "探索"
              : t("dungeon.ui.action.resumeExplore")
            : action === "explore"
              ? locale === "ja"
                ? "探索"
                : t("dungeon.ui.action.explore")
              : action === "autoStart"
                ? locale === "ja"
                  ? "自動周回"
                  : t("dungeon.ui.action.autoStart")
                : t("dungeon.ui.action.autoStop");
      const icon =
        action === "selectFloor" ? (
          <Layers3 size={14} stroke={variant === "primary" ? "#ffffff" : colors.textSecondary} />
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
            compact ? styles.actionButtonCompact : null,
            disabled ? styles.actionButtonDisabled : null,
          ]}
        >
          {icon}
          <Text
            style={[
              styles.actionButtonText,
            variant === "primary" ? styles.actionButtonTextPrimary : styles.actionButtonTextOutline,
              emphasize ? styles.actionButtonTextEmphasize : null,
              disabled ? styles.actionButtonTextDisabled : null,
            ]}
            numberOfLines={1}
          >
            {labelText}
          </Text>
        </Pressable>
      );
    },
    [locale, t]
  );

  const getStatusBadge = useCallback(
    (cardState: ReturnType<typeof buildDungeonPartyCardState>) => {
      if (cardState.displayStatus === "explore-frontier" || cardState.displayStatus === "explore-uncleared") {
        return {
          label: locale === "ja" ? "未攻略" : "Frontier",
          tone: "warning" as const,
        };
      }
      if (cardState.displayStatus === "idle") {
        return {
          label: locale === "ja" ? "待機" : "Idle",
          tone: "muted" as const,
        };
      }
      return {
        label: locale === "ja" ? "攻略済" : "Cleared",
        tone: "success" as const,
      };
    },
    [locale]
  );

  const getStatusNote = useCallback(
    (params: {
      cardState: ReturnType<typeof buildDungeonPartyCardState>;
      uiState: DungeonPartyUiStateRecord;
      returnCondition: DungeonReturnCondition;
    }) => {
      const { cardState, uiState, returnCondition } = params;
      if (cardState.displayStatus === "auto-running") {
        return locale === "ja"
          ? `自動 ${uiState.autoRunCount}周 / ${t(`dungeon.ui.returnCondition.${returnCondition}` as any)}`
          : `Auto ${uiState.autoRunCount} runs / ${t(`dungeon.ui.returnCondition.${returnCondition}` as any)}`;
      }
      if (cardState.displayStatus === "auto-ready") {
        return locale === "ja" ? "自動周回可能" : "Auto loop available";
      }
      if (cardState.displayStatus === "explore-frontier" || cardState.displayStatus === "explore-uncleared") {
        return "";
      }
      return "";
    },
    [locale]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerBar}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerBarTitle}>{locale === "ja" ? "探索準備" : "Exploration Prep"}</Text>
        <View style={styles.headerSpacer} />
      </View>

        <View style={styles.infoBar}>
        <View style={styles.infoLeft}>
          <Layers3 size={14} stroke={parchment.gold} />
          <Text style={styles.infoLeftText}>{`${t("dungeon.ui.shared.title")} ${selectedDungeon.floorLabel}`}</Text>
        </View>
        <Text style={styles.infoRightText}>{locale === "ja" ? `最深到達: B${maxUnlockedFloor}` : `Deepest: B${maxUnlockedFloor}`}</Text>
      </View>

      <View style={styles.ornamentDivider}>
        <View style={styles.ornamentLine} />
        <View style={styles.ornamentDiamond} />
        <View style={styles.ornamentLine} />
      </View>

      <FlashList
        data={isLoading || error || parties.length === 0 ? [] : parties}
        extraData={{ uiStateMap, maxUnlockedFloor, maxFloor }}
        keyExtractor={(item) => item.party.id}
        estimatedItemSize={180}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        ListHeaderComponent={<View style={styles.listHeader} />}
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
          const returnCondition = normalizeDungeonReturnCondition(uiState.returnCondition);
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
          const hasAutoAction = cardState.secondaryAction === "autoStart" || cardState.secondaryAction === "autoStop";

          const badge = getStatusBadge(cardState);
          const statusNote = getStatusNote({ cardState, uiState, returnCondition });

          return (
            <View
              style={[styles.partyCard, isIdleCard ? styles.partyCardIdle : styles.partyCardActiveLike]}
            >
              <View style={styles.partyCardTop}>
                <View style={styles.partyTopRow}>
                  <Text style={styles.partyName} numberOfLines={1}>{`PT ${index + 1}`}</Text>
                  <Pressable style={styles.floorTopWrap} onPress={() => openFloorPicker(entry.party.id)}>
                    <Layers3 size={18} stroke={"#a68350"} />
                    <Text style={styles.floorTopText}>{cardState.floor ? `B${cardState.floor}` : "--"}</Text>
                  </Pressable>
                </View>
                <View style={styles.membersRow}>
                  {memberSlots.map((member, slotIndex) => {
                    const empty = member === null;
                    return (
                      <View key={`party-member-${entry.party.id}-${slotIndex}`} style={styles.memberItem}>
                        <View style={[styles.memberAvatar, empty ? styles.memberAvatarEmpty : null]}>
                          {empty ? (
                            <Text style={styles.cardMemberAddText}>+</Text>
                          ) : (
                            <View style={styles.memberAvatarClip}>
                              <Image
                                source={getClassById(member.classId).image}
                                style={styles.memberAvatarImage}
                                resizeMode="contain"
                              />
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      badge.tone === "warning"
                        ? styles.statusBadgeWarning
                        : badge.tone === "success"
                          ? styles.statusBadgeSuccess
                          : styles.statusBadgeMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        badge.tone === "warning"
                          ? styles.statusBadgeTextWarning
                          : badge.tone === "success"
                            ? styles.statusBadgeTextSuccess
                            : styles.statusBadgeTextMuted,
                      ]}
                    >
                      {badge.label}
                    </Text>
                  </View>
                  {statusNote ? <Text style={styles.statusNote}>{statusNote}</Text> : <View style={styles.statusNoteSpacer} />}
                </View>

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
                        ? hasAutoAction
                          ? "outline"
                          : "primary"
                        : "outline",
                    fullWidth: false,
                    compact: cardState.secondaryAction !== null,
                    emphasize: cardState.primaryAction === "resumeExplore" || cardState.primaryAction === "explore",
                    disabled: !primaryActionEnabled,
                  })}
                  {cardState.secondaryAction
                    ? renderActionButton({
                        action: cardState.secondaryAction,
                        onPress: () => void handlePartyAction(entry.party.id, cardState.secondaryAction!),
                        fullWidth: false,
                        disabled: !secondaryActionEnabled,
                        compact: true,
                        emphasize: true,
                        variant: cardState.secondaryAction === "autoStart" ? "primary" : "outline",
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerPartyId ? `PT ${partyIndexById.get(pickerPartyId) ?? 1} 設定` : t("dungeon.ui.floorPicker.title")}
              </Text>
              <Pressable onPress={closeFloorPicker}>
                <Text style={styles.modalCloseText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <View style={styles.modalLabelRow}>
                <Users size={14} stroke={"#5C4A34"} />
                <Text style={styles.modalLabelText}>{locale === "ja" ? "メンバー編成" : "Members"}</Text>
              </View>
              <View style={styles.modalMemberRow}>
                {Array.from({ length: 6 }).map((_, slotIndex) => {
                  const member = pickerParty?.members.find((row) => row.slotIndex === slotIndex) ?? null;
                  return (
                    <Pressable
                      key={`modal-member-${slotIndex}`}
                      style={styles.memberCell}
                      onPress={() =>
                        pickerParty &&
                        router.push({
                          pathname: "/dungeon/party",
                          params: { partyId: pickerParty.party.id },
                        })
                      }
                    >
                      <View style={[styles.modalMemberAvatar, !member ? styles.modalMemberAvatarEmpty : null]}>
                        {member ? (
                          <View style={styles.modalMemberAvatarClip}>
                            <Image source={getClassById(member.classId).image} style={styles.modalMemberAvatarImage} resizeMode="contain" />
                          </View>
                        ) : (
                          <Text style={styles.memberAddText}>+</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.modalHintText}>{locale === "ja" ? "タップでメンバーを変更" : "Tap to edit members"}</Text>
            </View>

            <View style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>{locale === "ja" ? "探索階層の設定" : "Floor"}</Text>
              <View style={styles.floorStepper}>
                <Pressable style={styles.floorStepperButton} onPress={() => stepDraftFloor(-1)}>
                  <Minus size={16} stroke={colors.textPrimary} />
                </Pressable>
                <View style={styles.floorStepperValueWrap}>
                  <Text style={styles.floorStepperValue}>{`B${draftSelectedFloor ?? maxUnlockedFloor}`}</Text>
                </View>
                <Pressable style={styles.floorStepperButton} onPress={() => stepDraftFloor(1)}>
                  <Plus size={16} stroke={colors.textPrimary} />
                </Pressable>
              </View>
              <Text style={styles.modalHintText}>
                {locale === "ja" ? `最深到達: B${maxUnlockedFloor} まで設定可能` : `Up to B${maxUnlockedFloor}`}
              </Text>
            </View>

            <View style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <View style={styles.modalLabelRow}>
                <Flag size={14} stroke={"#5C4A34"} />
                <Text style={styles.modalLabelText}>{locale === "ja" ? "帰還条件" : t("dungeon.ui.returnConditionPicker.title")}</Text>
              </View>
              <View style={styles.returnConditionList}>
                {DUNGEON_RETURN_CONDITIONS.map((returnCondition) => {
                  const active = returnCondition === draftReturnCondition;
                  return (
                    <Pressable
                      key={`picker-return-condition-${returnCondition}`}
                      style={[styles.returnConditionRow, active ? styles.returnConditionRowActive : null]}
                      onPress={() => handleSelectReturnCondition(returnCondition)}
                    >
                      <View style={[styles.radioOuter, active ? styles.radioOuterActive : null]}>
                        {active ? <View style={styles.radioInner} /> : null}
                      </View>
                      <Text style={[styles.returnConditionText, active ? styles.returnConditionTextActive : null]}>
                        {t(`dungeon.ui.returnCondition.${returnCondition}` as any)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalDivider} />

            <View style={styles.buttonRow}>
              <Pressable style={styles.modalCancelButton} onPress={closeFloorPicker}>
                <Text style={styles.modalCancelButtonText}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={() => void handleSavePicker()}>
                <Text style={styles.modalSaveButtonText}>{locale === "ja" ? "保存する" : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: parchment.headerBar,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerSpacer: { width: 20 },
  headerBarTitle: { flex: 1, textAlign: "center", color: "#f5ede0", fontSize: 18, fontWeight: "700" },
  infoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(59, 46, 30, 0.84)",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  infoLeftText: { color: parchment.gold, fontSize: 12, fontWeight: "600", flexShrink: 1 },
  infoRightText: { color: "#e8dcc8", fontSize: 11 },
  ornamentDivider: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  ornamentLine: { flex: 1, height: 1, backgroundColor: parchment.goldLine },
  ornamentDiamond: { width: 8, height: 8, backgroundColor: parchment.gold, transform: [{ rotate: "45deg" }] },
  content: { paddingHorizontal: 16, paddingBottom: 20 },
  listHeader: { height: 4 },
  listSeparator: { height: 14 },
  stateWrap: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  stateText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: "#b91c1c", fontSize: 13 },
  partyCard: {
    ...parchmentShadow,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(196, 168, 112, 0.25)",
    overflow: "hidden",
  },
  partyCardActiveLike: { backgroundColor: "rgba(245, 237, 224, 0.12)" },
  partyCardIdle: { backgroundColor: "rgba(245, 237, 224, 0.12)" },
  partyCardTop: { gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  partyTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  partyName: { color: "#3B2E1E", fontFamily: "Source Serif 4", fontSize: 14, fontWeight: "700" },
  floorTopWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  floorTopText: { color: "#8B6B40", fontFamily: "Source Serif 4", fontSize: 13, fontWeight: "700" },
  membersRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  memberItem: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  memberAvatarClip: {
    width: 36,
    height: 36,
    overflow: "hidden",
    borderRadius: 1,
    position: "relative",
  },
  memberAvatarImage: {
    width: 98,
    height: 140,
    position: "absolute",
    left: -35,
    top: -28,
  },
  memberAvatarEmpty: { backgroundColor: "#efe8d8", borderWidth: 1.5, borderColor: "#e1d1ae" },
  cardMemberAddText: { color: "#ac9d83", fontSize: 20, lineHeight: 20, fontWeight: "400" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeWarning: { backgroundColor: "#8d5d2f" },
  statusBadgeSuccess: { backgroundColor: "#4b6c43" },
  statusBadgeMuted: { backgroundColor: "#7a6b55" },
  statusBadgeText: { fontFamily: "Barlow Semi Condensed", fontSize: 9, fontWeight: "700" },
  statusBadgeTextWarning: { color: "#F5EDE0" },
  statusBadgeTextSuccess: { color: "#C8E6B0" },
  statusBadgeTextMuted: { color: "#f5ede0" },
  statusNote: { color: "#5C7A34", fontFamily: "Source Serif 4", fontSize: 11, fontWeight: "400", flex: 1 },
  statusNoteSpacer: { flex: 1 },
  autoStatsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  autoStatItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  autoStatLabel: { color: colors.textTertiary, fontSize: 10, fontWeight: "500" },
  autoStatValue: { color: colors.textPrimary, fontSize: 10, fontWeight: "700" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    width: "100%",
    alignSelf: "flex-end",
  },
  actionButton: {
    minHeight: 38,
    borderRadius: 4,
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionButtonPrimary: { backgroundColor: colors.bgDark },
  actionButtonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#8b7a5c",
  },
  actionButtonFill: { flex: 1 },
  actionButtonCompact: { flex: 0 },
  actionButtonDisabled: { opacity: 0.45 },
  actionButtonText: { fontFamily: "Barlow Semi Condensed", fontSize: 11, fontWeight: "700" },
  actionButtonTextPrimary: { color: "#ffffff" },
  actionButtonTextOutline: { color: "#5c4a34" },
  actionButtonTextEmphasize: { fontSize: 11 },
  actionButtonTextDisabled: { color: colors.textMuted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    ...parchmentShadow,
    borderRadius: 12,
    backgroundColor: "#E8DCC8",
    borderWidth: 1,
    borderColor: "rgba(196, 184, 160, 0.38)",
    paddingTop: 0,
    paddingBottom: 16,
    paddingHorizontal: 0,
    gap: 0,
    maxHeight: "82%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalTitle: { color: "#3B2E1E", fontFamily: "Source Serif 4", fontSize: 16, fontWeight: "700" },
  modalCloseText: { color: "#7A6B55", fontSize: 20, lineHeight: 20 },
  modalDivider: { height: 1, backgroundColor: "rgba(196, 168, 112, 0.35)" },
  modalSection: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  modalSectionTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  modalLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  modalLabelText: { color: "#5C4A34", fontFamily: "Barlow Semi Condensed", fontSize: 12, fontWeight: "600" },
  modalMemberRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  memberCell: { width: 36, alignItems: "center", justifyContent: "center" },
  modalMemberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  modalMemberAvatarClip: { width: 36, height: 36, overflow: "hidden", borderRadius: 8, position: "relative" },
  modalMemberAvatarImage: { width: 70, height: 100, position: "absolute", left: -17, top: -5 },
  modalMemberAvatarEmpty: {
    backgroundColor: "rgba(59, 46, 30, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(196, 168, 112, 0.25)",
  },
  memberAddText: { color: "#A0937F", fontSize: 18, lineHeight: 18, fontWeight: "400" },
  memberName: { color: colors.textPrimary, fontSize: 11, fontWeight: "700" },
  memberNameEmpty: { color: "#c5baa5", fontSize: 12, fontWeight: "700" },
  modalHintText: { color: "#A0937F", fontFamily: "Barlow Semi Condensed", fontSize: 10, fontWeight: "400" },
  floorStepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  floorStepperButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  floorStepperValueWrap: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  floorStepperValue: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  returnConditionList: { gap: 10 },
  returnConditionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 6,
    backgroundColor: "rgba(59, 46, 30, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(196, 168, 112, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  returnConditionRowActive: {
    backgroundColor: "rgba(59, 46, 30, 0.07)",
    borderColor: "rgba(139, 107, 64, 0.5)",
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(196, 168, 112, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: { borderColor: "#8B6B40" },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#8B6B40",
  },
  returnConditionText: { color: "#3B2E1E", fontFamily: "Source Serif 4", fontSize: 12, fontWeight: "400" },
  returnConditionTextActive: { color: "#3B2E1E", fontWeight: "600" },
  buttonRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  modalCancelButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  modalSaveButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: colors.bgDark,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveButtonText: { color: "#f5ede0", fontSize: 14, fontWeight: "700" },
});
