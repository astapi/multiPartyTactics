import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, GripVertical, Plus, User } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CharacterSelectModal } from "@/components/party/CharacterSelectModal";
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

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("party.header.title")}</Text>
        </View>
        <View style={styles.iconBtnDisabled}>
          <GripVertical size={16} stroke={colors.iconSecondary} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t("party.section.current")}</Text>

        <View style={styles.slotGrid}>
          {partyMembers.map((character, index) => (
            <Pressable key={index} style={styles.slotCard} onPress={() => setSelectedSlot(index)}>
              <View style={styles.slotTop}>
                <View style={styles.slotAvatar}>{character ? <User size={16} stroke={colors.textSecondary} /> : <Plus size={16} stroke={colors.iconSecondary} />}</View>
                <View style={styles.slotTextWrap}>
                  <Text style={styles.slotName}>{character?.name ?? t("party.slot.empty")}</Text>
                  <Text style={styles.slotSub}>{character ? `${character.classId}  •  Lv.${character.level}` : t("party.slot.tap")}</Text>
                </View>
                <ChevronRight size={16} stroke={colors.iconSecondary} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.availableHeader}>
          <Text style={styles.sectionLabel}>{t("party.section.available")}</Text>
          <Text style={styles.availableCount}>{t("party.available.count", { count: available.length })}</Text>
        </View>

        <View style={styles.listWrap}>
          {available.slice(0, 3).map((character) => (
            <Pressable key={character.id} style={styles.listCard} onPress={() => setSelectedSlot(0)}>
              <View style={styles.listAvatar}>
                <User size={18} stroke={colors.textSecondary} />
              </View>
              <View style={styles.listTextWrap}>
                <Text style={styles.listName}>{character.name}</Text>
                <Text style={styles.listSub}>{`${character.classId}  •  Lv.${character.level}`}</Text>
              </View>
              <ChevronRight size={18} stroke={colors.iconSecondary} />
            </Pressable>
          ))}
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
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  slotGrid: { gap: 8 },
  slotCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    padding: 12,
  },
  slotTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  slotAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  slotTextWrap: { flex: 1, gap: 2 },
  slotName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  slotSub: { color: colors.textTertiary, fontSize: 10 },
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
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  listTextWrap: { flex: 1, gap: 2 },
  listName: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  listSub: { color: colors.textTertiary, fontSize: 10 },
});
