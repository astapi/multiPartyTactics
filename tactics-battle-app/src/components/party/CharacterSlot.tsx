import { StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { CharacterRecord } from "@/types/models";

type Props = {
  slotIndex: number;
  character?: CharacterRecord;
  onEdit: () => void;
  onDelete: () => void;
  onTactics: () => void;
};

export const CharacterSlot = ({ slotIndex, character, onEdit, onDelete, onTactics }: Props) => (
  <Card style={styles.card}>
    <View style={styles.headerRow}>
      <Text style={styles.slotTitle}>Slot {slotIndex + 1}</Text>
      {character ? (
        <Text style={styles.classText}>{character.jobId}</Text>
      ) : (
        <Text style={styles.emptyText}>Empty</Text>
      )}
    </View>
    <Text style={styles.nameText}>{character ? character.name : "キャラ未設定"}</Text>
    <View style={styles.buttonRow}>
      <View style={styles.buttonCell}>
        <Button label={character ? "編集" : "追加"} onPress={onEdit} />
      </View>
      <View style={styles.buttonCell}>
        <Button label="タクティクス" onPress={onTactics} disabled={!character} />
      </View>
      <View style={styles.buttonCell}>
        <Button label="削除" onPress={onDelete} disabled={!character} />
      </View>
    </View>
  </Card>
);

const styles = StyleSheet.create({
  card: { gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slotTitle: { fontSize: 18, fontWeight: "600", color: "#ffffff" },
  classText: { color: "#d4d4d8" },
  emptyText: { color: "#71717a" },
  nameText: { color: "#e4e4e7" },
  buttonRow: { flexDirection: "row", gap: 8 },
  buttonCell: { flex: 1 },
});
