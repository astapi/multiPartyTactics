import { useCallback, useEffect, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, Coins, Package, RefreshCw, UserPlus } from "lucide-react-native";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getClassById } from "@/constants/classes";
import { getConstellationDisplayName } from "@/constants/constellations";
import { charactersRepository, DEFAULT_PARTY_ID } from "@/db/repositories/charactersRepository";
import { partiesRepository } from "@/db/repositories/partiesRepository";
import { walletRepository } from "@/db/repositories/walletRepository";
import { tavernService } from "@/features/guild/tavernService";
import { getTraitLabel } from "@/features/guild/traits";
import { TranslationKey, useI18n } from "@/i18n";
import { CharacterRecord, PartyWithMembers, TavernCandidateRecord, TavernRefreshState } from "@/types/models";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgSurfaceStrong: "#efefef",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  textMuted: "#aaaaaa",
  borderDefault: "#e0e0e0",
  borderStrong: "#222222",
  accent: "#1a1a1a",
} as const;

const CLASS_NAME_KEYS: Record<CharacterRecord["classId"], TranslationKey> = {
  GUARDIAN: "class.name.guardian",
  SWORDMAN: "class.name.swordman",
  BERSERKER: "class.name.berserker",
  CLERIC: "class.name.cleric",
  WITCH: "class.name.witch",
  THIEF: "class.name.thief",
  PORTER: "class.name.porter",
};

