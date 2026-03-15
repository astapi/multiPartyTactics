import { describe, expect, it } from "vitest";
import { formatBattleLogMessage } from "@/game/battleLog";

const jaMessages: Record<string, string> = {
  "skill.name.basic_attack": "通常攻撃",
  "skill.name.sword_dance": "つるぎの舞",
  "skill.name.lightning": "ライトニング",
  "battle.log.basic_attack_damage": "{actorName} の攻撃！ {targetName} に {damage} のダメージ",
  "battle.log.skill_use_target_damage":
    "{actorName} は {targetName} に {skillName} を使った。{targetName} に {damage} のダメージ",
  "battle.log.skill_use_damage": "{actorName} は {skillName} を使った。合計 {damage} のダメージ",
  "battle.log.damage_target": "{targetName} に {damage} のダメージ",
  "battle.log.result_win": "戦闘に勝利した",
  "battle.log.meta.wrap": "({detail})",
  "battle.log.meta.damage": "DMG:{damage}",
  "battle.log.meta.healing": "HEAL:{healing}",
};

const t = (key: string, params?: Record<string, string | number>) => {
  const template = jaMessages[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ""));
};

describe("game/battleLog", () => {
  it("formats single-target attack logs without DMG meta", () => {
    const message = formatBattleLogMessage(
      {
        battleSessionId: "s1",
        turn: 1,
        actorName: "シオン",
        actionType: "basic_attack",
        targetName: "Skeleton Soldier 1",
        damage: 31,
        healing: 0,
        logMessage: "battle.log.basic_attack",
      },
      t as any
    );

    expect(message).toBe("シオン の攻撃！ Skeleton Soldier 1 に 31 のダメージ");
  });

  it("formats targeted skill attack logs without DMG meta", () => {
    const message = formatBattleLogMessage(
      {
        battleSessionId: "s1",
        turn: 1,
        actorName: "ネル",
        actionType: "sword_dance",
        targetName: "Goblin Warrior 2",
        damage: 23,
        healing: 0,
        logMessage: "battle.log.skill_use_target",
      },
      t as any
    );

    expect(message).toBe(
      "ネル は Goblin Warrior 2 に つるぎの舞 を使った。Goblin Warrior 2 に 23 のダメージ"
    );
  });

  it("formats area skill attack logs with total damage sentence", () => {
    const message = formatBattleLogMessage(
      {
        battleSessionId: "s1",
        turn: 1,
        actorName: "シオン",
        actionType: "lightning",
        targetName: null,
        damage: 42,
        healing: 0,
        logMessage: "battle.log.skill_use",
      },
      t as any
    );

    expect(message).toBe("シオン は ライトニング を使った。合計 42 のダメージ");
  });
});
