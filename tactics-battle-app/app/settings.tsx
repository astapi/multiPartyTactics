import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { resetDatabase } from "@/db/database";

export default function SettingsScreen() {
  const [isResetting, setIsResetting] = useState(false);

  const runReset = async () => {
    setIsResetting(true);
    try {
      await resetDatabase();
      Alert.alert("初期化完了", "データベースを初期化しました。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "不明なエラー";
      Alert.alert("初期化失敗", `データベース初期化に失敗しました。\n${message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const onPressReset = () => {
    Alert.alert(
      "データ初期化",
      "キャラクター/タクティクス/進行状況が削除されます。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "初期化する",
          style: "destructive",
          onPress: () => {
            void runReset();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>設定</Text>
      <Text style={styles.description}>今後、音量や演出速度などを追加予定です。</Text>
      <Pressable
        disabled={isResetting}
        onPress={onPressReset}
        style={[styles.resetButton, isResetting ? styles.resetButtonDisabled : null]}
      >
        <Text style={styles.resetButtonText}>
          {isResetting ? "初期化中..." : "データベース初期化（全データ削除）"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  title: { fontSize: 20, fontWeight: "600", color: "#ffffff" },
  description: { marginTop: 8, color: "#a1a1aa" },
  resetButton: {
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: "#b91c1c",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    textAlign: "center",
    fontWeight: "600",
    color: "#ffffff",
  },
});
