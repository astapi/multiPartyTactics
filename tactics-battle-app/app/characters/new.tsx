import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ClassSelectModal } from "@/components/party/ClassSelectModal";
import { BASE_STATS_BY_CLASS } from "@/constants/baseStats";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { JobId } from "@/types/models";
import { generateId } from "@/utils/id";

export default function NewCharacterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [jobId, setJobId] = useState<JobId>("GUARDIAN");
  const [jobModalVisible, setJobModalVisible] = useState(false);

  const onSave = async () => {
    try {
      const base = BASE_STATS_BY_CLASS[jobId];
      const id = generateId("char");
      await charactersRepository.upsert({
        id,
        slotIndex: null,
        name: name.trim() || "New Character",
        jobId,
        level: 1,
        baseMaxHp: base.maxHp,
        baseAtk: base.atk,
        baseDef: base.def,
        baseSpd: base.spd,
        baseMaxMp: base.maxMp,
        baseMpRegen: base.mpRegen,
        currentHp: base.maxHp,
        currentMp: base.maxMp,
      });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : "不明なエラー";
      Alert.alert("作成失敗", `キャラクターの作成に失敗しました。\n${message}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>キャラクター作成</Text>

      <View style={styles.form}>
        <Text style={styles.label}>名前</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="キャラクター名を入力"
          placeholderTextColor="#71717a"
          style={styles.input}
        />

        <Text style={styles.label}>クラス</Text>
        <Pressable
          style={styles.jobSelector}
          onPress={() => setJobModalVisible(true)}
        >
          <Text style={styles.jobSelectorText}>{jobId}</Text>
        </Pressable>

        <View style={styles.statsPreview}>
          <Text style={styles.statsTitle}>ステータス（初期値）</Text>
          <Text style={styles.statLine}>HP: {BASE_STATS_BY_CLASS[jobId].maxHp}</Text>
          <Text style={styles.statLine}>ATK: {BASE_STATS_BY_CLASS[jobId].atk}</Text>
          <Text style={styles.statLine}>DEF: {BASE_STATS_BY_CLASS[jobId].def}</Text>
          <Text style={styles.statLine}>SPD: {BASE_STATS_BY_CLASS[jobId].spd}</Text>
          <Text style={styles.statLine}>MP: {BASE_STATS_BY_CLASS[jobId].maxMp}</Text>
        </View>

        <View style={styles.buttons}>
          <Pressable style={[styles.button, styles.saveButton]} onPress={() => void onSave()}>
            <Text style={styles.buttonText}>作成</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.cancelButton]} onPress={() => router.back()}>
            <Text style={styles.buttonText}>キャンセル</Text>
          </Pressable>
        </View>
      </View>

      <ClassSelectModal
        visible={jobModalVisible}
        selectedClassId={jobId}
        onSelect={(selected) => {
          setJobId(selected as JobId);
          setJobModalVisible(false);
        }}
        onClose={() => setJobModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  content: { padding: 16 },
  title: { marginBottom: 24, fontSize: 28, fontWeight: "700", color: "#ffffff" },
  form: { gap: 16 },
  label: { marginBottom: 4, fontSize: 14, fontWeight: "600", color: "#e4e4e7" },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#ffffff",
  },
  jobSelector: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  jobSelectorText: { color: "#f4f4f5" },
  statsPreview: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    padding: 16,
  },
  statsTitle: { marginBottom: 8, fontSize: 14, fontWeight: "600", color: "#e4e4e7" },
  statLine: { color: "#a1a1aa" },
  buttons: { marginTop: 8, flexDirection: "row", gap: 12 },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saveButton: { backgroundColor: "#059669" },
  cancelButton: { backgroundColor: "#3f3f46" },
  buttonText: { textAlign: "center", fontWeight: "600", color: "#ffffff" },
});
