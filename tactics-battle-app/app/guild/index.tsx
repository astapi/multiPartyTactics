import { Stack, useRouter } from "expo-router";
import {
  ChevronRight,
  Coins,
  Home,
  Plus,
  Settings,
  Shield,
  Swords,
  User,
  UserPlus,
  Users,
  Wand,
} from "lucide-react-native";
import { useMemo, useState } from "react";
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
  textMuted: "#aaaaaa",
  textDisabled: "#cccccc",
  borderDefault: "#e0e0e0",
  borderStrong: "#d0d0d0",
  iconSecondary: "#999999",
} as const;

type GuildTab = "hire" | "party";

export default function GuildScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<GuildTab>("hire");

  const hireItems = useMemo(
    () => [
      { name: "Roland", role: t("guild.role.knight"), cost: 2000, icon: <Shield size={20} stroke={colors.textSecondary} /> },
      { name: "Elara", role: t("guild.role.mage"), cost: 2500, icon: <Wand size={20} stroke={colors.textSecondary} /> },
      { name: "Mira", role: t("guild.role.healer"), cost: 3000, icon: <User size={20} stroke={colors.textSecondary} /> },
    ],
    [t]
  );

  const parties = useMemo(
    () => [
      {
        title: t("guild.party.alpha"),
        sub: t("guild.party.alpha.sub"),
        members: [
          { lv: 15, name: "Aria" },
          { lv: 12, name: "Rune" },
          { lv: 14, name: "Finn" },
          { lv: 13, name: "Lily" },
          { lv: 16, name: "Grim" },
          { lv: 15, name: "Odin" },
        ],
      },
      {
        title: t("guild.party.beta"),
        sub: t("guild.party.beta.sub"),
        members: [
          { lv: 10, name: "Zara" },
          { lv: 8, name: "Vex" },
          { lv: 7, name: "Nova" },
          { lv: 6, name: "Rex" },
          { lv: null, name: t("guild.party.empty") },
          { lv: null, name: t("guild.party.empty") },
        ],
      },
    ],
    [t]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>{t("guild.header.sub")}</Text>
          <Text style={styles.headerTitle}>{t("guild.header.title")}</Text>
        </View>
        <View style={styles.currencyChip}>
          <Coins size={14} stroke={colors.textSecondary} />
          <Text style={styles.currencyText}>12,500</Text>
        </View>
      </View>

      <View style={styles.tabSwitchWrap}>
        <Pressable style={styles.tabSwitchItem} onPress={() => setActiveTab("hire")}>
          <Text style={[styles.tabSwitchText, activeTab === "hire" ? styles.tabSwitchTextActive : null]}>
            {t("guild.tab.hire")}
          </Text>
          <View style={[styles.tabSwitchBorder, activeTab === "hire" ? styles.tabSwitchBorderActive : null]} />
        </Pressable>
        <Pressable style={styles.tabSwitchItem} onPress={() => setActiveTab("party")}>
          <Text style={[styles.tabSwitchText, activeTab === "party" ? styles.tabSwitchTextActive : null]}>
            {t("guild.tab.party")}
          </Text>
          <View style={[styles.tabSwitchBorder, activeTab === "party" ? styles.tabSwitchBorderActive : null]} />
        </Pressable>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "hire" ? (
          <>
            <Text style={styles.sectionLabel}>{t("guild.section.hire")}</Text>
            {hireItems.map((item) => (
              <Pressable key={item.name} style={({ pressed }) => [styles.listCard, pressed ? styles.listCardPressed : null]}>
                <View style={styles.avatarCircle}>{item.icon}</View>
                <View style={styles.listTextWrap}>
                  <Text style={styles.listTitle}>{item.name}</Text>
                  <Text style={styles.listSub}>{`${item.role}  •  ${item.cost.toLocaleString()} G`}</Text>
                </View>
                <ChevronRight size={18} stroke={colors.iconSecondary} />
              </Pressable>
            ))}
            <Pressable style={({ pressed }) => [styles.createButton, pressed ? styles.listCardPressed : null]} onPress={() => router.push("/guild/hire")}>
              <UserPlus size={18} stroke={colors.iconSecondary} />
              <Text style={styles.createButtonText}>{t("guild.hire.create")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>{t("guild.section.party")}</Text>
            {parties.map((party) => (
              <Pressable key={party.title} style={({ pressed }) => [styles.partyCard, pressed ? styles.listCardPressed : null]}>
                <View style={styles.partyTopRow}>
                  <View style={styles.partyLeftWrap}>
                    <View style={styles.partyIconWrap}>
                      <Users size={18} stroke={colors.textSecondary} />
                    </View>
                    <View>
                      <Text style={styles.partyTitle}>{party.title}</Text>
                      <Text style={styles.partySub}>{party.sub}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} stroke={colors.iconSecondary} />
                </View>
                <View style={styles.membersRow}>
                  {party.members.map((member, idx) => {
                    const empty = member.lv === null;
                    return (
                      <View key={`${party.title}-${idx}`} style={styles.memberItem}>
                        <View style={[styles.memberAvatar, empty ? styles.memberAvatarEmpty : null]}>
                          {empty ? <Plus size={12} stroke={colors.borderStrong} /> : <User size={14} stroke={colors.textSecondary} />}
                        </View>
                        <Text style={empty ? styles.memberLevelEmpty : styles.memberLevel}>{empty ? "" : `Lv${member.lv}`}</Text>
                        <Text style={empty ? styles.memberNameEmpty : styles.memberName}>{member.name}</Text>
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            ))}
            <Pressable style={({ pressed }) => [styles.createButton, pressed ? styles.listCardPressed : null]}>
              <Plus size={18} stroke={colors.iconSecondary} />
              <Text style={styles.createButtonText}>{t("guild.party.create")}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomNavWrap}>
        <View style={styles.bottomNav}>
          <Pressable style={styles.bottomNavItem} onPress={() => router.push("/")}>
            <Home size={18} stroke={colors.textMuted} />
            <Text style={styles.bottomNavText}>{t("home.tab.home")}</Text>
          </Pressable>
          <Pressable style={styles.bottomNavItem} onPress={() => router.push("/dungeon")}>
            <Swords size={18} stroke={colors.textMuted} />
            <Text style={styles.bottomNavText}>{t("home.tab.dungeon")}</Text>
          </Pressable>
          <View style={styles.bottomNavItem}>
            <Users size={18} stroke={colors.textPrimary} />
            <Text style={styles.bottomNavTextActive}>{t("home.tab.guild")}</Text>
          </View>
          <Pressable style={styles.bottomNavItem} onPress={() => router.push("/settings")}>
            <Settings size={18} stroke={colors.textMuted} />
            <Text style={styles.bottomNavText}>{t("home.tab.more")}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingRight: 20,
    paddingBottom: 12,
    paddingLeft: 20,
  },
  headerSub: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
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
  currencyText: { color: colors.textPrimary, fontSize: 12, fontWeight: "500" },
  tabSwitchWrap: { flexDirection: "row", paddingHorizontal: 20 },
  tabSwitchItem: { flex: 1, alignItems: "center" },
  tabSwitchText: { color: colors.textMuted, fontSize: 14, fontWeight: "500", paddingTop: 10, paddingBottom: 10 },
  tabSwitchTextActive: { color: colors.textPrimary, fontWeight: "700" },
  tabSwitchBorder: { height: 1, width: "100%", backgroundColor: colors.borderDefault },
  tabSwitchBorderActive: { height: 2, backgroundColor: colors.textPrimary },
  contentScroll: { flex: 1 },
  content: { padding: 20, gap: 12 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  listCard: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  listCardPressed: { opacity: 0.8 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  listTextWrap: { flex: 1, gap: 2 },
  listTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  listSub: { color: colors.textTertiary, fontSize: 10, fontWeight: "400" },
  createButton: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  createButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  partyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 12,
    padding: 16,
  },
  partyTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  partyLeftWrap: { alignItems: "center", flexDirection: "row", gap: 10 },
  partyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  partyTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  partySub: { color: colors.textTertiary, fontSize: 10, fontWeight: "500" },
  membersRow: { flexDirection: "row", gap: 6 },
  memberItem: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 6 },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  memberAvatarEmpty: { backgroundColor: colors.bgPrimary, borderWidth: 1, borderColor: colors.borderStrong },
  memberLevel: { color: colors.textTertiary, fontSize: 8, fontWeight: "500" },
  memberLevelEmpty: { color: colors.textDisabled, fontSize: 8, fontWeight: "500", minHeight: 10 },
  memberName: { color: colors.textPrimary, fontSize: 9, fontWeight: "600" },
  memberNameEmpty: { color: colors.textDisabled, fontSize: 9, fontWeight: "500" },
  bottomNavWrap: { paddingTop: 12, paddingRight: 16, paddingBottom: 20, paddingLeft: 16 },
  bottomNav: {
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
  bottomNavItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 16 },
  bottomNavText: { color: colors.textMuted, fontSize: 10, fontWeight: "500" },
  bottomNavTextActive: { color: colors.textPrimary, fontSize: 10, fontWeight: "600" },
});
