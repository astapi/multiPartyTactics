import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/common/Card";
import { useI18n } from "@/i18n";
import {
  getConditionTypeLabel,
  getSkillIdDisplayName,
  getTargetTypeLabel,
  summarizeConditionParams,
  summarizeTargetParams,
} from "@/game/tactics/labels";
import { TacticsRuleRecord } from "@/types/models";

type Props = {
  rule: TacticsRuleRecord;
  onEdit: () => void;
  onDelete: () => void;
};

export const RuleItem = ({ rule, onEdit, onDelete }: Props) => {
  const { t } = useI18n();
  const conditionSummary = summarizeConditionParams(rule, t);
  const targetSummary = summarizeTargetParams(rule, t);

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.priority}>#{rule.priority}</Text>
        <Text style={styles.skill}>{getSkillIdDisplayName(rule.skillId, t)}</Text>
      </View>
      <Text style={styles.meta}>
        {getConditionTypeLabel(rule.conditionType, t)}
        {conditionSummary ? ` (${conditionSummary})` : ""} / {getTargetTypeLabel(rule.targetType, t)}
        {targetSummary ? ` (${targetSummary})` : ""}
      </Text>
      <View style={styles.buttons}>
        <Pressable onPress={onEdit} style={[styles.button, styles.editButton]}>
          <Text style={styles.buttonLabel}>{t("tactics.ui.edit")}</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={[styles.button, styles.deleteButton]}>
          <Text style={styles.buttonLabel}>{t("tactics.ui.delete")}</Text>
        </Pressable>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priority: { fontWeight: "600", color: "#ffffff" },
  skill: { color: "#d4d4d8" },
  meta: { marginTop: 4, color: "#a1a1aa" },
  buttons: { marginTop: 12, flexDirection: "row", gap: 8 },
  button: { flex: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  editButton: { backgroundColor: "#047857" },
  deleteButton: { backgroundColor: "#be123c" },
  buttonLabel: { textAlign: "center", color: "#ffffff" },
});
