const test = require('node:test');
const assert = require('node:assert/strict');

const { getEffectiveStat } = require('../dist/battle');
const { CLERIC_SKILLS, executeSkill, getSkillById } = require('../dist/skills');
const { createUnit } = require('./helpers/createUnit');

test('cleric skills: heal, greater heal, cleanse, bless', () => {
  const cleric = createUnit({
    id: 'cleric',
    name: 'Cleric',
    stats: { maxHp: 80, atk: 5, def: 6, maxMp: 35 },
    hp: 80,
    mp: 35,
  });
  const blade = createUnit({
    id: 'blade',
    name: 'Blade',
    stats: { maxHp: 90, atk: 12, def: 5, maxMp: 25 },
    hp: 40,
    mp: 25,
    statusEffects: [
      { type: 'POISON', remainingTurns: 3, potency: 6 },
      { type: 'STUN', remainingTurns: 1 },
    ],
  });

  const heal = getSkillById(CLERIC_SKILLS, 'heal');
  const greaterHeal = getSkillById(CLERIC_SKILLS, 'greater_heal');
  const cleanse = getSkillById(CLERIC_SKILLS, 'cleanse');
  const bless = getSkillById(CLERIC_SKILLS, 'bless');
  assert.ok(heal && greaterHeal && cleanse && bless);

  const healResult = executeSkill(cleric, blade, heal, () => 0);
  assert.equal(healResult.healing, 18);
  assert.equal(blade.hp, 58);

  const greaterHealResult = executeSkill(cleric, blade, greaterHeal, () => 0);
  assert.equal(greaterHealResult.healing, 32);
  assert.equal(blade.hp, 90);

  const cleanseResult = executeSkill(cleric, blade, cleanse, () => 0);
  assert.deepEqual(cleanseResult.cleansedStatuses, ['POISON']);
  assert.equal(blade.statusEffects.some((status) => status.type === 'POISON'), false);
  assert.equal(blade.statusEffects.some((status) => status.type === 'STUN'), true);

  executeSkill(cleric, blade, bless, () => 0);
  assert.equal(getEffectiveStat(blade, 'atk'), 15);
});
