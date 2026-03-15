import { Unit } from "@/game/battle";
import {
  computeCharacterDerivedStats,
  toBattleResource,
} from "@/game/equipment/equipmentStatsService";
import type { EquipmentBySlot } from "@/db/repositories/characterEquipmentRepository";
import { CharacterRecord } from "@/types/models";
import { hasTrait } from "@/features/guild/traits";

type PartyMemberRecord = CharacterRecord & { slotIndex: number };

export const toUnit = (
  character: PartyMemberRecord,
  equippedBySlot: EquipmentBySlot = {}
): Unit => {
  const derived = computeCharacterDerivedStats(character, equippedBySlot);
  return {
    id: character.id,
    name: character.name,
    classId: character.classId,
    stats: derived.battle,
    hp: toBattleResource(character.currentHp, character.baseMaxHp, derived.bonus.hp),
    mp: toBattleResource(character.currentMp, character.baseMaxMp, derived.bonus.mp),
    statusEffects: [],
    effects: [],
    cooldowns: {},
    order: character.slotIndex + 1,
  };
};

export const toPartyUnits = (
  characters: PartyMemberRecord[],
  equippedByCharacterId: Record<string, EquipmentBySlot> = {}
): Unit[] => {
  const heroCount = characters.filter((character) => hasTrait(character.traitIds, "HERO")).length;
  const hpMultiplier = heroCount > 0 ? 1.2 : 1;

  return characters.map((character) => {
    const unit = toUnit(character, equippedByCharacterId[character.id] ?? {});
    if (hpMultiplier === 1) return unit;
    const boostedMaxHp = Math.max(1, Math.floor(unit.stats.maxHp * hpMultiplier));
    const boostedCurrentHp = Math.max(1, Math.floor(unit.hp * hpMultiplier));
    return {
      ...unit,
      stats: {
        ...unit.stats,
        maxHp: boostedMaxHp,
      },
      hp: Math.min(boostedMaxHp, boostedCurrentHp),
    };
  });
};
