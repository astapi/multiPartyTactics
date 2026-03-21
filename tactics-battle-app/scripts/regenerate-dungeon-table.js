const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dungeonTablePath = path.join(root, "src/data/dungeonEnemyTable.json");
const legacyTablePath = path.join(root, "src/data/dungeonEnemyTable_legacy_121_200.json");

const currentData = JSON.parse(fs.readFileSync(dungeonTablePath, "utf8"));
const legacyData = JSON.parse(fs.readFileSync(legacyTablePath, "utf8"));

const originalDungeon = currentData.dungeons.find((entry) => entry.dungeonId === "crestoria_dungeon_1_200");
if (!originalDungeon) {
  throw new Error("crestoria_dungeon_1_200 not found in dungeonEnemyTable.json");
}

const originalFloors = [...originalDungeon.floors, ...legacyData.floors].sort((a, b) => a.floor - b.floor);

const FALLBACK_TEMPLATES = {
  wolf: { statScale: 1, hpScale: 2 },
  ghoul: { statScale: 1, hpScale: 1 },
  scorpion: { statScale: 1, hpScale: 1 },
  banshee: { statScale: 1, hpScale: 1 },
  minotaur: { statScale: 1, hpScale: 1 },
  cyclops: { statScale: 1.185, hpScale: 1 },
  elder_cyclops: { statScale: 1.22, hpScale: 1 },
  vampire: { statScale: 1.185, hpScale: 1 },
  shield_golem: { statScale: 1.15, hpScale: 1 },
};

