import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Package, Shield, Sword } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { characterEquipmentRepository } from "@/db/repositories/characterEquipmentRepository";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { equipmentInventoryRepository } from "@/db/repositories/equipmentInventoryRepository";
import { buildEquipmentDisplayName, getEquipmentById } from "@/game/loot/equipmentMasterService";
import { useI18n } from "@/i18n";
import type { EquipmentCategory, EquipmentSlot, EquipmentStackRecord } from "@/types/equipment";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  bgElevated: "#e5e5e5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  borderDefault: "#e0e0e0",
  iconSecondary: "#999999",
  chipActiveBg: "#111827",
  chipActiveText: "#ffffff",
} as const;

type InventoryTab = "items" | "equipment";
type CategoryFilter = "all" | EquipmentCategory;

type OwnedEquipmentRow = {
  key: string;
  category: EquipmentCategory;
  displayName: string;
  quantity: number;
  source: string;
};

type EquippedEquipmentRow = {
  key: string;
  category: EquipmentCategory;
  displayName: string;
  characterName: string;
  slotType: EquipmentSlot;
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
  const [tab, setTab] = useState<InventoryTab>("equipment");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [ownedEquipment, setOwnedEquipment] = useState<OwnedEquipmentRow[]>([]);
  const [equippedEquipment, setEquippedEquipment] = useState<EquippedEquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const strings = useMemo(
    () => ({
      title: locale === "ja" ? "インベントリ" : "Inventory",
      tabs: {
        items: locale === "ja" ? "アイテム" : "Items",
        equipment: locale === "ja" ? "装備" : "Equipment",
      },
      itemsNotImplemented: locale === "ja"
        ? "アイテム所持の実データ表示はまだ未実装です。"
        : "Item inventory data view is not implemented yet.",
      itemsHint: locale === "ja"
        ? "現在は装備インベントリのみ管理されています。"
        : "Currently only equipment inventory is tracked.",
      categoryAll: locale === "ja" ? "すべて" : "All",
      ownedSection: locale === "ja" ? "所持装備" : "Owned Equipment",
      equippedSection: locale === "ja" ? "装備中" : "Equipped",
      emptyOwned: locale === "ja" ? "所持装備はありません。" : "No owned equipment.",
      emptyEquipped: locale === "ja" ? "装備中の装備はありません。" : "No equipped items.",
      sourceLabel: locale === "ja" ? "入手" : "Source",
      ownerLabel: locale === "ja" ? "装備者" : "Owner",
      slotWeapon: locale === "ja" ? "武器" : "Weapon",
      slotArmor: locale === "ja" ? "防具" : "Armor",
    }),
    [locale]
  );

  const categoryLabel = useCallback(
    (category: EquipmentCategory): string => {
      const mapJa: Record<EquipmentCategory, string> = {
        one_handed_sword: "剣",
        dagger: "短剣",
        throwing_knife: "スローナイフ",
        two_handed_axe: "両手斧",
        two_handed_hammer: "両手ハンマー",
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
      const [stacks, characters] = await Promise.all([
        equipmentInventoryRepository.listStacks(),
        charactersRepository.list(),
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
        };
      });

      const equippedPerCharacter = await Promise.all(
        characters.map(async (character) => ({
          character,
          equipment: await characterEquipmentRepository.getByCharacterId(character.id),
        }))
      );

      const equippedRows: EquippedEquipmentRow[] = equippedPerCharacter.flatMap(({ character, equipment }) => {
        const rows: EquippedEquipmentRow[] = [];
        for (const slotType of ["weapon", "armor"] as const) {
          const entry = equipment[slotType];
          if (!entry) continue;
          const item = getEquipmentById(entry.baseItemId);
          const display = buildEquipmentDisplayName(entry.baseItemId, entry.mutationPrefixId);
          rows.push({
            key: `${character.id}:${slotType}`,
            category: item.category,
            displayName: locale === "ja" ? display.jp : display.en,
            characterName: character.name,
            slotType,
          });
        }
        return rows;
      });

      setOwnedEquipment(ownedRows);
      setEquippedEquipment(equippedRows);
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

      <View style={styles.tabRow}>
        <Pressable style={styles.tabButton} onPress={() => setTab("items")}>
          <Text style={[styles.tabText, tab === "items" ? styles.tabTextActive : null]}>{strings.tabs.items}</Text>
          <View style={[styles.tabBorder, tab === "items" ? styles.tabBorderActive : null]} />
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => setTab("equipment")}>
          <Text style={[styles.tabText, tab === "equipment" ? styles.tabTextActive : null]}>{strings.tabs.equipment}</Text>
          <View style={[styles.tabBorder, tab === "equipment" ? styles.tabBorderActive : null]} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === "items" ? (
          <View style={styles.card}>
            <View style={styles.rowIcon}><Package size={16} stroke={colors.textSecondary} /></View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{strings.itemsNotImplemented}</Text>
              <Text style={styles.cardSub}>{strings.itemsHint}</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.filterWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                <Pressable
                  style={[styles.filterChip, categoryFilter === "all" ? styles.filterChipActive : null]}
                  onPress={() => setCategoryFilter("all")}
                >
                  <Text style={[styles.filterChipText, categoryFilter === "all" ? styles.filterChipTextActive : null]}>{strings.categoryAll}</Text>
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
                      <Text style={styles.cardSub}>{`${strings.sourceLabel}: ${sourceLabel(row.source)}`}</Text>
                    </View>
                    <Text style={styles.quantityText}>x{row.quantity}</Text>
                  </View>
                ), strings.emptyOwned)
              )}
            </View>

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
                      <Text style={styles.cardSub}>{`${strings.ownerLabel}: ${row.characterName} / ${row.slotType === "weapon" ? strings.slotWeapon : strings.slotArmor}`}</Text>
                    </View>
                  </View>
                ), strings.emptyEquipped)
              )}
            </View>
          </>
        )}
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
  tabRow: { flexDirection: "row", paddingHorizontal: 20 },
  tabButton: { flex: 1, alignItems: "center" },
  tabText: { color: colors.textTertiary, fontSize: 14, fontWeight: "500", paddingVertical: 10 },
  tabTextActive: { color: colors.textPrimary, fontWeight: "700" },
  tabBorder: { width: "100%", height: 1, backgroundColor: colors.borderDefault },
  tabBorderActive: { height: 2, backgroundColor: colors.textPrimary },
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
