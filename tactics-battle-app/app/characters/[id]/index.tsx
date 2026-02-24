import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, GripVertical, Plus, Shield, Sword } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { characterEquipmentRepository } from "@/db/repositories/characterEquipmentRepository";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { buildEquipmentDisplayName } from "@/game/loot/equipmentMasterService";
import {
  getConditionTypeLabel,
  getSkillIdDisplayName,
  getTargetTypeLabel,
  summarizeConditionParams,
  summarizeTargetParams,
} from "@/game/tactics/labels";
import { TranslationKey, useI18n } from "@/i18n";
import { useTactics } from "@/hooks/useTactics";
import { CharacterRecord, ClassId } from "@/types/models";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgElevated: "#e5e5e5",
  textPrimary: "#1a1a1a",
  textStrong: "#444444",
  textSecondary: "#666666",
  textTertiary: "#888888",
  iconSecondary: "#999999",
  borderDefault: "#e0e0e0",
} as const;

const CLASS_NAME_KEYS: Record<ClassId, TranslationKey> = {
  GUARDIAN: "class.name.guardian",
  SWORDMAN: "class.name.swordman",
  BERSERKER: "class.name.berserker",
  CLERIC: "class.name.cleric",
  WITCH: "class.name.witch",
  THIEF: "class.name.thief",
};

