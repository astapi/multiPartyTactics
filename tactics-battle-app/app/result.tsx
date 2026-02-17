import { Link, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function ResultScreen() {
  const { status } = useLocalSearchParams<{ status: "WIN" | "LOSE" | "DRAW" | string }>();
  const isWin = status === "WIN";
  const isDraw = status === "DRAW";

  return (
    <View style={styles.container}>
      <Text style={[styles.title, isDraw ? styles.draw : isWin ? styles.win : styles.lose]}>
        {isDraw ? "DRAW" : isWin ? "VICTORY" : "DEFEAT"}
      </Text>
      <Text style={styles.result}>Result: {status}</Text>
      <Link href="/" asChild>
        <Text style={styles.backButton}>ホームへ戻る</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#09090b",
    paddingHorizontal: 16,
  },
  title: { fontSize: 36, fontWeight: "700" },
  win: { color: "#34d399" },
  draw: { color: "#facc15" },
  lose: { color: "#fb7185" },
  result: { marginTop: 12, color: "#d4d4d8" },
  backButton: {
    marginTop: 32,
    borderRadius: 12,
    backgroundColor: "#3f3f46",
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: "#ffffff",
  },
});
