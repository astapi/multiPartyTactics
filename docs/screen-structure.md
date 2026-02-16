# Tactics Battle App 画面構成

本ドキュメントはモバイルアプリ（tactics-battle-app）の画面構成を整理したものです。

## 画面一覧

| 画面名 | パス | ファイル | 説明 |
|--------|------|----------|------|
| ホーム | `/` | `app/index.tsx` | メイン画面。PT概要表示、各機能への導線 |
| キャラクター一覧 | `/characters` | `app/characters/index.tsx` | 作成済みキャラクター一覧 |
| キャラクター作成 | `/characters/new` | `app/characters/new.tsx` | 新規キャラクター作成画面 |
| キャラクター詳細 | `/characters/[id]` | `app/characters/[id]/index.tsx` | キャラ情報表示・編集 |
| タクティクス設定 | `/characters/[id]/tactics` | `app/characters/[id]/tactics.tsx` | AIルール編集 |
| PT編成 | `/party` | `app/party/index.tsx` | スロットにキャラクターを割り当て |
| ダンジョン選択 | `/dungeon` | `app/dungeon/index.tsx` | ダンジョン一覧と進行状況表示 |
| 探索 | `/dungeon/exploration` | `app/dungeon/exploration.tsx` | ダンジョン探索中画面 |
| 戦闘 | `/dungeon/battle` | `app/dungeon/battle.tsx` | ターン制戦闘画面 |
| 結果 | `/result` | `app/result.tsx` | 戦闘結果（勝利/敗北）表示 |
| 設定 | `/settings` | `app/settings.tsx` | アプリ設定（未実装） |

---

## 画面遷移図

```
┌─────────────────────────────────────────────────────────────┐
│                        ホーム (/)                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ キャラクター │  │   PT編成     │  │  ダンジョン  │       │
│  │   管理       │  │              │  │    選択      │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         ▼                 │                 ▼               │
│  ┌──────────────┐         │         ┌──────────────┐        │
│  │ キャラクター │         │         │ ダンジョン   │        │
│  │    一覧      │         │         │   選択       │        │
│  │ /characters  │         │         │ /dungeon     │        │
│  └───────┬──────┘         │         └──────┬───────┘        │
│          │                │                │                │
│    ┌─────┴─────┐          │                ▼                │
│    ▼           ▼          │         ┌──────────────┐        │
│ ┌────────┐ ┌────────┐     │         │    探索      │        │
│ │ 新規   │ │ 詳細   │     │         │ /dungeon/    │        │
│ │ 作成   │ │        │     │         │  exploration │        │
│ └────────┘ └───┬────┘     │         └──────┬───────┘        │
│                │          │                │                │
│                ▼          │                ▼                │
│         ┌──────────┐      │         ┌──────────────┐        │
│         │タクティクス     │         │    戦闘      │        │
│         │  設定    │      │         │ /dungeon/    │        │
│         └──────────┘      │         │    battle    │        │
│                           │         └──────┬───────┘        │
│                           │                │                │
│                           ▼                ▼                │
│                    ┌──────────────┐ ┌──────────────┐        │
│                    │   PT編成     │ │    結果      │        │
│                    │   /party     │ │   /result    │        │
│                    │              │ └──────┬───────┘        │
│                    │ キャラ選択   │        │                │
│                    │  モーダル    │        ▼                │
│                    └──────────────┘   ホームへ戻る          │
└─────────────────────────────────────────────────────────────┘
```

---

## 各画面の詳細

### 1. ホーム画面 (`app/index.tsx`)

**機能:**
- パーティサマリー表示（現在のメンバー一覧）
- 各機能への導線ボタン

**UI要素:**
- タイトル「Tactics Battle」
- PT Summaryカード（タップでPT編成へ）
- キャラクター管理ボタン（紫 `#7c3aed`）
- PT編成ボタン（緑 `#059669`）
- ダンジョン選択ボタン（青 `#0369a1`）
- 設定ボタン（グレー `#3f3f46`）

---

### 2. キャラクター一覧画面 (`app/characters/index.tsx`)

**機能:**
- 作成済みキャラクターの一覧表示
- 新規作成画面への遷移
- キャラクター詳細画面への遷移

**UI要素:**
- タイトル「キャラクター一覧」
- 新規作成ボタン
- キャラクターカード一覧
  - キャラ名、ジョブ、レベル
  - PT配置中バッジ（配置済みの場合）

---

### 3. キャラクター作成画面 (`app/characters/new.tsx`)

**機能:**
- 新規キャラクターの作成
- 名前入力、ジョブ選択
- 初期ステータスプレビュー

**UI要素:**
- タイトル「キャラクター作成」
- 名前入力フィールド
- ジョブ選択ボタン
- ステータスプレビュー
- 作成/キャンセルボタン

---

### 4. キャラクター詳細画面 (`app/characters/[id]/index.tsx`)

**機能:**
- キャラクター情報の表示
- 名前・ジョブの編集
- タクティクス設定への遷移
- キャラクター削除

**UI要素:**
- キャラ名（タイトル）
- PT配置状況バッジ
- ステータス表示（HP/ATK/DEF/SPD/MP）
- タクティクス設定ボタン
- 編集/削除ボタン

---

### 5. タクティクス設定画面 (`app/characters/[id]/tactics.tsx`)

**機能:**
- キャラクターのAIルール編集
- ルールの追加・編集・削除
- ドラッグ&ドロップでルール優先順位変更

