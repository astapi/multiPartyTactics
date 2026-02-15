const test = require('node:test');
const assert = require('node:assert/strict');

const { getEffectiveStat } = require('../dist/battle');
const { BLADE_SKILLS, executeSkill, getSkillById } = require('../dist/skills');
const { createUnit } = require('./helpers/createUnit');

test('blade skills: berserk, power strike, execute', () => {
  const blade = createUnit({
    id: 'blade',
    name: 'Blade',
    stats: { maxHp: 90, atk: 12, def: 5, maxMp: 25 },
    hp: 90,
    mp: 25,
  });
  const boss = createUnit({
    id: 'boss',
    name: 'Boss',
    stats: { maxHp: 260, atk: 14, def: 6, maxMp: 999, mpRegen: 0 },
    hp: 260,
    mp: 999,
  });

  const berserk = getSkillById(BLADE_SKILLS, 'berserk');
  const powerStrike = getSkillById(BLADE_SKILLS, 'power_strike');
  const execute = getSkillById(BLADE_SKILLS, 'execute');
  assert.ok(berserk && powerStrike && execute);

  executeSkill(blade, blade, berserk, () => 0);
  assert.equal(getEffectiveStat(blade, 'atk'), 18);
  assert.equal(getEffectiveStat(blade, 'def'), 3);

  const strikeResult = executeSkill(blade, boss, powerStrike, () => 0);
  assert.equal(strikeResult.damage, 22);

  boss.hp = 70;
  const executeResult = executeSkill(blade, boss, execute, () => 0);
  assert.equal(executeResult.damage, 32);
});
