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
import { getSkillDisplayName, Skill } from "@/game/skills";
import { getConditionTypeLabel, getTargetTypeLabel } from "@/game/tactics/labels";
import { useI18n } from "@/i18n";
import { ConditionType, TacticsRuleRecord, TargetType } from "@/types/models";
import { generateId } from "@/utils/id";

const CONDITIONS: ConditionType[] = [
  "TURN_EQUALS",
  "SELF_HP_BELOW",
  "ALLY_HP_BELOW",
  "ALLY_MP_BELOW",
  "ENEMY_HP_BELOW",
  "ANY_ALLY_HAS_STATUS",
  "ALL_OF",
  "ALWAYS",
];

const TARGETS: TargetType[] = [
  "SELF",
  "ALLY_LOWEST_HP",
  "ALLY_WITH_STATUS_LOWEST_HP",
  "ALLY_POSITION",
  "ENEMY_FIRST",
  "ENEMY_POSITION",
  "ENEMY_LOWEST_HP",
];

const NESTED_CONDITIONS: Exclude<ConditionType, "ALL_OF">[] = [
  "TURN_EQUALS",
  "SELF_HP_BELOW",
  "ALLY_HP_BELOW",
  "ALLY_MP_BELOW",
  "ENEMY_HP_BELOW",
  "ANY_ALLY_HAS_STATUS",
  "ALWAYS",
];

type CompoundConditionRow = {
  id: string;
  type: Exclude<ConditionType, "ALL_OF">;
  turn: string;
  threshold: string;
  status: string;
};

type Props = {
  visible: boolean;
  characterId: string;
  skills: Skill[];
  initial?: TacticsRuleRecord;
  priority: number;
  onSave: (rule: TacticsRuleRecord) => void;
  onClose: () => void;
};

const parseObject = (value: string | null): Record<string, unknown> => {
  if (!value) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON object expected");
  }
  return parsed as Record<string, unknown>;
};

const safeParseObject = (value: string | null): Record<string, unknown> => {
  try {
    return parseObject(value);
  } catch {
    return {};
  }
};

const toText = (value: unknown): string => (value == null ? "" : String(value));

const parseNestedConditions = (value: string | null): CompoundConditionRow[] => {
  const obj = safeParseObject(value);
  const rows = Array.isArray(obj.conditions)
    ? (obj.conditions as Array<{ type?: unknown; params?: unknown }>)
    : [];
  return rows.map((entry, index) => {
    const type = String(entry.type ?? "ALWAYS");
    const params =
      entry.params && typeof entry.params === "object" && !Array.isArray(entry.params)
        ? (entry.params as Record<string, unknown>)
        : {};
    const normalizedType = NESTED_CONDITIONS.includes(type as Exclude<ConditionType, "ALL_OF">)
      ? (type as Exclude<ConditionType, "ALL_OF">)
      : "ALWAYS";
    return {
      id: `nested-${index}-${generateId("cond")}`,
      type: normalizedType,
      turn: toText(params.turn),
      threshold: toText(params.threshold),
      status: toText(params.status),
    };
  });
};

const buildNumeric = (raw: string, label: string): number => {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${label}:number`);
  }
  return value;
};

const buildInteger = (raw: string, label: string): number => {
  const value = buildNumeric(raw, label);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label}:integer`);
  }
  return value;
};

const buildSingleConditionParams = (row: {
  type: Exclude<ConditionType, "ALL_OF">;
  turn: string;
  threshold: string;
  status: string;
}): Record<string, unknown> | null => {
  switch (row.type) {
    case "TURN_EQUALS":
      return { turn: buildInteger(row.turn, "turn") };
    case "SELF_HP_BELOW":
    case "ALLY_HP_BELOW":
    case "ALLY_MP_BELOW":
    case "ENEMY_HP_BELOW":
      return { threshold: buildNumeric(row.threshold, "threshold") };
    case "ANY_ALLY_HAS_STATUS": {
      const status = row.status.trim().toUpperCase();
      if (!status) throw new Error("status:required");
      return { status };
    }
    case "ALWAYS":
      return null;
    default:
      return null;
  }
};

