import { create } from "zustand";
import { DEFAULT_PARTY_ID } from "@/db/repositories/charactersRepository";

type SelectedPartyState = {
  selectedPartyId: string;
  setSelectedPartyId: (partyId: string) => void;
};

export const useSelectedPartyStore = create<SelectedPartyState>((set) => ({
  selectedPartyId: DEFAULT_PARTY_ID,
  setSelectedPartyId: (partyId) => set({ selectedPartyId: partyId }),
}));
