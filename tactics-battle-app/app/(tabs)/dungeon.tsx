import { useEffect, useMemo, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Compass, Swords, Users } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DUNGEONS } from "@/constants/dungeons";
import { dungeonRepository } from "@/db/repositories/dungeonRepository";
import { useI18n } from "@/i18n";
import { DungeonProgressRecord } from "@/types/models";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgElevated: "#e5e5e5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  textMuted: "#aaaaaa",
  borderDefault: "#e0e0e0",
} as const;

export default function DungeonScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [progressList, setProgressList] = useState<DungeonProgressRecord[]>([]);
  const [selectedDungeonId, setSelectedDungeonId] = useState(DUNGEONS[0]?.id ?? "");
  const [selectedFloor, setSelectedFloor] = useState(1);

  useEffect(() => {
    const load = async () => {
      const list = await dungeonRepository.list();
      setProgressList(list);
    };
    void load();
  }, []);

  const progressMap = useMemo(() => new Map(progressList.map((p) => [p.dungeonId, p])), [progressList]);
  const selectedDungeon = DUNGEONS.find((d) => d.id === selectedDungeonId) ?? DUNGEONS[0];
  const maxFloor = selectedDungeon?.floors ?? 1;
  const currentFloor = Math.min(selectedFloor, maxFloor);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>{t("dungeon.header.sub")}</Text>
          <Text style={styles.headerTitle}>{t("dungeon.header.title")}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t("dungeon.selectParty")}</Text>

        <View style={styles.partyCardActive}>
          <View style={styles.partyIconDark}><Users size={18} stroke="#ffffff" /></View>
          <View style={styles.partyTextWrap}>
            <Text style={styles.partyNameDark}>Alpha Squad</Text>
            <Text style={styles.partySubDark}>Lv.15-16 • 6 members</Text>
          </View>
          <Text style={styles.selectedMark}>●</Text>
        </View>

        <View style={styles.partyCard}>
          <View style={styles.partyIcon}><Users size={18} stroke={colors.textSecondary} /></View>
          <View style={styles.partyTextWrap}>
            <Text style={styles.partyName}>Beta Squad</Text>
            <Text style={styles.partySub}>Lv.6-10 • 4 members</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>{t("dungeon.selectDungeon")}</Text>
        <View style={styles.dungeonCard}>
          <View style={styles.dungeonTop}>
            <View style={styles.dungeonIcon}><Swords size={18} stroke={colors.textSecondary} /></View>
            <View style={styles.partyTextWrap}>
              <Text style={styles.partyName}>{selectedDungeon.name}</Text>
              <Text style={styles.partySub}>{t("dungeon.progress", { floor: progressMap.get(selectedDungeon.id)?.currentFloor ?? 1, max: selectedDungeon.floors })}</Text>
            </View>
          </View>

          <Text style={styles.floorLabel}>{t("dungeon.selectFloor")}</Text>
          <View style={styles.floorGrid}>
            {Array.from({ length: Math.min(maxFloor, 8) }).map((_, idx) => {
              const floor = idx + 1;
              const active = floor === currentFloor;
              return (
                <Pressable key={floor} style={[styles.floorBtn, active ? styles.floorBtnActive : null]} onPress={() => setSelectedFloor(floor)}>
                  <Text style={[styles.floorText, active ? styles.floorTextActive : null]}>{floor}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dungeonList}>
            {DUNGEONS.map((d) => (
              <Pressable key={d.id} style={[styles.dungeonPick, d.id === selectedDungeonId ? styles.dungeonPickActive : null]} onPress={() => setSelectedDungeonId(d.id)}>
                <Text style={[styles.dungeonPickText, d.id === selectedDungeonId ? styles.dungeonPickTextActive : null]}>{d.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={styles.deployBtn}
          onPress={() =>
            router.push({
              pathname: "/dungeon/exploration",
              params: { dungeonId: selectedDungeon.id, floor: String(currentFloor) },
            })
          }
        >
          <Compass size={18} stroke="#ffffff" />
          <Text style={styles.deployText}>{t("dungeon.deploy")}</Text>
        </Pressable>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingTop: 16, paddingRight: 20, paddingBottom: 12, paddingLeft: 20 },
  headerSub: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 16 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  partyCardActive: { alignItems: "center", flexDirection: "row", borderRadius: 16, backgroundColor: colors.textPrimary, gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  partyCard: { alignItems: "center", flexDirection: "row", borderRadius: 16, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  partyIconDark: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#333333" },
  partyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgElevated },
  partyTextWrap: { flex: 1, gap: 2 },
  partyNameDark: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  partySubDark: { color: "#e5e5e5", fontSize: 11 },
  selectedMark: { color: "#ffffff", fontSize: 18 },
  partyName: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  partySub: { color: colors.textTertiary, fontSize: 11 },
  divider: { height: 1, backgroundColor: colors.borderDefault },
  dungeonCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, padding: 16, gap: 12 },
  dungeonTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  dungeonIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgElevated },
  floorLabel: { color: colors.textTertiary, fontSize: 10, letterSpacing: 1 },
  floorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  floorBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  floorBtnActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  floorText: { color: colors.textSecondary, fontWeight: "600" },
  floorTextActive: { color: "#ffffff" },
  dungeonList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dungeonPick: { borderRadius: 10, borderWidth: 1, borderColor: colors.borderDefault, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#ffffff" },
  dungeonPickActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  dungeonPickText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  dungeonPickTextActive: { color: "#ffffff" },
  deployBtn: { alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderRadius: 16, backgroundColor: colors.textPrimary, paddingVertical: 16, paddingHorizontal: 24 },
  deployText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
