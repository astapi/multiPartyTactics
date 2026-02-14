import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/common/Card";
import { DUNGEONS } from "@/constants/dungeons";
import { dungeonRepository } from "@/db/repositories/dungeonRepository";
import { DungeonProgressRecord } from "@/types/models";

export default function DungeonScreen() {
  const [progressList, setProgressList] = useState<DungeonProgressRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      const list = await dungeonRepository.list();
      setProgressList(list);
    };
    void load();
  }, []);

  const progressMap = new Map(progressList.map((p) => [p.dungeonId, p]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>ダンジョン選択</Text>
      <View style={styles.list}>
        {DUNGEONS.map((dungeon) => {
          const progress = progressMap.get(dungeon.id);
          const floor = progress?.currentFloor ?? 1;
          return (
            <Card key={dungeon.id}>
              <Text style={styles.dungeonName}>{dungeon.name}</Text>
              <Text style={styles.progressText}>
                進行: Floor {floor} / {dungeon.floors}
              </Text>
              <Link
                href={{
                  pathname: "/dungeon/exploration",
                  params: { dungeonId: dungeon.id },
                }}
                asChild
              >
                <Text style={styles.startButton}>
                  探索開始
                </Text>
              </Link>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  content: { padding: 16 },
  title: { marginBottom: 16, fontSize: 28, fontWeight: "700", color: "#ffffff" },
  list: { gap: 12 },
  dungeonName: { fontSize: 18, fontWeight: "600", color: "#ffffff" },
  progressText: { marginTop: 4, color: "#a1a1aa" },
  startButton: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: "center",
    fontWeight: "600",
    color: "#ffffff",
  },
});
