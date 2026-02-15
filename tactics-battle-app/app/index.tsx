import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/common/Card";
import { useCharacters } from "@/hooks/useCharacters";

export default function HomeScreen() {
  const { characters } = useCharacters();
  const partyMembers = characters.filter((c) => c.slotIndex !== null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tactics Battle</Text>
      <Link href="/party" asChild>
        <Pressable style={({ pressed }) => [styles.summaryPressable, pressed ? styles.summaryPressed : null]}>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>PT Summary ({partyMembers.length}/6)</Text>
            {partyMembers.length === 0 ? (
              <Text style={styles.emptyText}>パーティ未編成</Text>
            ) : (
              partyMembers
                .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0))
                .map((c) => (
                  <Text key={c.id} style={styles.memberText}>
                    Slot {(c.slotIndex ?? 0) + 1}: {c.name} ({c.jobId})
                  </Text>
                ))
            )}
          </Card>
        </Pressable>
      </Link>

      <View style={styles.linkGroup}>
        <Link href="/characters" asChild>
          <Pressable style={[styles.linkButton, styles.charactersButton]}>
            <Text style={styles.linkButtonText}>キャラクター管理</Text>
          </Pressable>
        </Link>
        <Link href="/party" asChild>
          <Pressable style={[styles.linkButton, styles.partyButton]}>
            <Text style={styles.linkButtonText}>PT編成</Text>
          </Pressable>
        </Link>
        <Link href="/dungeon" asChild>
          <Pressable style={[styles.linkButton, styles.dungeonButton]}>
            <Text style={styles.linkButtonText}>ダンジョン選択</Text>
          </Pressable>
        </Link>
        <Link href="/settings" asChild>
          <Pressable style={[styles.linkButton, styles.settingsButton]}>
            <Text style={styles.linkButtonText}>設定</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  content: { paddingHorizontal: 16, paddingVertical: 16 },
  title: { marginBottom: 16, fontSize: 28, fontWeight: "700", color: "#ffffff" },
  summaryPressable: { borderRadius: 16, marginBottom: 16 },
  summaryPressed: { opacity: 0.85 },
  summaryCard: { marginBottom: 0 },
  summaryTitle: { color: "#e4e4e7" },
  emptyText: { marginTop: 8, color: "#71717a" },
  memberText: { marginTop: 4, color: "#d4d4d8" },
  linkGroup: { gap: 12 },
  linkButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  linkButtonText: {
    textAlign: "center",
    fontWeight: "600",
    color: "#ffffff",
  },
  charactersButton: { backgroundColor: "#7c3aed" },
  partyButton: { backgroundColor: "#059669" },
  dungeonButton: { backgroundColor: "#0369a1" },
  settingsButton: { backgroundColor: "#3f3f46" },
});
