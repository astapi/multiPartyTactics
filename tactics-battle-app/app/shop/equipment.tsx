import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, Coins, Shield, Sword } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { shopEquipmentRepository } from "@/db/repositories/shopEquipmentRepository";
import { walletRepository } from "@/db/repositories/walletRepository";
import { getEquipSlotForCategory } from "@/game/equipment/equipmentRules";
import { formatStatSummary } from "@/game/equipment/equipmentStatsService";
import { buildEquipmentDisplayName, getEquipmentById } from "@/game/loot/equipmentMasterService";
import { useI18n } from "@/i18n";
import { parchment, parchmentImages, parchmentShadow } from "@/theme/parchment";
import type { ShopCatalogItem } from "@/types/equipment";

type ShopTab = "weapons" | "armor";

type ShopViewRow = ShopCatalogItem & {
  name: string;
  slotType: "weapon" | "armor";
  statSummary: string;
};

export default function EquipmentShopScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<ShopTab>("weapons");
  const [walletGold, setWalletGold] = useState(0);
  const [items, setItems] = useState<ShopViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingBaseItemId, setBuyingBaseItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wallet, catalog] = await Promise.all([
        walletRepository.getMainWallet(),
        shopEquipmentRepository.listCatalogWithOwnedCounts(),
      ]);
      const rows: ShopViewRow[] = catalog
        .map((row) => {
          const item = getEquipmentById(row.baseItemId);
          const slotType = getEquipSlotForCategory(item.category);
          if (!slotType) return null;
          const name = buildEquipmentDisplayName(item.id, null);
          return {
            ...row,
            name: locale === "ja" ? name.jp : name.en,
            slotType,
            statSummary: formatStatSummary(item.stats, locale),
          };
        })
        .filter((row): row is ShopViewRow => Boolean(row));
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
    () => items.filter((item) => (tab === "weapons" ? item.slotType === "weapon" : item.slotType === "armor")),
    [items, tab]
  );

  const onBuy = useCallback(
    async (baseItemId: string) => {
      if (buyingBaseItemId) return;
      setBuyingBaseItemId(baseItemId);
      try {
        const result = await shopEquipmentRepository.purchase(baseItemId);
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
        setBuyingBaseItemId(null);
      }
    },
    [buyingBaseItemId, load, locale]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground source={parchmentImages.equipmentShopHeader} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroOverlay}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable style={styles.iconBtn} onPress={() => router.back()}>
                <ArrowLeft size={18} stroke="#f5ede0" />
              </Pressable>
              <View>
                <Text style={styles.heroTitle}>{locale === "ja" ? "武器防具屋" : "Weapon & Armor"}</Text>
                <Text style={styles.heroSub}>{t("shop.equip.header")}</Text>
              </View>
            </View>
            <View style={styles.iconBtn}>
              <Sword size={16} stroke={parchment.gold} />
            </View>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.tabs}>
        <Pressable style={styles.tabItem} onPress={() => setTab("weapons")}>
          <Text style={[styles.tabText, tab === "weapons" ? styles.tabTextActive : null]}>{t("shop.equip.tab.weapons")}</Text>
          <View style={[styles.tabBorder, tab === "weapons" ? styles.tabBorderActive : null]} />
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => setTab("armor")}>
          <Text style={[styles.tabText, tab === "armor" ? styles.tabTextActive : null]}>{t("shop.equip.tab.armor")}</Text>
          <View style={[styles.tabBorder, tab === "armor" ? styles.tabBorderActive : null]} />
        </Pressable>
      </View>

      <View style={styles.goldBar}>
        <View style={styles.goldPill}>
          <Coins size={14} stroke={parchment.gold} />
          <Text style={styles.goldText}>{t("shop.equip.gold", { amount: walletGold.toLocaleString() })}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.emptyText}>{locale === "ja" ? "読み込み中..." : "Loading..."}</Text>
        ) : filteredItems.length === 0 ? (
          <Text style={styles.emptyText}>{locale === "ja" ? "販売中の装備はありません。" : "No equipment available."}</Text>
        ) : (
          filteredItems.map((item) => (
            <View key={item.baseItemId} style={styles.itemCard}>
              <View style={styles.itemIcon}>{item.slotType === "armor" ? <Shield size={18} stroke="#ffffff" /> : <Sword size={18} stroke="#ffffff" />}</View>
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>{item.statSummary || "--"}</Text>
                <Text style={styles.itemSub}>{`${locale === "ja" ? "所持" : "Owned"}: ${item.ownedQuantity}`}</Text>
              </View>
              <View style={styles.priceWrap}>
                <Text style={styles.price}>{t("shop.equip.gold", { amount: item.priceGold.toLocaleString() })}</Text>
                <Pressable
                  style={[styles.buyButton, buyingBaseItemId === item.baseItemId ? styles.buyButtonDisabled : null]}
                  onPress={() => void onBuy(item.baseItemId)}
                  disabled={Boolean(buyingBaseItemId)}
                >
                  <Text style={styles.buy}>{t("shop.equip.buy")}</Text>
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