const formatRemaining = (refreshState: TavernRefreshState | null, now: number): string => {
  if (!refreshState) return "--:--";
  const diffMs = Math.max(0, Date.parse(refreshState.nextRefreshAt) - now);
  const totalSec = Math.floor(diffMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export default function GuildScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [partiesWithMembers, setPartiesWithMembers] = useState<PartyWithMembers[]>([]);
  const [walletGold, setWalletGold] = useState(0);
  const [candidates, setCandidates] = useState<TavernCandidateRecord[]>([]);
  const [refreshState, setRefreshState] = useState<TavernRefreshState | null>(null);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadScreenData = useCallback(
    async (forceRefresh = false) => {
      const [list, parties, wallet, tavern] = await Promise.all([
        charactersRepository.list(DEFAULT_PARTY_ID),
        partiesRepository.listWithMembers(),
        walletRepository.getMainWallet(),
        tavernService.getTavernState(forceRefresh),
      ]);
      setCharacters(list);
      setPartiesWithMembers(parties);
      setWalletGold(wallet.gold);
      setCandidates(tavern.candidates);
      setRefreshState(tavern.refreshState);
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void loadScreenData();
    }, [loadScreenData])
  );

  const assignmentByCharacterId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of partiesWithMembers) {
      for (const member of entry.members) {
        map.set(member.id, entry.party.name);
      }
    }
    return map;
  }, [partiesWithMembers]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadScreenData(true);
      setExpandedCandidateId(null);
    } catch (error) {
      Alert.alert("更新失敗", error instanceof Error ? error.message : "酒場の更新に失敗しました。");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleHire = async (candidateId: string) => {
    try {
      const result = await tavernService.hireCandidate(candidateId);
      if (!result.ok) {
        Alert.alert(
          "資金不足",
          `必要額: ${result.requiredGold.toLocaleString()} G / 所持: ${result.walletGold.toLocaleString()} G`
        );
        setWalletGold(result.walletGold);
        return;
      }
      await loadScreenData();
    } catch (error) {
      Alert.alert("雇用失敗", error instanceof Error ? error.message : "冒険者の雇用に失敗しました。");
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>{locale === "ja" ? "冒険者が集う場所" : "Tavern"}</Text>
          <Text style={styles.headerTitle}>{locale === "ja" ? "酒場" : "Tavern"}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.inventoryButton} onPress={() => router.push("/inventory")}>
            <Package size={14} stroke={colors.textSecondary} />
            <Text style={styles.inventoryButtonText}>{locale === "ja" ? "倉庫" : "Inventory"}</Text>
          </Pressable>
          <View style={styles.currencyChip}>
            <Coins size={14} stroke={colors.textSecondary} />
            <Text style={styles.currencyText}>{walletGold.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.tavernHeaderCard}>
          <View style={styles.tavernHeaderRow}>
            <View>
              <Text style={styles.sectionLabel}>{locale === "ja" ? "待機中の冒険者" : "Available Adventurers"}</Text>
              <Text style={styles.refreshLabel}>
                {locale === "ja" ? "次回更新まで" : "Next refresh"} {formatRemaining(refreshState, now)}
              </Text>
            </View>
            <Pressable style={styles.refreshButton} onPress={handleRefresh}>
              <RefreshCw size={14} stroke="#ffffff" />
              <Text style={styles.refreshButtonText}>{locale === "ja" ? "更新" : "Refresh"}</Text>
            </Pressable>
          </View>
        </View>

        {candidates.map((candidate) => {
          const classInfo = getClassById(candidate.classId);
          const isExpanded = expandedCandidateId === candidate.id;
          return (
            <View key={candidate.id} style={styles.candidateCard}>
              <Pressable
                style={styles.candidateSummary}
                onPress={() => setExpandedCandidateId((prev) => (prev === candidate.id ? null : candidate.id))}
              >
                <View style={styles.candidateAvatarWrap}>
                  <Image source={classInfo.image} style={styles.candidateAvatar} resizeMode="contain" />
                </View>
                <View style={styles.candidateTextWrap}>
                  <Text style={styles.candidateName}>{candidate.name}</Text>
                  <Text style={styles.candidateSub}>
                    {`${t(CLASS_NAME_KEYS[candidate.classId])} • Lv.${candidate.level} • ${candidate.age}歳`}
                  </Text>
                  <Text style={styles.candidateMeta}>
                    {getConstellationDisplayName(candidate.constellationId, locale)}
                  </Text>
                </View>
                <View style={styles.candidatePriceWrap}>
                  <Text style={styles.candidatePrice}>{candidate.priceGold.toLocaleString()} G</Text>
                  <ChevronRight size={16} stroke={colors.textMuted} />
                </View>
              </Pressable>

              {isExpanded ? (
                <View style={styles.candidateDetail}>
                  <View style={styles.statGrid}>
                    {[
                      ["HP", candidate.baseMaxHp],
                      ["ATK", candidate.baseAtk],
                      ["DEF", candidate.baseDef],
                      ["SPI", candidate.baseSpi],
                      ["SPD", candidate.baseSpd],
                      ["MP", candidate.baseMaxMp],
                      [locale === "ja" ? "MP回復" : "MP Regen", candidate.baseMpRegen],
                    ].map(([label, value]) => (
                      <View key={String(label)} style={styles.statChip}>
                        <Text style={styles.statChipLabel}>{label}</Text>
                        <Text style={styles.statChipValue}>{value}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.traitWrap}>
                    <Text style={styles.detailTitle}>{locale === "ja" ? "特性" : "Traits"}</Text>
                    <Text style={styles.traitText}>
                      {candidate.traitIds.length > 0
                        ? candidate.traitIds.map(getTraitLabel).join(" / ")
                        : locale === "ja"
                          ? "なし"
                          : "None"}
                    </Text>
                  </View>
                  <Pressable style={styles.hireButton} onPress={() => void handleHire(candidate.id)}>
                    <UserPlus size={16} stroke="#ffffff" />
                    <Text style={styles.hireButtonText}>{locale === "ja" ? "雇用する" : "Hire"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        <Text style={styles.sectionLabel}>{locale === "ja" ? "キャラクター管理" : "Character Management"}</Text>

        {characters.map((character) => (
          <Pressable
            key={character.id}
            style={({ pressed }) => [styles.listCard, pressed ? styles.listCardPressed : null]}
            onPress={() => router.push(`/characters/${character.id}`)}
          >
            <View style={styles.avatarCircle}>
              <Image source={getClassById(character.classId).image} style={styles.avatarImage} />
            </View>
            <View style={styles.listTextWrap}>
              <Text style={styles.listTitle}>{character.name}</Text>
              <Text style={styles.listSub}>{`${t(CLASS_NAME_KEYS[character.classId])}  •  Lv.${character.level} • ${character.age}歳`}</Text>
              <Text style={styles.listMeta}>
                {getConstellationDisplayName(character.constellationId, locale)}
              </Text>
            </View>
            <View style={styles.assignmentWrap}>
              <Text style={styles.assignmentText} numberOfLines={1}>
                {assignmentByCharacterId.get(character.id) ?? (locale === "ja" ? "未所属" : "Unassigned")}
              </Text>
              <ChevronRight size={18} stroke={colors.textMuted} />
            </View>
          </Pressable>
        ))}

        {characters.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t("guild.hire.empty")}</Text>
          </View>
        ) : null}
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerSub: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  inventoryButton: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  inventoryButtonText: { color: colors.textPrimary, fontSize: 11, fontWeight: "600" },
  currencyChip: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 12,
  },
  currencyText: { color: colors.textPrimary, fontSize: 12, fontWeight: "500" },
  contentScroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  tavernHeaderCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    padding: 14,
  },
  tavernHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  refreshLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 4 },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  refreshButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  candidateCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    overflow: "hidden",
  },
  candidateSummary: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  candidateAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.bgSurfaceStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  candidateAvatar: { width: 52, height: 52 },
  candidateTextWrap: { flex: 1, gap: 2 },
  candidateName: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  candidateSub: { color: colors.textSecondary, fontSize: 12, fontWeight: "500" },
  candidateMeta: { color: colors.textTertiary, fontSize: 11 },
  candidatePriceWrap: { alignItems: "flex-end", gap: 4 },
  candidatePrice: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  candidateDetail: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    padding: 12,
    gap: 12,
  },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statChip: {
    minWidth: 72,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statChipLabel: { color: colors.textTertiary, fontSize: 10, fontWeight: "600" },
  statChipValue: { color: colors.textPrimary, fontSize: 14, fontWeight: "700", marginTop: 2 },
  detailTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  traitWrap: { gap: 4 },
  traitText: { color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
  hireButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.borderStrong,
    paddingVertical: 12,
  },
  hireButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  listCard: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  listCardPressed: { opacity: 0.8 },
  avatarCircle: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 56, height: 56 },
  listTextWrap: { flex: 1, gap: 2 },
  listTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  listSub: { color: colors.textTertiary, fontSize: 10, fontWeight: "400" },
  listMeta: { color: colors.textMuted, fontSize: 10, fontWeight: "400" },
  assignmentWrap: { alignItems: "flex-end", gap: 4 },
  assignmentText: { color: colors.textTertiary, fontSize: 10, maxWidth: 100 },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingVertical: 24,
  },
  emptyText: { color: colors.textTertiary, fontSize: 13, fontWeight: "500" },
});
