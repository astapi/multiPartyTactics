import { StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "@/components/common/ProgressBar";

type Props = {
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
};

export const UnitStatusBar = ({ name, hp, maxHp, mp, maxMp }: Props) => (
  <View style={styles.container}>
    <Text style={styles.name}>{name}</Text>
    <Text style={styles.statLabel}>
      HP {hp}/{maxHp}
    </Text>
    <ProgressBar value={hp} max={maxHp} color="#ef4444" />
    <Text style={[styles.statLabel, styles.mpMargin]}>
      MP {mp}/{maxMp}
    </Text>
    <ProgressBar value={mp} max={maxMp} color="#0ea5e9" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    padding: 12,
  },
  name: { marginBottom: 8, fontWeight: "600", color: "#ffffff" },
  statLabel: { marginBottom: 4, fontSize: 12, color: "#d4d4d8" },
  mpMargin: { marginTop: 8 },
});
