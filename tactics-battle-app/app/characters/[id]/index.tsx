import { useCallback, useMemo, useState } from "react";
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, GripVertical, Plus, RefreshCw, Shield, Sword } from "lucide-react-native";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getClassById } from "@/constants/classes";
import { getConstellationDisplayName } from "@/constants/constellations";
import { characterEquipmentRepository } from "@/db/repositories/characterEquipmentRepository";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { computeCharacterDerivedStats, formatStatSummary } from "@/game/equipment/equipmentStatsService";
import { buildEquipmentDisplayName, getEquipmentById } from "@/game/loot/equipmentMasterService";
import {
  describeConditionSentence,
  getSkillIdDisplayName,
  getTargetTypeLabel,
  summarizeTargetParams,
} from "@/game/tactics/labels";
import { useTactics } from "@/hooks/useTactics";
import { TranslationKey, useI18n } from "@/i18n";
import { parchment, parchmentShadow } from "@/theme/parchment";
import { CharacterRecord, ClassId } from "@/types/models";

const CLASS_NAME_KEYS: Record<ClassId, TranslationKey> = {
  GUARDIAN: "class.name.guardian",
  SWORDMAN: "class.name.swordman",
  BERSERKER: "class.name.berserker",
  CLERIC: "class.name.cleric",
  WITCH: "class.name.witch",
  THIEF: "class.name.thief",
  PORTER: "class.name.porter",
};

const PRIORITY_BADGE_COLORS = ["#333333", "#666666", "#999999"] as const;

