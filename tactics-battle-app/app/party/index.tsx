import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Bell, Plus, User } from "lucide-react-native";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CharacterSelectModal } from "@/components/party/CharacterSelectModal";
import { getClassById } from "@/constants/classes";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { useI18n } from "@/i18n";
import { CharacterRecord } from "@/types/models";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgElevated: "#e5e5e5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  borderDefault: "#e0e0e0",
  iconSecondary: "#999999",
} as const;

export default function PartyScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const load = useCallback(async () => {
    const list = await charactersRepository.list();
    setCharacters(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const slotMap = useMemo(() => {
    const map = new Map<number, CharacterRecord>();
    for (const c of characters) {
      if (c.slotIndex !== null) map.set(c.slotIndex, c);
    }
    return map;
  }, [characters]);

  const partyMembers = Array.from({ length: 6 }).map((_, i) => slotMap.get(i));
  const available = characters.filter((c) => c.slotIndex === null);
  const assignedCount = partyMembers.filter(Boolean).length;
  const firstEmptySlotIndex = partyMembers.findIndex((member) => !member);

  const onSelectCharacter = async (character: CharacterRecord) => {
    if (selectedSlot === null) return;
    await charactersRepository.assignToSlot(character.id, selectedSlot);
    await load();
    setSelectedSlot(null);
  };

  const onClearSlot = async () => {
    if (selectedSlot === null) return;
    const current = slotMap.get(selectedSlot);
    if (current) {
      await charactersRepository.removeFromSlot(current.id);
      await load();
    }
    setSelectedSlot(null);
  };

  const onAddToFirstEmptySlot = async (character: CharacterRecord) => {
    if (firstEmptySlotIndex < 0) return;
    await charactersRepository.assignToSlot(character.id, firstEmptySlotIndex);
    await load();
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("party.header.title")}</Text>
        </View>
        <View style={styles.iconBtnDisabled}>
          <Bell size={18} stroke={colors.iconSecondary} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t("party.section.current")}</Text>

        <View style={styles.slotGrid}>
          {partyMembers.map((character, index) => (
            <Pressable key={index} style={styles.slotCard} onPress={() => setSelectedSlot(index)}>
              <View style={[styles.slotAvatar, !character ? styles.slotAvatarEmpty : null]}>
                {character ? (
                  <Image source={getClassById(character.classId).image} style={styles.slotAvatarImage} />
                ) : (
                  <Plus size={18} stroke={colors.iconSecondary} />
                )}
              </View>
              <Text style={character ? styles.slotName : styles.slotNameEmpty} numberOfLines={1}>
                {character?.name ?? t("guild.party.empty")}
              </Text>
              <Text style={character ? styles.slotSub : styles.slotSubEmpty} numberOfLines={1}>
                {character ? `${getClassById(character.classId).name} • Lv.${character.level}` : ""}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.availableHeader}>
          <Text style={styles.sectionLabel}>{t("party.section.available")}</Text>
          <Text style={styles.availableCount}>{t("party.available.count", { count: available.length })}</Text>
        </View>

        <View style={styles.listWrap}>
          {available.map((character) => (
            <View key={character.id} style={styles.listCard}>
              <View style={styles.listAvatar}>
                <Image source={getClassById(character.classId).image} style={styles.listAvatarImage} />
              </View>
              <View style={styles.listTextWrap}>
                <Text style={styles.listName}>{character.name}</Text>
                <Text style={styles.listSub}>{`${getClassById(character.classId).name}   Lv.${character.level}`}</Text>
              </View>
              <Pressable
                style={[styles.addButton, firstEmptySlotIndex < 0 ? styles.addButtonDisabled : null]}
                onPress={() => onAddToFirstEmptySlot(character)}
                disabled={firstEmptySlotIndex < 0}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            </View>
          ))}
          {available.length === 0 ? (
            <View style={styles.emptyWrap}>
              <User size={16} stroke={colors.iconSecondary} />
              <Text style={styles.emptyText}>No available adventurers</Text>
            </View>
          ) : null}
          {assignedCount >= 6 ? (
            <Text style={styles.hintText}>Party is full. Tap a slot to replace a member.</Text>
          ) : null}
        </View>
      </ScrollView>

      <CharacterSelectModal
        visible={selectedSlot !== null}
        characters={characters}
        slotIndex={selectedSlot ?? 0}
        onSelect={onSelectCharacter}
        onClear={onClearSlot}
        onClose={() => setSelectedSlot(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 20,
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
  iconBtnDisabled: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
  },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 16, paddingTop: 12 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slotCard: {
    width: "31.5%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 4,
    minHeight: 94,
    justifyContent: "center",
  },
  slotAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    overflow: "hidden",
  },
  slotAvatarImage: { width: "100%", height: "100%" },
  slotAvatarEmpty: {
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: "#d0d0d0",
  },
  slotName: { color: colors.textPrimary, fontSize: 11, fontWeight: "600" },
  slotNameEmpty: { color: colors.textTertiary, fontSize: 11, fontWeight: "500" },
  slotSub: { color: colors.textTertiary, fontSize: 8 },
  slotSubEmpty: { color: colors.textTertiary, fontSize: 8, minHeight: 10 },
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
    paddingHorizontal: 16,
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
  listName: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
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
    gap: 6,
  },
  emptyText: { color: colors.textTertiary, fontSize: 12 },
  hintText: { color: colors.textTertiary, fontSize: 11, paddingTop: 2 },
});
