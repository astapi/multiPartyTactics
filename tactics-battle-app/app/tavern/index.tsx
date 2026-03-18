import { useCallback, useEffect, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Coins, Package, RefreshCw, UserPlus, X } from "lucide-react-native";
import {
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getClassById } from "@/constants/classes";
import { getConstellationDisplayName } from "@/constants/constellations";
import { walletRepository } from "@/db/repositories/walletRepository";
import { tavernService } from "@/features/guild/tavernService";
import { getTraitLabel } from "@/features/guild/traits";
import { TranslationKey, useI18n } from "@/i18n";
import { parchment, parchmentImages, parchmentShadow } from "@/theme/parchment";
import { TavernCandidateRecord, TavernRefreshState } from "@/types/models";

const CLASS_NAME_KEYS: Record<TavernCandidateRecord["classId"], TranslationKey> = {
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

export default function TavernScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [walletGold, setWalletGold] = useState(0);
  const [candidates, setCandidates] = useState<TavernCandidateRecord[]>([]);
  const [refreshState, setRefreshState] = useState<TavernRefreshState | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<TavernCandidateRecord | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadScreenData = useCallback(
    async (forceRefresh = false) => {
      const [wallet, tavern] = await Promise.all([
        walletRepository.getMainWallet(),
        tavernService.getTavernState(forceRefresh),
      ]);
      setWalletGold(wallet.gold);
      setCandidates(tavern.candidates);
      setRefreshState(tavern.refreshState);
      setSelectedCandidate((prev) => (prev ? tavern.candidates.find((candidate) => candidate.id === prev.id) ?? null : null));
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void loadScreenData();
    }, [loadScreenData])
  );

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadScreenData(true);
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
      setSelectedCandidate(null);
      await loadScreenData();
    } catch (error) {
      Alert.alert("雇用失敗", error instanceof Error ? error.message : "冒険者の雇用に失敗しました。");
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ImageBackground source={parchmentImages.tavernHeader} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay}>
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.heroTitle}>The Golden Flagon</Text>
                <Text style={styles.heroSub}>{locale === "ja" ? "冒険者募集中" : "Adventurers Wanted"}</Text>
              </View>
              <Pressable style={styles.inventoryButton} onPress={() => router.push("/inventory")}>
                <Package size={14} stroke="#f5ede0" />
                <Text style={styles.inventoryButtonText}>{locale === "ja" ? "倉庫" : "Inventory"}</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.infoBar}>
          <View style={styles.infoLeft}>
            <Coins size={14} stroke={parchment.gold} />
            <Text style={styles.infoGold}>{walletGold.toLocaleString()} G</Text>
          </View>
          <View style={styles.infoRight}>
            <Text style={styles.infoText}>{locale === "ja" ? "次回更新" : "Next refresh"}</Text>
            <Text style={styles.infoTime}>{formatRemaining(refreshState, now)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{locale === "ja" ? "雇用候補" : "Candidates"}</Text>
            <Pressable style={styles.refreshButton} onPress={handleRefresh}>
              <RefreshCw size={14} stroke="#f5ede0" />
              <Text style={styles.refreshText}>{locale === "ja" ? "更新" : "Refresh"}</Text>
            </Pressable>
          </View>

          {candidates.map((candidate) => {
            const classInfo = getClassById(candidate.classId);
            return (
              <Pressable key={candidate.id} style={styles.candidateCard} onPress={() => setSelectedCandidate(candidate)}>
                <View style={styles.candidateAvatarWrap}>
                  <Image source={classInfo.image} style={styles.candidateAvatar} resizeMode="contain" />
                </View>
                <View style={styles.candidateText}>
                  <Text style={styles.candidateName}>{candidate.name}</Text>
                  <Text style={styles.candidateMeta}>
                    {`${t(CLASS_NAME_KEYS[candidate.classId])} • Lv.${candidate.level} • ${candidate.age}歳`}
                  </Text>
                  <Text style={styles.candidateMeta}>{getConstellationDisplayName(candidate.constellationId, locale)}</Text>
                </View>
                <Text style={styles.candidatePrice}>{candidate.priceGold.toLocaleString()} G</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal transparent visible={selectedCandidate !== null} animationType="fade" onRequestClose={() => setSelectedCandidate(null)}>
        <View style={styles.modalBackdrop}>
          {selectedCandidate ? (
            <ImageBackground source={parchmentImages.parchmentModal} style={styles.modalCard} imageStyle={styles.modalImage}>
              <Pressable style={styles.modalClose} onPress={() => setSelectedCandidate(null)}>
                <X size={18} stroke={parchment.inkSoft} />
              </Pressable>
              <View style={styles.modalTop}>
                <Image source={getClassById(selectedCandidate.classId).image} style={styles.modalAvatar} resizeMode="contain" />
                <View style={styles.modalTopText}>
                  <Text style={styles.modalName}>{selectedCandidate.name}</Text>
                  <Text style={styles.modalSub}>{`${t(CLASS_NAME_KEYS[selectedCandidate.classId])} • Lv.${selectedCandidate.level}`}</Text>
                  <Text style={styles.modalSub}>{getConstellationDisplayName(selectedCandidate.constellationId, locale)}</Text>
                </View>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.statGrid}>
                {[
                  ["HP", selectedCandidate.baseMaxHp],
                  ["ATK", selectedCandidate.baseAtk],
                  ["DEF", selectedCandidate.baseDef],
                  ["SPI", selectedCandidate.baseSpi],
                  ["SPD", selectedCandidate.baseSpd],
                  ["MP", selectedCandidate.baseMaxMp],
                  [locale === "ja" ? "MP回復" : "MP Regen", selectedCandidate.baseMpRegen],
                ].map(([label, value]) => (
                  <View key={String(label)} style={styles.statCard}>
                    <Text style={styles.statLabel}>{label}</Text>
                    <Text style={styles.statValue}>{value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.traitSection}>
                <Text style={styles.sectionLabel}>{locale === "ja" ? "特性" : "Traits"}</Text>
                <Text style={styles.traitText}>
                  {selectedCandidate.traitIds.length > 0
                    ? selectedCandidate.traitIds.map(getTraitLabel).join(" / ")
                    : locale === "ja"
                      ? "なし"
                      : "None"}
                </Text>
              </View>
              <Pressable style={styles.hireButton} onPress={() => void handleHire(selectedCandidate.id)}>
                <UserPlus size={16} stroke="#f5ede0" />
                <Text style={styles.hireButtonText}>{locale === "ja" ? "雇用する" : "Hire"}</Text>
              </Pressable>
            </ImageBackground>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: parchment.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },
  hero: { height: 140, justifyContent: "flex-end" },
  heroImage: { resizeMode: "cover" },
  heroOverlay: { backgroundColor: "rgba(26, 14, 5, 0.42)" },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", padding: 20 },
  heroTitle: { color: "#f5ede0", fontSize: 24, fontWeight: "700" },
  heroSub: { color: "#e8dcc8", fontSize: 12, marginTop: 2 },
  inventoryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(59, 46, 30, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(196, 168, 112, 0.5)",
  },
  inventoryButtonText: { color: "#f5ede0", fontSize: 11, fontWeight: "700" },
  infoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: parchment.headerBar,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoGold: { color: parchment.gold, fontSize: 12, fontWeight: "700" },
  infoRight: { alignItems: "flex-end" },
  infoText: { color: "#e8dcc8", fontSize: 10 },
  infoTime: { color: parchment.gold, fontSize: 12, fontWeight: "700" },
  divider: {
    height: 18,
    marginHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: parchment.goldLine,
  },
  section: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { color: parchment.inkSoft, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: parchment.headerBar,
  },
  refreshText: { color: "#f5ede0", fontSize: 11, fontWeight: "700" },
  candidateCard: {
    ...parchmentShadow,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    backgroundColor: parchment.surfaceMuted,
  },
  candidateAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 46, 30, 0.14)",
  },
  candidateAvatar: { width: 48, height: 48 },
  candidateText: { flex: 1, gap: 2 },
  candidateName: { color: parchment.ink, fontSize: 16, fontWeight: "700" },
  candidateMeta: { color: parchment.inkSoft, fontSize: 11 },
  candidatePrice: { color: parchment.ink, fontSize: 12, fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: parchment.overlay,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    ...parchmentShadow,
    borderRadius: 12,
    overflow: "hidden",
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: parchment.borderStrong,
    backgroundColor: parchment.surface,
  },
  modalImage: { resizeMode: "cover", opacity: 0.4 },
  modalClose: { alignSelf: "flex-end", padding: 4 },
  modalTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  modalAvatar: { width: 84, height: 84 },
  modalTopText: { flex: 1, gap: 4 },
  modalName: { color: parchment.ink, fontSize: 22, fontWeight: "700" },
  modalSub: { color: parchment.inkSoft, fontSize: 12 },
  modalDivider: { height: 1, backgroundColor: parchment.goldLine, marginVertical: 12 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: {
    width: "30%",
    minWidth: 84,
    backgroundColor: "rgba(245, 237, 224, 0.6)",
    borderWidth: 1,
    borderColor: parchment.goldLine,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statLabel: { color: parchment.inkMuted, fontSize: 10, fontWeight: "700" },
  statValue: { color: parchment.ink, fontSize: 15, fontWeight: "700", marginTop: 2 },
  traitSection: { marginTop: 14, gap: 4 },
  traitText: { color: parchment.ink, fontSize: 13, lineHeight: 18 },
  hireButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: parchment.headerBar,
    paddingVertical: 12,
    borderRadius: 8,
  },
  hireButtonText: { color: "#f5ede0", fontSize: 14, fontWeight: "700" },
});
