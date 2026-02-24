import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Shield, Sword } from "lucide-react-native";
import { characterEquipmentRepository } from "@/db/repositories/characterEquipmentRepository";
import { charactersRepository } from "@/db/repositories/charactersRepository";
import { equipmentInventoryRepository } from "@/db/repositories/equipmentInventoryRepository";
import { canCharacterEquipItem, getEquipSlotForCategory } from "@/game/equipment/equipmentRules";
import { buildEquipmentDisplayName, getEquipmentById } from "@/game/loot/equipmentMasterService";
import { useI18n } from "@/i18n";
import type { EquipmentSlot, EquipmentStackRecord } from "@/types/equipment";
import type { CharacterRecord } from "@/types/models";

const colors = {
  bgPrimary: "#ffffff",
  bgSurface: "#f5f5f5",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#888888",
  borderDefault: "#e0e0e0",
  borderAccent: "#93C5FD",
  bgAccent: "#F0F7FF",
  accent: "#2563EB",
} as const;

type EquipTab = "weapon" | "armor" | "accessory";

type EquippedBySlot = Awaited<ReturnType<typeof characterEquipmentRepository.getByCharacterId>>;

type InventoryViewRow = EquipmentStackRecord & {
  displayName: { jp: string; en: string };
  slotType: EquipmentSlot | null;
};

const getSlotIcon = (slot: EquipTab) => {
  if (slot === "armor") return <Shield size={18} stroke="#ffffff" />;
  return <Sword size={18} stroke="#ffffff" />;
};

const getInventoryIcon = (slot: EquipTab) => {
  if (slot === "armor") return <Shield size={16} stroke={colors.textSecondary} />;
  return <Sword size={16} stroke={colors.textSecondary} />;
};

