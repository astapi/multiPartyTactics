export const MIGRATION_015 = `
ALTER TABLE dungeon_party_ui_state
ADD COLUMN return_condition TEXT NOT NULL DEFAULT 'ANY_MEMBER_DOWN'
CHECK (return_condition IN ('ANY_MEMBER_DOWN', 'INVENTORY_FULL', 'BEFORE_BOSS', 'UNTIL_WIPE_OR_CLEAR'));
`;
