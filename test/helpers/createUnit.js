const createUnit = (overrides = {}) => {
  const base = {
    id: 'unit',
    name: 'Unit',
    jobId: undefined,
    stats: {
      maxHp: 100,
      atk: 10,
      def: 5,
      spd: 10,
      maxMp: 30,
      mpRegen: 2,
    },
    hp: 100,
    mp: 30,
    statusEffects: [],
    effects: [],
    cooldowns: {},
    order: 1,
  };

  const stats = { ...base.stats, ...(overrides.stats ?? {}) };
  return { ...base, ...overrides, stats };
};

module.exports = { createUnit };
