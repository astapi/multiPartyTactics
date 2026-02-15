import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { RuleEditModal } from "@/components/tactics/RuleEditModal";
import { RuleItem } from "@/components/tactics/RuleItem";
import { useCharacters } from "@/hooks/useCharacters";
import { useTactics } from "@/hooks/useTactics";
import { JOB_DEFINITIONS } from "@/game/skills";
import { TacticsRuleRecord } from "@/types/models";

export default function TacticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { characters } = useCharacters();
  const { rules, saveRules } = useTactics(id);
  const [editing, setEditing] = useState<TacticsRuleRecord | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);

  const character = useMemo(
    () => characters.find((c) => c.id === id),
    [characters, id]
  );
  const skills = useMemo(() => {
    const job = JOB_DEFINITIONS.find((jobDef) => jobDef.id === character?.jobId);
    return job?.skills ?? [];
  }, [character?.jobId]);

  if (!character) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Character not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {character.name} Tactics
      </Text>
      <Pressable
        onPress={() => {
          setEditing(undefined);
          setModalVisible(true);
        }}
      >
        <Text style={styles.addRuleButton}>ルール追加</Text>
      </Pressable>

      <DraggableFlatList
        data={rules}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) =>
          void saveRules(data.map((rule, index) => ({ ...rule, priority: index + 1 })))
        }
        renderItem={({ item, drag, isActive }: RenderItemParams<TacticsRuleRecord>) => (
          <View style={{ opacity: isActive ? 0.6 : 1 }}>
            <Text onLongPress={drag} style={styles.dragHint}>
              長押しで並べ替え
            </Text>
            <RuleItem
              rule={item}
              onEdit={() => {
                setEditing(item);
                setModalVisible(true);
              }}
              onDelete={() =>
                void saveRules(rules.filter((rule) => rule.id !== item.id))
              }
            />
          </View>
        )}
      />

      <RuleEditModal
        visible={modalVisible}
        characterId={character.id}
        skills={skills}
        initial={editing}
        priority={editing?.priority ?? rules.length + 1}
        onSave={(rule) => {
          const next =
            editing == null
              ? [...rules, rule]
              : rules.map((r) => (r.id === editing.id ? { ...rule, id: editing.id } : r));
          void saveRules(next);
        }}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#09090b",
  },
  notFoundText: { color: "#d4d4d8" },
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  title: { marginBottom: 12, fontSize: 20, fontWeight: "600", color: "#ffffff" },
  addRuleButton: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: "#059669",
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: "center",
    fontWeight: "600",
    color: "#ffffff",
  },
  dragHint: { fontSize: 12, color: "#71717a" },
});
