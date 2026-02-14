import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { CharacterSlot } from "@/components/party/CharacterSlot";
import { JobSelectModal } from "@/components/party/JobSelectModal";
import { BASE_STATS_BY_JOB } from "@/constants/baseStats";
import { useCharacters } from "@/hooks/useCharacters";
import { JobId } from "@/types/models";
import { generateId } from "@/utils/id";

type EditingSlot = {
  slotIndex: number;
  id?: string;
  initialName: string;
  initialJobId: JobId;
};

const emptyEditing: EditingSlot = {
  slotIndex: 0,
  initialName: "",
  initialJobId: "GUARDIAN",
};

export default function PartyScreen() {
  const router = useRouter();
  const { characters, saveCharacter, removeCharacter } = useCharacters();
  const [editing, setEditing] = useState<EditingSlot | null>(null);
  const [name, setName] = useState("");
  const [jobId, setJobId] = useState<JobId>("GUARDIAN");
  const [jobModalVisible, setJobModalVisible] = useState(false);

  const slotMap = useMemo(() => {
    const map = new Map<number, (typeof characters)[number]>();
    for (const c of characters) map.set(c.slotIndex, c);
    return map;
  }, [characters]);

  const openEditor = (slotIndex: number) => {
    const found = slotMap.get(slotIndex);
    const next: EditingSlot = found
      ? { slotIndex, id: found.id, initialName: found.name, initialJobId: found.jobId }
      : { ...emptyEditing, slotIndex };
    setEditing(next);
    setName(next.initialName || `Unit ${slotIndex + 1}`);
    setJobId(next.initialJobId);
  };

  const onSave = async () => {
    if (!editing) return;
    const base = BASE_STATS_BY_JOB[jobId];
    const id = editing.id ?? generateId("char");
    await saveCharacter({
      id,
      slotIndex: editing.slotIndex,
      name: name.trim() || `Unit ${editing.slotIndex + 1}`,
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
    setEditing(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>PT編成 (6 Slots)</Text>
      <View style={styles.slotList}>
        {Array.from({ length: 6 }).map((_, index) => {
          const character = slotMap.get(index);
          return (
            <CharacterSlot
              key={index}
              slotIndex={index}
              character={character}
              onEdit={() => openEditor(index)}
              onDelete={async () => {
                if (!character) return;
                await removeCharacter(character.id);
              }}
              onTactics={() => {
                if (!character) return;
                router.push(`/party/${character.id}/tactics`);
              }}
            />
          );
        })}
      </View>

      {editing && (
        <View style={styles.editorCard}>
          <Text style={styles.editorTitle}>キャラ編集</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#71717a"
            style={styles.input}
          />
          <Pressable
            style={styles.jobSelector}
            onPress={() => setJobModalVisible(true)}
          >
            <Text style={styles.jobSelectorText}>Job: {jobId}</Text>
          </Pressable>
          <View style={styles.editorButtons}>
            <Pressable style={[styles.editorButton, styles.saveButton]} onPress={() => void onSave()}>
              <Text style={styles.editorButtonText}>保存</Text>
            </Pressable>
            <Pressable style={[styles.editorButton, styles.cancelButton]} onPress={() => setEditing(null)}>
              <Text style={styles.editorButtonText}>キャンセル</Text>
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
  container: { flex: 1, backgroundColor: "#09090b" },
  content: { padding: 16 },
  title: { marginBottom: 16, fontSize: 28, fontWeight: "700", color: "#ffffff" },
  slotList: { gap: 12 },
  editorCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    padding: 16,
  },
  editorTitle: { marginBottom: 8, fontSize: 18, fontWeight: "600", color: "#ffffff" },
  input: {
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#ffffff",
  },
  jobSelector: {
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  jobSelectorText: { color: "#f4f4f5" },
  editorButtons: { flexDirection: "row", gap: 8 },
  editorButton: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  saveButton: { backgroundColor: "#059669" },
  cancelButton: { backgroundColor: "#3f3f46" },
  editorButtonText: { textAlign: "center", fontWeight: "600", color: "#ffffff" },
});
