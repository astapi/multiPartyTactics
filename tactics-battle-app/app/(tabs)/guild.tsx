import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Coins, Package } from "lucide-react-native";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getClassById } from "@/constants/classes";
import { getConstellationDisplayName } from "@/constants/constellations";
import { charactersRepository, DEFAULT_PARTY_ID } from "@/db/repositories/charactersRepository";
import { partiesRepository } from "@/db/repositories/partiesRepository";
import { walletRepository } from "@/db/repositories/walletRepository";
import { TranslationKey, useI18n } from "@/i18n";
import { parchment, parchmentImages, parchmentShadow } from "@/theme/parchment";
import { CharacterRecord, PartyWithMembers } from "@/types/models";

const CLASS_NAME_KEYS: Record<CharacterRecord["classId"], TranslationKey> = {
  GUARDIAN: "class.name.guardian",
  SWORDMAN: "class.name.swordman",
  BERSERKER: "class.name.berserker",
  CLERIC: "class.name.cleric",
  WITCH: "class.name.witch",
  THIEF: "class.name.thief",
  PORTER: "class.name.porter",
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ImageBackground source={parchmentImages.guildHeader} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay}>
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.heroTitle}>{locale === "ja" ? "冒険者ギルド" : "Adventurers Guild"}</Text>
                <Text style={styles.heroSub}>{locale === "ja" ? "登録済み冒険者の管理" : "Registered Adventurers"}</Text>
              </View>
              <Pressable style={styles.inventoryButton} onPress={() => router.push("/inventory")}>
                <Package size={14} stroke="#f5ede0" />
                <Text style={styles.inventoryButtonText}>{locale === "ja" ? "倉庫" : "Inventory"}</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.infoBar}>
          <View style={styles.infoLeft}>
            <Coins size={14} stroke={parchment.gold} />
            <Text style={styles.infoGold}>{walletGold.toLocaleString()} G</Text>
          </View>
          <Text style={styles.infoText}>
            {locale === "ja" ? `${characters.length}人在籍` : `${characters.length} adventurers`}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{locale === "ja" ? "所属冒険者" : "Registered Adventurers"}</Text>
          {characters.map((character) => (
            <Pressable
              key={character.id}
              style={styles.characterCard}
              onPress={() => router.push(`/characters/${character.id}`)}
            >
              <Image source={getClassById(character.classId).image} style={styles.characterAvatar} resizeMode="contain" />
              <View style={styles.characterText}>
                <Text style={styles.characterName}>{character.name}</Text>
                <Text style={styles.characterMeta}>{`${t(CLASS_NAME_KEYS[character.classId])} • Lv.${character.level} • ${character.age}歳`}</Text>
                <Text style={styles.characterMeta}>{getConstellationDisplayName(character.constellationId, locale)}</Text>
              </View>
              <Text style={styles.assignmentText}>
                {assignmentByCharacterId.get(character.id) ?? (locale === "ja" ? "未所属" : "Unassigned")}
              </Text>
            </Pressable>
          ))}
          {characters.length === 0 ? <Text style={styles.emptyText}>{t("guild.hire.empty")}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: parchment.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },
  hero: { height: 140, justifyContent: "flex-end" },
  heroImage: { resizeMode: "cover" },
  heroOverlay: { backgroundColor: "rgba(26, 14, 5, 0.42)" },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", padding: 20 },
  heroTitle: { color: "#f5ede0", fontSize: 24, fontWeight: "700" },
  heroSub: { color: "#e8dcc8", fontSize: 12, marginTop: 2 },
  inventoryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(59, 46, 30, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(196, 168, 112, 0.5)",
  },
  inventoryButtonText: { color: "#f5ede0", fontSize: 11, fontWeight: "700" },
  infoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: parchment.headerBar,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoGold: { color: parchment.gold, fontSize: 12, fontWeight: "700" },
  infoText: { color: "#e8dcc8", fontSize: 11 },
  divider: {
    height: 18,
    marginHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: parchment.goldLine,
  },
  section: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  sectionLabel: { color: parchment.inkSoft, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  characterCard: {
    ...parchmentShadow,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    backgroundColor: parchment.surfaceMuted,
  },
  characterAvatar: { width: 52, height: 52 },
  characterText: { flex: 1, gap: 2 },
  characterName: { color: parchment.ink, fontSize: 15, fontWeight: "700" },
  characterMeta: { color: parchment.inkSoft, fontSize: 11 },
  assignmentText: { color: parchment.inkMuted, fontSize: 10, maxWidth: 90, textAlign: "right" },
  emptyText: { color: parchment.inkSoft, fontSize: 12, paddingVertical: 12, textAlign: "center" },
});
