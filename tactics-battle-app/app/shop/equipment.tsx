import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Coins, Shield, Sword } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TranslationKey, useI18n } from "@/i18n";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  borderDefault: "#e0e0e0",
} as const;

type ShopTab = "weapons" | "armor" | "accessories";
type ShopItem = { nameKey: TranslationKey; statKey: TranslationKey; price: number };

export default function EquipmentShopScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [tab, setTab] = useState<ShopTab>("weapons");

  const items: ShopItem[] = [
    { nameKey: "shop.equip.item.silverBlade.name", statKey: "shop.equip.item.silverBlade.stat", price: 3200 },
    { nameKey: "shop.equip.item.knightGuard.name", statKey: "shop.equip.item.knightGuard.stat", price: 2600 },
    { nameKey: "shop.equip.item.runeDagger.name", statKey: "shop.equip.item.runeDagger.stat", price: 1900 },
    { nameKey: "shop.equip.item.warAxe.name", statKey: "shop.equip.item.warAxe.stat", price: 3900 },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("shop.equip.header")}</Text>
        </View>
        <View style={styles.iconBtn}>
          <Sword size={16} stroke={colors.textTertiary} />
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable style={styles.tabItem} onPress={() => setTab("weapons")}><Text style={[styles.tabText, tab === "weapons" ? styles.tabTextActive : null]}>{t("shop.equip.tab.weapons")}</Text><View style={[styles.tabBorder, tab === "weapons" ? styles.tabBorderActive : null]} /></Pressable>
        <Pressable style={styles.tabItem} onPress={() => setTab("armor")}><Text style={[styles.tabText, tab === "armor" ? styles.tabTextActive : null]}>{t("shop.equip.tab.armor")}</Text><View style={[styles.tabBorder, tab === "armor" ? styles.tabBorderActive : null]} /></Pressable>
        <Pressable style={styles.tabItem} onPress={() => setTab("accessories")}><Text style={[styles.tabText, tab === "accessories" ? styles.tabTextActive : null]}>{t("shop.equip.tab.accessories")}</Text><View style={[styles.tabBorder, tab === "accessories" ? styles.tabBorderActive : null]} /></Pressable>
      </View>

      <View style={styles.goldBar}><View style={styles.goldPill}><Coins size={14} stroke={colors.textSecondary} /><Text style={styles.goldText}>{t("shop.equip.gold", { amount: (12450).toLocaleString() })}</Text></View></View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <Pressable key={item.nameKey} style={styles.itemCard}>
            <View style={styles.itemIcon}>{tab === "armor" ? <Shield size={18} stroke="#ffffff" /> : <Sword size={18} stroke="#ffffff" />}</View>
            <View style={styles.itemTextWrap}><Text style={styles.itemName}>{t(item.nameKey)}</Text><Text style={styles.itemSub}>{t(item.statKey)}</Text></View>
            <View style={styles.priceWrap}><Text style={styles.price}>{t("shop.equip.gold", { amount: item.price.toLocaleString() })}</Text><Text style={styles.buy}>{t("shop.equip.buy")}</Text></View>
          </Pressable>
        ))}
        <View style={styles.sellSection}><Pressable style={styles.sellBtn}><Text style={styles.sellText}>{t("shop.equip.sell")}</Text></Pressable></View>
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
  priceWrap: { alignItems: "flex-end", gap: 2 },
  price: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  buy: { color: colors.textSecondary, fontSize: 11 },
  sellSection: { alignItems: "center", paddingVertical: 12 },
  sellBtn: { borderRadius: 12, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, paddingHorizontal: 24, paddingVertical: 12 },
  sellText: { color: colors.textPrimary, fontWeight: "600" },
});
