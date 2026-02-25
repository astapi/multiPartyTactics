import { DungeonPartyUiMode } from "@/types/models";

export type DungeonPartyCardDisplayStatus =
  | "idle"
  | "explore-frontier"
  | "explore-uncleared"
  | "auto-ready"
  | "auto-running";

export type DungeonPartyCardAction =
  | "selectFloor"
  | "resumeExplore"
  | "explore"
  | "autoStart"
  | "autoStop";

export type DungeonPartyCardViewModel = {
  displayStatus: DungeonPartyCardDisplayStatus;
  floor: number | null;
  floorLabelType: "deepest" | "target" | "auto" | null;
  showFloorChangeChip: boolean;
  showAutoBadge: boolean;
  showAutoStats: boolean;
  primaryAction: DungeonPartyCardAction;
  secondaryAction: DungeonPartyCardAction | null;
  isExploreEnabled: boolean;
  isAutoEnabled: boolean;
};

export type BuildDungeonPartyCardStateInput = {
  selectedFloor: number | null;
  mode: DungeonPartyUiMode;
  maxClearedFloor: number;
};

export const buildDungeonPartyCardState = (
  input: BuildDungeonPartyCardStateInput
): DungeonPartyCardViewModel => {
  const { selectedFloor, mode } = input;
  const maxClearedFloor = Math.max(0, input.maxClearedFloor);

  if (selectedFloor === null || selectedFloor <= 0) {
    return {
      displayStatus: "idle",
      floor: null,
      floorLabelType: null,
      showFloorChangeChip: false,
      showAutoBadge: false,
      showAutoStats: false,
      primaryAction: "selectFloor",
      secondaryAction: null,
      isExploreEnabled: false,
      isAutoEnabled: false,
    };
  }

  if (selectedFloor > maxClearedFloor) {
    const isFrontier = selectedFloor === maxClearedFloor + 1;
    return {
      displayStatus: isFrontier ? "explore-frontier" : "explore-uncleared",
      floor: selectedFloor,
      floorLabelType: isFrontier ? "deepest" : "target",
      showFloorChangeChip: true,
      showAutoBadge: false,
      showAutoStats: false,
      primaryAction: "resumeExplore",
      secondaryAction: null,
      isExploreEnabled: true,
      isAutoEnabled: false,
    };
  }

  if (mode === "AUTO") {
    return {
      displayStatus: "auto-running",
      floor: selectedFloor,
      floorLabelType: "auto",
      showFloorChangeChip: true,
      showAutoBadge: true,
      showAutoStats: true,
      primaryAction: "autoStop",
      secondaryAction: null,
      isExploreEnabled: false,
      isAutoEnabled: true,
    };
  }

  return {
    displayStatus: "auto-ready",
    floor: selectedFloor,
    floorLabelType: "auto",
    showFloorChangeChip: true,
    showAutoBadge: false,
    showAutoStats: false,
    primaryAction: "explore",
    secondaryAction: "autoStart",
    isExploreEnabled: true,
    isAutoEnabled: true,
  };
};
