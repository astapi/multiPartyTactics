import { useState } from "react";
import { Stack } from "expo-router";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { resetDatabase } from "@/db/database";
import { settingsRepository } from "@/db/repositories/settingsRepository";
import { useI18n } from "@/i18n";
import { Locale } from "@/i18n/locale";
import { useLocaleStore } from "@/stores/localeStore";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textMuted: "#aaaaaa",
  borderDefault: "#e0e0e0",
} as const;

export default function SettingsScreen() {
  const { t, locale } = useI18n();
  const setLocale = useLocaleStore((state) => state.setLocale);
  const [isResetting, setIsResetting] = useState(false);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  const [bgmOn, setBgmOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);

  const onSelectLanguage = async (nextLocale: Locale) => {
    if (isSavingLanguage || locale === nextLocale) return;
    setIsSavingLanguage(true);
    try {
      await settingsRepository.setLanguage(nextLocale);
      setLocale(nextLocale);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(t("settings.alert.failTitle"), `${t("settings.alert.failBody")}\n${message}`);
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const runReset = async () => {
    setIsResetting(true);
    try {
      await resetDatabase();
      Alert.alert(t("settings.alert.doneTitle"), t("settings.alert.doneBody"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(t("settings.alert.failTitle"), `${t("settings.alert.failBody")}\n${message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const onPressReset = () => {
    Alert.alert(t("settings.reset.title"), t("settings.reset.body"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.reset.confirm"), style: "destructive", onPress: () => void runReset() },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("settings.header")}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("settings.language")}</Text>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={() => void onSelectLanguage("ja")}>
              <Text style={styles.rowText}>{t("settings.lang.ja")}</Text>
              <Text style={locale === "ja" ? styles.check : styles.muted}>{locale === "ja" ? "●" : "○"}</Text>
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.row} onPress={() => void onSelectLanguage("en")}>
              <Text style={styles.rowText}>{t("settings.lang.en")}</Text>
              <Text style={locale === "en" ? styles.check : styles.muted}>{locale === "en" ? "●" : "○"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("settings.audio")}</Text>
          <View style={styles.card}>
            <View style={styles.row}><Text style={styles.rowText}>{t("settings.audio.bgm")}</Text><Switch value={bgmOn} onValueChange={setBgmOn} /></View>
            <View style={styles.divider} />
            <View style={styles.row}><Text style={styles.rowText}>{t("settings.audio.sfx")}</Text><Switch value={sfxOn} onValueChange={setSfxOn} /></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("settings.account")}</Text>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={onPressReset}><Text style={styles.rowText}>{isResetting ? t("settings.reset.loading") : t("settings.reset.button")}</Text></Pressable>
          </View>
        </View>

        <View style={styles.versionWrap}>
          <Text style={styles.versionText}>Dungeon Tactics v1.0.0</Text>
          <Text style={styles.versionText}>Player ID: ADV-2024-0815</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingVertical: 12, paddingHorizontal: 20 },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 20 },
  section: { gap: 8 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  card: { borderRadius: 20, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, overflow: "hidden" },
  row: { minHeight: 50, paddingHorizontal: 16, alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  rowText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  divider: { height: 1, backgroundColor: colors.borderDefault },
  muted: { color: colors.textMuted },
  check: { color: colors.textPrimary },
  versionWrap: { alignItems: "center", gap: 4, paddingTop: 24 },
  versionText: { color: colors.textMuted, fontSize: 11 },
});
