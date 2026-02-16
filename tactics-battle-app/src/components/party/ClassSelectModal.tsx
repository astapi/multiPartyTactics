import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CLASS_OPTIONS } from "@/constants/jobs";

type Props = {
  visible: boolean;
  selectedClassId: string;
  onSelect: (classId: string) => void;
  onClose: () => void;
};

export const ClassSelectModal = ({ visible, selectedClassId, onSelect, onClose }: Props) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.overlay}>
      <View style={styles.container}>
        <Text style={styles.title}>クラス選択</Text>
        {CLASS_OPTIONS.map((classOption) => (
          <Pressable
            key={classOption.id}
            onPress={() => onSelect(classOption.id)}
            style={[styles.option, selectedClassId === classOption.id ? styles.optionSelected : styles.optionDefault]}
          >
            <Text style={styles.optionLabel}>{classOption.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeLabel}>閉じる</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 32,
  },
  container: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#18181b",
    padding: 16,
  },
  title: { marginBottom: 12, fontSize: 18, fontWeight: "600", color: "#ffffff" },
  option: { marginBottom: 8, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  optionSelected: { borderColor: "#10b981", backgroundColor: "rgba(6, 78, 59, 0.4)" },
  optionDefault: { borderColor: "#3f3f46" },
  optionLabel: { color: "#f4f4f5" },
  closeButton: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: "#3f3f46",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeLabel: { textAlign: "center", color: "#ffffff" },
});
