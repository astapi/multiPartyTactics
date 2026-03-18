import { useCallback, useEffect, useMemo, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, Package, Pencil, Plus, Shield, Trash2 } from "lucide-react-native";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CharacterSelectModal } from "@/components/party/CharacterSelectModal";
import { getClassById } from "@/constants/classes";
import { charactersRepository, DEFAULT_PARTY_ID } from "@/db/repositories/charactersRepository";
import { partiesRepository } from "@/db/repositories/partiesRepository";
import { TranslationKey, useI18n } from "@/i18n";
import { useSelectedPartyStore } from "@/stores/selectedPartyStore";
import { CharacterRecord, PartyWithMembers } from "@/types/models";
import { generateId } from "@/utils/id";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgElevated: "#e5e5e5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  textMuted: "#aaaaaa",
  textDisabled: "#cccccc",
  borderDefault: "#e0e0e0",
  borderStrong: "#d0d0d0",
  iconSecondary: "#999999",
} as const;

const CLASS_NAME_KEYS: Record<CharacterRecord["classId"], TranslationKey> = {
  GUARDIAN: "class.name.guardian",
  SWORDMAN: "class.name.swordman",
  BERSERKER: "class.name.berserker",
  CLERIC: "class.name.cleric",
  WITCH: "class.name.witch",
  THIEF: "class.name.thief",
  PORTER: "class.name.porter",
};

