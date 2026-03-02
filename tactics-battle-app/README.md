# Tactics Battle App (Expo)

React Native (Expo Router) + SQLite で構成したタクティクス戦闘UI実装です。

## セットアップ

```bash
cd tactics-battle-app
npm install
npx expo start
```

## 画面

- `/guild` ギルド（キャラ管理 + パーティ管理）
- `/characters/[id]/tactics` タクティクス設定（追加・編集・並べ替え）
- `/dungeon` ダンジョン選択
- `/shop` Shopハブ
- `/dungeon/exploration` 探索
- `/dungeon/battle` 戦闘
- `/result` 結果
- `/more` More（設定・補助機能）

## データ保存

- `expo-sqlite` で以下テーブルを初期化
  - `parties`
  - `party_members`
  - `characters`
  - `tactics_rules`
  - `dungeon_progress`
  - `battle_sessions`
  - `battle_logs`

## 移植内容

- `src/game/battle.ts` 戦闘コア
- `src/game/skills/*` スキル定義
- `src/game/tactics/evaluator.ts` ルール優先度評価
