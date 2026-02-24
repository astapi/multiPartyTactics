export const MIGRATION_004 = `
INSERT OR IGNORE INTO dungeons
(id, min_floor, max_floor, sort_order, is_bonus, is_enabled)
VALUES
('hakusla_dungeon_1_200', 1, 200, 5, 0, 1);

INSERT OR IGNORE INTO unlocked_dungeons (dungeon_id, unlock_reason)
VALUES
('hakusla_dungeon_1_200', 'content_update_004');
`;
