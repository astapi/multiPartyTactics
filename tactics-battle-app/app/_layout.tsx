import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useDatabaseInit } from "@/hooks/useDatabaseInit";

export default function RootLayout() {
  const { ready, error } = useDatabaseInit();

  if (error) {
    return (
      <View style={[styles.center, styles.root, styles.padding]}>
        <Text style={styles.errorText}>DB init error: {error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.center, styles.root]}>
        <Text style={styles.loadingText}>Loading database...</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#09090b" },
        headerTintColor: "#f4f4f5",
        contentStyle: { backgroundColor: "#09090b" },
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#09090b", flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  padding: { paddingHorizontal: 24 },
  errorText: { textAlign: "center", color: "#fda4af" },
  loadingText: { color: "#e4e4e7" },
});
