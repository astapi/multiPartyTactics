import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Coins, Droplets, FlaskRound, ShieldPlus } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { shopConsumableRepository } from "@/db/repositories/shopConsumableRepository";
import { walletRepository } from "@/db/repositories/walletRepository";
import { getConsumableById } from "@/game/consumable/consumableMasterService";
import { useI18n } from "@/i18n";
import { parchment, parchmentImages, parchmentShadow } from "@/theme/parchment";
import type { ConsumableCategory, ConsumableShopCatalogItem } from "@/types/consumable";

type ShopTab = "healing" | "mana" | "cure";

const TAB_TO_CATEGORY: Record<ShopTab, ConsumableCategory> = {
  healing: "healing_potion",
  mana: "mana_potion",
  cure: "status_cure",
};

type ShopViewRow = ConsumableShopCatalogItem & {
  name: string;
  category: ConsumableCategory;
};

const TabIcon = ({ tab, size, stroke }: { tab: ShopTab; size: number; stroke: string }) => {
  switch (tab) {
    case "healing":
      return <FlaskRound size={size} stroke={stroke} />;
    case "mana":
      return <Droplets size={size} stroke={stroke} />;
    case "cure":
      return <ShieldPlus size={size} stroke={stroke} />;
  }
};

const CategoryIcon = ({ category }: { category: ConsumableCategory }) => {
  switch (category) {
    case "healing_potion":
      return <FlaskRound size={18} stroke="#ffffff" />;
    case "mana_potion":
      return <Droplets size={18} stroke="#ffffff" />;
    case "status_cure":
      return <ShieldPlus size={18} stroke="#ffffff" />;
  }
};

export default function ConsumableShopScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<ShopTab>("healing");
  const [walletGold, setWalletGold] = useState(0);
  const [items, setItems] = useState<ShopViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wallet, catalog] = await Promise.all([
        walletRepository.getMainWallet(),
        shopConsumableRepository.listCatalogWithOwnedCounts(),
      ]);
      const rows: ShopViewRow[] = catalog.map((row) => {
        const item = getConsumableById(row.itemId);
        return {
          ...row,
          name: locale === "ja" ? item.jp : item.en,
          category: item.category,
        };
      });
      setWalletGold(wallet.gold);
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filteredItems = useMemo(
    () => items.filter((item) => item.category === TAB_TO_CATEGORY[tab]),
    [items, tab]
  );

  const onBuy = useCallback(
    async (itemId: string) => {
      if (buyingItemId) return;
      setBuyingItemId(itemId);
      try {
        const result = await shopConsumableRepository.purchase(itemId);
        if (!result.ok) {
          Alert.alert(
            locale === "ja" ? "ゴールド不足" : "Insufficient Gold",
            locale === "ja"
              ? `必要: ${result.priceGold}G / 所持: ${result.walletGold}G`
              : `Need: ${result.priceGold}G / Have: ${result.walletGold}G`
          );
          return;
        }
        await load();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Alert.alert(
          locale === "ja" ? "購入失敗" : "Purchase Failed",
          locale === "ja" ? `購入に失敗しました。\n${message}` : `Failed to purchase item.\n${message}`
        );
      } finally {
        setBuyingItemId(null);
      }
    },
    [buyingItemId, load, locale]
  );

  const tabs: ShopTab[] = ["healing", "mana", "cure"];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground source={parchmentImages.itemShopHeader} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroOverlay}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable style={styles.iconBtn} onPress={() => router.back()}>
                <ArrowLeft size={18} stroke="#f5ede0" />
              </Pressable>
              <View>
                <Text style={styles.heroTitle}>{locale === "ja" ? "道具屋" : "Item Shop"}</Text>
                <Text style={styles.heroSub}>{t("shop.consumable.header")}</Text>
              </View>
            </View>
            <View style={styles.iconBtn}>
              <FlaskRound size={16} stroke={parchment.gold} />
            </View>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.tabs}>
        {tabs.map((tabKey) => (
          <Pressable key={tabKey} style={styles.tabItem} onPress={() => setTab(tabKey)}>
            <Text style={[styles.tabText, tab === tabKey ? styles.tabTextActive : null]}>
              {t(`shop.consumable.tab.${tabKey}`)}
            </Text>
            <View style={[styles.tabBorder, tab === tabKey ? styles.tabBorderActive : null]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.goldBar}>
        <View style={styles.goldPill}>
          <Coins size={14} stroke={parchment.gold} />
          <Text style={styles.goldText}>{t("shop.consumable.gold", { amount: walletGold.toLocaleString() })}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.emptyText}>{locale === "ja" ? "読み込み中..." : "Loading..."}</Text>
        ) : filteredItems.length === 0 ? (
          <Text style={styles.emptyText}>{t("shop.consumable.empty")}</Text>
        ) : (
          filteredItems.map((item) => (
            <View key={item.itemId} style={styles.itemCard}>
              <View style={styles.itemIcon}>
                <CategoryIcon category={item.category} />
              </View>
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>{t("shop.consumable.owned", { count: item.ownedQuantity })}</Text>
              </View>
              <View style={styles.priceWrap}>
                <Text style={styles.price}>{t("shop.consumable.gold", { amount: item.priceGold.toLocaleString() })}</Text>
                <Pressable
                  style={[styles.buyButton, buyingItemId === item.itemId ? styles.buyButtonDisabled : null]}
                  onPress={() => void onBuy(item.itemId)}
                  disabled={Boolean(buyingItemId)}
                >
                  <Text style={styles.buy}>{t("shop.consumable.buy")}</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: parchment.background },
  hero: { height: 140, justifyContent: "flex-end" },
  heroImage: { resizeMode: "cover" },
  heroOverlay: { backgroundColor: "rgba(26, 14, 5, 0.42)" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 16, paddingHorizontal: 20 },
  headerLeft: { alignItems: "center", flexDirection: "row", gap: 12 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(59, 46, 30, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(196, 168, 112, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#f5ede0", fontSize: 24, fontWeight: "700" },
  heroSub: { color: "#e8dcc8", fontSize: 12, marginTop: 2 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, backgroundColor: parchment.background },
  tabItem: { flex: 1, alignItems: "center" },
  tabText: { color: parchment.inkMuted, fontSize: 13, fontWeight: "500", paddingVertical: 10 },
  tabTextActive: { color: parchment.ink, fontWeight: "700" },
  tabBorder: { width: "100%", height: 1, backgroundColor: parchment.goldLine },
  tabBorderActive: { height: 2, backgroundColor: parchment.borderStrong },
  goldBar: { alignItems: "stretch", paddingHorizontal: 16, paddingTop: 8 },
  goldPill: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: parchment.headerBar,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  goldText: { color: parchment.gold, fontSize: 12, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
  itemCard: {
    ...parchmentShadow,
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    backgroundColor: parchment.surfaceMuted,
    gap: 12,
    padding: 12,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 46, 30, 0.18)",
  },
  itemTextWrap: { flex: 1, gap: 2 },
  itemName: { color: parchment.ink, fontSize: 15, fontWeight: "700" },
  itemSub: { color: parchment.inkSoft, fontSize: 11 },
  priceWrap: { alignItems: "flex-end", gap: 6 },
  price: { color: parchment.ink, fontSize: 12, fontWeight: "700" },
  buyButton: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: parchment.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: parchment.headerBar,
  },
  buyButtonDisabled: {
    opacity: 0.5,
  },
  buy: { color: "#f5ede0", fontSize: 11, fontWeight: "700" },
  emptyText: { color: parchment.inkSoft, fontSize: 12, paddingTop: 8 },
});
