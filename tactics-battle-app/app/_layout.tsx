import { Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useDatabaseInit } from "@/hooks/useDatabaseInit";

export default function RootLayout() {
  const { ready, error, resetAndReinitialize } = useDatabaseInit();

  if (error) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.center, styles.root, styles.padding]}>
          <Text style={styles.errorText}>DB init error: {error}</Text>
          <Pressable style={styles.resetButton} onPress={() => void resetAndReinitialize()}>
            <Text style={styles.resetButtonText}>Reset Database</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (!ready) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.center, styles.root]}>
          <Text style={styles.loadingText}>Loading database...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#09090b" },
          headerTintColor: "#f4f4f5",
          contentStyle: { backgroundColor: "#09090b" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#09090b", flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  padding: { paddingHorizontal: 24 },
  errorText: { textAlign: "center", color: "#fda4af" },
  resetButton: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: "#3f3f46",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  resetButtonText: { color: "#f4f4f5", fontWeight: "600" },
  loadingText: { color: "#e4e4e7" },
});
