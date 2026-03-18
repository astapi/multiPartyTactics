import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, Flag, Layers3, Minus, Plus, Users } from "lucide-react-native";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getClassById } from "@/constants/classes";
import { DUNGEONS } from "@/constants/dungeons";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { dungeonExplorationProgressRepository } from "@/db/repositories/dungeonExplorationProgressRepository";
import { dungeonPartyUiRepository } from "@/db/repositories/dungeonPartyUiRepository";
import { partiesRepository } from "@/db/repositories/partiesRepository";
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
  CharacterRecord,
  PartyWithMembers,
} from "@/types/models";
import { parchment, parchmentShadow } from "@/theme/parchment";

const colors = {
  bgPrimary: parchment.background,
  textPrimary: parchment.ink,
  textSecondary: parchment.inkSoft,
  textTertiary: parchment.inkMuted,
  borderDefault: parchment.goldLine,
  bgDark: parchment.headerBar,
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

export default function DungeonSettingsScreen() {
  const router = useRouter();
  const { partyId: routePartyId } = useLocalSearchParams<{ partyId?: string }>();
  const { t, locale } = useI18n();
  const [parties, setParties] = useState<PartyWithMembers[]>([]);
  const [uiStateMap, setUiStateMap] = useState<Record<string, DungeonPartyUiStateRecord>>({});
  const [maxUnlockedFloor, setMaxUnlockedFloor] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [draftSelectedFloor, setDraftSelectedFloor] = useState<number | null>(null);
  const [draftReturnCondition, setDraftReturnCondition] = useState<DungeonReturnCondition>(
    DEFAULT_DUNGEON_RETURN_CONDITION
  );
  const [unassignedCharacters, setUnassignedCharacters] = useState<CharacterRecord[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const selectedDungeon = DUNGEONS.find((d) => d.id === DEFAULT_DUNGEON_ID) ?? DUNGEONS[0];
  const maxFloor = selectedDungeon?.floors ?? 1;

  const loadData = useCallback(async () => {
    const [partyRows, floorProgressRows, nextUnassignedCharacters] = await Promise.all([
      partiesRepository.listWithMembers(),
      dungeonExplorationProgressRepository.listByDungeon(DEFAULT_DUNGEON_ID),
      charactersRepository.listUnassigned(),
    ]);
    await dungeonPartyUiRepository.ensureDefaultsForParties({
      dungeonId: DEFAULT_DUNGEON_ID,
      partyIds: partyRows.map((row) => row.party.id),
    });
    const uiRows = await dungeonPartyUiRepository.listByDungeon(DEFAULT_DUNGEON_ID);

    const nextUiStateMap = uiRows.reduce<Record<string, DungeonPartyUiStateRecord>>((acc, row) => {
      acc[row.partyId] = row;
      return acc;
    }, {});
    const unlockedFloor = computeMaxUnlockedFloor({ maxFloor, floorProgressList: floorProgressRows });

    setParties(partyRows);
    setUiStateMap(nextUiStateMap);
    setMaxUnlockedFloor(unlockedFloor);
    setUnassignedCharacters(nextUnassignedCharacters);

    const fallbackPartyId = routePartyId && partyRows.some((row) => row.party.id === routePartyId)
      ? routePartyId
      : partyRows[0]?.party.id;

    if (!fallbackPartyId) return;
    const current = nextUiStateMap[fallbackPartyId] ?? defaultUiState(fallbackPartyId, DEFAULT_DUNGEON_ID);
    setDraftSelectedFloor(
      sanitizeSelectedFloor({
        floor: current.selectedFloor,
        maxUnlockedFloor: unlockedFloor,
        maxFloor,
      })
    );
    setDraftReturnCondition(normalizeDungeonReturnCondition(current.returnCondition));
  }, [maxFloor, routePartyId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const run = async () => {
        setIsLoading(true);
        try {
          await loadData();
        } finally {
          if (active) {
            setIsLoading(false);
          }
        }
      };
      void run();
      return () => {
        active = false;
      };
    }, [loadData])
  );

  const pickerParty = useMemo(() => {
    if (!routePartyId) return parties[0] ?? null;
    return parties.find((entry) => entry.party.id === routePartyId) ?? parties[0] ?? null;
  }, [parties, routePartyId]);

  const partyIndex = useMemo(() => {
    if (!pickerParty) return 1;
    return parties.findIndex((entry) => entry.party.id === pickerParty.party.id) + 1;
  }, [parties, pickerParty]);

  const slotCharacters = useMemo(() => {
    if (selectedSlot === null || !pickerParty) return [];
    const current = pickerParty.members.find((row) => row.slotIndex === selectedSlot) ?? null;
    return current ? [...unassignedCharacters, current] : unassignedCharacters;
  }, [pickerParty, selectedSlot, unassignedCharacters]);

  const hasAlternateMembers = useMemo(() => {
    if (selectedSlot === null) return false;
    return slotCharacters.some((character) => character.slotIndex !== selectedSlot);
  }, [selectedSlot, slotCharacters]);

  const handleSelectReturnCondition = useCallback((returnCondition: DungeonReturnCondition) => {
    setDraftReturnCondition(normalizeDungeonReturnCondition(returnCondition));
  }, []);

  const stepDraftFloor = useCallback(
    (delta: number) => {
      const baseFloor = draftSelectedFloor ?? maxUnlockedFloor;
      const nextFloor = clampFloor(baseFloor + delta, maxFloor);
      if (nextFloor > maxUnlockedFloor) return;
      setDraftSelectedFloor(nextFloor);
    },
    [draftSelectedFloor, maxFloor, maxUnlockedFloor]
  );

  const handleSave = useCallback(async () => {
    if (!pickerParty) return;
    const current = uiStateMap[pickerParty.party.id] ?? defaultUiState(pickerParty.party.id, DEFAULT_DUNGEON_ID);
    await dungeonPartyUiRepository.upsert({
      ...current,
      partyId: pickerParty.party.id,
      dungeonId: DEFAULT_DUNGEON_ID,
      selectedFloor: draftSelectedFloor,
      returnCondition: normalizeDungeonReturnCondition(draftReturnCondition),
      mode: "IDLE",
    });
    router.back();
  }, [draftReturnCondition, draftSelectedFloor, pickerParty, router, uiStateMap]);

  const handleSelectCharacter = useCallback(
    async (character: CharacterRecord) => {
      if (!pickerParty || selectedSlot === null) return;
      await charactersRepository.assignToSlot(character.id, selectedSlot, pickerParty.party.id);
      setSelectedSlot(null);
      await loadData();
    },
    [loadData, pickerParty, selectedSlot]
  );

  const handleClearSlot = useCallback(async () => {
    if (!pickerParty || selectedSlot === null) return;
    const current = pickerParty.members.find((row) => row.slotIndex === selectedSlot) ?? null;
    if (current) {
      await charactersRepository.removeFromSlot(current.id, pickerParty.party.id);
    }
    setSelectedSlot(null);
    await loadData();
  }, [loadData, pickerParty, selectedSlot]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable style={styles.headerBackHit} onPress={() => router.back()}>
          <ArrowLeft size={20} stroke="#7A6B55" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {pickerParty ? `PT ${partyIndex} 設定` : t("dungeon.ui.floorPicker.title")}
        </Text>
      </View>

      <View style={styles.infoBar}>
        <View style={styles.infoLeft}>
          <Layers3 size={14} stroke={parchment.gold} />
          <Text style={styles.infoLeftText}>{`${t("dungeon.ui.shared.title")} ${selectedDungeon.floorLabel}`}</Text>
        </View>
        <Text style={styles.infoRightText}>{locale === "ja" ? `最深到達: B${maxUnlockedFloor}` : `Deepest: B${maxUnlockedFloor}`}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Users size={14} stroke="#5C4A34" />
              <Text style={styles.labelText}>{locale === "ja" ? "メンバー編成" : "Members"}</Text>
            </View>
            <View style={styles.memberRow}>
              {Array.from({ length: 6 }).map((_, slotIndex) => {
                const member = pickerParty?.members.find((row) => row.slotIndex === slotIndex) ?? null;
                return (
                  <Pressable
                    key={`settings-member-${slotIndex}`}
                    style={styles.memberCell}
                    onPress={() => setSelectedSlot(slotIndex)}
                  >
                    <View style={[styles.memberAvatar, !member ? styles.memberAvatarEmpty : null]}>
                      {member ? (
                        <View style={styles.memberAvatarClip}>
                          <Image source={getClassById(member.classId).image} style={styles.memberAvatarImage} resizeMode="contain" />
                        </View>
                      ) : (
                        <Text style={styles.memberAddText}>+</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hintText}>{locale === "ja" ? "タップでメンバーを変更" : "Tap to edit members"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{locale === "ja" ? "探索階層の設定" : "Floor"}</Text>
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
            <Text style={styles.hintText}>
              {locale === "ja" ? `最深到達: B${maxUnlockedFloor} まで設定可能` : `Up to B${maxUnlockedFloor}`}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Flag size={14} stroke="#5C4A34" />
              <Text style={styles.labelText}>{locale === "ja" ? "帰還条件" : t("dungeon.ui.returnConditionPicker.title")}</Text>
            </View>
            <View style={styles.returnConditionList}>
              {DUNGEON_RETURN_CONDITIONS.map((returnCondition) => {
                const active = returnCondition === draftReturnCondition;
                return (
                  <Pressable
                    key={`screen-return-condition-${returnCondition}`}
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

          <View style={styles.divider} />

          <View style={styles.buttonSection}>
            <Pressable style={styles.cancelButton} onPress={() => router.back()}>
              <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={() => void handleSave()} disabled={!pickerParty || isLoading}>
              <Text style={styles.saveButtonText}>{locale === "ja" ? "保存する" : "Save"}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal transparent visible={selectedSlot !== null} animationType="fade" onRequestClose={() => setSelectedSlot(null)}>
        <Pressable style={styles.memberModalOverlay} onPress={() => setSelectedSlot(null)}>
          <Pressable style={styles.memberModalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.memberModalHeader}>
              <View style={styles.memberModalHeaderLeft}>
                <ArrowLeft size={18} stroke="#7A6B55" />
                <Text style={styles.memberModalTitle}>{locale === "ja" ? "メンバー変更" : "Change Member"}</Text>
              </View>
              <View style={styles.slotBadge}>
                <Text style={styles.slotBadgeText}>{`Slot ${(selectedSlot ?? 0) + 1}`}</Text>
              </View>
            </View>

            <View style={styles.modalDivider} />

            <ScrollView style={styles.memberList} contentContainerStyle={styles.memberListContent}>
              {slotCharacters.map((character) => {
                const isSelected = character.slotIndex === selectedSlot;
                return (
                  <Pressable
                    key={character.id}
                    style={[styles.memberListRow, isSelected ? styles.memberListRowSelected : null]}
                    onPress={() => void handleSelectCharacter(character)}
                  >
                    <View style={styles.memberListAvatar}>
                      <View style={styles.memberListAvatarClip}>
                        <Image source={getClassById(character.classId).image} style={styles.memberListAvatarImage} resizeMode="contain" />
                      </View>
                    </View>
                    <View style={styles.memberListText}>
                      <Text style={styles.memberListName}>{character.name}</Text>
                      <Text style={styles.memberListMeta}>{`${character.classId}  Lv.${character.level}`}</Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.currentTag}>
                        <Check size={12} stroke="#F5EDE0" />
                        <Text style={styles.currentTagText}>{locale === "ja" ? "配置中" : "Current"}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              {!hasAlternateMembers ? (
                <View style={styles.memberEmptyState}>
                  <Text style={styles.memberEmptyTitle}>{locale === "ja" ? "入れ替え候補がいません" : "No replacement members"}</Text>
                  <Text style={styles.memberEmptyText}>
                    {locale === "ja" ? "現在このスロット以外に編成できるメンバーはいません。" : "There are no other members available for this slot."}
                  </Text>
                </View>
              ) : null}
              <View style={styles.memberModalFooter}>
                <Pressable style={styles.clearSlotButton} onPress={() => void handleClearSlot()}>
                  <Text style={styles.clearSlotButtonText}>{locale === "ja" ? "スロットを空にする" : "Clear Slot"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBackHit: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#3B2E1E", fontFamily: "Source Serif 4", fontSize: 16, fontWeight: "700" },
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
  content: { padding: 16, paddingBottom: 24 },
  card: {
    ...parchmentShadow,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(196, 168, 112, 0.25)",
    backgroundColor: parchment.surfaceMuted,
    overflow: "hidden",
  },
  section: { paddingHorizontal: 16, paddingVertical: 18 },
  divider: { height: 1, backgroundColor: colors.borderDefault, marginHorizontal: 16 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  labelText: { color: "#5C4A34", fontSize: 13, fontWeight: "700" },
  memberRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  memberCell: { flex: 1, minWidth: 0, alignItems: "center" },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  memberAvatarClip: {
    width: 42,
    height: 42,
    overflow: "hidden",
    borderRadius: 2,
    position: "relative",
  },
  memberAvatarImage: {
    width: 108,
    height: 154,
    position: "absolute",
    left: -37,
    top: -30,
  },
  memberAvatarEmpty: { backgroundColor: "#efe8d8", borderWidth: 1.5, borderColor: "#e1d1ae" },
  memberAddText: { color: "#ac9d83", fontSize: 20, lineHeight: 20, fontWeight: "400" },
  hintText: { marginTop: 10, color: colors.textTertiary, fontSize: 11 },
  sectionTitle: { color: "#5C4A34", fontSize: 13, fontWeight: "700", marginBottom: 12 },
  floorStepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  floorStepperButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: parchment.surface,
  },
  floorStepperValueWrap: {
    minWidth: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: parchment.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  floorStepperValue: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  returnConditionList: { gap: 10 },
  returnConditionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: parchment.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  returnConditionRowActive: {
    borderColor: parchment.borderStrong,
    backgroundColor: "rgba(196, 168, 112, 0.12)",
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#a18a62",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: { borderColor: "#7a633d" },
  radioInner: { width: 8, height: 8, borderRadius: 999, backgroundColor: "#7a633d" },
  returnConditionText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  returnConditionTextActive: { color: colors.textPrimary, fontWeight: "700" },
  buttonSection: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  cancelButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C4A87080",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  cancelButtonText: { color: "#5C4A34", fontSize: 14, fontWeight: "700" },
  saveButton: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: "#3B2E1E",
  },
  saveButtonText: { color: "#F5EDE0", fontSize: 14, fontWeight: "700" },
  memberModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  memberModalCard: {
    width: "100%",
    maxWidth: 362,
    maxHeight: 600,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#C4B8A060",
    backgroundColor: "#F5EDE0",
  },
  modalDivider: { height: 1, backgroundColor: "#C4A87080" },
  memberModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  memberModalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberModalTitle: {
    color: "#3B2E1E",
    fontFamily: "Source Serif 4",
    fontSize: 16,
    fontWeight: "700",
  },
  slotBadge: {
    borderRadius: 12,
    backgroundColor: "#3B2E1E10",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  slotBadgeText: {
    color: "#5C4A34",
    fontSize: 12,
    fontWeight: "700",
  },
  memberList: {
    flexGrow: 0,
  },
  memberListContent: {
    minHeight: 260,
    paddingBottom: 8,
  },
  memberListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#C4A87030",
  },
  memberListRowSelected: {
    backgroundColor: "#3B2E1E08",
    borderLeftWidth: 3,
    borderLeftColor: "#8B6B4050",
  },
  memberListAvatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  memberListAvatarClip: {
    width: 42,
    height: 42,
    overflow: "hidden",
    borderRadius: 2,
    position: "relative",
  },
  memberListAvatarImage: {
    width: 108,
    height: 154,
    position: "absolute",
    left: -37,
    top: -30,
  },
  memberListText: {
    flex: 1,
    gap: 2,
  },
  memberListName: {
    color: "#3B2E1E",
    fontSize: 14,
    fontWeight: "700",
  },
  memberListMeta: {
    color: "#7A6B55",
    fontSize: 11,
  },
  currentTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "#3B2E1E",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  currentTagText: {
    color: "#F5EDE0",
    fontSize: 10,
    fontWeight: "700",
  },
  memberModalFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  memberEmptyState: {
    minHeight: 108,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#C4A87030",
  },
  memberEmptyTitle: {
    color: "#3B2E1E",
    fontSize: 14,
    fontWeight: "700",
  },
  memberEmptyText: {
    marginTop: 6,
    color: "#7A6B55",
    fontSize: 11,
    textAlign: "center",
  },
  clearSlotButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C4A87050",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  clearSlotButtonText: {
    color: "#5C4A34",
    fontSize: 13,
    fontWeight: "700",
  },
});
