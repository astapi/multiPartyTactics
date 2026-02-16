import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Skill } from "@/game/skills";
import { ConditionType, TacticsRuleRecord, TargetType } from "@/types/models";
import { generateId } from "@/utils/id";

const CONDITIONS: ConditionType[] = [
  "TURN_EQUALS",
  "SELF_HP_BELOW",
  "ALLY_HP_BELOW",
  "ENEMY_HP_BELOW",
  "ANY_ALLY_HAS_STATUS",
  "ALWAYS",
];
const TARGETS: TargetType[] = [
  "SELF",
  "ALLY_LOWEST_HP",
  "ALLY_WITH_STATUS_LOWEST_HP",
  "ENEMY_FIRST",
  "ENEMY_LOWEST_HP",
];

type Props = {
  visible: boolean;
  characterId: string;
  skills: Skill[];
  initial?: TacticsRuleRecord;
  priority: number;
  onSave: (rule: TacticsRuleRecord) => void;
  onClose: () => void;
};

export const RuleEditModal = ({
  visible,
  characterId,
  skills,
  initial,
  priority,
  onSave,
  onClose,
}: Props) => {
  const [skillId, setSkillId] = useState(initial?.skillId ?? skills[0]?.id ?? "");
  const [conditionType, setConditionType] = useState<ConditionType>(
    initial?.conditionType ?? "ALWAYS"
  );
  const [targetType, setTargetType] = useState<TargetType>(initial?.targetType ?? "ENEMY_FIRST");
  const [conditionParams, setConditionParams] = useState(initial?.conditionParams ?? "{}");
  const [targetParams, setTargetParams] = useState(initial?.targetParams ?? "{}");

  const skillButtons = useMemo(() => skills.slice(0, 8), [skills]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>ルール編集</Text>
          <Text style={styles.label}>Skill</Text>
          <View style={styles.optionRow}>
            {skillButtons.map((skill) => (
              <Pressable
                key={skill.id}
                onPress={() => setSkillId(skill.id)}
                style={[styles.optionButton, skillId === skill.id ? styles.optionSelected : styles.optionDefault]}
              >
                <Text style={styles.optionText}>{skill.name}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Condition</Text>
          <View style={styles.optionRow}>
            {CONDITIONS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setConditionType(c)}
                style={[styles.optionButton, conditionType === c ? styles.optionSelected : styles.optionDefault]}
              >
                <Text style={styles.optionText}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Target</Text>
          <View style={styles.optionRow}>
            {TARGETS.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTargetType(t)}
                style={[styles.optionButton, targetType === t ? styles.optionSelected : styles.optionDefault]}
              >
                <Text style={styles.optionText}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Condition Params (JSON)</Text>
          <TextInput
            value={conditionParams}
            onChangeText={setConditionParams}
            style={styles.input}
          />

          <Text style={styles.label}>Target Params (JSON)</Text>
          <TextInput
            value={targetParams}
            onChangeText={setTargetParams}
            style={[styles.input, styles.inputLast]}
          />

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => {
                onSave({
                  id: initial?.id ?? generateId("rule"),
                  characterId,
                  priority,
                  skillId,
                  conditionType,
                  conditionParams,
                  targetType,
                  targetParams,
                });
                onClose();
              }}
              style={[styles.actionButton, styles.saveButton]}
            >
              <Text style={styles.actionText}>保存</Text>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.actionButton, styles.cancelButton]}>
              <Text style={styles.actionText}>キャンセル</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  panel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#18181b",
    padding: 16,
  },
  title: { marginBottom: 12, fontSize: 18, fontWeight: "600", color: "#ffffff" },
  label: { marginBottom: 4, color: "#d4d4d8" },
  optionRow: { marginBottom: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  optionSelected: { borderColor: "#10b981" },
  optionDefault: { borderColor: "#3f3f46" },
  optionText: { color: "#f4f4f5" },
  input: {
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#ffffff",
  },
  inputLast: { marginBottom: 16 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionButton: { flex: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  saveButton: { backgroundColor: "#059669" },
  cancelButton: { backgroundColor: "#3f3f46" },
  actionText: { textAlign: "center", fontWeight: "600", color: "#ffffff" },
});
