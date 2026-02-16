import { Pressable, StyleSheet, Text } from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export const Button = ({ label, onPress, disabled }: Props) => (
  <Pressable onPress={onPress} disabled={disabled} style={[styles.base, disabled ? styles.disabled : styles.enabled]}>
    <Text style={styles.label}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  enabled: {
    backgroundColor: "#059669",
  },
  disabled: {
    backgroundColor: "#71717a",
  },
  label: {
    textAlign: "center",
    fontWeight: "600",
    color: "#ffffff",
  },
});
