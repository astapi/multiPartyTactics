import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Coins, Droplets, FlaskRound, ShieldPlus } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { shopConsumableRepository } from "@/db/repositories/shopConsumableRepository";
import { walletRepository } from "@/db/repositories/walletRepository";
import { getConsumableById } from "@/game/consumable/consumableMasterService";
import { useI18n } from "@/i18n";
import type { ConsumableCategory, ConsumableShopCatalogItem } from "@/types/consumable";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  borderDefault: "#e0e0e0",
} as const;

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
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("shop.consumable.header")}</Text>
        </View>
        <View style={styles.iconBtn}>
          <FlaskRound size={16} stroke={colors.textTertiary} />
        </View>
      </View>

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
          <Coins size={14} stroke={colors.textSecondary} />
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
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 20 },
  headerLeft: { alignItems: "center", flexDirection: "row", gap: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.bgSurface, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  tabs: { flexDirection: "row", paddingHorizontal: 20 },
  tabItem: { flex: 1, alignItems: "center" },
  tabText: { color: colors.textTertiary, fontSize: 14, fontWeight: "500", paddingVertical: 10 },
  tabTextActive: { color: colors.textPrimary, fontWeight: "700" },
  tabBorder: { width: "100%", height: 1, backgroundColor: colors.borderDefault },
  tabBorderActive: { height: 2, backgroundColor: colors.textPrimary },
  goldBar: { alignItems: "flex-end", paddingHorizontal: 20, paddingTop: 8 },
  goldPill: { alignItems: "center", flexDirection: "row", borderRadius: 100, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, gap: 6, paddingVertical: 6, paddingHorizontal: 12 },
  goldText: { color: colors.textPrimary, fontSize: 12, fontWeight: "500" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 8 },
  itemCard: { alignItems: "center", flexDirection: "row", borderRadius: 16, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, gap: 12, padding: 14 },
  itemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#666666" },
  itemTextWrap: { flex: 1, gap: 2 },
  itemName: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  itemSub: { color: colors.textTertiary, fontSize: 11 },
  priceWrap: { alignItems: "flex-end", gap: 6 },
  price: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  buyButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#ffffff",
  },
  buyButtonDisabled: {
    opacity: 0.5,
  },
  buy: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  emptyText: { color: colors.textTertiary, fontSize: 12, paddingTop: 8 },
});
