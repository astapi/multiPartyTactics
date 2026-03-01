import { ImageSourcePropType } from "react-native";

const DEFAULT_ENEMY_IMAGE = require("@/assets/images/enemies/default.png");

/**
 * 敵ID → 画像マッピング
 * - require() はビルド時に解決される（ランタイムコストなし）
 * - 同一画像を複数IDで参照してもバンドルは重複しない（Metro bundler が自動解決）
 * - 新モンスター追加時はこのマップにエントリを追加するだけ
 * - 画像差し替え時は対応する .png ファイルを上書きするだけで反映される
 */
const ENEMY_IMAGE_MAP: Record<string, ImageSourcePropType> = {
  // --- スライム系 ---
  slime: require("@/assets/images/enemies/slime.png"),
  acid_slime: require("@/assets/images/enemies/acid_slime.png"),
  toxic_slime: require("@/assets/images/enemies/toxic_slime.png"),

  // --- ネズミ系 ---
  feral_rat: require("@/assets/images/enemies/feral_rat.png"),
  giant_rat: require("@/assets/images/enemies/giant_rat.png"),
  plague_rat: require("@/assets/images/enemies/plague_rat.png"),
  shadow_rat: require("@/assets/images/enemies/shadow_rat.png"),

  // --- ゴブリン系 ---
  goblin: require("@/assets/images/enemies/goblin.png"),
  goblin_archer: require("@/assets/images/enemies/goblin_archer.png"),
  goblin_mage: require("@/assets/images/enemies/goblin_mage.png"),
  goblin_scout: require("@/assets/images/enemies/goblin_scout.png"),
  goblin_shaman: require("@/assets/images/enemies/goblin_shaman.png"),
  goblin_warrior: require("@/assets/images/enemies/goblin_warrior.png"),
  hobgoblin: require("@/assets/images/enemies/hobgoblin.png"),

  // --- コボルド系 ---
  kobold_scout: require("@/assets/images/enemies/kobold_scout.png"),
  kobold_spearman: require("@/assets/images/enemies/kobold_spearman.png"),
  kobold_trapper: require("@/assets/images/enemies/kobold_trapper.png"),
  kobold_captain: require("@/assets/images/enemies/kobold_captain.png"),
  kobold_mage: require("@/assets/images/enemies/kobold_mage.png"),

  // --- 毒ガエル系 ---
  poison_toad: require("@/assets/images/enemies/poison_toad.png"),

  // --- スケルトン系 ---
  skeleton_archer: require("@/assets/images/enemies/skeleton_archer.png"),
  skeleton_knight: require("@/assets/images/enemies/skeleton_knight.png"),
  skeleton_mage: require("@/assets/images/enemies/skeleton_mage.png"),
  skeleton_soldier: require("@/assets/images/enemies/skeleton_soldier.png"),

  // --- オーク系 ---
  orc_berserker: require("@/assets/images/enemies/orc_berserker.png"),
  orc_blackguard: require("@/assets/images/enemies/orc_blackguard.png"),
  orc_hunter: require("@/assets/images/enemies/orc_hunter.png"),
  orc_mage: require("@/assets/images/enemies/orc_mage.png"),
  orc_shaman: require("@/assets/images/enemies/orc_shaman.png"),
  orc_veteran: require("@/assets/images/enemies/orc_veteran.png"),
  orc_warrior: require("@/assets/images/enemies/orc_warrior.png"),

  // --- リザードマン系 ---
  lizardman_champion: require("@/assets/images/enemies/lizardman_champion.png"),
  lizardman_guard: require("@/assets/images/enemies/lizardman_guard.png"),
  lizardman_hunter: require("@/assets/images/enemies/lizardman_hunter.png"),
  lizardman_shaman: require("@/assets/images/enemies/lizardman_shaman.png"),
  lizardman_spearman: require("@/assets/images/enemies/lizardman_spearman.png"),
  lizardman_warrior: require("@/assets/images/enemies/lizardman_warrior.png"),

  // --- トロール系 ---
  cave_troll: require("@/assets/images/enemies/cave_troll.png"),
  rock_troll: require("@/assets/images/enemies/rock_troll.png"),
  war_troll: require("@/assets/images/enemies/war_troll.png"),

  // --- ガーゴイル系 ---
  stone_gargoyle: require("@/assets/images/enemies/stone_gargoyle.png"),
  iron_gargoyle: require("@/assets/images/enemies/iron_gargoyle.png"),
  obsidian_gargoyle: require("@/assets/images/enemies/obsidian_gargoyle.png"),

  // --- ミノタウロス系 ---
  minotaur_axeman: require("@/assets/images/enemies/minotaur_axeman.png"),
  minotaur_berserker: require("@/assets/images/enemies/minotaur_berserker.png"),
  minotaur_champion: require("@/assets/images/enemies/minotaur_champion.png"),
  minotaur_guard: require("@/assets/images/enemies/minotaur_guard.png"),
  minotaur_priest: require("@/assets/images/enemies/minotaur_priest.png"),
  minotaur_raider: require("@/assets/images/enemies/minotaur_raider.png"),

  // --- リッチ系 ---
  lesser_lich: require("@/assets/images/enemies/lesser_lich.png"),
  lich_mage: require("@/assets/images/enemies/lich_mage.png"),
  lich_lord: require("@/assets/images/enemies/lich_lord.png"),
  archlich: require("@/assets/images/enemies/archlich.png"),

  // --- 魔導機械系 ---
  construct_artillery: require("@/assets/images/enemies/construct_artillery.png"),
  construct_core: require("@/assets/images/enemies/construct_core.png"),
  construct_proto: require("@/assets/images/enemies/construct_proto.png"),
  construct_shield: require("@/assets/images/enemies/construct_shield.png"),
  construct_warp: require("@/assets/images/enemies/construct_warp.png"),

  // --- デーモン系 ---
  lesser_demon: require("@/assets/images/enemies/lesser_demon.png"),
  demon_soldier: require("@/assets/images/enemies/demon_soldier.png"),
  demon_mage: require("@/assets/images/enemies/demon_mage.png"),
  demon_knight: require("@/assets/images/enemies/demon_knight.png"),
  demon_warlord: require("@/assets/images/enemies/demon_warlord.png"),
  greater_demon: require("@/assets/images/enemies/greater_demon.png"),

  // --- 巨人系 ---
  hill_giant: require("@/assets/images/enemies/hill_giant.png"),
  stone_giant: require("@/assets/images/enemies/stone_giant.png"),
  war_giant: require("@/assets/images/enemies/war_giant.png"),
  ancient_giant: require("@/assets/images/enemies/ancient_giant.png"),

  // --- ドラゴン系 ---
  dragon_whelp: require("@/assets/images/enemies/dragon_whelp.png"),
  young_dragon: require("@/assets/images/enemies/young_dragon.png"),
  adult_dragon: require("@/assets/images/enemies/adult_dragon.png"),
  elder_dragon: require("@/assets/images/enemies/elder_dragon.png"),
  abyss_dragon: require("@/assets/images/enemies/abyss_dragon.png"),
};

