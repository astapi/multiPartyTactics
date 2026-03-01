# 宝箱産アイテム仕様

## 概要

ダンジョン探索中に宝箱から入手できる装備アイテムのシステム。フロア帯に応じたティア制を採用し、10F刻みで排出アイテムが切り替わる。

## ティアシステム

### フロア → ティア変換

```
tier = min(190, ceil(floor / 10) * 10)
```

| フロア帯 | ティア |
|----------|--------|
| 1F〜10F | 10 |
| 11F〜20F | 20 |
| 21F〜30F | 30 |
| ... | ... |
| 181F〜190F | 190 |
| 191F以上 | 190（クランプ） |

### ティア別素材・品数一覧（全19ティア / 計129品）

| ティア | 素材キー | JP | EN | カテゴリ数 | 品数 |
|--------|----------|----|----|-----------|------|
| 10 | bronze | ブロンズ | Bronze | 5 | 5 |
| 20 | iron | アイアン | Iron | 5 | 5 |
| 30 | steel | スチール | Steel | 7 | 7 |
| 40 | silver | シルバー | Silver | 7 | 7 |
| 50 | crimson | クリムゾン | Crimson | 7 | 7 |
| 60 | platinum | プラチナ | Platinum | 7 | 7 |
| 70 | mythril | ミスリル | Mythril | 7 | 7 |
| 80 | orichalcum | オリハルコン | Orichalcum | 7 | 7 |
| 90 | adamant | アダマン | Adamant | 7 | 7 |
| 100 | cobalt | コバルト | Cobalt | 7 | 7 |
| 110 | moonstone | ムーンストーン | Moonstone | 7 | 7 |
| 120 | celestite | セレスタイト | Celestite | 7 | 7 |
| 130 | stardust | スターダスト | Stardust | 7 | 7 |
| 140 | shadow | シャドウ | Shadow | 7 | 7 |
| 150 | dragonsteel | ドラゴンスチール | Dragonsteel | 7 | 7 |
| 160 | divine | ディヴァイン | Divine | 7 | 7 |
| 170 | ethereal | エーテル | Ethereal | 7 | 7 |
| 180 | void | ヴォイド | Void | 7 | 7 |
| 190 | chaos | カオス | Chaos | 7 | 7 |

### カテゴリ解禁

- **ティア10〜20（5カテゴリ）**: 片手剣 / 短剣 / 投刃 / 杖 / 盾
- **ティア30以降（7カテゴリ）**: 上記 + 両手斧 / 弓

> 両手槌（ハンマー）は宝箱からは排出されない。

### カテゴリ別排出重み

合計100。ティア10〜20では斧・弓の重みは無視される（該当アイテムが存在しないため）。

| カテゴリ | 重み |
|----------|------|
| 片手剣（one_handed_sword） | 16 |
| 短剣（dagger） | 13 |
| 投刃（throwing_knife） | 11 |
| 両手斧（two_handed_axe） | 13 |
| 弓（bow） | 13 |
| 杖（staff） | 16 |
| 盾（shield） | 18 |

### ID命名規則

```
chest_{素材キー}_{武器種}
```

武器種サフィックス:

| カテゴリ | サフィックス | 例 |
|----------|-------------|-----|
| 片手剣 | sword | `chest_bronze_sword` |
| 短剣 | dagger | `chest_bronze_dagger` |
| 投刃 | throwing_blade | `chest_bronze_throwing_blade` |
| 両手斧 | axe | `chest_steel_axe` |
| 弓 | bow | `chest_steel_bow` |
| 杖 | staff | `chest_bronze_staff` |
| 盾 | shield | `chest_bronze_shield` |

### 共通属性

- `source`: `"chest"`
- `can_mutate`: `false`（変異対象外）
- 盾は全て `shieldSize: "large"`

## 抽選ロジック

`rollTreasureChestEquipment()` の処理フロー:

1. フロア番号からティアを算出
2. 該当ティアのアイテムプールを取得
3. カテゴリ重みに基づきカテゴリを抽選（プール内に存在するカテゴリのみ対象）
4. カテゴリ内のアイテムから均等抽選
5. 変異なし（`mutationPrefixId: null`）で確定

シード計算:
```
seed = (explorationSeed ^ (tick * 131071) ^ (floor * 8191) ^ hash(dungeonId)) >>> 0
```

---

# アイテムステータス仕様

## 概要

全装備アイテム（shop / monster / chest）はステータスボーナスを持つ。`EquipmentStats` 型で定義され、`equipmentMaster.json` の各アイテムに `stats` フィールドとして設定される。

## ステータス項目

| フィールド | 略称 | JP | 説明 |
|-----------|------|-----|------|
| `hp` | HP | HP | 最大HP増加 |
| `atk` | ATK | 攻撃力 | 物理攻撃力増加 |
| `def` | DEF | 防御力 | 物理防御力増加 |
| `spi` | SPI | 精神 | 魔法関連ステータス |
| `mp` | MP | MP | 最大MP増加 |
| `spd` | SPD | 速度 | 行動速度増加 |
| `hpRegen` | HP Regen | HP自然回復 | HP自然回復量増加 |
| `mpRegen` | MP Regen | MP自然回復 | MP自然回復量増加 |

全フィールドはオプショナル（未設定 = 0扱い）。

## カテゴリ別ステータス（現行値）

現在は全ソース共通でカテゴリ別に一律のステータスを設定。

| カテゴリ | HP | ATK | DEF | SPI | MP | SPD | HP Regen | MP Regen |
|----------|----:|----:|----:|----:|---:|----:|---------:|---------:|
| 片手剣 | - | 5 | - | - | - | - | - | - |
| 短剣 | - | 3 | - | - | - | 2 | - | - |
| 投刃 | - | 4 | - | - | - | 1 | - | - |
| 両手斧 | - | 7 | - | - | - | - | - | - |
| 両手槌 | - | 6 | 1 | - | - | - | - | - |
| 弓 | - | 5 | - | - | - | 1 | - | - |
| 杖 | - | - | - | 5 | 3 | - | - | - |
| 盾 | 3 | - | 5 | - | - | - | - | - |

> 今後、ティア・素材・入手元に応じた個別調整を行う想定。

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `src/types/equipment.ts` | `EquipmentStats` / `EquipmentMasterItem` 型定義 |
| `src/data/equipmentMaster.json` | 全アイテムのマスターデータ（stats含む） |
| `src/game/loot/equipmentLootRoller.ts` | 宝箱ティア計算・抽選ロジック |
| `src/data/equipmentLootTable.json` | カテゴリ排出重み設定 |
| `src/game/loot/equipmentMasterService.ts` | マスターデータ参照・バリデーション |
