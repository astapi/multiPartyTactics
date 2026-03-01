import { Unit } from "@/game/battle";
import {
  computeCharacterDerivedStats,
  toBattleResource,
} from "@/game/equipment/equipmentStatsService";
import type { EquipmentBySlot } from "@/db/repositories/characterEquipmentRepository";
import { CharacterRecord } from "@/types/models";

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
