export type DungeonOption = {
  id: string;
  name: string;
  floors: number;
};

export const DUNGEONS: DungeonOption[] = [
  { id: "training-cavern", name: "Training Cavern", floors: 5 },
  { id: "venom-ruins", name: "Venom Ruins", floors: 10 },
];
