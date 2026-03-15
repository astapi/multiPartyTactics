export const MIGRATION_012 = `
UPDATE dungeons
SET min_floor = 1,
    max_floor = 120
WHERE id = 'crestoria_dungeon_1_200';
`;
