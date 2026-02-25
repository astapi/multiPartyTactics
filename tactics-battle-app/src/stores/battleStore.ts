import { create } from "zustand";
import { BattleLogRecord, BattleStatus } from "@/types/models";

type BattleState = {
  sessionId: string | null;
  logs: BattleLogRecord[];
  status: BattleStatus;
  latestBattleSessionId: string | null;
  latestBattleExplorationSeed: number | null;
  latestBattleDrops: string[];
  setSessionId: (sessionId: string | null) => void;
  setLogs: (logs: BattleLogRecord[]) => void;
  appendLog: (log: BattleLogRecord) => void;
  setStatus: (status: BattleStatus) => void;
  setLatestBattleRewards: (params: {
    sessionId: string | null;
    explorationSeed: number | null;
    drops: string[];
  }) => void;
  reset: () => void;
};

export const useBattleStore = create<BattleState>((set) => ({
  sessionId: null,
  logs: [],
  status: "IDLE",
  latestBattleSessionId: null,
  latestBattleExplorationSeed: null,
  latestBattleDrops: [],
  setSessionId: (sessionId) => set({ sessionId }),
  setLogs: (logs) => set({ logs }),
  appendLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  setStatus: (status) => set({ status }),
  setLatestBattleRewards: ({ sessionId, explorationSeed, drops }) =>
    set({
      latestBattleSessionId: sessionId,
      latestBattleExplorationSeed: explorationSeed,
      latestBattleDrops: [...drops],
    }),
  reset: () =>
    set({
      sessionId: null,
      logs: [],
      status: "IDLE",
      latestBattleSessionId: null,
      latestBattleExplorationSeed: null,
      latestBattleDrops: [],
    }),
}));
