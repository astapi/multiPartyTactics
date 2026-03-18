import { create } from "zustand";

export type ExplorationRunPartyMember = {
  id: string;
  name: string;
  classId?: string;
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
  level?: number | null;
};

type ExplorationRunState = {
  explorationSeed: number | null;
  partyId: string | null;
  members: ExplorationRunPartyMember[];
  startRun: (params: {
    explorationSeed: number;
    partyId: string;
    members: ExplorationRunPartyMember[];
  }) => void;
  replaceMembersForRun: (params: {
    explorationSeed: number;
    partyId: string;
    members: ExplorationRunPartyMember[];
  }) => void;
  applyPartyWideTrapDamage: (params: {
    explorationSeed: number;
    partyId: string;
    damage: number;
  }) => void;
  clearRun: () => void;
};

const cloneMembers = (members: ExplorationRunPartyMember[]): ExplorationRunPartyMember[] =>
  members.map((member) => ({ ...member }));

export const useExplorationRunStore = create<ExplorationRunState>((set) => ({
  explorationSeed: null,
  partyId: null,
  members: [],
  startRun: ({ explorationSeed, partyId, members }) =>
    set({
      explorationSeed,
      partyId,
      members: cloneMembers(members),
    }),
  replaceMembersForRun: ({ explorationSeed, partyId, members }) =>
    set((state) => {
      if (state.explorationSeed !== explorationSeed) return state;
      if (state.partyId !== partyId) return state;
      return {
        ...state,
        members: cloneMembers(members),
      };
    }),
  applyPartyWideTrapDamage: ({ explorationSeed, partyId, damage }) =>
    set((state) => {
      if (state.explorationSeed !== explorationSeed) return state;
      if (state.partyId !== partyId) return state;
      const nextDamage = Math.max(0, Math.floor(damage));
      if (nextDamage <= 0) return state;
      return {
        ...state,
        members: state.members.map((member) => ({
          ...member,
          hp: Math.max(0, member.hp - nextDamage),
        })),
      };
    }),
  clearRun: () =>
    set({
      explorationSeed: null,
      partyId: null,
      members: [],
    }),
}));
