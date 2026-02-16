import { StyleSheet, View } from "react-native";

type Props = {
  value: number;
  max: number;
  color?: string;
};

export const ProgressBar = ({ value, max, color = "#10b981" }: Props) => {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 12,
    width: "100%",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#3f3f46",
  },
  fill: {
    height: "100%",
  },
});