**UI要素:**
- タイトル「{キャラ名} Tactics」
- ルール追加ボタン
- DraggableFlatList（ルール一覧）
- RuleEditModal（ルール編集モーダル）

**使用コンポーネント:**
- `RuleItem` (`src/components/tactics/RuleItem.tsx`)
- `RuleEditModal` (`src/components/tactics/RuleEditModal.tsx`)

---

### 6. PT編成画面 (`app/party/index.tsx`)

**機能:**
- 6スロットへのキャラクター配置
- キャラクター選択モーダルで割り当て
- スロットからの配置解除

**UI要素:**
- タイトル「PT編成」
- 編成状況（X/6）
- スロットカード x6
  - スロット番号
  - 配置キャラ情報 or 空スロットメッセージ
- CharacterSelectModal（キャラ選択モーダル）

**使用コンポーネント:**
- `Card` (`src/components/common/Card.tsx`)
- `CharacterSelectModal` (`src/components/party/CharacterSelectModal.tsx`)

---

### 7. ダンジョン選択画面 (`app/dungeon/index.tsx`)

**機能:**
- ダンジョン一覧表示
- 各ダンジョンの進行状況表示
- 探索開始

**UI要素:**
- タイトル「ダンジョン選択」
- ダンジョンカード一覧
  - ダンジョン名
  - 進行状況（Floor X / Y）
  - 探索開始ボタン

---

### 8. 探索画面 (`app/dungeon/exploration.tsx`)

**機能:**
- ダンジョン探索シミュレーション
- 時間経過による自動エンカウント（8秒ごと）
- 即時戦闘開始オプション

**UI要素:**
- タイトル「探索」
- 経過時間表示
- 「即時接敵して戦闘へ」ボタン
- 探索ログ（ScrollView）

---

### 9. 戦闘画面 (`app/dungeon/battle.tsx`)

**機能:**
- ターン制戦闘の実行
- パーティとボスのステータス表示
- 戦闘ログ表示
- 1ターンずつ進行

**UI要素:**
- タイトル「戦闘 Turn X」
- ステータス表示（IN_PROGRESS等）
- UnitStatusBar（パーティ全員 + ボス）
- 「1ターン進行」ボタン
- BattleLogList

**使用コンポーネント:**
- `UnitStatusBar` (`src/components/battle/UnitStatusBar.tsx`)
- `BattleLogList` (`src/components/battle/BattleLogList.tsx`)
- `Button` (`src/components/common/Button.tsx`)

---

### 10. 結果画面 (`app/result.tsx`)

**機能:**
- 戦闘結果の表示（VICTORY/DEFEAT）
- ホームへの遷移

**UI要素:**
- 結果タイトル（勝利: 緑、敗北: ピンク）
- 結果ステータス
- 「ホームへ戻る」ボタン

---

### 11. 設定画面 (`app/settings.tsx`)

**機能:**
- （未実装）音量、演出速度などの設定予定

**UI要素:**
- タイトル「設定」
- 説明テキスト

---

## コンポーネント構成

### 共通コンポーネント (`src/components/common/`)
| コンポーネント | 説明 |
|---------------|------|
| `Button.tsx` | 汎用ボタン |
| `Card.tsx` | カード型コンテナ |
| `ProgressBar.tsx` | プログレスバー |

### パーティ関連 (`src/components/party/`)
| コンポーネント | 説明 |
|---------------|------|
| `CharacterSlot.tsx` | キャラクタースロット表示 |
| `JobSelectModal.tsx` | ジョブ選択モーダル |
| `CharacterSelectModal.tsx` | PT編成用キャラ選択モーダル |

### タクティクス関連 (`src/components/tactics/`)
| コンポーネント | 説明 |
|---------------|------|
| `RuleItem.tsx` | タクティクスルール1件表示 |
| `RuleEditModal.tsx` | ルール編集モーダル |

### 戦闘関連 (`src/components/battle/`)
| コンポーネント | 説明 |
|---------------|------|
| `UnitStatusBar.tsx` | ユニットHP/MP表示バー |
| `BattleLogList.tsx` | 戦闘ログ一覧 |

---

## データモデル

### CharacterRecord
```typescript
type CharacterRecord = {
  id: string;
  slotIndex: number | null;  // null = PT未配置、0-5 = PTスロット位置
  name: string;
  jobId: JobId;
  level: number;
  baseMaxHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpd: number;
  baseMaxMp: number;
  baseMpRegen: number;
  currentHp: number;
  currentMp: number;
};
```

---

## 技術スタック

- **フレームワーク:** Expo (React Native)
- **ルーティング:** expo-router (ファイルベースルーティング)
- **状態管理:**
  - Zustand (`src/stores/`)
  - React hooks (`src/hooks/`)
- **データ永続化:** SQLite (`src/db/`)
- **ドラッグ&ドロップ:** react-native-draggable-flatlist

---

## デザイントークン

### カラーパレット
| 用途 | カラーコード |
|------|-------------|
| 背景（メイン） | `#09090b` |
| 背景（カード） | `#18181b` |
| ボーダー | `#3f3f46` |
| テキスト（白） | `#ffffff` |
| テキスト（明） | `#f4f4f5` |
| テキスト（中） | `#e4e4e7` / `#d4d4d8` |
| テキスト（暗） | `#a1a1aa` / `#71717a` |
| キャラクター管理 | `#7c3aed` |
| 成功/アクション | `#059669` |
| 情報 | `#0369a1` |
| 勝利 | `#34d399` |
| 敗北/エラー | `#fb7185` / `#fda4af` |
| 削除 | `#dc2626` |
