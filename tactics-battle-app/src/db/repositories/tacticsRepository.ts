import { getDb } from "@/db/database";
import { TacticsRuleRecord } from "@/types/models";

const mapRule = (row: any): TacticsRuleRecord => ({
  id: row.id,
  characterId: row.character_id,
  priority: row.priority,
  skillId: row.skill_id,
  conditionType: row.condition_type,
  conditionParams: row.condition_params,
  targetType: row.target_type,
  targetParams: row.target_params,
});

export const tacticsRepository = {
  async listByCharacter(characterId: string): Promise<TacticsRuleRecord[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM tactics_rules WHERE character_id = ? ORDER BY priority ASC",
      [characterId]
    );
    return rows.map(mapRule);
  },

  async replaceForCharacter(characterId: string, rules: TacticsRuleRecord[]): Promise<void> {
    const db = await getDb();
    await db.runAsync("DELETE FROM tactics_rules WHERE character_id = ?", [characterId]);
    for (const rule of rules) {
      await db.runAsync(
        `INSERT INTO tactics_rules
        (id, character_id, priority, skill_id, condition_type, condition_params, target_type, target_params)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rule.id,
          characterId,
          rule.priority,
          rule.skillId,
          rule.conditionType,
          rule.conditionParams,
          rule.targetType,
          rule.targetParams,
        ]
      );
    }
  },
};
