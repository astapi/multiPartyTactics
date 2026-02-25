import { describe, expect, it } from "vitest";
import { buildDungeonPartyCardState } from "@/features/dungeon/partyCardState";

describe("buildDungeonPartyCardState", () => {
  it("returns idle state when floor is not selected", () => {
    const vm = buildDungeonPartyCardState({ selectedFloor: null, mode: "IDLE", maxClearedFloor: 12 });
    expect(vm.displayStatus).toBe("idle");
    expect(vm.primaryAction).toBe("selectFloor");
    expect(vm.secondaryAction).toBeNull();
  });

  it("treats frontier floor as deepest explore-only", () => {
    const vm = buildDungeonPartyCardState({ selectedFloor: 13, mode: "IDLE", maxClearedFloor: 12 });
    expect(vm.displayStatus).toBe("explore-frontier");
    expect(vm.floorLabelType).toBe("deepest");
    expect(vm.secondaryAction).toBeNull();
    expect(vm.isAutoEnabled).toBe(false);
  });

  it("treats other uncleared floor as target explore-only", () => {
    const vm = buildDungeonPartyCardState({ selectedFloor: 15, mode: "IDLE", maxClearedFloor: 12 });
    expect(vm.displayStatus).toBe("explore-uncleared");
    expect(vm.floorLabelType).toBe("target");
    expect(vm.primaryAction).toBe("resumeExplore");
  });

  it("shows auto-running state on cleared floor when mode is AUTO", () => {
    const vm = buildDungeonPartyCardState({ selectedFloor: 8, mode: "AUTO", maxClearedFloor: 12 });
    expect(vm.displayStatus).toBe("auto-running");
    expect(vm.showAutoBadge).toBe(true);
    expect(vm.showAutoStats).toBe(true);
    expect(vm.primaryAction).toBe("autoStop");
  });

  it("shows explore + auto on cleared floor when mode is not AUTO", () => {
    const vm = buildDungeonPartyCardState({ selectedFloor: 8, mode: "EXPLORE", maxClearedFloor: 12 });
    expect(vm.displayStatus).toBe("auto-ready");
    expect(vm.primaryAction).toBe("explore");
    expect(vm.secondaryAction).toBe("autoStart");
  });
});
