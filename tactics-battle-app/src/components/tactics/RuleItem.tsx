import { Pressable, StyleSheet, Text, View } from "react-native";
import { Pencil, Trash2 } from "lucide-react-native";
import { useI18n } from "@/i18n";
import {
  describeConditionSentence,
  getSkillIdDisplayName,
  getTargetTypeLabel,
  summarizeTargetParams,
} from "@/game/tactics/labels";
import { TacticsRuleRecord } from "@/types/models";

type Props = {
  rule: TacticsRuleRecord;
  onEdit: () => void;
  onDelete: () => void;
};

const colors = {
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  borderDefault: "#e0e0e0",
  iconDark: "#111111",
} as const;

export const RuleItem = ({ rule, onEdit, onDelete }: Props) => {
  const { t } = useI18n();
  const hasTargetDetails =
    rule.targetType !== "AUTO" ||
    (rule.targetParams != null && rule.targetParams.trim().length > 0);
  const targetSummary = summarizeTargetParams(rule, t);
  const actionName = getSkillIdDisplayName(rule.skillId, t);
  const conditionText = describeConditionSentence(rule, t);
  const targetText = `${getTargetTypeLabel(rule.targetType, t)}${
    targetSummary ? ` (${targetSummary})` : ""
  }`;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{`#${rule.priority} ${actionName}`}</Text>
        <View style={styles.iconActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tactics.ui.edit")}
            onPress={onEdit}
            style={[styles.iconButton, styles.editButton]}
          >
            <Pencil size={14} stroke="#ffffff" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tactics.ui.delete")}
            onPress={onDelete}
            style={[styles.iconButton, styles.deleteButton]}
          >
            <Trash2 size={14} stroke="#ffffff" />
          </Pressable>
        </View>
      </View>
      <Text style={styles.condition}>{`${t("tactics.ui.condition")}: ${conditionText}`}</Text>
      {hasTargetDetails ? (
        <Text style={styles.target}>{`${t("tactics.ui.target")}: ${targetText}`}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  iconActions: { flexDirection: "row", gap: 6 },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  condition: { marginTop: 8, color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  target: { marginTop: 4, color: colors.textTertiary, fontSize: 11, fontWeight: "500" },
  editButton: { backgroundColor: colors.iconDark },
  deleteButton: { backgroundColor: colors.textSecondary },
});
