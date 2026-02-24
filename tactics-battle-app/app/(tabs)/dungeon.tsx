import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { CircleCheck, Compass, Shield, TriangleAlert } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DUNGEONS } from "@/constants/dungeons";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { dungeonRepository } from "@/db/repositories/dungeonRepository";
import { useI18n } from "@/i18n";
import { CharacterRecord, DungeonProgressRecord } from "@/types/models";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgElevated: "#e5e5e5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  textMuted: "#aaaaaa",
  borderDefault: "#e0e0e0",
  iconSecondary: "#999999",
} as const;

const DUNGEON_NAME_I18N_KEY = {
  hakusla_dungeon_1_200: "dungeon.name.hakusla_dungeon_1_200",
  crestoria_dungeon_1_4: "dungeon.name.crestoria_dungeon_1_4",
  crestoria_dungeon_5_9: "dungeon.name.crestoria_dungeon_5_9",
} as const;

export default function DungeonScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [partyMembers, setPartyMembers] = useState<CharacterRecord[]>([]);
  const [progressList, setProgressList] = useState<DungeonProgressRecord[]>([]);
  const [selectedDungeonId] = useState(DUNGEONS[0]?.id ?? "");
  const [selectedFloor, setSelectedFloor] = useState(1);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [party, progress] = await Promise.all([
          charactersRepository.listPartyMembers(),
          dungeonRepository.list(),
        ]);
        setPartyMembers(party);
        setProgressList(progress);
      };
      void load();
    }, [])
  );

  const progressMap = useMemo(() => new Map(progressList.map((p) => [p.dungeonId, p])), [progressList]);
  const selectedDungeon = DUNGEONS.find((d) => d.id === selectedDungeonId) ?? DUNGEONS[0];
  const maxFloor = selectedDungeon?.floors ?? 1;
  const currentFloor = Math.min(selectedFloor, maxFloor);
  const dungeonNameKey =
    DUNGEON_NAME_I18N_KEY[
      selectedDungeon.id as keyof typeof DUNGEON_NAME_I18N_KEY
    ] ?? "dungeon.name.crestoria_dungeon_1_4";
  const partyCount = partyMembers.length;
  const progress = progressMap.get(selectedDungeon.id);
  const clearedFloor = progress?.maxClearedFloor ?? 0;
  const recommendedLv = Math.max(1, Math.floor(selectedDungeon.floors * 1.5));

  const getFloorStatus = (floor: number): string => {
    if (floor === 1) return "Start";
    if (floor <= clearedFloor) return "Cleared";
    if (floor === clearedFloor + 1) return "Next";
    return "Locked";
  };
  const partyAvgLv =
    partyCount > 0
      ? Math.round(partyMembers.reduce((sum, member) => sum + member.level, 0) / partyCount)
      : 0;

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
          <View style={styles.partyIconDark}><Shield size={18} stroke="#ffffff" /></View>
          <View style={styles.partyTextWrap}>
            <Text style={styles.partyNameDark}>Main Party</Text>
            <Text style={styles.partySubDark}>{`${partyCount}/6 members  •  Avg Lv.${partyAvgLv}`}</Text>
          </View>
          <CircleCheck size={18} stroke="#ffffff" />
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>{t("dungeon.selectDungeon")}</Text>
        <View style={styles.dungeonCard}>
          <View style={styles.dungeonTop}>
            <View style={styles.dungeonIcon}><TriangleAlert size={18} stroke={colors.textSecondary} /></View>
            <View style={styles.partyTextWrap}>
              <Text style={styles.partyName}>{t(dungeonNameKey)}</Text>
              <Text style={styles.partySub}>{`Recommended Lv${recommendedLv}+`}</Text>
            </View>
          </View>

          <Text style={styles.floorLabel}>{t("dungeon.selectFloor")}</Text>
          <View style={styles.floorGrid}>
            {[1, 5, 10, 15].map((floor) => {
              const active = floor === currentFloor;
              const locked = floor > maxFloor;
              return (
                <Pressable
                  key={floor}
                  style={[styles.floorBtn, active ? styles.floorBtnActive : null, locked ? styles.floorBtnDisabled : null]}
                  onPress={() => !locked && setSelectedFloor(floor)}
                  disabled={locked}
                >
                  <Text style={[styles.floorTextTop, active ? styles.floorTextTopActive : null, locked ? styles.floorTextDisabled : null]}>
                    {`B${floor}`}
                  </Text>
                  <Text style={[styles.floorTextBottom, active ? styles.floorTextBottomActive : null, locked ? styles.floorTextDisabled : null]}>
                    {getFloorStatus(floor)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.progressText}>
            {t("dungeon.progress", {
              floor: (progressMap.get(selectedDungeon.id)?.maxClearedFloor ?? 0) + 1,
              max: selectedDungeon.floors,
            })}
          </Text>
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
  headerTitle: { color: colors.textPrimary, fontSize: 30, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 16 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  partyCardActive: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: colors.textPrimary,
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  partyIconDark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333333",
  },
  partyTextWrap: { flex: 1, gap: 2 },
  partyNameDark: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  partySubDark: { color: "#aaaaaa", fontSize: 10 },
  partyName: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  partySub: { color: colors.textTertiary, fontSize: 10 },
  divider: { height: 1, backgroundColor: colors.borderDefault },
  dungeonCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    padding: 16,
    gap: 14,
  },
  dungeonTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  dungeonIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  floorLabel: { color: colors.textTertiary, fontSize: 10, letterSpacing: 1 },
  floorGrid: { flexDirection: "row", gap: 8 },
  floorBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  floorBtnActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  floorBtnDisabled: { backgroundColor: colors.bgSurface },
  floorTextTop: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  floorTextTopActive: { color: "#ffffff" },
  floorTextBottom: { color: colors.textTertiary, fontSize: 8, fontWeight: "500" },
  floorTextBottomActive: { color: "#aaaaaa" },
  floorTextDisabled: { color: colors.textMuted },
  progressText: { color: colors.textTertiary, fontSize: 10 },
  deployBtn: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.textPrimary,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  deployText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
