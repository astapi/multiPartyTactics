export type DungeonOption = {
  id: string;
  floorLabel: string;
  minFloor: number;
  floors: number;
};

export const DUNGEONS: DungeonOption[] = [
  {
    id: "crestoria_dungeon_1_200",
    floorLabel: "1-200F",
    minFloor: 1,
    floors: 200,
  },
];
