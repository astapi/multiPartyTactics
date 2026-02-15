import { useCallback, useEffect, useState } from "react";
import { Link, useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { JobSelectModal } from "@/components/party/JobSelectModal";
import { BASE_STATS_BY_JOB } from "@/constants/baseStats";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { CharacterRecord, JobId } from "@/types/models";

export default function CharacterDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [character, setCharacter] = useState<CharacterRecord | null>(null);
  const [name, setName] = useState("");
  const [jobId, setJobId] = useState<JobId>("GUARDIAN");
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isSlotIndexConstraintError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    return error.message.includes("NOT NULL constraint failed: characters.slot_index");
  };

  const load = useCallback(async () => {
    if (!id) return;
    const found = await charactersRepository.getById(id);
    if (found) {
      setCharacter(found);
      setName(found.name);
      setJobId(found.jobId);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onSave = async () => {
    if (!character) return;
    try {
      const base = BASE_STATS_BY_JOB[jobId];
      await charactersRepository.upsert({
        ...character,
        name: name.trim() || character.name,
        jobId,
        baseMaxHp: base.maxHp,
        baseAtk: base.atk,
        baseDef: base.def,
        baseSpd: base.spd,
        baseMaxMp: base.maxMp,
        baseMpRegen: base.mpRegen,
      });
      setIsEditing(false);
      await load();
    } catch (error) {
      if (isSlotIndexConstraintError(error)) {
        Alert.alert(
          "保存失敗",
          "データベースのスキーマ不整合を検出しました。設定画面の「データベース初期化（全データ削除）」を実行してください。"
        );
        return;
      }
      const message = error instanceof Error ? error.message : "不明なエラー";
      Alert.alert("保存失敗", `キャラクターの保存に失敗しました。\n${message}`);
    }
  };

  const onDelete = () => {
    Alert.alert(
      "削除確認",
      `${character?.name} を削除しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            await charactersRepository.deleteById(id);
            router.back();
          },
        },
      ]
    );
  };

  if (!character) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{character.name}</Text>

      {character.slotIndex !== null && (
        <View style={styles.slotInfo}>
          <Text style={styles.slotText}>PT スロット {character.slotIndex + 1} に配置中</Text>
        </View>
      )}

      {isEditing ? (
        <View style={styles.form}>
          <Text style={styles.label}>名前</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="キャラクター名"
            placeholderTextColor="#71717a"
            style={styles.input}
          />

          <Text style={styles.label}>ジョブ</Text>
          <Pressable
            style={styles.jobSelector}
            onPress={() => setJobModalVisible(true)}
          >
            <Text style={styles.jobSelectorText}>{jobId}</Text>
          </Pressable>

          <View style={styles.buttons}>
            <Pressable style={[styles.button, styles.saveButton]} onPress={() => void onSave()}>
              <Text style={styles.buttonText}>保存</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                setName(character.name);
                setJobId(character.jobId);
                setIsEditing(false);
              }}
            >
              <Text style={styles.buttonText}>キャンセル</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ジョブ</Text>
            <Text style={styles.infoValue}>{character.jobId}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>レベル</Text>
            <Text style={styles.infoValue}>{character.level}</Text>
          </View>

          <Text style={styles.sectionTitle}>ステータス</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>HP</Text>
              <Text style={styles.statValue}>{character.baseMaxHp}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>ATK</Text>
              <Text style={styles.statValue}>{character.baseAtk}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>DEF</Text>
              <Text style={styles.statValue}>{character.baseDef}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>SPD</Text>
              <Text style={styles.statValue}>{character.baseSpd}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>MP</Text>
              <Text style={styles.statValue}>{character.baseMaxMp}</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <Link href={`/characters/${id}/tactics`} asChild>
              <Pressable style={[styles.actionButton, styles.tacticsButton]}>
                <Text style={styles.buttonText}>タクティクス設定</Text>
              </Pressable>
            </Link>
            <Pressable
              style={[styles.actionButton, styles.editButton]}
              onPress={() => setIsEditing(true)}
            >
              <Text style={styles.buttonText}>編集</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={onDelete}>
              <Text style={styles.buttonText}>削除</Text>
            </Pressable>
          </View>
        </View>
      )}

      <JobSelectModal
        visible={jobModalVisible}
        selectedJobId={jobId}
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#09090b",
  },
  loadingText: { color: "#d4d4d8" },
  container: { flex: 1, backgroundColor: "#09090b" },
  content: { padding: 16 },
  title: { marginBottom: 16, fontSize: 28, fontWeight: "700", color: "#ffffff" },
  slotInfo: {
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: "#0369a1",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  slotText: { fontWeight: "600", color: "#ffffff" },
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
  infoSection: { gap: 12 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
    paddingVertical: 12,
  },
  infoLabel: { color: "#a1a1aa" },
  infoValue: { fontWeight: "600", color: "#ffffff" },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#e4e4e7",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statItem: {
    width: "30%",
    borderRadius: 8,
    backgroundColor: "#18181b",
    padding: 12,
    alignItems: "center",
  },
  statLabel: { fontSize: 12, color: "#71717a" },
  statValue: { marginTop: 4, fontSize: 18, fontWeight: "600", color: "#ffffff" },
  actionButtons: { marginTop: 24, gap: 12 },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tacticsButton: { backgroundColor: "#7c3aed" },
  editButton: { backgroundColor: "#0369a1" },
  deleteButton: { backgroundColor: "#dc2626" },
});
