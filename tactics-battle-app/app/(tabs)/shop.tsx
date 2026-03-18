import { ReactNode, useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Coins, Settings, Shield, Sword, TentTree, Users } from "lucide-react-native";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { charactersRepository, DEFAULT_PARTY_ID } from "@/db/repositories/charactersRepository";
import { partiesRepository } from "@/db/repositories/partiesRepository";
import { walletRepository } from "@/db/repositories/walletRepository";
import { tavernService } from "@/features/guild/tavernService";
import { useI18n } from "@/i18n";
import { parchment, parchmentImages, parchmentShadow } from "@/theme/parchment";

type TownCard = {
  key: string;
  title: string;
  description: string;
  meta: string;
  icon: ReactNode;
  href: "/shop/equipment" | "/shop/consumable" | "/guild" | "/tavern" | "/dungeon" | "/more";
};

export default function ShopHubScreen() {
  const router = useRouter();
  const { locale } = useI18n();
  const [walletGold, setWalletGold] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [tavernCount, setTavernCount] = useState(0);
  const [partyCount, setPartyCount] = useState(0);

  const load = useCallback(async () => {
    const [wallet, characters, tavern, parties] = await Promise.all([
      walletRepository.getMainWallet(),
      charactersRepository.list(DEFAULT_PARTY_ID),
      tavernService.getTavernState(),
      partiesRepository.listWithMembers(),
    ]);
    setWalletGold(wallet.gold);
    setCharacterCount(characters.length);
    setTavernCount(tavern.candidates.length);
    setPartyCount(parties.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const cards = useMemo<TownCard[]>(
    () => [
      {
        key: "equipment",
        title: locale === "ja" ? "武器防具屋" : "Weapon & Armor",
        description: locale === "ja" ? "装備を購入して戦力を整える" : "Buy equipment for your roster",
        meta: locale === "ja" ? "装備売場" : "Armory",
        icon: <Sword size={20} stroke={parchment.gold} />,
        href: "/shop/equipment",
      },
      {
        key: "consumable",
        title: locale === "ja" ? "道具屋" : "Item Shop",
        description: locale === "ja" ? "消耗品と補給を確認する" : "Check consumables and supplies",
        meta: locale === "ja" ? "消耗品" : "Supplies",
        icon: <Shield size={20} stroke={parchment.gold} />,
        href: "/shop/consumable",
      },
      {
        key: "tavern",
        title: locale === "ja" ? "酒場" : "Tavern",
        description: locale === "ja" ? "雇用候補の冒険者を確認する" : "Review hireable adventurers",
        meta: locale === "ja" ? `${tavernCount}人が滞在中` : `${tavernCount} candidates`,
        icon: <TentTree size={20} stroke={parchment.gold} />,
        href: "/tavern",
      },
      {
        key: "guild",
        title: locale === "ja" ? "ギルド" : "Guild",
        description: locale === "ja" ? "所属冒険者の状態を管理する" : "Manage your registered adventurers",
        meta: locale === "ja" ? `${characterCount}人在籍` : `${characterCount} adventurers`,
        icon: <Users size={20} stroke={parchment.gold} />,
        href: "/guild",
      },
      {
        key: "dungeon",
        title: locale === "ja" ? "探索準備" : "Exploration",
        description: locale === "ja" ? "パーティを編成してダンジョンへ向かう" : "Prepare parties for the dungeon",
        meta: locale === "ja" ? `${partyCount}PT 編成済み` : `${partyCount} parties ready`,
        icon: <Shield size={20} stroke={parchment.gold} />,
        href: "/dungeon",
      },
      {
        key: "settings",
        title: locale === "ja" ? "設定" : "Settings",
        description: locale === "ja" ? "言語やデバッグ項目を調整する" : "Adjust language and debug settings",
        meta: locale === "ja" ? "システム" : "System",
        icon: <Settings size={20} stroke={parchment.gold} />,
        href: "/more",
      },
    ],
    [characterCount, locale, partyCount, tavernCount]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ImageBackground source={parchmentImages.townHeader} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{locale === "ja" ? "クレストリア" : "Crestoria"}</Text>
            <Text style={styles.heroSub}>{locale === "ja" ? "Arcadia - 冒険者の街" : "Arcadia - Adventurer's Quarter"}</Text>
          </View>
        </ImageBackground>

        <View style={styles.infoBar}>
          <View style={styles.infoLeft}>
            <Coins size={14} stroke={parchment.gold} />
            <Text style={styles.infoValue}>{walletGold.toLocaleString()} G</Text>
          </View>
          <Text style={styles.infoMeta}>
            {locale === "ja" ? `${characterCount}人 / ${partyCount}PT` : `${characterCount} members / ${partyCount} parties`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{locale === "ja" ? "施設" : "Facilities"}</Text>
          {cards.map((card) => (
            <Pressable key={card.key} style={styles.card} onPress={() => router.push(card.href)}>
              <View style={styles.cardIcon}>{card.icon}</View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardDesc}>{card.description}</Text>
              </View>
              <Text style={styles.cardMeta}>{card.meta}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: parchment.background,
  },
  content: {
    paddingBottom: 24,
  },
  hero: {
    height: 200,
    justifyContent: "flex-end",
  },
  heroImage: {
    resizeMode: "cover",
  },
  heroOverlay: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "rgba(26, 14, 5, 0.32)",
  },
  heroTitle: {
    color: "#f5ede0",
    fontSize: 28,
    fontWeight: "700",
  },
  heroSub: {
    color: "#e8dcc8",
    fontSize: 12,
    marginTop: 2,
  },
  infoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: parchment.headerBar,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoValue: {
    color: parchment.gold,
    fontSize: 12,
    fontWeight: "700",
  },
  infoMeta: {
    color: "#e8dcc8",
    fontSize: 11,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  sectionLabel: {
    color: parchment.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  card: {
    ...parchmentShadow,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    backgroundColor: parchment.surfaceMuted,
    padding: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(59, 46, 30, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: parchment.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  cardDesc: {
    color: parchment.inkSoft,
    fontSize: 12,
  },
  cardMeta: {
    color: parchment.inkMuted,
    fontSize: 10,
    maxWidth: 84,
    textAlign: "right",
  },
});
