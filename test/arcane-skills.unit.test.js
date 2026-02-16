const test = require('node:test');
const assert = require('node:assert/strict');

const { getEffectiveStat, tickStatusesOnTurnStart } = require('../dist/battle');
const { ARCANE_SKILLS, executeSkill, getSkillById } = require('../dist/skills');
const { createUnit } = require('./helpers/createUnit');

test('arcane skills: weaken, armor break, poison, mana charge', () => {
  const arcane = createUnit({
    id: 'arcane',
    name: 'Arcane',
    stats: { maxHp: 75, atk: 6, def: 5, maxMp: 30 },
    hp: 75,
    mp: 30,
  });
  const boss = createUnit({
    id: 'boss',
    name: 'Boss',
    stats: { maxHp: 260, atk: 14, def: 6, maxMp: 999, mpRegen: 0 },
    hp: 260,
    mp: 999,
  });

  const weaken = getSkillById(ARCANE_SKILLS, 'weaken');
  const armorBreak = getSkillById(ARCANE_SKILLS, 'armor_break');
  const poison = getSkillById(ARCANE_SKILLS, 'poison');
  const manaCharge = getSkillById(ARCANE_SKILLS, 'mana_charge');
  assert.ok(weaken && armorBreak && poison && manaCharge);

  executeSkill(arcane, boss, weaken, () => 0);
  assert.equal(getEffectiveStat(boss, 'atk'), 10);

  executeSkill(arcane, boss, armorBreak, () => 0);
  assert.equal(getEffectiveStat(boss, 'def'), 2);

  executeSkill(arcane, boss, poison, () => 0);
  assert.equal(
    boss.statusEffects.some(
      (status) => status.type === 'POISON' && status.remainingTurns === 3 && status.potency === 6
    ),
    true
  );
  const beforeHp = boss.hp;
  const poisonTick = tickStatusesOnTurnStart(boss);
  assert.equal(poisonTick.poisonedDamage, 6);
  assert.equal(boss.hp, beforeHp - 6);

  arcane.mp = 22;
  executeSkill(arcane, arcane, manaCharge, () => 0);
  assert.equal(arcane.mp, 30);
});
