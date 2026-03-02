import { useCallback, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Coins, PenLine, UserPlus } from "lucide-react-native";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CLASS_MASTER, ClassInfo } from "@/constants/classes";
import { walletRepository } from "@/db/repositories/walletRepository";
import { hireCharacterService } from "@/features/guild/hireCharacterService";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgElevated: "#e5e5e5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  textMuted: "#aaaaaa",
  textInverted: "#ffffff",
  borderDefault: "#e0e0e0",
  borderActive: "#1a1a1a",
} as const;

export default function HireScreen() {
  const router = useRouter();
  const [selectedClass, setSelectedClass] = useState<ClassInfo>(CLASS_MASTER[0]);
  const [name, setName] = useState("");
  const [walletGold, setWalletGold] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadWallet = useCallback(async () => {
    const wallet = await walletRepository.getMainWallet();
    setWalletGold(wallet.gold);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadWallet();
    }, [loadWallet])
  );

  const handleCreate = async () => {
    if (isSubmitting) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Error", "Please enter a name for your adventurer.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await hireCharacterService.hireCharacter({
        name: trimmedName,
        classId: selectedClass.id,
      });
      if (!result.ok) {
        Alert.alert(
          "Insufficient Gold",
          `Need: ${result.requiredGold.toLocaleString()} G / Have: ${result.walletGold.toLocaleString()} G`
        );
        setWalletGold(result.walletGold);
        return;
      }
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", `Failed to create adventurer.\n${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={20} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>New Adventurer</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.classSection}>
          <Text style={styles.sectionLabel}>SELECT CLASS</Text>

          <View style={styles.classPreview}>
            <View style={styles.previewAvatarWrap}>
              <Image source={selectedClass.image} style={styles.previewAvatar} />
            </View>
            <Text style={styles.previewName}>{selectedClass.name}</Text>
            <Text style={styles.previewDesc}>{selectedClass.description}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{selectedClass.baseStats.maxHp}</Text>
                <Text style={styles.statLabel}>HP</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{selectedClass.baseStats.maxMp}</Text>
                <Text style={styles.statLabel}>MP</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{selectedClass.baseStats.atk}</Text>
                <Text style={styles.statLabel}>ATK</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{selectedClass.baseStats.def}</Text>
                <Text style={styles.statLabel}>DEF</Text>
              </View>
            </View>
          </View>

          <View style={styles.classGrid}>
            {CLASS_MASTER.map((classInfo) => {
              const isSelected = classInfo.id === selectedClass.id;
              return (
                <Pressable
                  key={classInfo.id}
                  style={[styles.classItem, isSelected ? styles.classItemSelected : null]}
                  onPress={() => setSelectedClass(classInfo)}
                >
                  <View style={styles.classItemAvatar}>
                    <Image source={classInfo.image} style={styles.classItemImage} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.nameSection}>
          <Text style={styles.sectionLabel}>ADVENTURER NAME</Text>
          <View style={styles.nameInputWrap}>
            <PenLine size={18} stroke={colors.textMuted} />
            <TextInput
              style={styles.nameInput}
              placeholder="Enter name..."
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={20}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomSection}>
        <View style={styles.walletRow}>
          <Text style={styles.walletLabel}>Current Gold:</Text>
          <Coins size={14} stroke={colors.textSecondary} />
          <Text style={styles.walletValue}>{walletGold.toLocaleString()} G</Text>
        </View>
        <View style={styles.costRow}>
          <Text style={styles.costLabel}>Hiring cost:</Text>
          <Coins size={14} stroke={colors.textSecondary} />
          <Text style={styles.costValue}>{selectedClass.hiringCost.toLocaleString()} G</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            isSubmitting ? styles.createButtonDisabled : null,
            pressed ? styles.createButtonPressed : null,
          ]}
          onPress={handleCreate}
          disabled={isSubmitting}
        >
          <UserPlus size={20} stroke={colors.textInverted} />
          <Text style={styles.createButtonText}>Create Adventurer</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  classSection: { paddingVertical: 16, paddingHorizontal: 20, gap: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  classPreview: { alignItems: "center", paddingVertical: 20, gap: 10 },
  previewAvatarWrap: {
    width: 120,
    height: 120,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    overflow: "hidden",
  },
  previewAvatar: { width: "100%", height: "100%" },
  previewName: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  previewDesc: { fontSize: 13, fontWeight: "500", color: colors.textTertiary },
  statsRow: { flexDirection: "row", gap: 8, paddingTop: 8, width: "100%" },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    padding: 8,
  },
  statValue: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  statLabel: { fontSize: 10, fontWeight: "500", color: colors.textTertiary },
  classGrid: { flexDirection: "row", gap: 8, justifyContent: "center" },
  classItem: {
    flex: 1,
    alignItems: "center",
    gap: 0,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  classItemSelected: { borderBottomColor: colors.borderActive },
  classItemAvatar: { width: 44, height: 44, borderRadius: 14, overflow: "hidden" },
  classItemImage: { width: "100%", height: "100%" },
  divider: { height: 1, backgroundColor: colors.bgElevated },
  nameSection: { paddingVertical: 16, paddingHorizontal: 20, gap: 10 },
  nameInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  nameInput: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.textPrimary },
  bottomSection: { paddingVertical: 12, paddingHorizontal: 20, gap: 10 },
  walletRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  walletLabel: { fontSize: 13, fontWeight: "500", color: colors.textTertiary },
  walletValue: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  costRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  costLabel: { fontSize: 13, fontWeight: "500", color: colors.textTertiary },
  costValue: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 100,
    backgroundColor: colors.textPrimary,
    paddingVertical: 16,
  },
  createButtonPressed: { opacity: 0.8 },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { fontSize: 16, fontWeight: "700", color: colors.textInverted },
});
