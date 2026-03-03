import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { RuleEditModal } from "@/components/tactics/RuleEditModal";
import { RuleItem } from "@/components/tactics/RuleItem";
import { useCharacters } from "@/hooks/useCharacters";
import { useTactics } from "@/hooks/useTactics";
import { CLASS_DEFINITIONS } from "@/game/skills/classes";
import { useI18n } from "@/i18n";
import { TacticsRuleRecord } from "@/types/models";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  textMuted: "#999999",
  borderDefault: "#e0e0e0",
  iconDark: "#111111",
} as const;

export default function TacticsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { characters } = useCharacters();
  const { rules, saveRules } = useTactics(id);
  const [editing, setEditing] = useState<TacticsRuleRecord | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);

  const character = useMemo(
    () => characters.find((c) => c.id === id),
    [characters, id]
  );
  const skills = useMemo(() => {
    const classDef = CLASS_DEFINITIONS.find((definition) => definition.id === character?.classId);
    return classDef?.skills ?? [];
  }, [character?.classId]);

  if (!character) {
    return (
      <SafeAreaView style={styles.notFoundContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.notFoundText}>{t("character.empty")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t("tactics.screen.title", { name: character.name })}
          </Text>
        </View>
      </View>

      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{t("character.tactics.info")}</Text>
          <Pressable
            style={styles.addRuleButton}
            onPress={() => {
              setEditing(undefined);
              setModalVisible(true);
            }}
          >
            <Text style={styles.addRuleButtonText}>{t("character.addRule")}</Text>
          </Pressable>
        </View>

        {rules.length === 0 ? (
          <Text style={styles.emptyText}>{t("character.tactics.empty")}</Text>
        ) : (
          <DraggableFlatList
            data={rules}
            keyExtractor={(item) => item.id}
            onDragEnd={({ data }) =>
              void saveRules(data.map((rule, index) => ({ ...rule, priority: index + 1 })))
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item, drag, isActive }: RenderItemParams<TacticsRuleRecord>) => (
              <View style={{ opacity: isActive ? 0.75 : 1 }}>
                <Text onLongPress={drag} style={styles.dragHint}>
                  {t("tactics.ui.dragToReorder")}
                </Text>
                <RuleItem
                  rule={item}
                  onEdit={() => {
                    setEditing(item);
                    setModalVisible(true);
                  }}
                  onDelete={() =>
                    void saveRules(rules.filter((rule) => rule.id !== item.id))
                  }
                />
              </View>
            )}
          />
        )}

        <RuleEditModal
          visible={modalVisible}
          characterId={character.id}
          skills={skills}
          initial={editing}
          priority={editing?.priority ?? rules.length + 1}
          onSave={(rule) => {
            const next =
              editing == null
                ? [...rules, rule]
                : rules.map((r) => (r.id === editing.id ? { ...rule, id: editing.id } : r));
            void saveRules(next);
          }}
          onClose={() => setModalVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgPrimary,
  },
  notFoundText: { color: colors.textTertiary, fontSize: 12, fontWeight: "500" },
  header: { paddingVertical: 12, paddingHorizontal: 20 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flexShrink: 1, color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: colors.bgPrimary,
  },
  sectionHeader: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionLabel: { flex: 1, color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  addRuleButton: {
    borderRadius: 16,
    backgroundColor: colors.iconDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addRuleButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  emptyText: {
    marginTop: 4,
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 20,
    gap: 2,
  },
  dragHint: {
    marginBottom: 4,
    marginLeft: 4,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
});