type EquipmentRowView = {
  key: "weapon" | "armor";
  slotLabel: string;
  itemName: string;
  hint: string;
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
  const constellationLabel = character ? getConstellationDisplayName(character.constellationId, locale) : "";
  const unequippedLabel = locale === "ja" ? "未装備" : "Unequipped";
  const tacticsInfoText =
    locale === "ja"
      ? "ルールは順番に実行されます。ドラッグで優先度を並び替え。"
      : "Rules are executed in order. Drag to reorder priority.";
  const statBreakdownTemplate =
    locale === "ja"
      ? (base: number, bonus: number) => `基礎 ${base} / 装備 ${bonus >= 0 ? `+${bonus}` : bonus}`
      : (base: number, bonus: number) => `Base ${base} / Equip ${bonus >= 0 ? `+${bonus}` : bonus}`;

  const derivedStats = useMemo(
    () => (character ? computeCharacterDerivedStats(character, equippedBySlot) : null),
    [character, equippedBySlot]
  );

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

  const equipmentRows = useMemo<EquipmentRowView[]>(
    () => [
      {
        key: "weapon",
        slotLabel: "Weapon",
        itemName: weaponLabel,
        hint: equippedBySlot.weapon
          ? formatStatSummary(equippedBySlot.weapon.grantedStats ?? getEquipmentById(equippedBySlot.weapon.baseItemId).stats, locale) || "--"
          : "--",
      },
      {
        key: "armor",
        slotLabel: "Armor",
        itemName: armorLabel,
        hint: equippedBySlot.armor
          ? formatStatSummary(equippedBySlot.armor.grantedStats ?? getEquipmentById(equippedBySlot.armor.baseItemId).stats, locale) || "--"
          : "--",
      },
    ],
    [armorLabel, equippedBySlot.armor, equippedBySlot.weapon, locale, weaponLabel]
  );

  if (!character) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>{t("character.empty")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const classInfo = getClassById(character.classId);
  const statCards = [
    {
      key: "hp",
      label: "HP",
      total: derivedStats?.total.hp ?? character.baseMaxHp,
      breakdown: statBreakdownTemplate(character.baseMaxHp, derivedStats?.bonus.hp ?? 0),
    },
    {
      key: "mp",
      label: "MP",
      total: derivedStats?.total.mp ?? character.baseMaxMp,
      breakdown: statBreakdownTemplate(character.baseMaxMp, derivedStats?.bonus.mp ?? 0),
    },
    {
      key: "atk",
      label: "ATK",
      total: derivedStats?.total.atk ?? character.baseAtk,
      breakdown: statBreakdownTemplate(character.baseAtk, derivedStats?.bonus.atk ?? 0),
    },
    {
      key: "def",
      label: "DEF",
      total: derivedStats?.total.def ?? character.baseDef,
      breakdown: statBreakdownTemplate(character.baseDef, derivedStats?.bonus.def ?? 0),
    },
    {
      key: "spi",
      label: "SPI",
      total: derivedStats?.total.spi ?? character.baseSpi,
      breakdown: statBreakdownTemplate(character.baseSpi, derivedStats?.bonus.spi ?? 0),
    },
    {
      key: "spd",
      label: "SPD",
      total: derivedStats?.total.spd ?? character.baseSpd,
      breakdown: statBreakdownTemplate(character.baseSpd, derivedStats?.bonus.spd ?? 0),
    },
    {
      key: "mpRegen",
      label: locale === "ja" ? "MP回復" : "MP Regen",
      total: derivedStats?.total.mpRegen ?? character.baseMpRegen,
      breakdown: statBreakdownTemplate(character.baseMpRegen, derivedStats?.bonus.mpRegen ?? 0),
    },
  ] as const;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={parchment.ink} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {character.name}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Image source={classInfo.image} style={styles.avatarImage} resizeMode="contain" />
          </View>
          <View style={styles.profileTextWrap}>
            <Text style={styles.profileName} numberOfLines={1}>
              {character.name}
            </Text>
            <Text style={styles.profileSub} numberOfLines={1}>
              {`${classLabel}  Lv.${character.level}`}
            </Text>
            <Text style={styles.profileMeta} numberOfLines={1}>
              {`${constellationLabel} • ${character.age}歳`}
            </Text>
          </View>
        </View>

        <View style={styles.statRow}>
          {statCards.map((stat) => (
            <View key={stat.key} style={styles.statCard}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.total}</Text>
              <Text style={styles.statSub} numberOfLines={1}>
                {stat.breakdown}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{t("character.equipment")}</Text>
            <Link href={`/characters/${id}/equipment`} asChild>
              <Pressable style={styles.sectionIconButton}>
                <RefreshCw size={14} stroke="#ffffff" />
              </Pressable>
            </Link>
          </View>

          <View style={styles.sectionList}>
            {equipmentRows.map((row) => {
              const leftIcon =
                row.key === "weapon" ? <Sword size={14} stroke="#ffffff" /> : <Shield size={14} stroke="#ffffff" />;

              return (
                <View key={row.key} style={styles.equipmentRowCard}>
                  <View style={styles.rowLeadingIcon}>{leftIcon}</View>
                  <View style={styles.rowMainText}>
                    <Text style={styles.rowSlotLabel}>{row.slotLabel}</Text>
                    <Text style={styles.rowItemName} numberOfLines={1}>
                      {row.itemName}
                    </Text>
                  </View>
                  <Text style={styles.rowHintText}>{row.hint}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{t("character.tactics")}</Text>
            <Link href={`/characters/${id}/tactics`} asChild>
              <Pressable style={styles.sectionIconButton}>
                <Plus size={14} stroke="#ffffff" />
              </Pressable>
            </Link>
          </View>

          <Text style={styles.infoText}>{tacticsInfoText}</Text>

          {topRules.length === 0 ? (
            <Text style={styles.emptyText}>{t("character.tactics.empty")}</Text>
          ) : (
            <View style={styles.sectionList}>
              {topRules.map((rule, index) => {
                const conditionSentence = describeConditionSentence(rule, t);
                const targetSummary = summarizeTargetParams(rule, t);
                const ruleSummary = `${conditionSentence}  ->  ${getTargetTypeLabel(rule.targetType, t)}${
                  targetSummary ? ` (${targetSummary})` : ""
                }`;

                return (
                  <View key={rule.id} style={styles.ruleCard}>
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: PRIORITY_BADGE_COLORS[index] ?? PRIORITY_BADGE_COLORS[2] },
                      ]}
                    >
                      <Text style={styles.priorityText}>{rule.priority}</Text>
                    </View>
                    <View style={styles.ruleTextWrap}>
                      <Text style={styles.ruleTitle} numberOfLines={1}>
                        {getSkillIdDisplayName(rule.skillId, t)}
                      </Text>
                      <Text style={styles.ruleSub} numberOfLines={1}>
                        {ruleSummary}
                      </Text>
                    </View>
                    <GripVertical size={14} stroke={parchment.inkMuted} />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: parchment.background,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 28,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: parchment.background,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: parchment.surface,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flexShrink: 1,
    color: parchment.ink,
    fontSize: 20,
    fontWeight: "700",
  },
  profileCard: {
    ...parchmentShadow,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    backgroundColor: parchment.surfaceMuted,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 80,
    height: 80,
  },
  profileTextWrap: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    color: parchment.ink,
    fontSize: 20,
    fontWeight: "700",
  },
  profileSub: {
    color: parchment.inkSoft,
    fontSize: 12,
    fontWeight: "500",
  },
  profileMeta: {
    color: parchment.inkMuted,
    fontSize: 11,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  statCard: {
    width: "48%",
    alignItems: "flex-start",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    backgroundColor: parchment.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statLabel: {
    color: parchment.inkMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  statValue: {
    color: parchment.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  statSub: {
    color: parchment.inkSoft,
    fontSize: 10,
  },
  section: {
    paddingTop: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: parchment.inkSoft,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  sectionIconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: parchment.headerBar,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionList: {
    gap: 8,
  },
  equipmentRowCard: {
    ...parchmentShadow,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    backgroundColor: parchment.surfaceMuted,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowLeadingIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(59, 46, 30, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowMainText: {
    flex: 1,
    gap: 2,
  },
  rowSlotLabel: {
    color: parchment.inkMuted,
    fontSize: 10,
  },
  rowItemName: {
    color: parchment.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  rowHintText: {
    color: parchment.inkSoft,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  infoText: {
    color: parchment.inkSoft,
    fontSize: 11,
    lineHeight: 16,
  },
  emptyText: {
    color: parchment.inkSoft,
    fontSize: 12,
  },
  ruleCard: {
    ...parchmentShadow,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: parchment.goldLine,
    backgroundColor: parchment.surfaceMuted,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  priorityBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  priorityText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  ruleTextWrap: {
    flex: 1,
    gap: 4,
  },
  ruleTitle: {
    color: parchment.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  ruleSub: {
    color: parchment.inkSoft,
    fontSize: 10,
  },
});