const buildConditionParamsValue = (args: {
  conditionType: ConditionType;
  turn: string;
  threshold: string;
  status: string;
  allOfRows: CompoundConditionRow[];
}): string | null => {
  switch (args.conditionType) {
    case "ALWAYS":
      return null;
    case "ALL_OF": {
      if (args.allOfRows.length === 0) {
        throw new Error("all_of:required");
      }
      const conditions = args.allOfRows.map((row) => ({
        type: row.type,
        params: buildSingleConditionParams(row) ?? {},
      }));
      return JSON.stringify({ conditions });
    }
    default: {
      const params = buildSingleConditionParams({
        type: args.conditionType as Exclude<ConditionType, "ALL_OF">,
        turn: args.turn,
        threshold: args.threshold,
        status: args.status,
      });
      return params ? JSON.stringify(params) : null;
    }
  }
};

const buildTargetParamsValue = (args: {
  targetType: TargetType;
  targetStatus: string;
  targetPosition: string;
}): string | null => {
  switch (args.targetType) {
    case "ALLY_WITH_STATUS_LOWEST_HP": {
      const status = args.targetStatus.trim().toUpperCase();
      if (!status) throw new Error("target_status:required");
      return JSON.stringify({ status });
    }
    case "ALLY_POSITION":
    case "ENEMY_POSITION":
      return JSON.stringify({ position: buildInteger(args.targetPosition, "position") });
    default:
      return null;
  }
};

const parseTargetStatus = (targetType: TargetType, targetParams: string | null): string => {
  if (targetType !== "ALLY_WITH_STATUS_LOWEST_HP") return "";
  const params = safeParseObject(targetParams);
  return toText(params.status);
};