const BANDS = [
  { start: 1, end: 3, enemies: ["slime", "giant_rat", "goblin_scout", "kobold_scout", "wolf"] },
  { start: 4, end: 6, enemies: ["slime", "giant_rat", "goblin_warrior", "kobold_spearman", "skeleton_soldier"] },
  { start: 7, end: 9, enemies: ["goblin_warrior", "goblin_archer", "kobold_spearman", "kobold_trapper", "feral_rat", "plague_rat"] },
  { start: 10, end: 10, enemies: ["goblin_warrior", "goblin_archer", "kobold_trapper", "skeleton_soldier", "plague_rat"] },
  { start: 11, end: 13, enemies: ["goblin_warrior", "goblin_archer", "skeleton_soldier", "skeleton_archer", "acid_slime", "feral_rat"] },
  { start: 14, end: 16, enemies: ["hobgoblin", "goblin_mage", "kobold_captain", "skeleton_archer", "acid_slime", "poison_toad"] },
  { start: 17, end: 19, enemies: ["hobgoblin", "goblin_mage", "skeleton_archer", "poison_toad", "plague_rat"] },
  { start: 20, end: 20, enemies: ["hobgoblin", "goblin_mage", "kobold_captain", "skeleton_archer", "poison_toad"] },
  { start: 21, end: 23, enemies: ["orc_warrior", "hobgoblin", "skeleton_soldier", "skeleton_archer", "ghoul", "scorpion"] },
  { start: 24, end: 26, enemies: ["orc_warrior", "orc_hunter", "skeleton_knight", "skeleton_archer", "ghoul", "scorpion"] },
  { start: 27, end: 29, enemies: ["orc_warrior", "orc_hunter", "skeleton_knight", "lizardman_warrior", "goblin_shaman", "ghoul"] },
  { start: 30, end: 30, enemies: ["orc_warrior", "orc_hunter", "skeleton_knight", "lizardman_warrior", "ghoul"] },
  { start: 31, end: 33, enemies: ["orc_warrior", "orc_shaman", "skeleton_knight", "lizardman_warrior", "lizardman_spearman", "ghoul"] },
  { start: 34, end: 36, enemies: ["orc_hunter", "orc_shaman", "skeleton_knight", "lizardman_warrior", "lizardman_spearman", "wraith"] },
  { start: 37, end: 39, enemies: ["orc_hunter", "lizardman_warrior", "lizardman_spearman", "lizardman_hunter", "skeleton_knight", "wraith"] },
  { start: 40, end: 40, enemies: ["orc_hunter", "lizardman_warrior", "lizardman_hunter", "skeleton_knight", "wraith"] },
  { start: 41, end: 43, enemies: ["orc_warrior", "orc_hunter", "lizardman_warrior", "skeleton_knight", "goblin_shaman"] },
  { start: 44, end: 46, enemies: ["orc_berserker", "orc_hunter", "lizardman_warrior", "skeleton_knight", "giant_bat", "rock_lizard"] },
  { start: 47, end: 49, enemies: ["orc_veteran", "orc_berserker", "lizardman_warrior", "skeleton_archer", "ghoul", "scorpion"] },
  { start: 50, end: 50, enemies: ["orc_veteran", "orc_berserker", "lizardman_warrior", "skeleton_archer", "ghoul"] },
  { start: 51, end: 53, enemies: ["orc_veteran", "cave_troll", "skeleton_archer", "toxic_slime", "wraith", "shadow_rat"] },
  { start: 54, end: 56, enemies: ["cave_troll", "orc_shaman", "ghoul", "scorpion", "wraith", "shadow_rat"] },
  { start: 57, end: 59, enemies: ["rock_troll", "cave_troll", "stone_gargoyle", "skeleton_mage", "ghoul", "banshee"] },
  { start: 60, end: 60, enemies: ["rock_troll", "cave_troll", "stone_gargoyle", "skeleton_mage", "banshee"] },
  { start: 61, end: 63, enemies: ["rock_troll", "stone_gargoyle", "orc_blackguard", "skeleton_mage", "banshee", "death_knight"] },
  { start: 64, end: 66, enemies: ["stone_gargoyle", "orc_blackguard", "skeleton_mage", "death_knight", "lizardman_champion", "lizardman_guard"] },
  { start: 67, end: 69, enemies: ["stone_gargoyle", "iron_gargoyle", "orc_blackguard", "lizardman_champion", "war_troll", "minotaur"] },
  { start: 70, end: 70, enemies: ["stone_gargoyle", "iron_gargoyle", "war_troll", "minotaur", "orc_blackguard"] },
  { start: 71, end: 73, enemies: ["rock_troll", "stone_gargoyle", "war_troll", "minotaur", "orc_blackguard", "lizardman_champion"] },
  { start: 74, end: 76, enemies: ["rock_troll", "iron_gargoyle", "minotaur", "war_troll", "orc_shaman", "lizardman_guard"] },
  { start: 77, end: 79, enemies: ["iron_gargoyle", "minotaur", "war_troll", "orc_shaman", "death_knight", "rock_troll"] },
  { start: 80, end: 80, enemies: ["iron_gargoyle", "minotaur", "war_troll", "death_knight", "rock_troll"] },
  { start: 81, end: 83, enemies: ["rock_troll", "stone_gargoyle", "iron_gargoyle", "minotaur_raider", "orc_shaman"] },
  { start: 84, end: 86, enemies: ["minotaur_raider", "minotaur_guard", "iron_gargoyle", "war_troll", "storm_harpy"] },
  { start: 87, end: 89, enemies: ["minotaur_guard", "minotaur_champion", "obsidian_gargoyle", "rock_troll", "death_knight"] },
  { start: 90, end: 90, enemies: ["minotaur_guard", "minotaur_champion", "obsidian_gargoyle", "rock_troll", "death_knight"] },
  { start: 91, end: 93, enemies: ["minotaur_champion", "obsidian_gargoyle", "cyclops", "war_troll", "shield_golem"] },
  { start: 94, end: 96, enemies: ["cyclops", "elder_cyclops", "shield_golem", "construct_artillery", "vampire"] },
  { start: 97, end: 99, enemies: ["elder_cyclops", "hill_giant", "war_giant", "lesser_demon", "demon_soldier"] },
  { start: 100, end: 100, enemies: ["elder_cyclops", "hill_giant", "war_giant", "demon_soldier", "lesser_demon"] },
  { start: 101, end: 103, enemies: ["war_giant", "lesser_demon", "demon_soldier", "demon_mage", "greater_demon"] },
  { start: 104, end: 106, enemies: ["demon_mage", "greater_demon", "demon_knight", "archlich", "lich_mage"] },
  { start: 107, end: 109, enemies: ["demon_knight", "archlich", "lich_lord", "construct_core", "construct_artillery"] },
  { start: 110, end: 110, enemies: ["demon_knight", "archlich", "lich_lord", "construct_core", "construct_artillery"] },
  { start: 111, end: 113, enemies: ["young_dragon", "dragon_whelp", "adult_dragon", "demon_warlord", "ancient_giant"] },
  { start: 114, end: 116, enemies: ["adult_dragon", "elder_dragon", "demon_warlord", "lich_lord", "abyss_dragon"] },
  { start: 117, end: 119, enemies: ["elder_dragon", "abyss_dragon", "demon_warlord", "lich_lord", "construct_core"] },
  { start: 120, end: 120, enemies: ["elder_dragon", "abyss_dragon", "demon_warlord", "construct_core", "lich_lord"] },
];

const mapTargetFloorToSource = (floor) => Math.round(1 + ((floor - 1) * 199) / 119);

const getSourceTemplate = (enemyId, sourceFloor, targetFloor) => {
  let best = null;
  for (const floor of originalFloors) {
    for (const encounter of floor.encounters) {
      if (encounter.enemyId !== enemyId) continue;
      const distance = Math.abs(floor.floor - sourceFloor);
      if (!best || distance < best.distance) {
        best = { distance, encounter };
      }
    }
  }

  if (best) {
    return {
      level: best.encounter.level ?? targetFloor,
      statScale: best.encounter.statScale ?? 1,
      hpScale: best.encounter.hpScale ?? 1,
    };
  }

  const fallback = FALLBACK_TEMPLATES[enemyId] ?? { statScale: 1, hpScale: 1 };
  return {
    level: targetFloor,
    statScale: fallback.statScale,
    hpScale: fallback.hpScale,
  };
};

