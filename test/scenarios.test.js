const test = require('node:test');
const assert = require('node:assert/strict');

const { runAllScenarios } = require('../dist/scenarios');

const captureLogs = (fn) => {
  const original = console.log;
  const lines = [];
  console.log = (...args) => {
    lines.push(args.join(' '));
  };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
};

const findLine = (lines, predicate) => lines.find((line) => predicate(line));

const turnLine = (lines, scenarioName, actor, turn) =>
  findLine(
    lines,
    (line) =>
      line.includes(`[${scenarioName}]`) &&
      line.includes(`turn ${turn}`) &&
      line.includes(`actor=${actor}`)
  );

test('scenario A turn 1 uses Guard Stance and Berserk, heal not triggered', () => {
  const logs = captureLogs(() => runAllScenarios());

  const guardianLine = turnLine(logs, 'Scenario A', 'Guardian', 1);
  assert.ok(guardianLine, 'Guardian turn 1 line not found');
  assert.ok(guardianLine.includes('action=Guard Stance'));

  const bladeLine = turnLine(logs, 'Scenario A', 'Blade', 1);
  assert.ok(bladeLine, 'Blade turn 1 line not found');
  assert.ok(bladeLine.includes('action=Berserk'));

  const clericLine = turnLine(logs, 'Scenario A', 'Cleric', 1);
  assert.ok(clericLine, 'Cleric turn 1 line not found');
  assert.ok(clericLine.includes('action=Bless'));
  assert.equal(clericLine.includes('action=Heal'), false);
  assert.equal(clericLine.includes('action=Greater Heal'), false);
});

test('scenario B uses Cleanse when poison is applied', () => {
  const logs = captureLogs(() => runAllScenarios());
  const cleanseLine = findLine(
    logs,
    (line) =>
      line.includes('[Scenario B]') &&
      line.includes('action=Cleanse') &&
      line.includes('statusRemoved=[POISON]')
  );
  assert.ok(cleanseLine, 'Cleanse line for Scenario B not found');
});

test('scenario C uses Cleanse on poisoned ally in early turns', () => {
  const logs = captureLogs(() => runAllScenarios());
  const cleanseLine = findLine(
    logs,
    (line) =>
      line.includes('[Scenario C]') &&
      line.includes('rule=cleanse_turn_leq3') &&
      line.includes('action=Cleanse')
  );
  assert.ok(cleanseLine, 'Cleanse line for Scenario C not found');
});
