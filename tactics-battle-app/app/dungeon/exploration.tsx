import { useEffect, useMemo, useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/common/Button";
import { dungeonRepository } from "@/db/repositories/dungeonRepository";
import { generateId } from "@/utils/id";

export default function ExplorationScreen() {
  const router = useRouter();
  const { dungeonId } = useLocalSearchParams<{ dungeonId: string }>();
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<string[]>(["探索を開始しました。"]);
  const [progressId, setProgressId] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      const list = await dungeonRepository.list();
      const found = list.find((row) => row.dungeonId === dungeonId);
      if (found) {
        setProgressId(found.id);
      } else {
        const id = generateId("progress");
        await dungeonRepository.upsert({
          id,
          dungeonId,
          currentFloor: 1,
          isCleared: 0,
        });
        setProgressId(id);
      }
    };
    void init();
  }, [dungeonId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
      setLogs((prev) => {
        const next = [...prev];
        if (Math.random() < 0.2) {
          next.push("物音を感じる...");
        } else {
          next.push("慎重に前進した。");
        }
        return next.slice(-30);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const shouldEncounter = useMemo(() => elapsed > 0 && elapsed % 8 === 0, [elapsed]);

  useEffect(() => {
    if (!shouldEncounter || !progressId) return;
    router.replace({
      pathname: "/dungeon/battle",
      params: { dungeonId, progressId },
    });
  }, [dungeonId, progressId, router, shouldEncounter]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>探索</Text>
      <Text style={styles.elapsed}>経過時間: {elapsed}s</Text>
      <View style={styles.actionWrap}>
        <Button
          label="即時接敵して戦闘へ"
          onPress={() =>
            router.replace({
              pathname: "/dungeon/battle",
              params: { dungeonId, progressId },
            })
          }
        />
      </View>
      <ScrollView style={styles.logBox} contentContainerStyle={styles.logContent}>
        {logs.map((log, index) => (
          <Text key={`${index}-${log}`} style={styles.logLine}>
            [{index + 1}] {log}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  title: { marginBottom: 8, fontSize: 20, fontWeight: "600", color: "#ffffff" },
  elapsed: { marginBottom: 12, color: "#a1a1aa" },
  actionWrap: { marginBottom: 12 },
  logBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
  },
  logContent: { padding: 12 },
  logLine: { marginBottom: 8, color: "#e4e4e7" },
});
