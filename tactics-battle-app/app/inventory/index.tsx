import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, FlaskRound, Shield, Sword } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { characterEquipmentRepository } from "@/db/repositories/characterEquipmentRepository";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { consumableInventoryRepository } from "@/db/repositories/consumableInventoryRepository";
import { equipmentInventoryRepository } from "@/db/repositories/equipmentInventoryRepository";
import { formatStatSummary } from "@/game/equipment/equipmentStatsService";
import { buildEquipmentDisplayName, getEquipmentById } from "@/game/loot/equipmentMasterService";
import { useI18n } from "@/i18n";
import { buildOwnedConsumableRows, type OwnedConsumableRow } from "@/features/inventory/consumableRows";
import type { ConsumableCategory } from "@/types/consumable";
import type { EquipmentCategory, EquipmentSlot, EquipmentStackRecord } from "@/types/equipment";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgElevated: "#e5e5e5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  borderDefault: "#e0e0e0",
  chipActiveBg: "#111827",
  chipActiveText: "#ffffff",
} as const;

type CategoryFilter = "all" | "consumables" | EquipmentCategory;

type OwnedEquipmentRow = {
  key: string;
  category: EquipmentCategory;
  displayName: string;
  quantity: number;
  source: string;
  statSummary: string;
};

type EquippedEquipmentRow = {
  key: string;
  category: EquipmentCategory;
  displayName: string;
  characterName: string;
  slotType: EquipmentSlot;
  statSummary: string;
};

const CATEGORY_ORDER: EquipmentCategory[] = [
  "one_handed_sword",
  "dagger",
  "throwing_knife",
  "two_handed_axe",
  "two_handed_hammer",
  "staff",
  "bow",
  "shield",
];

const groupByCategory = <T extends { category: EquipmentCategory }>(rows: T[]) => {
  const map = new Map<EquipmentCategory, T[]>();
  for (const row of rows) {
    const current = map.get(row.category) ?? [];
    current.push(row);
    map.set(row.category, current);
  }
  return map;
};

