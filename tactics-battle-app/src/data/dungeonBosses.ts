import type { Stats } from "@/game/battle";

export type DungeonBossDefinition = {
  floor: number;
  id: string;
  zodiacJa: string;
  zodiacEn: string;
  name: string;
  title: string;
  role: string;
  profile: string;
  stats: Stats;
};

export const DUNGEON_BOSS_DEFINITIONS: DungeonBossDefinition[] = [
  {
    floor: 10,
    id: "boss_aries",
    zodiacJa: "牡羊宮",
    zodiacEn: "Aries",
    name: "星霊導師アリエス",
    title: "支援型の星霊魔導ボス",
    role: "サポート型ボス",
    profile: "星霊術と補助魔法を極めた最初の守護者。バランスの取れた魔法寄りのボス。",
    stats: { maxHp: 260, atk: 48, def: 18, spi: 72, spd: 16, maxMp: 96, mpRegen: 7 },
  },
  {
    floor: 20,
    id: "boss_taurus",
    zodiacJa: "牡牛宮",
    zodiacEn: "Taurus",
    name: "巨角王タウロス",
    title: "巨体で押し切る重装守護者",
    role: "タンクボス",
    profile: "圧倒的な耐久力で前線を支配する守護王。HPと防御を大きく高めたボス。",
    stats: { maxHp: 430, atk: 58, def: 30, spi: 24, spd: 10, maxMp: 36, mpRegen: 2 },
  },
  {
    floor: 30,
    id: "boss_gemini",
    zodiacJa: "双子宮",
    zodiacEn: "Gemini",
    name: "幻影王ジェミニ",
    title: "幻惑と速度で翻弄する双貌王",
    role: "トリッキーボス",
    profile: "実像と虚像を重ねて戦う攪乱型ボス。速度とMP効率を高めている。",
    stats: { maxHp: 470, atk: 72, def: 24, spi: 64, spd: 20, maxMp: 84, mpRegen: 6 },
  },
  {
    floor: 40,
    id: "boss_cancer",
    zodiacJa: "蟹宮",
    zodiacEn: "Cancer",
    name: "冥界司祭キャンサー",
    title: "死霊と呪術を操る冥府司祭",
    role: "ネクロマンサー型",
    profile: "冥界の力を借りて戦線を削る呪術師。中盤以降の継戦能力を意識した配分。",
    stats: { maxHp: 580, atk: 80, def: 28, spi: 86, spd: 15, maxMp: 112, mpRegen: 7 },
  },
  {
    floor: 50,
    id: "boss_leo",
    zodiacJa: "獅子宮",
    zodiacEn: "Leo",
    name: "雷光王レオ",
    title: "迅雷の連撃で仕留める獅子王",
    role: "DPSボス",
    profile: "高火力の連続攻撃を得意とする攻撃特化ボス。速度と攻撃を強めに設定。",
    stats: { maxHp: 680, atk: 98, def: 26, spi: 46, spd: 24, maxMp: 60, mpRegen: 4 },
  },
  {
    floor: 60,
    id: "boss_virgo",
    zodiacJa: "乙女宮",
    zodiacEn: "Virgo",
    name: "天空僧ヴィルゴ",
    title: "精神干渉に長けた天上の修道者",
    role: "精神系ボス",
    profile: "封印や行動阻害を思わせる制圧型ボス。高めの防御とMPを持つ。",
    stats: { maxHp: 790, atk: 92, def: 34, spi: 98, spd: 21, maxMp: 126, mpRegen: 8 },
  },
  {
    floor: 70,
    id: "boss_libra",
    zodiacJa: "天秤宮",
    zodiacEn: "Libra",
    name: "武神ライブラ",
    title: "武装を切り替える戦技の化身",
    role: "武器スタイル変化ボス",
    profile: "戦況に応じて戦法を変える武神。攻防の総合値を高めた万能型ボス。",
    stats: { maxHp: 910, atk: 112, def: 38, spi: 62, spd: 19, maxMp: 82, mpRegen: 5 },
  },
  {
    floor: 80,
    id: "boss_scorpio",
    zodiacJa: "蠍宮",
    zodiacEn: "Scorpio",
    name: "毒帝スコルピオ",
    title: "持続毒で壊滅へ導く毒王",
    role: "DOTボス",
    profile: "毒と消耗で優位を取る遅効型ボス。攻撃とMPを高め、長期戦に強い。",
    stats: { maxHp: 1020, atk: 118, def: 36, spi: 90, spd: 22, maxMp: 118, mpRegen: 7 },
  },
  {
    floor: 90,
    id: "boss_sagittarius",
    zodiacJa: "射手宮",
    zodiacEn: "Sagittarius",
    name: "星弓王サジタリウス",
    title: "星を射抜く長弓の王",
    role: "遠距離ボス",
    profile: "遠距離高火力を象徴する射手王。高攻撃・高速度の終盤ボス。",
    stats: { maxHp: 1140, atk: 132, def: 40, spi: 70, spd: 24, maxMp: 92, mpRegen: 5 },
  },
  {
    floor: 100,
    id: "boss_capricorn",
    zodiacJa: "山羊宮",
    zodiacEn: "Capricorn",
    name: "聖刃王カプリコーン",
    title: "聖剣を極めた断罪の王",
    role: "剣士ボス",
    profile: "防御貫通と会心を思わせる純アタッカー。最終盤に向けた高水準の剣士。",
    stats: { maxHp: 1280, atk: 146, def: 46, spi: 54, spd: 22, maxMp: 72, mpRegen: 4 },
  },
  {
    floor: 110,
    id: "boss_aquarius",
    zodiacJa: "水瓶宮",
    zodiacEn: "Aquarius",
    name: "氷帝アクエリアス",
    title: "凍てつく支配を司る氷の皇帝",
    role: "CCボス",
    profile: "凍結と鈍化を軸に主導権を握る制御型ボス。高HPと高MPを両立する。",
    stats: { maxHp: 1420, atk: 154, def: 48, spi: 112, spd: 20, maxMp: 146, mpRegen: 8 },
  },
  {
    floor: 120,
    id: "boss_pisces",
    zodiacJa: "魚宮",
    zodiacEn: "Pisces",
    name: "深紅王ピスケス",
    title: "深紅の薔薇で終幕を飾る最終守護者",
    role: "最終ボス",
    profile: "魅了・出血・毒を束ねる終末の王。最終階層にふさわしい総合性能のボス。",
    stats: { maxHp: 1600, atk: 168, def: 52, spi: 124, spd: 23, maxMp: 160, mpRegen: 9 },
  },
];

export const DUNGEON_BOSS_BY_FLOOR = new Map(
  DUNGEON_BOSS_DEFINITIONS.map((boss) => [boss.floor, boss] as const)
);
