import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/common/Card";
import { useCharacters } from "@/hooks/useCharacters";

export default function HomeScreen() {
  const { characters } = useCharacters();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tactics Battle</Text>
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>PT Summary ({characters.length}/6)</Text>
        {characters.length === 0 ? (
          <Text style={styles.emptyText}>パーティ未編成</Text>
        ) : (
          characters.map((c) => (
            <Text key={c.id} style={styles.memberText}>
              Slot {c.slotIndex + 1}: {c.name} ({c.jobId})
            </Text>
          ))
        )}
      </Card>

      <View style={styles.linkGroup}>
        <Link href="/party" asChild>
          <Text style={[styles.linkButton, styles.partyButton]}>PT編成</Text>
        </Link>
        <Link href="/dungeon" asChild>
          <Text style={[styles.linkButton, styles.dungeonButton]}>ダンジョン選択</Text>
        </Link>
        <Link href="/settings" asChild>
          <Text style={[styles.linkButton, styles.settingsButton]}>設定</Text>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  content: { paddingHorizontal: 16, paddingVertical: 16 },
  title: { marginBottom: 16, fontSize: 28, fontWeight: "700", color: "#ffffff" },
  summaryCard: { marginBottom: 16 },
  summaryTitle: { color: "#e4e4e7" },
  emptyText: { marginTop: 8, color: "#71717a" },
  memberText: { marginTop: 4, color: "#d4d4d8" },
  linkGroup: { gap: 12 },
  linkButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: "center",
    fontWeight: "600",
    color: "#ffffff",
  },
  partyButton: { backgroundColor: "#059669" },
  dungeonButton: { backgroundColor: "#0369a1" },
  settingsButton: { backgroundColor: "#3f3f46" },
});
