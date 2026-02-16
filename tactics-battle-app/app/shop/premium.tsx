import { Stack, useRouter } from "expo-router";
import { ArrowLeft, Gem } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  borderDefault: "#e0e0e0",
} as const;

export default function PremiumShopScreen() {
  const router = useRouter();
  const { t } = useI18n();

  const packs = [
    { gem: 30, bonus: 0, price: "$1.99" },
    { gem: 85, bonus: 10, price: "$4.99" },
    { gem: 200, bonus: 40, price: "$9.99" },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("shop.premium.header")}</Text>
        </View>
        <View style={styles.iconBtn}><Gem size={16} stroke={colors.textSecondary} /></View>
      </View>

      <View style={styles.gemBar}><View style={styles.gemPill}><Gem size={14} stroke={colors.textSecondary} /><Text style={styles.gemText}>85 Gems</Text></View></View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t("shop.premium.gempacks")}</Text>
        {packs.map((pack) => (
          <View key={pack.gem} style={[styles.packCard, pack.gem === 200 ? styles.packFeatured : null]}>
            <View style={styles.packTextWrap}>
              <Text style={styles.packTitle}>{t("shop.premium.pack", { gem: pack.gem })}</Text>
              <Text style={styles.packSub}>{pack.bonus > 0 ? t("shop.premium.bonus", { bonus: pack.bonus }) : t("shop.premium.noBonus")}</Text>
            </View>
            <Pressable style={styles.buyBtn}><Text style={styles.buyBtnText}>{pack.price}</Text></Pressable>
          </View>
        ))}

        <Text style={styles.sectionLabel}>{t("shop.premium.bundle")}</Text>
        <View style={styles.bundleCard}>
          <Text style={styles.bundleTitle}>{t("shop.premium.bundleName")}</Text>
          <Text style={styles.bundleSub}>{t("shop.premium.bundleDesc")}</Text>
          <Pressable style={styles.bundleBtn}><Text style={styles.bundleBtnText}>$14.99</Text></Pressable>
        </View>
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
  gemBar: { alignItems: "flex-end", paddingHorizontal: 20, paddingTop: 8 },
  gemPill: { alignItems: "center", flexDirection: "row", borderRadius: 100, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, gap: 6, paddingVertical: 6, paddingHorizontal: 12 },
  gemText: { color: colors.textPrimary, fontSize: 12, fontWeight: "500" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 16 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  packCard: { alignItems: "center", flexDirection: "row", borderRadius: 20, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, gap: 16, padding: 16 },
  packFeatured: { borderColor: colors.textPrimary, borderWidth: 2 },
  packTextWrap: { flex: 1, gap: 2 },
  packTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  packSub: { color: colors.textSecondary, fontSize: 12 },
  buyBtn: { borderRadius: 12, backgroundColor: colors.textPrimary, paddingVertical: 10, paddingHorizontal: 20 },
  buyBtnText: { color: "#ffffff", fontWeight: "700" },
  bundleCard: { borderRadius: 20, borderWidth: 1, borderColor: "#888888", backgroundColor: "#f0f0f0", padding: 16, gap: 8 },
  bundleTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  bundleSub: { color: colors.textSecondary, fontSize: 13 },
  bundleBtn: { borderRadius: 12, backgroundColor: colors.textPrimary, alignItems: "center", paddingVertical: 12, marginTop: 4 },
  bundleBtnText: { color: "#ffffff", fontWeight: "700" },
});
