export const MIGRATION_009 = `
ALTER TABLE characters
ADD COLUMN constellation_id TEXT NOT NULL DEFAULT 'ARIES';
`;
