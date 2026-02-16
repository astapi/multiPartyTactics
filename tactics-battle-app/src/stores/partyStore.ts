import { create } from "zustand";
import { CharacterRecord, TacticsRuleRecord } from "@/types/models";

type PartyState = {
  characters: CharacterRecord[];
  tacticsMap: Record<string, TacticsRuleRecord[]>;
  setCharacters: (characters: CharacterRecord[]) => void;
  setTactics: (characterId: string, rules: TacticsRuleRecord[]) => void;
};

export const usePartyStore = create<PartyState>((set) => ({
  characters: [],
  tacticsMap: {},
  setCharacters: (characters) => set({ characters }),
  setTactics: (characterId, rules) =>
    set((state) => ({ tacticsMap: { ...state.tacticsMap, [characterId]: rules } })),
}));
