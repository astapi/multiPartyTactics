import { StyleSheet, Text, View } from "react-native";

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>設定</Text>
      <Text style={styles.description}>今後、音量や演出速度などを追加予定です。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  title: { fontSize: 20, fontWeight: "600", color: "#ffffff" },
  description: { marginTop: 8, color: "#a1a1aa" },
});