export default function DungeonPartyScreen() {
  const router = useRouter();
  const { partyId: routePartyId, slotIndex: routeSlotIndex } = useLocalSearchParams<{ partyId?: string; slotIndex?: string }>();
  const { t, locale } = useI18n();

  const selectedPartyId = useSelectedPartyStore((state) => state.selectedPartyId);
  const setSelectedPartyId = useSelectedPartyStore((state) => state.setSelectedPartyId);

  const [partiesWithMembers, setPartiesWithMembers] = useState<PartyWithMembers[]>([]);
  const [unassignedCharacters, setUnassignedCharacters] = useState<CharacterRecord[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");

  const loadData = useCallback(async () => {
    const [parties, unassigned] = await Promise.all([
      partiesRepository.listWithMembers(),
      charactersRepository.listUnassigned(),
    ]);
    setPartiesWithMembers(parties);
    setUnassignedCharacters(unassigned);

    if (routePartyId && parties.some((entry) => entry.party.id === routePartyId)) {
      setSelectedPartyId(routePartyId);
      return;
    }

    const partyExists = parties.some((entry) => entry.party.id === selectedPartyId);
    if (!partyExists && parties.length > 0) {
      setSelectedPartyId(parties[0].party.id);
    }
  }, [routePartyId, selectedPartyId, setSelectedPartyId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (typeof routeSlotIndex !== "string") return;
    if (routePartyId && routePartyId !== selectedPartyId) return;

    const parsedSlot = Number(routeSlotIndex);
    if (!Number.isInteger(parsedSlot) || parsedSlot < 0 || parsedSlot > 5) {
      router.setParams({ slotIndex: undefined });
      return;
    }

    setSelectedSlot(parsedSlot);
    router.setParams({ slotIndex: undefined });
  }, [routePartyId, routeSlotIndex, router, selectedPartyId]);

  const selectedParty = useMemo(
    () => partiesWithMembers.find((entry) => entry.party.id === selectedPartyId) ?? null,
    [partiesWithMembers, selectedPartyId]
  );

  const selectedSlotMap = useMemo(() => {
    const map = new Map<number, CharacterRecord>();
    for (const member of selectedParty?.members ?? []) {
      map.set(member.slotIndex, member);
    }
    return map;
  }, [selectedParty?.members]);

  const partySlots = useMemo(
    () => Array.from({ length: 6 }).map((_, index) => selectedSlotMap.get(index) ?? null),
    [selectedSlotMap]
  );

  const firstEmptySlot = partySlots.findIndex((member) => member === null);

  const slotModalCharacters = useMemo(() => {
    if (selectedSlot === null) return [];
    const current = partySlots[selectedSlot];
    return current ? [...unassignedCharacters, current] : unassignedCharacters;
  }, [partySlots, selectedSlot, unassignedCharacters]);

  const handleCreateParty = useCallback(async () => {
    const nextId = generateId("party");
    const nextName = `Party ${partiesWithMembers.length + 1}`;
    await partiesRepository.create({ id: nextId, name: nextName });
    setSelectedPartyId(nextId);
    setRenameInput(nextName);
    setIsRenaming(true);
    await loadData();
  }, [loadData, partiesWithMembers.length, setSelectedPartyId]);

  const handleDeleteParty = useCallback(async () => {
    if (!selectedParty || selectedParty.party.id === DEFAULT_PARTY_ID) return;

    Alert.alert(
      locale === "ja" ? "パーティ削除" : "Delete Party",
      locale === "ja" ? `${selectedParty.party.name} を削除します。` : `Delete ${selectedParty.party.name}?`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: locale === "ja" ? "削除" : "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await partiesRepository.delete(selectedParty.party.id);
              setSelectedPartyId(DEFAULT_PARTY_ID);
              await loadData();
            })();
          },
        },
      ]
    );
  }, [loadData, locale, selectedParty, setSelectedPartyId, t]);

  const handleCommitRename = useCallback(async () => {
    if (!selectedParty) return;
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    await partiesRepository.rename(selectedParty.party.id, trimmed);
    setIsRenaming(false);
    await loadData();
  }, [loadData, renameInput, selectedParty]);

  const onSelectParty = useCallback(
    (partyId: string) => {
      setSelectedPartyId(partyId);
      setSelectedSlot(null);
      setIsRenaming(false);
    },
    [setSelectedPartyId]
  );

  const onSelectCharacterToSlot = useCallback(
    async (character: CharacterRecord) => {
      if (selectedSlot === null || !selectedParty) return;
      await charactersRepository.assignToSlot(character.id, selectedSlot, selectedParty.party.id);
      setSelectedSlot(null);
      await loadData();
    },
    [loadData, selectedParty, selectedSlot]
  );

  const onClearSlot = useCallback(async () => {
    if (selectedSlot === null || !selectedParty) return;
    const current = selectedSlotMap.get(selectedSlot);
    if (current) {
      await charactersRepository.removeFromSlot(current.id, selectedParty.party.id);
    }
    setSelectedSlot(null);
    await loadData();
  }, [loadData, selectedParty, selectedSlot, selectedSlotMap]);

  const onQuickAssign = useCallback(
    async (character: CharacterRecord) => {
      if (!selectedParty || firstEmptySlot < 0) return;
      await charactersRepository.assignToSlot(character.id, firstEmptySlot, selectedParty.party.id);
      await loadData();
    },
    [firstEmptySlot, loadData, selectedParty]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{locale === "ja" ? "パーティ管理" : "Party Management"}</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => router.push("/inventory")}>
          <Package size={18} stroke={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>{locale === "ja" ? "パーティ編成" : "Party Setup"}</Text>
          <View style={styles.partyActions}>
            <Pressable style={styles.partyActionButton} onPress={() => void handleCreateParty()}>
              <Plus size={14} stroke={colors.textSecondary} />
            </Pressable>
            <Pressable
              style={styles.partyActionButton}
              onPress={() => {
                if (!selectedParty) return;
                setRenameInput(selectedParty.party.name);
                setIsRenaming(true);
              }}
              disabled={!selectedParty}
            >
              <Pencil size={14} stroke={selectedParty ? colors.textSecondary : colors.textDisabled} />
            </Pressable>
            <Pressable
              style={styles.partyActionButton}
              onPress={() => void handleDeleteParty()}
              disabled={!selectedParty || selectedParty.party.id === DEFAULT_PARTY_ID}
            >
              <Trash2
                size={14}
                stroke={!selectedParty || selectedParty.party.id === DEFAULT_PARTY_ID ? colors.textDisabled : colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partyChipRow}>
          {partiesWithMembers.map((entry) => {
            const active = entry.party.id === selectedPartyId;
            return (
              <Pressable
                key={entry.party.id}
                style={[styles.partyChip, active ? styles.partyChipActive : null]}
                onPress={() => onSelectParty(entry.party.id)}
              >
                <Text style={[styles.partyChipText, active ? styles.partyChipTextActive : null]}>{entry.party.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isRenaming && selectedParty ? (
          <View style={styles.renameRow}>
            <TextInput
              value={renameInput}
              onChangeText={setRenameInput}
              style={styles.renameInput}
              maxLength={20}
              placeholder={locale === "ja" ? "パーティ名" : "Party name"}
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={styles.renameCommit} onPress={() => void handleCommitRename()}>
              <Check size={15} stroke="#ffffff" />
            </Pressable>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
          {partySlots.map((character, index) => (
            <Pressable key={`slot-${index}`} style={styles.slotCard} onPress={() => setSelectedSlot(index)}>
              <View style={[styles.slotAvatar, !character ? styles.slotAvatarEmpty : null]}>
                {character ? (
                  <Image source={getClassById(character.classId).image} style={styles.slotAvatarImage} resizeMode="contain" />
                ) : (
                  <Shield size={12} stroke={colors.borderDefault} />
                )}
              </View>
              <Text style={character ? styles.slotLevel : styles.slotLevelEmpty}>
                {character ? `Lv${character.level}` : ""}
              </Text>
              <Text style={character ? styles.slotName : styles.slotNameEmpty} numberOfLines={1}>
                {character?.name ?? t("guild.party.empty")}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.availableHeader}>
          <Text style={styles.sectionLabel}>{locale === "ja" ? "未所属キャラクター" : "Unassigned Characters"}</Text>
          <Text style={styles.availableCount}>{locale === "ja" ? `${unassignedCharacters.length}人` : `${unassignedCharacters.length} members`}</Text>
        </View>

        <View style={styles.listWrap}>
          {unassignedCharacters.map((character) => (
            <View key={character.id} style={styles.listCard}>
              <View style={styles.listAvatar}>
                <Image source={getClassById(character.classId).image} style={styles.listAvatarImage} />
              </View>
              <View style={styles.listTextWrap}>
                <Text style={styles.listName}>{character.name}</Text>
                <Text style={styles.listSub}>{`${t(CLASS_NAME_KEYS[character.classId])}   Lv.${character.level}`}</Text>
              </View>
              <Pressable
                style={[styles.addButton, firstEmptySlot < 0 ? styles.addButtonDisabled : null]}
                onPress={() => void onQuickAssign(character)}
                disabled={firstEmptySlot < 0}
              >
                <Text style={styles.addButtonText}>{locale === "ja" ? "追加" : "Add"}</Text>
              </Pressable>
            </View>
          ))}
          {unassignedCharacters.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{locale === "ja" ? "未所属キャラクターはいません" : "No unassigned characters"}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <CharacterSelectModal
        visible={selectedSlot !== null}
        characters={slotModalCharacters}
        slotIndex={selectedSlot ?? 0}
        onSelect={onSelectCharacterToSlot}
        onClear={() => void onClearSlot()}
        onClose={() => setSelectedSlot(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: { alignItems: "center", flexDirection: "row", gap: 12 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  partyActions: { flexDirection: "row", gap: 8 },
  partyActionButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  partyChipRow: { gap: 8, paddingVertical: 2 },
  partyChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  partyChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  partyChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  partyChipTextActive: { color: "#ffffff" },
  renameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  renameInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  renameCommit: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.textPrimary,
  },
  slotRow: { flexDirection: "row", gap: 4, paddingVertical: 2 },
  slotCard: {
    width: 52,
    alignItems: "center",
    gap: 2,
    paddingVertical: 2,
  },
  slotAvatar: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  slotAvatarImage: { width: "122%", height: "122%" },
  slotAvatarEmpty: {
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  slotLevel: { color: colors.textTertiary, fontSize: 8, fontWeight: "500" },
  slotLevelEmpty: { color: colors.textDisabled, fontSize: 8, fontWeight: "500", minHeight: 10 },
  slotName: { color: colors.textPrimary, fontSize: 9, fontWeight: "600" },
  slotNameEmpty: { color: colors.textDisabled, fontSize: 9, fontWeight: "500" },
  availableHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingTop: 8 },
  availableCount: { color: colors.textTertiary, fontSize: 11 },
  listWrap: { gap: 8 },
  listCard: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    overflow: "hidden",
  },
  listAvatarImage: { width: "100%", height: "100%" },
  listTextWrap: { flex: 1, gap: 1 },
  listName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  listSub: { color: colors.textTertiary, fontSize: 10 },
  addButton: {
    borderRadius: 10,
    backgroundColor: "#1a1a1a",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addButtonDisabled: { backgroundColor: "#999999" },
  addButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  emptyWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingVertical: 18,
    alignItems: "center",
  },
  emptyText: { color: colors.textTertiary, fontSize: 13, fontWeight: "500" },
});
