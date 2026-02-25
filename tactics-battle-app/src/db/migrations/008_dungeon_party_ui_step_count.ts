export const MIGRATION_008 = `
ALTER TABLE dungeon_party_ui_state
ADD COLUMN step_count INTEGER NOT NULL DEFAULT 40;
`;