export default function EquipmentChangeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<EquipTab>("weapon");
  const [character, setCharacter] = useState<CharacterRecord | null>(null);
  const [equippedBySlot, setEquippedBySlot] = useState<EquippedBySlot>({});
  const [inventoryStacks, setInventoryStacks] = useState<EquipmentStackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [nextCharacter, nextEquipped, nextStacks] = await Promise.all([
        charactersRepository.getById(id),
        characterEquipmentRepository.getByCharacterId(id),
        equipmentInventoryRepository.listStacks(),
      ]);
      setCharacter(nextCharacter);
      setEquippedBySlot(nextEquipped);
      setInventoryStacks(nextStacks);
    } catch (error) {
      console.error("Failed to load equipment screen:", error);
      Alert.alert(
        locale === "ja" ? "読込失敗" : "Load Failed",
        locale === "ja" ? "装備情報の読み込みに失敗しました。" : "Failed to load equipment data."
      );
    } finally {
      setLoading(false);
    }
  }, [id, locale]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const inventoryRows = useMemo<InventoryViewRow[]>(() => {
    return inventoryStacks.map((stack) => ({
      ...stack,
      displayName: buildEquipmentDisplayName(stack.baseItemId, stack.mutationPrefixId),
      slotType: getEquipSlotForCategory(getEquipmentById(stack.baseItemId).category),
    }));
  }, [inventoryStacks]);

  const filteredInventory = useMemo(() => {
    if (!character) return [] as InventoryViewRow[];
    if (tab === "accessory") return [] as InventoryViewRow[];
    return inventoryRows
      .filter((row) => {
        const item = getEquipmentById(row.baseItemId);
        return row.slotType === tab && canCharacterEquipItem(character.classId, item);
      })
      .sort((a, b) => {
        const aName = locale === "ja" ? a.displayName.jp : a.displayName.en;
        const bName = locale === "ja" ? b.displayName.jp : b.displayName.en;
        return aName.localeCompare(bName);
      });
  }, [character, inventoryRows, locale, tab]);

  const currentEquipped = tab === "accessory" ? null : equippedBySlot[tab];
  const currentEquippedName = useMemo(() => {
    if (!currentEquipped) return locale === "ja" ? "未装備" : "Unequipped";
    const name = buildEquipmentDisplayName(currentEquipped.baseItemId, currentEquipped.mutationPrefixId);
    return locale === "ja" ? name.jp : name.en;
  }, [currentEquipped, locale]);

  const onEquip = useCallback(
    async (row: InventoryViewRow) => {
      if (!id || tab === "accessory" || busy) return;
      setBusy(true);
      try {
        await characterEquipmentRepository.equip({
          characterId: id,
          slotType: tab,
          baseItemId: row.baseItemId,
          mutationPrefixId: row.mutationPrefixId,
        });
        await load();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Alert.alert(
          locale === "ja" ? "装備失敗" : "Equip Failed",
          locale === "ja" ? `装備に失敗しました。\n${message}` : `Failed to equip item.\n${message}`
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, id, load, locale, tab]
  );

  const onUnequip = useCallback(async () => {
    if (!id || tab === "accessory" || busy) return;
    setBusy(true);
    try {
      await characterEquipmentRepository.unequip({ characterId: id, slotType: tab });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(
        locale === "ja" ? "解除失敗" : "Unequip Failed",
        locale === "ja" ? `装備解除に失敗しました。\n${message}` : `Failed to unequip item.\n${message}`
      );
    } finally {
      setBusy(false);
    }
  }, [busy, id, load, locale, tab]);

  const accessoryMessage = locale === "ja" ? "アクセサリは未実装です。" : "Accessory slot is not implemented yet.";
  const emptyInventoryMessage = locale === "ja" ? "装備可能な所持装備がありません。" : "No compatible equipment in inventory.";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} stroke={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("equip.header.title")}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Pressable style={styles.tabItem} onPress={() => setTab("weapon")}>
          <Text style={[styles.tabText, tab === "weapon" ? styles.tabTextActive : null]}>{t("equip.tab.weapon")}</Text>
          <View style={[styles.tabBorder, tab === "weapon" ? styles.tabBorderActive : null]} />
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => setTab("armor")}>
          <Text style={[styles.tabText, tab === "armor" ? styles.tabTextActive : null]}>{t("equip.tab.armor")}</Text>
          <View style={[styles.tabBorder, tab === "armor" ? styles.tabBorderActive : null]} />
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => setTab("accessory")}>
          <Text style={[styles.tabText, tab === "accessory" ? styles.tabTextActive : null]}>{t("equip.tab.accessory")}</Text>
          <View style={[styles.tabBorder, tab === "accessory" ? styles.tabBorderActive : null]} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t("equip.current")}</Text>
        <View style={styles.currentCard}>
          <View style={styles.currentIcon}>{getSlotIcon(tab)}</View>
          <View style={styles.currentTextWrap}>
            <Text style={styles.currentName}>{currentEquippedName}</Text>
            <Text style={styles.currentSub}>{currentEquipped ? t("equip.equipped") : (locale === "ja" ? "未装備" : "Unequipped")}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>{t("equip.inventory")}</Text>
        <View style={styles.listWrap}>
          {loading ? (
            <Text style={styles.helperText}>{locale === "ja" ? "読み込み中..." : "Loading..."}</Text>
          ) : tab === "accessory" ? (
            <Text style={styles.helperText}>{accessoryMessage}</Text>
          ) : filteredInventory.length === 0 ? (
            <Text style={styles.helperText}>{emptyInventoryMessage}</Text>
          ) : (
            filteredInventory.map((row) => {
              const itemName = locale === "ja" ? row.displayName.jp : row.displayName.en;
              return (
                <Pressable key={`${row.baseItemId}:${row.mutationPrefixId ?? ""}`} style={styles.itemCard} onPress={() => void onEquip(row)} disabled={busy}>
                  <View style={styles.itemIcon}>{getInventoryIcon(tab)}</View>
                  <View style={styles.currentTextWrap}>
                    <Text style={styles.itemName}>{itemName}</Text>
                    <Text style={styles.itemSub}>{`${t("equip.tap")} ×${row.quantity}`}</Text>
                  </View>
                </Pressable>
              );
            })
          )}

          {tab !== "accessory" ? (
            <View style={styles.unequipRow}>
              <Pressable onPress={() => void onUnequip()} disabled={busy || !currentEquipped}>
                <Text style={[styles.unequipText, !currentEquipped ? styles.unequipDisabled : null]}>{t("equip.unequip")}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  header: { paddingVertical: 12, paddingHorizontal: 20 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.bgSurface, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  tabs: { flexDirection: "row", paddingHorizontal: 20 },
  tabItem: { flex: 1, alignItems: "center" },
  tabText: { color: colors.textTertiary, fontSize: 14, fontWeight: "500", paddingVertical: 10 },
  tabTextActive: { color: colors.textPrimary, fontWeight: "700" },
  tabBorder: { width: "100%", height: 1, backgroundColor: colors.borderDefault },
  tabBorderActive: { height: 2, backgroundColor: colors.textPrimary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 10 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "500", letterSpacing: 1 },
  currentCard: { alignItems: "center", flexDirection: "row", borderRadius: 16, borderWidth: 1.5, borderColor: colors.borderAccent, backgroundColor: colors.bgAccent, gap: 12, padding: 14 },
  currentIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.textPrimary },
  currentTextWrap: { flex: 1, gap: 2 },
  currentName: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  currentSub: { color: colors.textTertiary, fontSize: 10 },
  divider: { height: 1, backgroundColor: colors.borderDefault, marginVertical: 2 },
  listWrap: { gap: 8 },
  helperText: { color: colors.textTertiary, fontSize: 12, paddingVertical: 8 },
  itemCard: { alignItems: "center", flexDirection: "row", borderRadius: 16, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.bgSurface, gap: 12, padding: 12 },
  itemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.bgPrimary },
  itemName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  itemSub: { color: colors.textTertiary, fontSize: 10 },
  unequipRow: { alignItems: "center", paddingVertical: 8 },
  unequipText: { color: colors.textSecondary, fontSize: 12, textDecorationLine: "underline" },
  unequipDisabled: { color: colors.borderDefault, textDecorationLine: "none" },
});