export default function InventoryScreen() {
  const router = useRouter();
  const { locale } = useI18n();
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [ownedEquipment, setOwnedEquipment] = useState<OwnedEquipmentRow[]>([]);
  const [equippedEquipment, setEquippedEquipment] = useState<EquippedEquipmentRow[]>([]);
  const [ownedConsumables, setOwnedConsumables] = useState<OwnedConsumableRow[]>([]);
  const [loading, setLoading] = useState(true);

  const strings = useMemo(
    () => ({
      title: locale === "ja" ? "インベントリ" : "Inventory",
      categoryAll: locale === "ja" ? "すべて" : "All",
      categoryConsumables: locale === "ja" ? "道具" : "Items",
      ownedSection: locale === "ja" ? "所持装備" : "Owned Equipment",
      equippedSection: locale === "ja" ? "装備中" : "Equipped",
      consumableSection: locale === "ja" ? "所持アイテム（道具）" : "Owned Items",
      emptyOwned: locale === "ja" ? "所持装備はありません。" : "No owned equipment.",
      emptyEquipped: locale === "ja" ? "装備中の装備はありません。" : "No equipped items.",
      emptyConsumables: locale === "ja" ? "所持道具はありません。" : "No owned items.",
      sourceLabel: locale === "ja" ? "入手" : "Source",
      ownerLabel: locale === "ja" ? "装備者" : "Owner",
      slotWeapon: locale === "ja" ? "武器" : "Weapon",
      slotArmor: locale === "ja" ? "防具" : "Armor",
    }),
    [locale]
  );

  const consumableCategoryLabel = useCallback(
    (category: ConsumableCategory): string => {
      const mapJa: Record<ConsumableCategory, string> = {
        healing_potion: "回復薬",
        mana_potion: "魔力薬",
        status_cure: "治療薬",
      };
      const mapEn: Record<ConsumableCategory, string> = {
        healing_potion: "Healing",
        mana_potion: "Mana",
        status_cure: "Status Cure",
      };
      return (locale === "ja" ? mapJa : mapEn)[category];
    },
    [locale]
  );

  const categoryLabel = useCallback(
    (category: EquipmentCategory): string => {
      const mapJa: Record<EquipmentCategory, string> = {
        one_handed_sword: "剣",
        dagger: "短剣",
        throwing_knife: "投刃",
        two_handed_axe: "両手斧",
        two_handed_hammer: "両手槌",
        bow: "弓",
        staff: "杖",
        shield: "盾",
      };
      const mapEn: Record<EquipmentCategory, string> = {
        one_handed_sword: "Sword",
        dagger: "Dagger",
        throwing_knife: "Throwing Knife",
        two_handed_axe: "2H Axe",
        two_handed_hammer: "2H Hammer",
        bow: "Bow",
        staff: "Staff",
        shield: "Shield",
      };
      return (locale === "ja" ? mapJa : mapEn)[category];
    },
    [locale]
  );

  const sourceLabel = useCallback(
    (source: string): string => {
      const map = {
        shop: locale === "ja" ? "ショップ" : "Shop",
        monster: locale === "ja" ? "モンスター" : "Monster",
        chest: locale === "ja" ? "宝箱" : "Chest",
      } as const;
      return map[source as keyof typeof map] ?? source;
    },
    [locale]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stacks, characters, consumableInventory] = await Promise.all([
        equipmentInventoryRepository.listStacks(),
        charactersRepository.list(),
        consumableInventoryRepository.listAll(),
      ]);

      const ownedRows: OwnedEquipmentRow[] = stacks.map((stack: EquipmentStackRecord) => {
        const item = getEquipmentById(stack.baseItemId);
        const display = buildEquipmentDisplayName(stack.baseItemId, stack.mutationPrefixId);
        return {
          key: `${stack.baseItemId}:${stack.mutationPrefixId ?? ""}`,
          category: item.category,
          displayName: locale === "ja" ? display.jp : display.en,
          quantity: stack.quantity,
          source: item.source,
          statSummary: formatStatSummary(item.stats, locale),
        };
      });

      const equippedByCharacterId = await characterEquipmentRepository.getByCharacterIds(
        characters.map((character) => character.id)
      );
      const equippedRows: EquippedEquipmentRow[] = [];
      for (const character of characters) {
        const equipment = equippedByCharacterId[character.id] ?? {};
        for (const slotType of ["weapon", "armor"] as const) {
          const entry = equipment[slotType];
          if (!entry) continue;
          const item = getEquipmentById(entry.baseItemId);
          const display = buildEquipmentDisplayName(entry.baseItemId, entry.mutationPrefixId);
          equippedRows.push({
            key: `${character.id}:${slotType}`,
            category: item.category,
            displayName: locale === "ja" ? display.jp : display.en,
            characterName: character.name,
            slotType,
            statSummary: formatStatSummary(item.stats, locale),
          });
        }
      }

      const consumableRows = buildOwnedConsumableRows({
        inventoryRows: consumableInventory,
        locale,
        onUnknownItemId: (itemId) => {
          console.warn(`[inventory] unknown consumable item id: ${itemId}`);
        },
      });

      setOwnedEquipment(ownedRows);
      setEquippedEquipment(equippedRows);
      setOwnedConsumables(consumableRows);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const categories = useMemo(() => {
    const set = new Set<EquipmentCategory>();
    for (const row of ownedEquipment) set.add(row.category);
    for (const row of equippedEquipment) set.add(row.category);
    return CATEGORY_ORDER.filter((category) => set.has(category));
  }, [ownedEquipment, equippedEquipment]);

  const filteredOwned = useMemo(
    () => ownedEquipment.filter((row) => categoryFilter === "all" || row.category === categoryFilter),
    [ownedEquipment, categoryFilter]
  );
  const filteredEquipped = useMemo(
    () => equippedEquipment.filter((row) => categoryFilter === "all" || row.category === categoryFilter),
    [equippedEquipment, categoryFilter]
  );

  const ownedGroups = useMemo(() => groupByCategory(filteredOwned), [filteredOwned]);
  const equippedGroups = useMemo(() => groupByCategory(filteredEquipped), [filteredEquipped]);
  const isConsumablesOnlyFilter = categoryFilter === "consumables";
  const shouldShowConsumableSection =
    categoryFilter === "all" || categoryFilter === "consumables";

  const renderCategoryGroups = <T extends { key: string; category: EquipmentCategory }>(
    groups: Map<EquipmentCategory, T[]>,
    renderRow: (row: T) => ReactNode,
    emptyText: string
  ) => {
    if (groups.size === 0) {
      return <Text style={styles.emptyText}>{emptyText}</Text>;
    }
    return CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => {
      const rows = groups.get(category) ?? [];
      return (
        <View key={category} style={styles.groupSection}>
          <Text style={styles.groupTitle}>{categoryLabel(category)}</Text>
          <View style={styles.groupList}>{rows.map(renderRow)}</View>
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{strings.title}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.filterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            <Pressable
              style={[styles.filterChip, categoryFilter === "all" ? styles.filterChipActive : null]}
              onPress={() => setCategoryFilter("all")}
            >
              <Text style={[styles.filterChipText, categoryFilter === "all" ? styles.filterChipTextActive : null]}>{strings.categoryAll}</Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, isConsumablesOnlyFilter ? styles.filterChipActive : null]}
              onPress={() => setCategoryFilter("consumables")}
            >
              <Text style={[styles.filterChipText, isConsumablesOnlyFilter ? styles.filterChipTextActive : null]}>{strings.categoryConsumables}</Text>
            </Pressable>
            {categories.map((category) => (
              <Pressable
                key={category}
                style={[styles.filterChip, categoryFilter === category ? styles.filterChipActive : null]}
                onPress={() => setCategoryFilter(category)}
              >
                <Text style={[styles.filterChipText, categoryFilter === category ? styles.filterChipTextActive : null]}>{categoryLabel(category)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {!isConsumablesOnlyFilter ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{strings.ownedSection}</Text>
            {loading ? (
              <Text style={styles.emptyText}>{locale === "ja" ? "読み込み中..." : "Loading..."}</Text>
            ) : (
              renderCategoryGroups(ownedGroups, (row) => (
                <View key={row.key} style={styles.card}>
                  <View style={styles.rowIcon}><Sword size={15} stroke={colors.textSecondary} /></View>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle}>{row.displayName}</Text>
                    <Text style={styles.cardSub}>{row.statSummary || "--"}</Text>
                    <Text style={styles.cardSub}>{`${strings.sourceLabel}: ${sourceLabel(row.source)}`}</Text>
                  </View>
                  <Text style={styles.quantityText}>x{row.quantity}</Text>
                </View>
              ), strings.emptyOwned)
            )}
          </View>
        ) : null}

        {!isConsumablesOnlyFilter ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{strings.equippedSection}</Text>
            {loading ? (
              <Text style={styles.emptyText}>{locale === "ja" ? "読み込み中..." : "Loading..."}</Text>
            ) : (
              renderCategoryGroups(equippedGroups, (row) => (
                <View key={row.key} style={styles.card}>
                  <View style={styles.rowIcon}>{row.slotType === "armor" ? <Shield size={15} stroke={colors.textSecondary} /> : <Sword size={15} stroke={colors.textSecondary} />}</View>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle}>{row.displayName}</Text>
                    <Text style={styles.cardSub}>{row.statSummary || "--"}</Text>
                    <Text style={styles.cardSub}>{`${strings.ownerLabel}: ${row.characterName} / ${row.slotType === "weapon" ? strings.slotWeapon : strings.slotArmor}`}</Text>
                  </View>
                </View>
              ), strings.emptyEquipped)
            )}
          </View>
        ) : null}

        {shouldShowConsumableSection ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{strings.consumableSection}</Text>
            {loading ? (
              <Text style={styles.emptyText}>{locale === "ja" ? "読み込み中..." : "Loading..."}</Text>
            ) : ownedConsumables.length === 0 ? (
              <Text style={styles.emptyText}>{strings.emptyConsumables}</Text>
            ) : (
              ownedConsumables.map((row) => (
                <View key={row.key} style={styles.card}>
                  <View style={styles.rowIcon}><FlaskRound size={15} stroke={colors.textSecondary} /></View>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle}>{row.displayName}</Text>
                    <Text style={styles.cardSub}>{consumableCategoryLabel(row.category)}</Text>
                  </View>
                  <Text style={styles.quantityText}>x{row.quantity}</Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
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
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 14 },
  filterWrap: { marginBottom: 2 },
  filterContent: { gap: 8, paddingVertical: 4 },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: colors.chipActiveBg,
    borderColor: colors.chipActiveBg,
  },
  filterChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  filterChipTextActive: { color: colors.chipActiveText },
  section: { gap: 10 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "600", letterSpacing: 1 },
  groupSection: { gap: 8 },
  groupTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  groupList: { gap: 8 },
  card: {
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgSurface,
    gap: 12,
    padding: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  cardTextWrap: { flex: 1, gap: 2 },
  cardTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  cardSub: { color: colors.textTertiary, fontSize: 11 },
  quantityText: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  emptyText: { color: colors.textTertiary, fontSize: 12 },
});
