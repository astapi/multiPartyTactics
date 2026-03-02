import { Stack, useRouter } from "expo-router";
import { ChevronRight, FlaskRound, Gem, Shield } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "@/i18n";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgElevated: "#e5e5e5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  borderDefault: "#e0e0e0",
  iconSecondary: "#999999",
} as const;

export default function ShopHubScreen() {
  const router = useRouter();
  const { t } = useI18n();

  const items = [
    {
      key: "equipment",
      title: t("shop.hub.equipment.title"),
      desc: t("shop.hub.equipment.desc"),
      href: "/shop/equipment" as const,
      icon: <Shield size={20} stroke={colors.textPrimary} />,
    },
    {
      key: "consumable",
      title: t("shop.hub.consumable.title"),
      desc: t("shop.hub.consumable.desc"),
      href: "/shop/consumable" as const,
      icon: <FlaskRound size={20} stroke={colors.textPrimary} />,
    },
    {
      key: "premium",
      title: t("shop.hub.premium.title"),
      desc: t("shop.hub.premium.desc"),
      href: "/shop/premium" as const,
      icon: <Gem size={20} stroke={colors.textPrimary} />,
    },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Text style={styles.headerSub}>{t("shop.hub.sub")}</Text>
        <Text style={styles.headerTitle}>{t("shop.hub.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [styles.menuCard, pressed ? styles.menuCardPressed : null]}
            onPress={() => router.push(item.href)}
          >
            <View style={styles.menuIconWrap}>{item.icon}</View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <ChevronRight size={18} stroke={colors.iconSecondary} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerSub: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 12,
  },
  menuCard: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 16,
    padding: 20,
  },
  menuCardPressed: {
    opacity: 0.8,
  },
  menuIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  menuTextWrap: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  menuDesc: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: "500",
  },
});
