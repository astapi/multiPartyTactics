import { create } from "zustand";
import { BattleLogRecord } from "@/types/models";

type BattleState = {
  sessionId: string | null;
  logs: BattleLogRecord[];
  status: "IDLE" | "IN_PROGRESS" | "WIN" | "LOSE";
  setSessionId: (sessionId: string | null) => void;
  setLogs: (logs: BattleLogRecord[]) => void;
  appendLog: (log: BattleLogRecord) => void;
  setStatus: (status: BattleState["status"]) => void;
  reset: () => void;
};

export const useBattleStore = create<BattleState>((set) => ({
  sessionId: null,
  logs: [],
  status: "IDLE",
  setSessionId: (sessionId) => set({ sessionId }),
  setLogs: (logs) => set({ logs }),
  appendLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  setStatus: (status) => set({ status }),
  reset: () => set({ sessionId: null, logs: [], status: "IDLE" }),
}));