const getWeights = (count) => {
  if (count === 5) return [28, 24, 20, 16, 12];
  if (count === 6) return [24, 21, 18, 15, 12, 10];
  if (count === 4) return [32, 26, 22, 18];
  if (count === 3) return [40, 34, 26];
  return Array.from({ length: count }, (_, index) => Math.max(6, 24 - index * 3));
};

const findBand = (floor) => {
  const band = BANDS.find((entry) => floor >= entry.start && floor <= entry.end);
  if (!band) throw new Error(`No band configured for floor ${floor}`);
  return band;
};

const getBandIndex = (floor) => {
  const index = BANDS.findIndex((entry) => floor >= entry.start && floor <= entry.end);
  if (index < 0) throw new Error(`No band index configured for floor ${floor}`);
  return index;
};

const addCandidate = (pool, enemyId, baseScore) => {
  const current = pool.get(enemyId);
  if (!current || baseScore > current.baseScore) {
    pool.set(enemyId, { enemyId, baseScore });
  }
};

const buildLineup = ({ floor, bandIndex, streaks, lastSeen }) => {
  const band = BANDS[bandIndex];
  const prevBand = BANDS[bandIndex - 1];
  const nextBand = BANDS[bandIndex + 1];
  const pool = new Map();
  const offset = floor - band.start;
  const targetCount = Math.min(6, Math.max(5, band.enemies.length));

  band.enemies.forEach((enemyId, index) => {
    addCandidate(pool, enemyId, 100 - index * 12);
  });

  if (band.start !== band.end && prevBand) {
    if (offset === 0) {
      addCandidate(pool, prevBand.enemies.at(-1), 34);
      addCandidate(pool, prevBand.enemies.at(-2), 28);
    }
    if (offset === 1) {
      addCandidate(pool, prevBand.enemies.at(-1), 22);
    }
  }

  if (band.start !== band.end && nextBand) {
    if (offset === 1) {
      addCandidate(pool, nextBand.enemies[0], 26);
    }
    if (offset === 2) {
      addCandidate(pool, nextBand.enemies[0], 36);
      addCandidate(pool, nextBand.enemies[1], 30);
    }
  }

  const lineup = [...pool.values()]
    .map((candidate) => {
      const streak = streaks.get(candidate.enemyId) ?? 0;
      const gap = floor - (lastSeen.get(candidate.enemyId) ?? -999);
      let score = candidate.baseScore;
      if (streak >= 3) score = Number.NEGATIVE_INFINITY;
      else if (streak === 2) score *= 0.08;
      else if (streak === 1) score *= 0.55;
      if (gap === 1) score *= 0.75;
      else if (gap >= 4) score *= 1.08;
      return { ...candidate, score };
    })
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score || b.baseScore - a.baseScore)
    .slice(0, targetCount)
    .map((candidate) => candidate.enemyId);

  return lineup;
};

const generatedFloors = [];
const streaks = new Map();
const lastSeen = new Map();

for (let floor = 1; floor <= 120; floor += 1) {
  const band = findBand(floor);
  const bandIndex = getBandIndex(floor);
  const sourceFloor = mapTargetFloorToSource(floor);
  const lineup = buildLineup({ floor, bandIndex, streaks, lastSeen });
  const weights = getWeights(lineup.length);
  const encounters = lineup.map((enemyId, index) => {
    const template = getSourceTemplate(enemyId, sourceFloor, floor);
    return {
      enemyId,
      weight: weights[index],
      level: floor,
      statScale: Number(template.statScale.toFixed(3)),
      hpScale: Number(template.hpScale.toFixed(3)),
    };
  });

  for (const key of [...streaks.keys()]) {
    if (!lineup.includes(key)) {
      streaks.set(key, 0);
    }
  }
  for (const enemyId of lineup) {
    const nextStreak = lastSeen.get(enemyId) === floor - 1 ? (streaks.get(enemyId) ?? 0) + 1 : 1;
    streaks.set(enemyId, nextStreak);
    lastSeen.set(enemyId, floor);
  }

  generatedFloors.push({
    floor,
    tableId: `R${String(band.start).padStart(3, "0")}`,
    isBossFloor: floor % 10 === 0,
    encounters,
  });
}

const nextDungeon = {
  dungeonId: "crestoria_dungeon_1_200",
  bossFloors: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
  floors: generatedFloors,
};

const nextData = {
  ...currentData,
  dungeons: currentData.dungeons.map((entry) =>
    entry.dungeonId === nextDungeon.dungeonId ? nextDungeon : entry
  ),
};

fs.writeFileSync(dungeonTablePath, `${JSON.stringify(nextData, null, 2)}\n`);
console.log(`Updated ${path.relative(process.cwd(), dungeonTablePath)}`);