const parseTargetPosition = (targetType: TargetType, targetParams: string | null): string => {
  if (targetType !== "ALLY_POSITION" && targetType !== "ENEMY_POSITION") return "";
  const params = safeParseObject(targetParams);
  return toText(params.position);
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
  const skillButtons = useMemo(() => skills.slice(0, 8), [skills]);

  const [skillId, setSkillId] = useState("");
  const [conditionType, setConditionType] = useState<ConditionType>("ALWAYS");
  const [targetType, setTargetType] = useState<TargetType>("ENEMY_FIRST");
  const [turnValue, setTurnValue] = useState("");
  const [thresholdValue, setThresholdValue] = useState("");
  const [statusValue, setStatusValue] = useState("");
  const [allOfRows, setAllOfRows] = useState<CompoundConditionRow[]>([]);
  const [targetStatusValue, setTargetStatusValue] = useState("");
  const [targetPositionValue, setTargetPositionValue] = useState("");

  useEffect(() => {
    if (!visible) return;

    const nextSkillId = initial?.skillId ?? skills[0]?.id ?? "";
    const nextConditionType = initial?.conditionType ?? "ALWAYS";
    const nextTargetType = initial?.targetType ?? "ENEMY_FIRST";
    const conditionParams = safeParseObject(initial?.conditionParams ?? null);

    setSkillId(nextSkillId);
    setConditionType(nextConditionType);
    setTargetType(nextTargetType);
    setTurnValue(toText(conditionParams.turn));
    setThresholdValue(toText(conditionParams.threshold));
    setStatusValue(toText(conditionParams.status));
    setAllOfRows(parseNestedConditions(initial?.conditionParams ?? null));
    setTargetStatusValue(parseTargetStatus(nextTargetType, initial?.targetParams ?? null));
    setTargetPositionValue(parseTargetPosition(nextTargetType, initial?.targetParams ?? null));
  }, [visible, initial, skills]);

  const addAllOfRow = () => {
    setAllOfRows((prev) => [
      ...prev,
      {
        id: generateId("cond"),
        type: "ALWAYS",
        turn: "",
        threshold: "",
        status: "",
      },
    ]);
  };

  const updateAllOfRow = (id: string, patch: Partial<CompoundConditionRow>) => {
    setAllOfRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const deleteAllOfRow = (id: string) => {
    setAllOfRows((prev) => prev.filter((row) => row.id !== id));
  };

  const formatValidationError = (message: string): string => {
    const [field, kind] = message.split(":");
    const fieldLabel =
      field === "turn"
        ? t("tactics.param.turn")
        : field === "threshold"
          ? t("tactics.param.threshold")
          : field === "position"
            ? t("tactics.param.position")
            : field === "status" || field === "target_status"
              ? t("tactics.param.status")
              : field;
    if (field === "all_of" && kind === "required") return t("tactics.validation.all_of_required");
    if (kind === "number") return t("tactics.validation.number", { field: fieldLabel });
    if (kind === "integer") return t("tactics.validation.integer", { field: fieldLabel });
    if (kind === "required") return t("tactics.validation.required", { field: fieldLabel });
    return t("tactics.validation.invalid");
  };

  const renderConditionFields = (
    type: ConditionType | Exclude<ConditionType, "ALL_OF">,
    values: {
      turn: string;
      threshold: string;
      status: string;
    },
    setters: {
      setTurn: (value: string) => void;
      setThreshold: (value: string) => void;
      setStatus: (value: string) => void;
    }
  ) => {
    if (type === "TURN_EQUALS") {
      return (
        <TextInput
          value={values.turn}
          onChangeText={setters.setTurn}
          style={styles.input}
          placeholder={t("tactics.placeholder.turn")}
          placeholderTextColor="#71717a"
          keyboardType="number-pad"
        />
      );
    }

    if (
      type === "SELF_HP_BELOW" ||
      type === "ALLY_HP_BELOW" ||
      type === "ALLY_MP_BELOW" ||
      type === "ENEMY_HP_BELOW"
    ) {
      return (
        <TextInput
          value={values.threshold}
          onChangeText={setters.setThreshold}
          style={styles.input}
          placeholder={t("tactics.placeholder.threshold")}
          placeholderTextColor="#71717a"
          keyboardType="decimal-pad"
        />
      );
    }

    if (type === "ANY_ALLY_HAS_STATUS") {
      return (
        <TextInput
          value={values.status}
          onChangeText={setters.setStatus}
          style={styles.input}
          placeholder={t("tactics.placeholder.status")}
          placeholderTextColor="#71717a"
          autoCapitalize="characters"
        />
      );
    }

    return null;
  };

  const renderAllOfEditor = () => (
    <View style={styles.groupBox}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{t("tactics.ui.allOfConditions")}</Text>
        <Pressable onPress={addAllOfRow} style={styles.smallActionButton}>
          <Text style={styles.smallActionText}>{t("tactics.ui.addCondition")}</Text>
        </Pressable>
      </View>
      {allOfRows.length === 0 ? (
        <Text style={styles.hintText}>{t("tactics.ui.allOfEmpty")}</Text>
      ) : (
        allOfRows.map((row, index) => (
          <View key={row.id} style={styles.subRuleCard}>
            <View style={styles.subRuleHeader}>
              <Text style={styles.subRuleTitle}>{t("tactics.ui.conditionIndex", { index: index + 1 })}</Text>
              <Pressable onPress={() => deleteAllOfRow(row.id)} style={styles.removeButton}>
                <Text style={styles.removeButtonText}>{t("tactics.ui.delete")}</Text>
              </Pressable>
            </View>
            <View style={styles.optionRow}>
              {NESTED_CONDITIONS.map((type) => (
                <Pressable
                  key={`${row.id}-${type}`}
                  onPress={() => updateAllOfRow(row.id, { type })}
                  style={[
                    styles.optionButton,
                    row.type === type ? styles.optionSelected : styles.optionDefault,
                  ]}
                >
                  <Text style={styles.optionText}>{getConditionTypeLabel(type, t)}</Text>
                </Pressable>
              ))}
            </View>
            {renderConditionFields(
              row.type,
              { turn: row.turn, threshold: row.threshold, status: row.status },
              {
                setTurn: (value) => updateAllOfRow(row.id, { turn: value }),
                setThreshold: (value) => updateAllOfRow(row.id, { threshold: value }),
                setStatus: (value) => updateAllOfRow(row.id, { status: value }),
              }
            )}
          </View>
        ))
      )}
    </View>
  );

  const renderTargetParamsEditor = () => {
    if (targetType === "ALLY_WITH_STATUS_LOWEST_HP") {
      return (
        <TextInput
          value={targetStatusValue}
          onChangeText={setTargetStatusValue}
          style={[styles.input, styles.inputLast]}
          placeholder={t("tactics.placeholder.status")}
          placeholderTextColor="#71717a"
          autoCapitalize="characters"
        />
      );
    }

    if (targetType === "ALLY_POSITION" || targetType === "ENEMY_POSITION") {
      return (
        <TextInput
          value={targetPositionValue}
          onChangeText={setTargetPositionValue}
          style={[styles.input, styles.inputLast]}
          placeholder={t("tactics.placeholder.position")}
          placeholderTextColor="#71717a"
          keyboardType="number-pad"
        />
      );
    }

    return (
      <Text style={[styles.hintText, styles.inputLast]}>{t("tactics.ui.noExtraParams")}</Text>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{t("tactics.ui.editRule")}</Text>

            <Text style={styles.label}>{t("tactics.ui.skill")}</Text>
            <View style={styles.optionRow}>
              {skillButtons.map((skill) => (
                <Pressable
                  key={skill.id}
                  onPress={() => setSkillId(skill.id)}
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
              {CONDITIONS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setConditionType(c)}
                  style={[
                    styles.optionButton,
                    conditionType === c ? styles.optionSelected : styles.optionDefault,
                  ]}
                >
                  <Text style={styles.optionText}>{getConditionTypeLabel(c, t)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>{t("tactics.ui.conditionParams")}</Text>
            {conditionType === "ALL_OF"
              ? renderAllOfEditor()
              : renderConditionFields(
                  conditionType,
                  { turn: turnValue, threshold: thresholdValue, status: statusValue },
                  {
                    setTurn: setTurnValue,
                    setThreshold: setThresholdValue,
                    setStatus: setStatusValue,
                  }
                ) ?? <Text style={styles.hintText}>{t("tactics.ui.noExtraParams")}</Text>}

            <Text style={styles.label}>{t("tactics.ui.target")}</Text>
            <View style={styles.optionRow}>
              {TARGETS.map((target) => (
                <Pressable
                  key={target}
                  onPress={() => setTargetType(target)}
                  style={[
                    styles.optionButton,
                    targetType === target ? styles.optionSelected : styles.optionDefault,
                  ]}
                >
                  <Text style={styles.optionText}>{getTargetTypeLabel(target, t)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>{t("tactics.ui.targetParams")}</Text>
            {renderTargetParamsEditor()}

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => {
                  try {
                    const nextConditionParams = buildConditionParamsValue({
                      conditionType,
                      turn: turnValue,
                      threshold: thresholdValue,
                      status: statusValue,
                      allOfRows,
                    });
                    const nextTargetParams = buildTargetParamsValue({
                      targetType,
                      targetStatus: targetStatusValue,
                      targetPosition: targetPositionValue,
                    });

                    onSave({
                      id: initial?.id ?? generateId("rule"),
                      characterId,
                      priority,
                      skillId,
                      conditionType,
                      conditionParams: nextConditionParams,
                      targetType,
                      targetParams: nextTargetParams,
                    });
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
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  panel: {
    maxHeight: "86%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#18181b",
    padding: 16,
  },
  title: { marginBottom: 12, fontSize: 18, fontWeight: "600", color: "#ffffff" },
  label: { marginBottom: 4, color: "#d4d4d8" },
  optionRow: { marginBottom: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  optionSelected: { borderColor: "#10b981" },
  optionDefault: { borderColor: "#3f3f46" },
  optionText: { color: "#f4f4f5" },
  input: {
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#ffffff",
  },
  inputLast: { marginBottom: 16 },
  hintText: { marginBottom: 12, color: "#a1a1aa" },
  groupBox: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#111113",
    padding: 10,
    gap: 8,
  },
  groupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  groupTitle: { color: "#f4f4f5", fontWeight: "600" },
  smallActionButton: {
    borderRadius: 6,
    backgroundColor: "#374151",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  smallActionText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  subRuleCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#18181b",
    padding: 8,
  },
  subRuleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subRuleTitle: { marginBottom: 8, color: "#d4d4d8", fontWeight: "600" },
  removeButton: {
    borderRadius: 6,
    backgroundColor: "#7f1d1d",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 8 },
  actionButton: { flex: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  saveButton: { backgroundColor: "#059669" },
  cancelButton: { backgroundColor: "#3f3f46" },
  actionText: { textAlign: "center", fontWeight: "600", color: "#ffffff" },
});