export default function CharacterDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { rules } = useTactics(id);
  const [character, setCharacter] = useState<CharacterRecord | null>(null);
  const [equippedBySlot, setEquippedBySlot] = useState<
    Awaited<ReturnType<typeof characterEquipmentRepository.getByCharacterId>>
  >({});

  const load = useCallback(async () => {
    if (!id) return;
    const [found, equipped] = await Promise.all([
      charactersRepository.getById(id),
      characterEquipmentRepository.getByCharacterId(id),
    ]);
    setCharacter(found ?? null);
    setEquippedBySlot(equipped);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const topRules = useMemo(() => [...rules].sort((a, b) => a.priority - b.priority).slice(0, 3), [rules]);
  const classLabel = t(CLASS_NAME_KEYS[character?.classId ?? "SWORDMAN"]);
  const unequippedLabel = locale === "ja" ? "未装備" : "Unequipped";
  const weaponLabel = useMemo(() => {
    const weapon = equippedBySlot.weapon;
    if (!weapon) return unequippedLabel;
    const name = buildEquipmentDisplayName(weapon.baseItemId, weapon.mutationPrefixId);
    return locale === "ja" ? name.jp : name.en;
  }, [equippedBySlot.weapon, locale, unequippedLabel]);
  const armorLabel = useMemo(() => {
    const armor = equippedBySlot.armor;
    if (!armor) return unequippedLabel;
    const name = buildEquipmentDisplayName(armor.baseItemId, armor.mutationPrefixId);
    return locale === "ja" ? name.jp : name.en;
  }, [equippedBySlot.armor, locale, unequippedLabel]);

  if (!character) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>{t("character.empty")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{character.name}</Text>
        </View>
        <View style={styles.iconBtn}>
          <Plus size={16} stroke={colors.iconSecondary} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileWrap}>
          <View style={styles.avatar}>
            <Shield size={36} stroke={colors.textStrong} />
          </View>
          <Text style={styles.profileName}>{character.name}</Text>
          <Text style={styles.profileSub}>{`${classLabel}  Lv.${character.level}`}</Text>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>HP</Text>
              <Text style={styles.statValue}>{character.baseMaxHp}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>MP</Text>
              <Text style={styles.statValue}>{character.baseMaxMp}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>ATK</Text>
              <Text style={styles.statValue}>{character.baseAtk}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>DEF</Text>
              <Text style={styles.statValue}>{character.baseDef}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{t("character.equipment")}</Text>
            <Link href={`/characters/${id}/equipment`} asChild>
              <Pressable style={styles.darkBtn}>
                <Text style={styles.darkBtnText}>{t("character.change")}</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.itemCard}>
            <Sword size={18} stroke={colors.textSecondary} />
            <View style={styles.itemTextWrap}>
              <Text style={styles.itemName}>{weaponLabel}</Text>
              <Text style={styles.itemSub}>{equippedBySlot.weapon ? t("equip.equipped") : unequippedLabel}</Text>
            </View>
            <ChevronRight size={18} stroke={colors.iconSecondary} />
          </View>
          <View style={styles.itemCard}>
            <Shield size={18} stroke={colors.textSecondary} />
            <View style={styles.itemTextWrap}>
              <Text style={styles.itemName}>{armorLabel}</Text>
              <Text style={styles.itemSub}>{equippedBySlot.armor ? t("equip.equipped") : unequippedLabel}</Text>
            </View>
            <ChevronRight size={18} stroke={colors.iconSecondary} />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{t("character.tactics")}</Text>
            <Link href={`/characters/${id}/tactics`} asChild>
              <Pressable style={styles.darkBtn}>
                <Text style={styles.darkBtnText}>{t("character.addRule")}</Text>
              </Pressable>
            </Link>
          </View>

          <Text style={styles.infoText}>{t("character.tactics.info")}</Text>

          {topRules.length === 0 ? (
            <Text style={styles.emptyText}>{t("character.tactics.empty")}</Text>
          ) : (
            topRules.map((rule) => (
              <View key={rule.id} style={styles.ruleCard}>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>{rule.priority}</Text>
                </View>
                <View style={styles.ruleTextWrap}>
                  <Text style={styles.ruleTitle}>{getSkillIdDisplayName(rule.skillId, t)}</Text>
                  <Text style={styles.ruleSub}>
                    {`${getConditionTypeLabel(rule.conditionType, t)}${
                      summarizeConditionParams(rule, t)
                        ? ` (${summarizeConditionParams(rule, t)})`
                        : ""
                    } -> ${getTargetTypeLabel(rule.targetType, t)}${
                      summarizeTargetParams(rule, t)
                        ? ` (${summarizeTargetParams(rule, t)})`
                        : ""
                    }`}
                  </Text>
                </View>
                <GripVertical size={16} stroke={colors.iconSecondary} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 20 },
  headerLeft: { alignItems: "center", flexDirection: "row", gap: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.bgSurface, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { paddingBottom: 20 },
  profileWrap: { alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  avatar: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgSurface, borderWidth: 2, borderColor: colors.textPrimary },
  profileName: { color: colors.textPrimary, fontSize: 24, fontWeight: "700" },
  profileSub: { color: colors.textStrong, fontSize: 13, fontWeight: "500" },
  statRow: { flexDirection: "row", gap: 8, width: "100%" },
  statCard: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 12, backgroundColor: colors.bgSurface, padding: 12, gap: 4 },
  statLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: "500" },
  statValue: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  section: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  darkBtn: { borderRadius: 12, backgroundColor: colors.textPrimary, paddingHorizontal: 10, paddingVertical: 8 },
  darkBtnText: { color: "#ffffff", fontSize: 11, fontWeight: "600" },
  itemCard: { alignItems: "center", flexDirection: "row", borderRadius: 16, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, gap: 12, padding: 12 },
  itemTextWrap: { flex: 1, gap: 2 },
  itemName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  itemSub: { color: colors.textTertiary, fontSize: 10 },
  divider: { height: 1, backgroundColor: colors.borderDefault, marginTop: 12 },
  infoText: { color: colors.textTertiary, fontSize: 12 },
  emptyText: { color: colors.textTertiary, fontSize: 12 },
  ruleCard: { alignItems: "center", flexDirection: "row", borderRadius: 16, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, gap: 12, padding: 14 },
  priorityBadge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#333333" },
  priorityText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  ruleTextWrap: { flex: 1, gap: 4 },
  ruleTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  ruleSub: { color: colors.textTertiary, fontSize: 11 },
});
