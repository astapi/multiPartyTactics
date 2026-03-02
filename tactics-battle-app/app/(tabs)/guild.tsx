import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, Coins, Package, UserPlus } from "lucide-react-native";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getClassById } from "@/constants/classes";
import { getConstellationDisplayName } from "@/constants/constellations";
import { charactersRepository, DEFAULT_PARTY_ID } from "@/db/repositories/charactersRepository";
import { partiesRepository } from "@/db/repositories/partiesRepository";
import { walletRepository } from "@/db/repositories/walletRepository";
import { TranslationKey, useI18n } from "@/i18n";
import { CharacterRecord, PartyWithMembers } from "@/types/models";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  textMuted: "#aaaaaa",
  borderDefault: "#e0e0e0",
  iconSecondary: "#999999",
} as const;

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

  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [partiesWithMembers, setPartiesWithMembers] = useState<PartyWithMembers[]>([]);
  const [walletGold, setWalletGold] = useState(0);

  const loadScreenData = useCallback(async () => {
    const [list, parties, wallet] = await Promise.all([
      charactersRepository.list(DEFAULT_PARTY_ID),
      partiesRepository.listWithMembers(),
      walletRepository.getMainWallet(),
    ]);
    setCharacters(list);
    setPartiesWithMembers(parties);
    setWalletGold(wallet.gold);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadScreenData();
    }, [loadScreenData])
  );

  const assignmentByCharacterId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of partiesWithMembers) {
      for (const member of entry.members) {
        map.set(member.id, entry.party.name);
      }
    }
    return map;
  }, [partiesWithMembers]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>{t("guild.header.sub")}</Text>
          <Text style={styles.headerTitle}>{t("guild.header.title")}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.inventoryButton} onPress={() => router.push("/inventory")}>
            <Package size={14} stroke={colors.textSecondary} />
            <Text style={styles.inventoryButtonText}>{locale === "ja" ? "倉庫" : "Inventory"}</Text>
          </Pressable>
          <View style={styles.currencyChip}>
            <Coins size={14} stroke={colors.textSecondary} />
            <Text style={styles.currencyText}>{walletGold.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.createWrap}>
        <Pressable
          style={({ pressed }) => [styles.createButton, pressed ? styles.createButtonPressed : null]}
          onPress={() => router.push("/guild/hire")}
        >
          <UserPlus size={18} stroke="#ffffff" />
          <Text style={styles.createButtonText}>{t("guild.hire.create")}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{locale === "ja" ? "キャラクター管理" : "Character Management"}</Text>

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
            <View style={styles.assignmentWrap}>
              <Text style={styles.assignmentText} numberOfLines={1}>
                {assignmentByCharacterId.get(character.id) ?? (locale === "ja" ? "未所属" : "Unassigned")}
              </Text>
              <ChevronRight size={18} stroke={colors.iconSecondary} />
            </View>
          </Pressable>
        ))}

        {characters.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t("guild.hire.empty")}</Text>
          </View>
        ) : null}
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  inventoryButton: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  inventoryButtonText: { color: colors.textPrimary, fontSize: 11, fontWeight: "600" },
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
  createWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  createButton: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: colors.textPrimary,
    gap: 8,
    paddingVertical: 12,
  },
  createButtonPressed: { opacity: 0.82 },
  createButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  contentScroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
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
    paddingHorizontal: 12,
  },
  listCardPressed: { opacity: 0.8 },
  avatarCircle: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 56, height: 56 },
  listTextWrap: { flex: 1, gap: 2 },
  listTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  listSub: { color: colors.textTertiary, fontSize: 10, fontWeight: "400" },
  listMeta: { color: colors.textMuted, fontSize: 10, fontWeight: "400" },
  assignmentWrap: { alignItems: "flex-end", gap: 4 },
  assignmentText: { color: colors.textTertiary, fontSize: 10, maxWidth: 100 },
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
});
