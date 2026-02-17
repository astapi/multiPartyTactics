# Tactics Battle App 画面構成（現行）

本ドキュメントは `tactics-battle-app` の **現在の実装** に基づく画面構成です。

## ルーティング構成

- ルートレイアウト: `app/_layout.tsx`
- タブレイアウト: `app/(tabs)/_layout.tsx`
- タブ画面: `index` / `dungeon` / `guild` / `settings`

## 画面一覧

| 画面名 | パス | ファイル | 区分 | 説明 |
|---|---|---|---|---|
| ホーム | `/` | `app/(tabs)/index.tsx` | タブ | 機能メニュー（装備店・ダンジョン・PT・プレミアム） |
| ダンジョン | `/dungeon` | `app/(tabs)/dungeon.tsx` | タブ | パーティ確認、階層選択、探索開始 |
| ギルド | `/guild` | `app/(tabs)/guild.tsx` | タブ | 雇用キャラ一覧・パーティ概要 |
| 設定 | `/settings` | `app/(tabs)/settings.tsx` | タブ | 言語、音量、DBリセット、デバッグ作成 |
| 雇用（新規作成） | `/guild/hire` | `app/guild/hire.tsx` | スタック | 新しい冒険者の作成 |
| PT編成 | `/party` | `app/party/index.tsx` | スタック | 6スロット編成、割当・解除 |
| キャラクター詳細 | `/characters/[id]` | `app/characters/[id]/index.tsx` | スタック | キャラ情報、装備/タクティクス導線 |
| キャラ装備 | `/characters/[id]/equipment` | `app/characters/[id]/equipment.tsx` | スタック | 武器/防具/装飾の切替装備 |
| タクティクス | `/characters/[id]/tactics` | `app/characters/[id]/tactics.tsx` | スタック | AIルール編集 |
| 探索 | `/dungeon/exploration` | `app/dungeon/exploration.tsx` | スタック | 探索進行、戦闘遷移 |
| 戦闘 | `/dungeon/battle` | `app/dungeon/battle.tsx` | スタック | 戦闘進行・ログ表示 |
| 結果 | `/result` | `app/result.tsx` | スタック | 勝敗表示、ホーム復帰 |
| 装備ショップ | `/shop/equipment` | `app/shop/equipment.tsx` | スタック | 装備購入・売却UI |
| プレミアムショップ | `/shop/premium` | `app/shop/premium.tsx` | スタック | ジェム商品・バンドル表示 |
| キャラクター作成（旧） | `/characters/new` | `app/characters/new.tsx` | スタック | 旧作成画面（現導線なし） |

## 主要遷移

### タブ間

- 下部タブで `ホーム / ダンジョン / ギルド / 設定` を切替

### ホーム (`/`)

- 装備メニュー → `/shop/equipment`
- ダンジョンメニュー → `/dungeon`
- パーティメニュー → `/party`
- プレミアムメニュー → `/shop/premium`

### ギルド (`/guild`)

- 雇用タブのキャラクター行タップ → `/characters/[id]`
- 「新しい冒険者を作成」 → `/guild/hire`
- パーティカード / 作成ボタン → `/party`

### ダンジョン (`/dungeon`)

- 「Deploy」→ `/dungeon/exploration?dungeonId=...&floor=...`

### 探索 (`/dungeon/exploration`)

- 条件成立時に戦闘へ遷移 → `/dungeon/battle`

### 戦闘 (`/dungeon/battle`)

- 戦闘終了時に結果へ遷移 → `/result`

### キャラクター詳細 (`/characters/[id]`)

- 装備変更 → `/characters/[id]/equipment`
- タクティクス編集 → `/characters/[id]/tactics`

## 補足（旧仕様との差分）

- `app/characters/index.tsx`（キャラクター一覧）は削除済み
- そのため `/characters` 一覧導線は現状なし
- キャラ詳細への導線は **ギルドの雇用一覧タップ** が主経路

## コンポーネント構成（現行）

### 共通 (`src/components/common/`)

- `Button.tsx`: 汎用ボタン
- `Card.tsx`: カードコンテナ
- `ProgressBar.tsx`: プログレス表示

### ナビゲーション (`src/components/navigation/`)

- `CustomTabBar.tsx`: 下部タブUI

### パーティ (`src/components/party/`)

- `CharacterSelectModal.tsx`: PT割当モーダル
- `CharacterSlot.tsx`: スロット表示
- `ClassSelectModal.tsx`: クラス選択モーダル

### タクティクス (`src/components/tactics/`)

- `RuleItem.tsx`: ルール表示
- `RuleEditModal.tsx`: ルール編集モーダル

### 戦闘 (`src/components/battle/`)

- `UnitStatusBar.tsx`: ユニットステータスバー
- `BattleLogList.tsx`: 戦闘ログ

## 技術スタック

- フレームワーク: Expo / React Native
- ルーティング: `expo-router`（ファイルベース）
- 状態管理: Zustand + hooks
- 永続化: SQLite
