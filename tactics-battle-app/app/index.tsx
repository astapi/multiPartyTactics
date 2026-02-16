import { Stack, useRouter } from "expo-router";
import {
  ChevronRight,
  Coins,
  FlaskRound,
  Gem,
  Home,
  Settings,
  Shield,
  ShoppingBag,
  Sword,
  Swords,
  Users,
} from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCharacters } from "@/hooks/useCharacters";
import { useI18n } from "@/i18n";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgElevated: "#e5e5e5",
  textPrimary: "#1a1a1a",
  textStrong: "#444444",
  textSecondary: "#666666",
  textTertiary: "#888888",
  textMuted: "#aaaaaa",
  borderDefault: "#e0e0e0",
  iconSecondary: "#999999",
} as const;

export default function HomeScreen() {
  const router = useRouter();
  const { characters } = useCharacters();
  const { t } = useI18n();
  const partyMembers = characters.filter((c) => c.slotIndex !== null);

  const menuItems = [
    {
      href: "/shop/equipment" as const,
      icon: "weapon" as const,
      title: t("home.menu.weapon.title"),
      description: t("home.menu.weapon.desc"),
    },
    {
      href: "/dungeon" as const,
      icon: "item" as const,
      title: t("home.menu.item.title"),
      description: t("home.menu.item.desc"),
    },
    {
      href: "/party" as const,
      icon: "party" as const,
      title: t("home.menu.party.title"),
      description: t("home.menu.party.desc", { count: partyMembers.length, max: 6 }),
    },
    {
      href: "/shop/premium" as const,
      icon: "premium" as const,
      title: t("home.menu.premium.title"),
      description: t("home.menu.premium.desc"),
    },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t("home.greeting")}</Text>
          <Text style={styles.playerName}>{t("home.playerName")}</Text>
        </View>
        <View style={styles.currencyRow}>
          <View style={styles.currencyChip}>
            <Coins size={14} stroke={colors.textSecondary} />
            <Text style={styles.currencyText}>12,450</Text>
          </View>
          <View style={styles.currencyChip}>
            <Gem size={14} stroke={colors.textTertiary} />
            <Text style={styles.currencyText}>85</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.menuScroll}
        contentContainerStyle={styles.menuContent}
        showsVerticalScrollIndicator={false}
      >
        {menuItems.map((item) => (
          <Pressable
            key={item.href}
            style={({ pressed }) => [styles.menuCard, pressed ? styles.menuCardPressed : null]}
            onPress={() => router.push(item.href)}
          >
            <View style={styles.menuIconWrap}>
              {item.icon === "weapon" ? <Sword size={20} stroke={colors.textStrong} /> : null}
              {item.icon === "item" ? <FlaskRound size={20} stroke={colors.textStrong} /> : null}
              {item.icon === "party" ? <Shield size={20} stroke={colors.textStrong} /> : null}
              {item.icon === "premium" ? <ShoppingBag size={20} stroke={colors.textStrong} /> : null}
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDesc}>{item.description}</Text>
            </View>
            <ChevronRight size={18} stroke={colors.iconSecondary} />
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.tabSection}>
        <View style={styles.tabBar}>
          <View style={styles.tabItemActive}>
            <Home size={18} stroke={colors.textPrimary} />
            <Text style={styles.tabLabelActive}>{t("home.tab.home")}</Text>
          </View>
          <Pressable style={styles.tabItem} onPress={() => router.push("/dungeon")}>
            <Swords size={18} stroke={colors.textMuted} />
            <Text style={styles.tabLabel}>{t("home.tab.dungeon")}</Text>
          </Pressable>
          <Pressable style={styles.tabItem} onPress={() => router.push("/guild")}>
            <Users size={18} stroke={colors.textMuted} />
            <Text style={styles.tabLabel}>{t("home.tab.guild")}</Text>
          </Pressable>
          <Pressable style={styles.tabItem} onPress={() => router.push("/settings")}>
            <Settings size={18} stroke={colors.textMuted} />
            <Text style={styles.tabLabel}>{t("home.tab.more")}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    paddingTop: 8,
    paddingRight: 20,
    paddingBottom: 12,
    paddingLeft: 20,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  playerName: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
  },
  currencyRow: {
    flexDirection: "row",
    gap: 10,
  },
  currencyChip: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  currencyText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "500",
  },
  menuScroll: {
    flex: 1,
  },
  menuContent: {
    paddingTop: 8,
    paddingRight: 20,
    paddingBottom: 20,
    paddingLeft: 20,
    gap: 12,
  },
  menuCard: {
    alignItems: "center",
    flexDirection: "row",
    width: "100%",
    alignSelf: "stretch",
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
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: 14,
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
  tabSection: {
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 20,
    paddingLeft: 16,
  },
  tabBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    height: 64,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    padding: 4,
  },
  tabItemActive: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  tabLabelActive: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: "600",
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "500",
  },
});
