import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  ChevronRight,
  Coins,
  Plus,
  User,
  UserPlus,
  Users,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getClassById } from "@/constants/classes";
import { getConstellationDisplayName } from "@/constants/constellations";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { TranslationKey, useI18n } from "@/i18n";
import { CharacterRecord } from "@/types/models";

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

type GuildTab = "hire" | "party";

const CLASS_NAME_KEYS: Record<CharacterRecord["classId"], TranslationKey> = {
  GUARDIAN: "class.name.guardian",
  SWORDMAN: "class.name.swordman",
  BERSERKER: "class.name.berserker",
  CLERIC: "class.name.cleric",
  WITCH: "class.name.witch",
  THIEF: "class.name.thief",
};

export default function GuildScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<GuildTab>("hire");
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);

  const loadCharacters = useCallback(async () => {
    const list = await charactersRepository.list();
    setCharacters(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCharacters();
    }, [loadCharacters])
  );

  const mainParty = useMemo(() => {
    const slotMap = new Map<number, CharacterRecord>();
    for (const c of characters) {
      if (c.slotIndex !== null) slotMap.set(c.slotIndex, c);
    }
    const members = Array.from({ length: 6 }).map((_, idx) => slotMap.get(idx) ?? null);
    const assigned = members.filter((member): member is CharacterRecord => member !== null);
    const minLevel = assigned.length > 0 ? Math.min(...assigned.map((member) => member.level)) : null;
    const maxLevel = assigned.length > 0 ? Math.max(...assigned.map((member) => member.level)) : null;
    const sub = assigned.length > 0 && minLevel !== null && maxLevel !== null
      ? `Lv.${minLevel}-${maxLevel} • ${assigned.length}/6`
      : `0/6`;
    return {
      title: t("party.header.title"),
      sub,
      members,
    };
  }, [characters, t]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>{t("guild.header.sub")}</Text>
          <Text style={styles.headerTitle}>{t("guild.header.title")}</Text>
        </View>
        <View style={styles.currencyChip}>
          <Coins size={14} stroke={colors.textSecondary} />
          <Text style={styles.currencyText}>12,500</Text>
        </View>
      </View>

      <View style={styles.tabSwitchWrap}>
        <Pressable style={styles.tabSwitchItem} onPress={() => setActiveTab("hire")}>
          <Text style={[styles.tabSwitchText, activeTab === "hire" ? styles.tabSwitchTextActive : null]}>
            {t("guild.tab.hire")}
          </Text>
          <View style={[styles.tabSwitchBorder, activeTab === "hire" ? styles.tabSwitchBorderActive : null]} />
        </Pressable>
        <Pressable style={styles.tabSwitchItem} onPress={() => setActiveTab("party")}>
          <Text style={[styles.tabSwitchText, activeTab === "party" ? styles.tabSwitchTextActive : null]}>
            {t("guild.tab.party")}
          </Text>
          <View style={[styles.tabSwitchBorder, activeTab === "party" ? styles.tabSwitchBorderActive : null]} />
        </Pressable>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "hire" ? (
          <>
            <Text style={styles.sectionLabel}>{t("guild.section.hire")}</Text>
            {characters.map((character) => (
              <Pressable
                key={character.id}
                style={({ pressed }) => [styles.listCard, pressed ? styles.listCardPressed : null]}
                onPress={() => router.push(`/characters/${character.id}`)}
              >
                <View style={styles.avatarCircle}>
                  <Image source={getClassById(character.classId).image} style={styles.avatarImage} />
                </View>
                <View style={styles.listTextWrap}>
                  <Text style={styles.listTitle}>{character.name}</Text>
                  <Text style={styles.listSub}>{`${t(CLASS_NAME_KEYS[character.classId])}  •  Lv.${character.level}`}</Text>
                  <Text style={styles.listMeta}>{getConstellationDisplayName(character.constellationId, locale)}</Text>
                </View>
                <ChevronRight size={18} stroke={colors.iconSecondary} />
              </Pressable>
            ))}
            {characters.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>{t("guild.hire.empty")}</Text>
              </View>
            ) : null}
            <Pressable style={({ pressed }) => [styles.createButton, pressed ? styles.listCardPressed : null]} onPress={() => router.push("/guild/hire")}>
              <UserPlus size={18} stroke={colors.iconSecondary} />
              <Text style={styles.createButtonText}>{t("guild.hire.create")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>{t("guild.section.party")}</Text>
            <Pressable
              style={({ pressed }) => [styles.partyCard, pressed ? styles.listCardPressed : null]}
              onPress={() => router.push("/party")}
            >
              <View style={styles.partyTopRow}>
                <View style={styles.partyLeftWrap}>
                  <View style={styles.partyIconWrap}>
                    <Users size={18} stroke={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.partyTitle}>{mainParty.title}</Text>
                    <Text style={styles.partySub}>{mainParty.sub}</Text>
                  </View>
                </View>
                <ChevronRight size={18} stroke={colors.iconSecondary} />
              </View>
              <View style={styles.membersRow}>
                {mainParty.members.map((member, idx) => {
                  const empty = member === null;
                  return (
                    <View key={`party-member-${idx}`} style={styles.memberItem}>
                      <View style={[styles.memberAvatar, empty ? styles.memberAvatarEmpty : null]}>
                        {empty ? (
                          <Plus size={12} stroke={colors.borderStrong} />
                        ) : (
                          <Image source={getClassById(member.classId).image} style={styles.memberAvatarImage} />
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
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.createButton, pressed ? styles.listCardPressed : null]}
              onPress={() => router.push("/party")}
            >
              <Plus size={18} stroke={colors.iconSecondary} />
              <Text style={styles.createButtonText}>{t("guild.party.create")}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingRight: 20,
    paddingBottom: 12,
    paddingLeft: 20,
  },
  headerSub: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
  currencyChip: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 12,
  },
  currencyText: { color: colors.textPrimary, fontSize: 12, fontWeight: "500" },
  tabSwitchWrap: { flexDirection: "row", paddingHorizontal: 20 },
  tabSwitchItem: { flex: 1, alignItems: "center" },
  tabSwitchText: { color: colors.textMuted, fontSize: 14, fontWeight: "500", paddingTop: 10, paddingBottom: 10 },
  tabSwitchTextActive: { color: colors.textPrimary, fontWeight: "700" },
  tabSwitchBorder: { height: 1, width: "100%", backgroundColor: colors.borderDefault },
  tabSwitchBorderActive: { height: 2, backgroundColor: colors.textPrimary },
  contentScroll: { flex: 1 },
  content: { padding: 20, gap: 12 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  listCard: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  listCardPressed: { opacity: 0.8 },
  avatarCircle: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 60, height: 60 },
  listTextWrap: { flex: 1, gap: 2 },
  listTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  listSub: { color: colors.textTertiary, fontSize: 10, fontWeight: "400" },
  listMeta: { color: colors.textMuted, fontSize: 10, fontWeight: "400" },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingVertical: 24,
  },
  emptyText: { color: colors.textTertiary, fontSize: 13, fontWeight: "500" },
  createButton: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  createButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  partyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 12,
    padding: 16,
  },
  partyTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  partyLeftWrap: { alignItems: "center", flexDirection: "row", gap: 10 },
  partyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  partyTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  partySub: { color: colors.textTertiary, fontSize: 10, fontWeight: "500" },
  membersRow: { flexDirection: "row", gap: 6 },
  memberItem: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 6 },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
    overflow: "hidden",
  },
  memberAvatarImage: { width: "100%", height: "100%" },
  memberAvatarEmpty: { backgroundColor: colors.bgPrimary, borderWidth: 1, borderColor: colors.borderStrong },
  memberLevel: { color: colors.textTertiary, fontSize: 8, fontWeight: "500" },
  memberLevelEmpty: { color: colors.textDisabled, fontSize: 8, fontWeight: "500", minHeight: 10 },
  memberName: { color: colors.textPrimary, fontSize: 9, fontWeight: "600" },
  memberNameEmpty: { color: colors.textDisabled, fontSize: 9, fontWeight: "500" },
});
