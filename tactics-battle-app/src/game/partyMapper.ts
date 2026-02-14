import { Unit } from "@/game/battle";
import { CharacterRecord } from "@/types/models";

export const toUnit = (character: CharacterRecord): Unit => ({
  id: character.id,
  name: character.name,
  jobId: character.jobId,
  stats: {
    maxHp: character.baseMaxHp,
    atk: character.baseAtk,
    def: character.baseDef,
    spd: character.baseSpd,
    maxMp: character.baseMaxMp,
    mpRegen: character.baseMpRegen,
  },
  hp: character.currentHp,
  mp: character.currentMp,
  statusEffects: [],
  effects: [],
  cooldowns: {},
  order: character.slotIndex + 1,
});
