# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コマンド

```bash
npm install          # 依存関係をインストール
npm run start        # CLIを実行（tsx src/index.ts）
npm run build        # TypeScriptをビルド
npm test             # テストを実行（node --test test/*.test.js）
```

## アーキテクチャ

ターン制タクティクス戦闘シミュレーターのCLI実装。4人パーティ vs 単体ボス（ヴェノム・タイラント）の戦闘をシミュレートする。

### コアモジュール

- **src/battle.ts** - 戦闘システムのコアロジック。ユニット/ステータス/エフェクトの型定義、ダメージ計算（`calculatePhysicalDamage`）、ターン処理（`runTurn`）、状態異常管理（POISON/STUN）
- **src/boss-ai.ts** - ボスAIの行動選択ロジック（`selectVenomTyrantAction`）。HP閾値による激昂発動、毒撒き、優先度ベースの行動決定
- **src/scenarios.ts** - 3つのテストシナリオ（A/B/C）の定義と実行。タクティクスルール（条件→スキル発動）の評価、seed固定による再現性確保

### スキルシステム（src/skills/）

- **types.ts** - スキル型定義（SkillType, SkillEffect, ConditionalPower等）
- **execute.ts** - スキル実行ロジック（`executeSkill`）、ヘルパー関数（`getHpPercent`, `hasEffect`, `isSkillUsable`）
- **guardian.ts / cleric.ts / blade.ts / arcane.ts** - ジョブ別スキル定義
- **boss.ts** - ボススキル定義（VENOM_TYRANT）
- **jobs.ts** - ジョブ定義の集約

### タクティクスシステム

各ユニットは優先度順のルールリストを持ち、上から評価して最初に通ったスキルを発動する。ルールは以下を評価：
1. スキルが使用可能か（MP/クールダウン）
2. 条件を満たすか（ターン数、HP%、状態異常の有無など）
3. 有効なターゲットが存在するか

### ダメージ計算式

```
damage = max(1, power + attacker.atk - defender.def)
```

被ダメージ軽減バフ（Fortify等）は乗算で適用。

## テスト構成

- **test/battle-core.test.js** - 戦闘コアロジックのテスト
- **test/skills.test.js** - スキル実行のテスト
- **test/scenarios.test.js** - シナリオ実行のテスト
- **test/*-skills.unit.test.js** - ジョブ別スキルのユニットテスト
- **test/helpers/createUnit.js** - テスト用ユニット生成ヘルパー

## 仕様参照

詳細なゲーム仕様（ジョブ/スキル/ボスAI/テストシナリオ）は `spec.md` を参照。
