import { useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Shield, Sword } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  borderDefault: "#e0e0e0",
} as const;

type EquipTab = "weapon" | "armor" | "accessory";

export default function EquipmentChangeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const [tab, setTab] = useState<EquipTab>("weapon");

  const inventory =
    tab === "weapon"
      ? ["Iron Sword", "Steel Sword", "Moon Blade", "Guardian Spear"]
      : tab === "armor"
      ? ["Knight Plate", "Chain Mail", "Mage Robe", "Shadow Cloak"]
      : ["Ruby Ring", "Wolf Fang", "Lucky Charm", "Ancient Coin"];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("equip.header.title")}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable style={styles.tabItem} onPress={() => setTab("weapon")}>
          <Text style={[styles.tabText, tab === "weapon" ? styles.tabTextActive : null]}>{t("equip.tab.weapon")}</Text>
          <View style={[styles.tabBorder, tab === "weapon" ? styles.tabBorderActive : null]} />
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => setTab("armor")}>
          <Text style={[styles.tabText, tab === "armor" ? styles.tabTextActive : null]}>{t("equip.tab.armor")}</Text>
          <View style={[styles.tabBorder, tab === "armor" ? styles.tabBorderActive : null]} />
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => setTab("accessory")}>
          <Text style={[styles.tabText, tab === "accessory" ? styles.tabTextActive : null]}>{t("equip.tab.accessory")}</Text>
          <View style={[styles.tabBorder, tab === "accessory" ? styles.tabBorderActive : null]} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t("equip.current")}</Text>
        <View style={styles.currentCard}>
          <View style={styles.currentIcon}>{tab === "weapon" ? <Sword size={18} stroke="#ffffff" /> : <Shield size={18} stroke="#ffffff" />}</View>
          <View style={styles.currentTextWrap}>
            <Text style={styles.currentName}>{tab === "weapon" ? "Steel Sword" : tab === "armor" ? "Knight Plate" : "Ruby Ring"}</Text>
            <Text style={styles.currentSub}>{t("equip.equipped")}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{tab === "weapon" ? "+22 ATK" : tab === "armor" ? "+18 DEF" : "+12 HP"}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>{t("equip.inventory")}</Text>
        <View style={styles.listWrap}>
          {inventory.map((name) => (
            <Pressable key={name} style={styles.itemCard}>
              <View style={styles.itemIcon}>{tab === "weapon" ? <Sword size={16} stroke={colors.textSecondary} /> : <Shield size={16} stroke={colors.textSecondary} />}</View>
              <View style={styles.currentTextWrap}>
                <Text style={styles.itemName}>{name}</Text>
                <Text style={styles.itemSub}>{t("equip.tap")}</Text>
              </View>
            </Pressable>
          ))}
          <View style={styles.unequipRow}>
            <Pressable>
              <Text style={styles.unequipText}>{t("equip.unequip")}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingVertical: 12, paddingHorizontal: 20 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.bgSurface, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  tabs: { flexDirection: "row", paddingHorizontal: 20 },
  tabItem: { flex: 1, alignItems: "center" },
  tabText: { color: colors.textTertiary, fontSize: 14, fontWeight: "500", paddingVertical: 10 },
  tabTextActive: { color: colors.textPrimary, fontWeight: "700" },
  tabBorder: { width: "100%", height: 1, backgroundColor: colors.borderDefault },
  tabBorderActive: { height: 2, backgroundColor: colors.textPrimary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 10 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  currentCard: { alignItems: "center", flexDirection: "row", borderRadius: 16, borderWidth: 1.5, borderColor: "#93C5FD", backgroundColor: "#F0F7FF", gap: 12, padding: 14 },
  currentIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.textPrimary },
  currentTextWrap: { flex: 1, gap: 2 },
  currentName: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  currentSub: { color: colors.textTertiary, fontSize: 10 },
  badge: { borderRadius: 8, backgroundColor: "#2563EB", paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
  divider: { height: 1, backgroundColor: colors.borderDefault, marginVertical: 2 },
  listWrap: { gap: 8 },
  itemCard: { alignItems: "center", flexDirection: "row", borderRadius: 16, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, gap: 12, padding: 12 },
  itemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgPrimary },
  itemName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  itemSub: { color: colors.textTertiary, fontSize: 10 },
  unequipRow: { alignItems: "center", paddingVertical: 8 },
  unequipText: { color: colors.textSecondary, fontSize: 12, textDecorationLine: "underline" },
});
