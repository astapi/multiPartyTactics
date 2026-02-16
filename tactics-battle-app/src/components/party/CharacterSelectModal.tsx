import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CharacterRecord } from "@/types/models";

type Props = {
  visible: boolean;
  characters: CharacterRecord[];
  slotIndex: number;
  onSelect: (character: CharacterRecord) => void;
  onClear: () => void;
  onClose: () => void;
};

export function CharacterSelectModal({
  visible,
  characters,
  slotIndex,
  onSelect,
  onClear,
  onClose,
}: Props) {
  const availableCharacters = characters.filter(
    (c) => c.slotIndex === null || c.slotIndex === slotIndex
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>スロット {slotIndex + 1} にキャラクターを配置</Text>

          <ScrollView style={styles.list}>
            {availableCharacters.length === 0 ? (
              <Text style={styles.emptyText}>配置可能なキャラクターがいません</Text>
            ) : (
              availableCharacters.map((character) => (
                <Pressable
                  key={character.id}
                  style={[
                    styles.characterItem,
                    character.slotIndex === slotIndex && styles.selectedItem,
                  ]}
                  onPress={() => onSelect(character)}
                >
                  <Text style={styles.characterName}>{character.name}</Text>
                  <Text style={styles.characterClass}>{character.classId}</Text>
                  {character.slotIndex === slotIndex && (
                    <Text style={styles.currentBadge}>現在配置中</Text>
                  )}
                </Pressable>
              ))
            )}
          </ScrollView>

          <View style={styles.buttons}>
            <Pressable style={[styles.button, styles.clearButton]} onPress={onClear}>
              <Text style={styles.buttonText}>スロットを空にする</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.buttonText}>キャンセル</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  content: {
    width: "85%",
    maxHeight: "70%",
    borderRadius: 16,
    backgroundColor: "#18181b",
    padding: 16,
  },
  title: {
    marginBottom: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  list: {
    maxHeight: 300,
  },
  emptyText: {
    paddingVertical: 24,
    textAlign: "center",
    color: "#71717a",
  },
  characterItem: {
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#27272a",
    padding: 12,
  },
  selectedItem: {
    borderColor: "#059669",
    backgroundColor: "#064e3b",
  },
  characterName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  characterClass: {
    marginTop: 2,
    color: "#a1a1aa",
  },
  currentBadge: {
    marginTop: 4,
    fontSize: 12,
    color: "#34d399",
  },
  buttons: {
    marginTop: 16,
    gap: 8,
  },
  button: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  clearButton: {
    backgroundColor: "#dc2626",
  },
  cancelButton: {
    backgroundColor: "#3f3f46",
  },
  buttonText: {
    textAlign: "center",
    fontWeight: "600",
    color: "#ffffff",
  },
});
