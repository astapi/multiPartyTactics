const test = require('node:test');
const assert = require('node:assert/strict');

const { tickCooldownsOnTurnStart } = require('../dist/battle');
const {
  GUARDIAN_SKILLS,
  executeSkill,
} = require('../dist/skills');

const createUnit = (overrides = {}) => ({
  id: 'guardian',
  name: 'Guardian',
  stats: {
    maxHp: 120,
    atk: 8,
    def: 10,
    spd: 8,
    maxMp: 20,
    mpRegen: 2,
  },
  hp: 120,
  mp: 20,
  statusEffects: [],
  effects: [],
  cooldowns: {},
  order: 1,
  ...overrides,
});

test('skill usage sets cooldown and tick reduces it', () => {
  const actor = createUnit();
  const target = actor;
  const guardStance = GUARDIAN_SKILLS.find((skill) => skill.id === 'guard_stance');
  assert.ok(guardStance);

  executeSkill(actor, target, guardStance, () => 0);
  assert.equal(actor.cooldowns.guard_stance, guardStance.cooldown);

  tickCooldownsOnTurnStart(actor);
  assert.equal(actor.cooldowns.guard_stance, guardStance.cooldown - 1);
});
