import { create } from "zustand";
import { BattleLogRecord, BattleStatus } from "@/types/models";

export type BattleSyncPartyMember = {
  id: string;
  name: string;
  classId?: string;
  hp: number;
  mp: number;
  level?: number | null;
};

export type BattlePartySyncPayload = {
  battleSessionId: string | null;
  explorationSeed: number | null;
  partyId: string | null;
  members: BattleSyncPartyMember[];
};

type BattleState = {
  sessionId: string | null;
  logs: BattleLogRecord[];
  status: BattleStatus;
  latestBattleSessionId: string | null;
  latestBattleExplorationSeed: number | null;
  latestBattleGold: number;
  latestBattleDrops: string[];
  pendingExplorationPartySync: BattlePartySyncPayload | null;
  latestBattlePartySync: BattlePartySyncPayload | null;
  setSessionId: (sessionId: string | null) => void;
  setLogs: (logs: BattleLogRecord[]) => void;
  appendLog: (log: BattleLogRecord) => void;
  setStatus: (status: BattleStatus) => void;
  setLatestBattleRewards: (params: {
    sessionId: string | null;
    explorationSeed: number | null;
    gold: number;
    drops: string[];
  }) => void;
  setPendingExplorationPartySync: (payload: BattlePartySyncPayload | null) => void;
  setLatestBattlePartySync: (payload: BattlePartySyncPayload | null) => void;
  reset: () => void;
};

export const useBattleStore = create<BattleState>((set) => ({
  sessionId: null,
  logs: [],
  status: "IDLE",
  latestBattleSessionId: null,
  latestBattleExplorationSeed: null,
  latestBattleGold: 0,
  latestBattleDrops: [],
  pendingExplorationPartySync: null,
  latestBattlePartySync: null,
  setSessionId: (sessionId) => set({ sessionId }),
  setLogs: (logs) => set({ logs }),
  appendLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  setStatus: (status) => set({ status }),
  setLatestBattleRewards: ({ sessionId, explorationSeed, gold, drops }) =>
    set({
      latestBattleSessionId: sessionId,
      latestBattleExplorationSeed: explorationSeed,
      latestBattleGold: Math.max(0, Math.floor(gold)),
      latestBattleDrops: [...drops],
    }),
  setPendingExplorationPartySync: (payload) =>
    set({
      pendingExplorationPartySync: payload
        ? {
            ...payload,
            members: payload.members.map((member) => ({ ...member })),
          }
        : null,
    }),
  setLatestBattlePartySync: (payload) =>
    set({
      latestBattlePartySync: payload
        ? {
            ...payload,
            members: payload.members.map((member) => ({ ...member })),
          }
        : null,
    }),
  reset: () =>
    set((state) => ({
      sessionId: null,
      logs: [],
      status: "IDLE",
      latestBattleSessionId: null,
      latestBattleExplorationSeed: null,
      latestBattleGold: 0,
      latestBattleDrops: [],
      pendingExplorationPartySync: state.pendingExplorationPartySync,
      latestBattlePartySync: state.latestBattlePartySync,
    })),
}));
