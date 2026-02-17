export type DungeonOption = {
  id: string;
  floorLabel: string;
  minFloor: number;
  floors: number;
};

export const DUNGEONS: DungeonOption[] = [
  {
    id: "crestoria_dungeon_1_4",
    floorLabel: "1-4F",
    minFloor: 1,
    floors: 4,
  },
  {
    id: "crestoria_dungeon_5_9",
    floorLabel: "5-9F",
    minFloor: 5,
    floors: 9,
  },
];
