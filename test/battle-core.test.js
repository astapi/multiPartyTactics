const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculatePhysicalDamage,
  applyStatus,
  tickStatusesOnTurnStart,
} = require('../dist/battle');

const createUnit = (overrides = {}) => ({
  id: 'unit',
  name: 'Unit',
  stats: {
    maxHp: 100,
    atk: 10,
    def: 5,
    spd: 10,
    maxMp: 20,
    mpRegen: 2,
  },
  hp: 100,
  mp: 20,
  statusEffects: [],
  effects: [],
  cooldowns: {},
  order: 1,
  ...overrides,
});

test('calculatePhysicalDamage uses max(1, power + atk - def)', () => {
  const attacker = createUnit({ stats: { ...createUnit().stats, atk: 12 } });
  const defender = createUnit({ stats: { ...createUnit().stats, def: 8 } });
  assert.equal(calculatePhysicalDamage(attacker, defender, 6), 10);

  const lowAttacker = createUnit({ stats: { ...createUnit().stats, atk: 1 } });
  const highDefender = createUnit({ stats: { ...createUnit().stats, def: 999 } });
  assert.equal(calculatePhysicalDamage(lowAttacker, highDefender, 0), 1);
});

test('tickStatusesOnTurnStart applies poison damage and expires', () => {
  const unit = createUnit({ hp: 20 });
  applyStatus(unit, { type: 'POISON', remainingTurns: 2, potency: 5 });

  const first = tickStatusesOnTurnStart(unit);
  assert.equal(unit.hp, 15);
  assert.equal(first.poisonedDamage, 5);
  assert.equal(first.skippedAction, false);
  assert.deepEqual(first.expired, []);
  assert.equal(unit.statusEffects[0].remainingTurns, 1);

  const second = tickStatusesOnTurnStart(unit);
  assert.equal(unit.hp, 10);
  assert.equal(second.poisonedDamage, 5);
  assert.deepEqual(second.expired, ['POISON']);
  assert.equal(unit.statusEffects.length, 0);
});

test('tickStatusesOnTurnStart handles stun skip', () => {
  const unit = createUnit({ hp: 50 });
  applyStatus(unit, { type: 'STUN', remainingTurns: 1 });

  const result = tickStatusesOnTurnStart(unit);
  assert.equal(result.skippedAction, true);
  assert.deepEqual(result.expired, ['STUN']);
  assert.equal(unit.statusEffects.length, 0);
});