const BOSS_IMAGE_MAP: Record<string, ImageSourcePropType> = {
  boss_lepus: require("@/assets/images/enemies/boss/lepus.png"),
};

/**
 * 敵IDから画像を取得
 * O(1)のRecord参照。画像未登録の場合はデフォルト画像を返す。
 */
export const getEnemyImage = (enemyId: string): ImageSourcePropType => {
  return BOSS_IMAGE_MAP[enemyId]
    ?? ENEMY_IMAGE_MAP[enemyId]
    ?? DEFAULT_ENEMY_IMAGE;
};

/**
 * ボス判定
 */
export const isBossEnemyId = (enemyId: string): boolean => {
  return enemyId in BOSS_IMAGE_MAP;
};

/**
 * 敵IDからサイズ倍率を取得
 * ベースサイズ(72px)に対する倍率を返す
 */
export const getEnemySizeScale = (enemyId: string): number => {
  const id = enemyId.toLowerCase();
  // ボス
  if (id in BOSS_IMAGE_MAP || id.includes("boss_")) return 1.55;
  // 巨大 (dragon, giant, demon_warlord, greater_demon, abyss)
  if (id.includes("dragon") || id.includes("giant") || id.includes("demon_warlord") || id.includes("greater_demon") || id.includes("abyss")) return 1.4;
  // 大型 (troll, minotaur, construct, demon)
  if (id.includes("troll") || id.includes("minotaur") || id.includes("construct") || id.includes("demon")) return 1.2;
  // 中型 (orc, lizardman, gargoyle, lich, hobgoblin)
  if (id.includes("orc") || id.includes("lizardman") || id.includes("gargoyle") || id.includes("lich") || id.includes("hobgoblin")) return 1.0;
  // やや小型 (skeleton, kobold, poison_toad)
  if (id.includes("skeleton") || id.includes("kobold") || id.includes("poison_toad") || id.includes("poison_frog")) return 0.9;
  // 小型 (slime, rat, goblin)
  if (id.includes("slime") || id.includes("rat") || id.includes("goblin")) return 0.8;
  // デフォルト
  return 1.0;
};
