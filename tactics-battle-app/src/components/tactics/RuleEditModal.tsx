import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Skill } from "@/game/skills/types";
import { getSkillDisplayName } from "@/game/skills/labels";
import { getConditionTypeLabel, getTargetTypeLabel } from "@/game/tactics/labels";
import {
  coerceRuleToSkillDefinition,
  getSkillTacticsDefinition,
  type TacticsParamField,
  validateRuleAgainstSkillDefinition,
} from "@/game/tactics/skillTacticsDefinitions";
import { useI18n } from "@/i18n";
import { ConditionType, TacticsRuleRecord, TargetType } from "@/types/models";
import { generateId } from "@/utils/id";

type Props = {
  visible: boolean;
  characterId: string;
  skills: Skill[];
  initial?: TacticsRuleRecord;
  priority: number;
  onSave: (rule: TacticsRuleRecord) => void;
  onClose: () => void;
};

const colors = {
  bgPanel: "#ffffff",
  bgSection: "#f5f5f5",
  bgAccent: "#f0f7ff",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  borderDefault: "#e0e0e0",
  borderAccent: "#93c5fd",
  iconDark: "#111111",
} as const;

const parseObject = (value: string | null): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
};

const toText = (value: unknown): string => (value == null ? "" : String(value));

const toJson = (value: Record<string, unknown> | null): string | null =>
  value ? JSON.stringify(value) : null;

