import { describe, expect, it } from "vitest";
import { simulateBattle } from "@/game/battleSimulation";
import type { EncounterEnemy } from "@/game/encounter";
import type { Unit } from "@/game/battle";
import { makeRule, makeSkill } from "./helpers";
import { makeUnit } from "./helpers";

const toEncounter = (id: string, name: string, stats: Unit["stats"]): EncounterEnemy => ({
  enemyId: id,
  name,
  stats,
});

describe("game/battleSimulation", () => {
  it("returns WIN for a stronger party and uses fallback basic attacks", () => {
    const party = [
      makeUnit({ id: "p1", name: "Hero", stats: { atk: 25, def: 5, spd: 20 }, hp: 80 }),
      makeUnit({ id: "p2", name: "Mage", stats: { atk: 18, def: 3, spd: 15 }, hp: 60 }),
    ];
    const enemies = [
      toEncounter("slime", "Slime", { maxHp: 18, atk: 4, def: 1, spd: 5, maxMp: 0, mpRegen: 0 }),
    ];

    const result = simulateBattle({
      sessionId: "s1",
      seed: 1,
      party,
      enemies,
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 5,
    });

    expect(result.outcome).toBe("WIN");
    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.replayStates).toHaveLength(result.logs.length + 1);
    expect(result.visualEvents.length).toBeGreaterThan(0);
    expect(result.outcomeRevealLogCount).toBe(result.logs.length);
    expect(result.replayStates[0].party.map((unit) => unit.hp)).toEqual(party.map((unit) => unit.hp));
    expect(result.replayStates[0].enemies[0].hp).toBe(enemies[0].stats.maxHp);
    expect(result.logs.some((log) => log.actionType === "basic_attack")).toBe(true);
    expect(result.visualEvents.some((event) => event.kind === "damage_number")).toBe(true);
    expect(result.finalEnemies[0].hp).toBe(0);
    expect(result.finalParty[0]).not.toBe(party[0]);
  });

  it("creates log-index-synced visual events for basic attacks and maps attack style by class", () => {
    const party = [
      makeUnit({
        id: "t1",
        name: "Thief",
        classId: "THIEF",
        stats: { atk: 20, def: 1, spd: 20, maxHp: 30, maxMp: 0, mpRegen: 0 },
        hp: 30,
        mp: 0,
      }),
    ];
    const enemies = [
      toEncounter("slime", "Slime", { maxHp: 20, atk: 1, def: 0, spd: 1, maxMp: 0, mpRegen: 0 }),
    ];

    const result = simulateBattle({
      sessionId: "s-visual-1",
      seed: 9,
      party,
      enemies,
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 1,
    });

    const basicAttackLogIndex = result.logs.findIndex((log) => log.actionType === "basic_attack");
    expect(basicAttackLogIndex).toBeGreaterThanOrEqual(0);

    const syncedEvents = result.visualEvents.filter((event) => event.logIndex === basicAttackLogIndex);
    expect(syncedEvents.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["attack_trail", "hit_flash", "hit_reaction", "damage_number"])
    );
    expect(syncedEvents.every((event) => event.targetIds.length > 0)).toBe(true);
    expect(syncedEvents.some((event) => event.attackStyle === "dagger")).toBe(true);
  });

  it("falls back to generic attack style when class is unknown or missing", () => {
    const party = [
      makeUnit({
        id: "no-class",
        name: "NoClass",
        classId: undefined,
        stats: { atk: 20, def: 1, spd: 20, maxHp: 30, maxMp: 0, mpRegen: 0 },
        hp: 30,
        mp: 0,
      }),
    ];
    const enemies = [
      toEncounter("slime", "Slime", { maxHp: 10, atk: 1, def: 0, spd: 1, maxMp: 0, mpRegen: 0 }),
    ];

    const result = simulateBattle({
      sessionId: "s-visual-2",
      seed: 10,
      party,
      enemies,
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 1,
    });

    const attackTrail = result.visualEvents.find((event) => event.kind === "attack_trail");
    expect(attackTrail).toBeTruthy();
    expect(attackTrail?.attackStyle).toBe("generic");
  });

  it("returns LOSE when enemies overpower the party", () => {
    const party = [makeUnit({ id: "p1", hp: 10, stats: { maxHp: 10, atk: 2, def: 0, spd: 1 } })];
    const enemies = [
      toEncounter("ogre", "Ogre", { maxHp: 80, atk: 50, def: 0, spd: 30, maxMp: 0, mpRegen: 0 }),
    ];

    const result = simulateBattle({
      sessionId: "s2",
      seed: 2,
      party,
      enemies,
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 3,
    });

    expect(result.outcome).toBe("LOSE");
    expect(result.finalParty[0].hp).toBe(0);
  });

  it("returns DRAW immediately when maxTurns is 0", () => {
    const result = simulateBattle({
      sessionId: "s3",
      seed: 3,
      party: [makeUnit({ id: "p1" })],
      enemies: [toEncounter("slime", "Slime", { maxHp: 10, atk: 1, def: 0, spd: 1, maxMp: 0, mpRegen: 0 })],
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 0,
    });

    expect(result).toMatchObject({ outcome: "DRAW", turns: 0 });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toMatchObject({
      actionType: "RESULT_DRAW",
      actorName: "SYSTEM",
      logMessage: "battle.log.result_draw",
      turn: 0,
    });
    expect(result.replayStates).toHaveLength(2);
    expect(result.outcomeRevealLogCount).toBe(1);
  });

  it("logs poison tick and stun skip when statuses are present", () => {
    const party = [
      makeUnit({
        id: "p1",
        name: "Stunned Hero",
        hp: 30,
        stats: { maxHp: 30, atk: 10, def: 2, spd: 20, maxMp: 10, mpRegen: 0 },
        statusEffects: [
          { type: "POISON", remainingTurns: 1, potency: 2 },
          { type: "STUN", remainingTurns: 1 },
        ],
      }),
    ];
    const enemies = [
      toEncounter("slime", "Slime", { maxHp: 30, atk: 1, def: 0, spd: 1, maxMp: 0, mpRegen: 0 }),
    ];

    const result = simulateBattle({
      sessionId: "s4",
      seed: 4,
      party,
      enemies,
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 1,
    });

    expect(result.logs.some((log) => log.actionType === "POISON_TICK")).toBe(true);
    expect(result.logs.some((log) => log.actionType === "SKIP")).toBe(true);
    const poisonLogIndex = result.logs.findIndex((log) => log.actionType === "POISON_TICK");
    expect(poisonLogIndex).toBeGreaterThanOrEqual(0);
    expect(result.replayStates[poisonLogIndex + 1].party[0].hp).toBe(28);
  });

  it("uses matched tactics skill when rules resolve successfully", () => {
    const party = [
      makeUnit({
        id: "p1",
        name: "Caster",
        hp: 30,
        mp: 10,
        stats: { maxHp: 30, atk: 5, def: 1, spd: 20, maxMp: 10, mpRegen: 0 },
      }),
    ];
    const enemies = [
      toEncounter("slime", "Slime", { maxHp: 10, atk: 1, def: 0, spd: 1, maxMp: 0, mpRegen: 0 }),
    ];
    const skill = makeSkill({
      id: "heal_self",
      name: "Heal Self",
      type: "heal",
      target: "ALLY",
      effects: [{ kind: "HEAL", amount: 5 }],
    });
    const rules = [
      makeRule({
        id: "r1",
        characterId: "p1",
        skillId: "heal_self",
        conditionType: "ALWAYS",
        targetType: "SELF",
      }),
    ];

    const result = simulateBattle({
      sessionId: "s5",
      seed: 5,
      party,
      enemies,
      tacticsByCharacter: { p1: rules },
      skillMap: new Map([[skill.id, skill]]),
      maxTurns: 1,
    });

    expect(result.logs.some((log) => log.actionType === "heal_self")).toBe(true);
  });

  it("returns LOSE from enemy branch when party is wiped by poison before enemy acts", () => {
    const party = [
      makeUnit({
        id: "p1",
        hp: 2,
        stats: { maxHp: 10, atk: 1, def: 0, spd: 50 },
        statusEffects: [{ type: "POISON", remainingTurns: 1, potency: 5 }],
      }),
    ];
    const enemies = [
      toEncounter("e1", "Goblin", { maxHp: 10, atk: 1, def: 0, spd: 10, maxMp: 0, mpRegen: 0 }),
      toEncounter("e2", "Goblin", { maxHp: 10, atk: 1, def: 0, spd: 9, maxMp: 0, mpRegen: 0 }),
    ];

    const result = simulateBattle({
      sessionId: "s6",
      seed: 6,
      party,
      enemies,
      tacticsByCharacter: {},
      skillMap: new Map(),
      maxTurns: 1,
    });

    expect(result.outcome).toBe("LOSE");
    expect(result.logs.some((log) => log.actionType === "POISON_TICK")).toBe(true);
  });

  it("redirects enemy single-target attacks with taunt", () => {
    const guardian = makeUnit({
      id: "g1",
      name: "Guardian",
      hp: 60,
      mp: 10,
      stats: { maxHp: 60, atk: 5, def: 4, spd: 20, maxMp: 10, mpRegen: 0 },
    });
    const rogue = makeUnit({
      id: "r1",
      name: "Rogue",
      hp: 20,
      stats: { maxHp: 20, atk: 4, def: 0, spd: 10, maxMp: 0, mpRegen: 0 },
    });
    const enemies = [
      toEncounter("wolf", "Wolf", { maxHp: 30, atk: 12, def: 0, spd: 5, maxMp: 0, mpRegen: 0 }),
    ];
    const taunt = makeSkill({
      id: "taunt",
      name: "Taunt",
      type: "utility",
      target: "SELF",
      mpCost: 0,
      cooldown: 0,
      effects: [{ kind: "TAUNT", id: "TAUNT", duration: 1 }],
    });
    const rules = [
      makeRule({
        id: "taunt-rule",
        characterId: "g1",
        skillId: "taunt",
        conditionType: "ALWAYS",
        targetType: "SELF",
      }),
    ];

    const result = simulateBattle({
      sessionId: "s7",
      seed: 7,
      party: [guardian, rogue],
      enemies,
      tacticsByCharacter: { g1: rules },
      skillMap: new Map([[taunt.id, taunt]]),
      maxTurns: 1,
    });

    const finalGuardian = result.finalParty.find((u) => u.id === "g1")!;
    const finalRogue = result.finalParty.find((u) => u.id === "r1")!;
    expect(finalGuardian.hp).toBeLessThan(guardian.hp);
    expect(finalRogue.hp).toBe(rogue.hp);
  });

  it("applies all-enemy attacks to every enemy in battle simulation", () => {
    const caster = makeUnit({
      id: "w1",
      name: "Witch",
      mp: 20,
      stats: { maxHp: 30, atk: 20, def: 1, spd: 20, maxMp: 20, mpRegen: 0 },
    });
    const enemies = [
      toEncounter("s1", "Slime A", { maxHp: 30, atk: 1, def: 0, spd: 3, maxMp: 0, mpRegen: 0 }),
      toEncounter("s2", "Slime B", { maxHp: 30, atk: 1, def: 0, spd: 2, maxMp: 0, mpRegen: 0 }),
    ];
    const lightning = makeSkill({
      id: "lightning",
      name: "Lightning",
      type: "attack",
      target: "ENEMY",
      area: "ALL_ENEMIES",
      mpCost: 0,
      cooldown: 0,
      multiplier: 1.3,
    });
    const rules = [
      makeRule({
        id: "lightning-rule",
        characterId: "w1",
        skillId: "lightning",
        conditionType: "ALWAYS",
        targetType: "ENEMY_FIRST",
      }),
    ];

    const result = simulateBattle({
      sessionId: "s8",
      seed: 8,
      party: [caster],
      enemies,
      tacticsByCharacter: { w1: rules },
      skillMap: new Map([[lightning.id, lightning]]),
      maxTurns: 1,
    });

    expect(result.finalEnemies.every((enemy) => enemy.hp < enemy.stats.maxHp)).toBe(true);
    expect(result.logs.some((log) => log.actionType === "lightning" && log.targetName === null)).toBe(
      true
    );
    const lightningLogIndex = result.logs.findIndex((log) => log.actionType === "lightning");
    expect(lightningLogIndex).toBeGreaterThanOrEqual(0);
    expect(
      result.replayStates[lightningLogIndex + 1].enemies.every((enemy) => enemy.hp < enemy.stats.maxHp)
    ).toBe(true);
  });

  it("makes front party slots more likely targets than back slots", () => {
    const counts = new Map<string, number>();

    for (let seed = 1; seed <= 240; seed += 1) {
      const party = Array.from({ length: 6 }, (_, idx) =>
        makeUnit({
          id: `p${idx + 1}`,
          name: `P${idx + 1}`,
          hp: 100,
          stats: { maxHp: 100, atk: 0, def: 0, spd: 1, maxMp: 0, mpRegen: 0 },
          order: idx + 1,
        })
      );
      const enemies = [
        toEncounter("wolf", "Wolf", {
          maxHp: 999,
          atk: 1,
          def: 0,
          spd: 50,
          maxMp: 0,
          mpRegen: 0,
        }),
      ];

      const result = simulateBattle({
        sessionId: `weighted-${seed}`,
        seed,
        party,
        enemies,
        tacticsByCharacter: {},
        skillMap: new Map(),
        maxTurns: 1,
      });

      for (const unit of result.finalParty) {
        if (unit.hp < 100) {
          counts.set(unit.id, (counts.get(unit.id) ?? 0) + 1);
        }
      }
    }

    const front = counts.get("p1") ?? 0;
    const back = counts.get("p6") ?? 0;
    expect(front).toBeGreaterThan(back);
  });
});
