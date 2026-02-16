const test = require('node:test');
const assert = require('node:assert/strict');

const { applyDamage, getEffectiveStat } = require('../dist/battle');
const { GUARDIAN_SKILLS, executeSkill, getSkillById } = require('../dist/skills');
const { createUnit } = require('./helpers/createUnit');

test('guardian skills: guard stance, shield bash, fortify', () => {
  const guardian = createUnit({
    id: 'guardian',
    name: 'Guardian',
    stats: { maxHp: 120, atk: 8, def: 10, maxMp: 20 },
    hp: 120,
    mp: 20,
  });
  const boss = createUnit({
    id: 'boss',
    name: 'Boss',
    stats: { maxHp: 260, atk: 14, def: 6, maxMp: 999, mpRegen: 0 },
    hp: 260,
    mp: 999,
  });

  const guardStance = getSkillById(GUARDIAN_SKILLS, 'guard_stance');
  const shieldBash = getSkillById(GUARDIAN_SKILLS, 'shield_bash');
  const fortify = getSkillById(GUARDIAN_SKILLS, 'fortify');
  assert.ok(guardStance && shieldBash && fortify);

  executeSkill(guardian, guardian, guardStance, () => 0);
  assert.equal(guardian.mp, 16);
  assert.equal(guardian.cooldowns.guard_stance, 3);
  assert.equal(getEffectiveStat(guardian, 'def'), 14);

  const shieldResult = executeSkill(guardian, boss, shieldBash, () => 0);
  assert.equal(guardian.mp, 11);
  assert.equal(guardian.cooldowns.shield_bash, 4);
  assert.equal(shieldResult.damage, 8);
  assert.equal(boss.hp, 252);
  assert.equal(
    boss.statusEffects.some((status) => status.type === 'STUN' && status.remainingTurns === 1),
    true
  );

  executeSkill(guardian, guardian, fortify, () => 0);
  assert.equal(guardian.mp, 5);
  assert.equal(guardian.cooldowns.fortify, 5);
  const beforeHp = guardian.hp;
  const taken = applyDamage(guardian, 10);
  assert.equal(taken, 7);
  assert.equal(guardian.hp, beforeHp - 7);
});