const buildParams = (
  fields: TacticsParamField[] | undefined,
  values: {
    turn: string;
    threshold: string;
    status: string;
    position: string;
    count: string;
  }
): Record<string, unknown> | null => {
  if (!fields || fields.length === 0) return null;

  const params: Record<string, unknown> = {};
  for (const field of fields) {
    if (field === "turn") {
      const turn = Number(values.turn);
      if (!Number.isInteger(turn) || turn < 1) throw new Error("turn:integer");
      params.turn = turn;
      continue;
    }
    if (field === "threshold") {
      const threshold = Number(values.threshold);
      if (!Number.isFinite(threshold)) throw new Error("threshold:number");
      if (threshold < 0 || threshold > 1) throw new Error("threshold:range");
      params.threshold = threshold;
      continue;
    }
    if (field === "status") {
      const status = values.status.trim().toUpperCase();
      if (!status) throw new Error("status:required");
      params.status = status;
      continue;
    }
    if (field === "position") {
      const position = Number(values.position);
      if (!Number.isInteger(position) || position < 1) throw new Error("position:integer");
      params.position = position;
      continue;
    }
    if (field === "count") {
      const count = Number(values.count);
      if (!Number.isInteger(count) || count < 1) throw new Error("count:integer");
      params.count = count;
    }
  }

  return params;
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
  const { t } = useI18n();

  const [skillId, setSkillId] = useState("");
  const [conditionType, setConditionType] = useState<ConditionType>("ALWAYS");
  const [targetType, setTargetType] = useState<TargetType>("AUTO");
  const [turnValue, setTurnValue] = useState("");
  const [thresholdValue, setThresholdValue] = useState("");
  const [statusValue, setStatusValue] = useState("");
  const [countValue, setCountValue] = useState("");
  const [targetStatusValue, setTargetStatusValue] = useState("");
  const [targetPositionValue, setTargetPositionValue] = useState("");

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === skillId) ?? skills[0],
    [skills, skillId]
  );

  const definition = useMemo(
    () =>
      getSkillTacticsDefinition(
        selectedSkill?.id ?? skillId,
        selectedSkill?.target
      ),
    [selectedSkill, skillId]
  );

  useEffect(() => {
    if (!visible) return;

    const nextSkill = initial
      ? skills.find((skill) => skill.id === initial.skillId) ?? skills[0]
      : skills[0];
    const nextSkillId = nextSkill?.id ?? "";
    const nextDefinition = getSkillTacticsDefinition(nextSkillId, nextSkill?.target);

    const seedRule: TacticsRuleRecord = initial ?? {
      id: generateId("rule"),
      characterId,
      priority,
      skillId: nextSkillId,
      conditionType: nextDefinition.defaultCondition.type,
      conditionParams: toJson(nextDefinition.defaultCondition.params),
      targetType: nextDefinition.defaultTarget.type,
      targetParams: toJson(nextDefinition.defaultTarget.params),
    };

    const normalized = coerceRuleToSkillDefinition(
      { ...seedRule, skillId: nextSkillId },
      nextDefinition
    );
    const conditionParams = parseObject(normalized.conditionParams);
    const targetParams = parseObject(normalized.targetParams);

    setSkillId(nextSkillId);
    setConditionType(normalized.conditionType);
    setTargetType(normalized.targetType);
    setTurnValue(toText(conditionParams.turn));
    setThresholdValue(toText(conditionParams.threshold));
    setStatusValue(toText(conditionParams.status));
    setCountValue(toText(conditionParams.count));
    setTargetStatusValue(toText(targetParams.status));
    setTargetPositionValue(toText(targetParams.position));
  }, [visible, initial, skills, characterId, priority]);

  const handleSelectSkill = (nextSkill: Skill) => {
    const nextDefinition = getSkillTacticsDefinition(nextSkill.id, nextSkill.target);
    setSkillId(nextSkill.id);

    if (!nextDefinition.allowedConditions.includes(conditionType)) {
      setConditionType(nextDefinition.defaultCondition.type);
      setTurnValue(toText(nextDefinition.defaultCondition.params?.turn));
      setThresholdValue(toText(nextDefinition.defaultCondition.params?.threshold));
      setStatusValue(toText(nextDefinition.defaultCondition.params?.status));
      setCountValue(toText(nextDefinition.defaultCondition.params?.count));
    }

    if (!nextDefinition.allowedTargets.includes(targetType)) {
      setTargetType(nextDefinition.defaultTarget.type);
      setTargetStatusValue(toText(nextDefinition.defaultTarget.params?.status));
      setTargetPositionValue(toText(nextDefinition.defaultTarget.params?.position));
    }
  };

  const conditionFields =
    definition.paramSchema.condition[conditionType]?.fields ?? [];
  const targetFields = definition.paramSchema.target[targetType]?.fields ?? [];
  const hideTargetEditor =
    definition.allowedTargets.length === 1 &&
    definition.allowedTargets[0] === "AUTO" &&
    targetFields.length === 0;

  const formatValidationError = (message: string): string => {
    if (
      message === "condition_type:not_allowed" ||
      message === "target_type:not_allowed"
    ) {
      return t("tactics.validation.invalid_combo");
    }

    const [field, kind] = message.split(":");
    const fieldLabel =
      field === "turn"
        ? t("tactics.param.turn")
        : field === "threshold"
          ? t("tactics.param.threshold")
          : field === "position"
            ? t("tactics.param.position")
            : field === "status"
              ? t("tactics.param.status")
              : field === "count"
                ? t("tactics.param.count")
              : field;
    if (kind === "range" && field === "threshold") {
      return t("tactics.validation.threshold_range", { field: fieldLabel });
    }
    if (kind === "number") return t("tactics.validation.number", { field: fieldLabel });
    if (kind === "integer") return t("tactics.validation.integer", { field: fieldLabel });
    if (kind === "required") return t("tactics.validation.required", { field: fieldLabel });
    return t("tactics.validation.invalid");
  };

  const renderConditionFields = () => (
    <View>
      {conditionFields.includes("turn") ? (
        <TextInput
          value={turnValue}
          onChangeText={setTurnValue}
          style={styles.input}
          placeholder={t("tactics.placeholder.turn")}
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
        />
      ) : null}
      {conditionFields.includes("threshold") ? (
        <TextInput
          value={thresholdValue}
          onChangeText={setThresholdValue}
          style={styles.input}
          placeholder={t("tactics.placeholder.threshold")}
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
        />
      ) : null}
      {conditionFields.includes("status") ? (
        <TextInput
          value={statusValue}
          onChangeText={setStatusValue}
          style={styles.input}
          placeholder={t("tactics.placeholder.status")}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
        />
      ) : null}
      {conditionFields.includes("count") ? (
        <TextInput
          value={countValue}
          onChangeText={setCountValue}
          style={styles.input}
          placeholder={t("tactics.placeholder.count")}
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
        />
      ) : null}
      {conditionFields.length === 0 ? (
        <Text style={styles.hintText}>{t("tactics.ui.noExtraParams")}</Text>
      ) : null}
    </View>
  );

  const renderTargetFields = () => (
    <View>
      {targetFields.includes("status") ? (
        <TextInput
          value={targetStatusValue}
          onChangeText={setTargetStatusValue}
          style={styles.input}
          placeholder={t("tactics.placeholder.status")}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
        />
      ) : null}
      {targetFields.includes("position") ? (
        <TextInput
          value={targetPositionValue}
          onChangeText={setTargetPositionValue}
          style={styles.input}
          placeholder={t("tactics.placeholder.position")}
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
        />
      ) : null}
      {targetFields.length === 0 ? (
        <Text style={styles.hintText}>{t("tactics.ui.noExtraParams")}</Text>
      ) : null}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{t("tactics.ui.editRule")}</Text>

            <Text style={styles.label}>{t("tactics.ui.skill")}</Text>
            <View style={styles.optionRow}>
              {skills.map((skill) => (
                <Pressable
                  key={skill.id}
                  onPress={() => handleSelectSkill(skill)}
                  style={[
                    styles.optionButton,
                    skillId === skill.id ? styles.optionSelected : styles.optionDefault,
                  ]}
                >
                  <Text style={styles.optionText}>{getSkillDisplayName(skill, t)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>{t("tactics.ui.condition")}</Text>
            <View style={styles.optionRow}>
              {definition.allowedConditions.map((type) => {
                const fixed = definition.allowedConditions.length === 1;
                return (
                  <Pressable
                    key={type}
                    onPress={() => {
                      if (fixed) return;
                      setConditionType(type);
                    }}
                    style={[
                      styles.optionButton,
                      conditionType === type ? styles.optionSelected : styles.optionDefault,
                      fixed ? styles.optionDisabled : null,
                    ]}
                    disabled={fixed}
                  >
                    <Text style={styles.optionText}>{getConditionTypeLabel(type, t)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>{t("tactics.ui.conditionParams")}</Text>
            {renderConditionFields()}

            {hideTargetEditor ? null : (
              <>
                <Text style={styles.label}>{t("tactics.ui.target")}</Text>
                <View style={styles.optionRow}>
                  {definition.allowedTargets.map((target) => {
                    const fixed = definition.allowedTargets.length === 1;
                    return (
                      <Pressable
                        key={target}
                        onPress={() => {
                          if (fixed) return;
                          setTargetType(target);
                        }}
                        style={[
                          styles.optionButton,
                          targetType === target ? styles.optionSelected : styles.optionDefault,
                          fixed ? styles.optionDisabled : null,
                        ]}
                        disabled={fixed}
                      >
                        <Text style={styles.optionText}>{getTargetTypeLabel(target, t)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t("tactics.ui.targetParams")}</Text>
                {renderTargetFields()}
              </>
            )}

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => {
                  try {
                    const nextSkill = selectedSkill;
                    const nextSkillId = nextSkill?.id ?? "";
                    const nextDefinition = getSkillTacticsDefinition(
                      nextSkillId,
                      nextSkill?.target
                    );
                    const nextConditionParams = buildParams(
                      nextDefinition.paramSchema.condition[conditionType]?.fields,
                      {
                        turn: turnValue,
                        threshold: thresholdValue,
                        status: statusValue,
                        position: "",
                        count: countValue,
                      }
                    );
                    const nextTargetParams = buildParams(
                      nextDefinition.paramSchema.target[targetType]?.fields,
                      {
                        turn: "",
                        threshold: "",
                        status: targetStatusValue,
                        position: targetPositionValue,
                        count: "",
                      }
                    );

                    const nextRule: TacticsRuleRecord = {
                      id: initial?.id ?? generateId("rule"),
                      characterId,
                      priority,
                      skillId: nextSkillId,
                      conditionType,
                      conditionParams: toJson(nextConditionParams),
                      targetType,
                      targetParams: toJson(nextTargetParams),
                    };

                    const validation = validateRuleAgainstSkillDefinition(
                      nextRule,
                      nextDefinition
                    );
                    if (!validation.ok) {
                      throw new Error(validation.reason);
                    }

                    onSave(nextRule);
                    onClose();
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? formatValidationError(error.message)
                        : t("tactics.validation.invalid");
                    Alert.alert(t("tactics.validation.title"), message);
                  }
                }}
                style={[styles.actionButton, styles.saveButton]}
              >
                <Text style={styles.actionText}>{t("tactics.ui.save")}</Text>
              </Pressable>
              <Pressable onPress={onClose} style={[styles.actionButton, styles.cancelButton]}>
                <Text style={styles.actionText}>{t("common.cancel")}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  panel: {
    maxHeight: "86%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.bgPanel,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: { marginBottom: 12, fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  label: {
    marginBottom: 6,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
  },
  optionRow: { marginBottom: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bgSection,
  },
  optionSelected: { borderColor: colors.borderAccent, backgroundColor: colors.bgAccent },
  optionDefault: { borderColor: colors.borderDefault },
  optionDisabled: { opacity: 0.6 },
  optionText: { color: colors.textPrimary, fontSize: 12, fontWeight: "500" },
  input: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSection,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
  },
  hintText: { marginBottom: 12, color: colors.textTertiary, fontSize: 11 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionButton: { flex: 1, borderRadius: 12, paddingVertical: 10 },
  saveButton: { backgroundColor: colors.iconDark },
  cancelButton: { backgroundColor: colors.textSecondary },
  actionText: { textAlign: "center", color: "#ffffff", fontWeight: "600" },
});
