# Tactics Battle App 現行仕様書

本書は `tactics-battle-app` の 2026-03-10 時点の実装を基準にした、画面構成および主要仕様の整理です。
企画上の理想仕様ではなく、コード上で現在成立している挙動を優先して記載します。

## 1. アプリ概要

- 種別: Expo / React Native 製のタクティクスRPGアプリ
- ルーティング: `expo-router`
- 永続化: `expo-sqlite`
- 状態管理: Zustand + 画面内 state
- 初回表示:
  - `/` は `/guild` へリダイレクト
  - 起動時に DB 初期化を実行
  - 保存済み言語設定があれば適用、未保存なら端末ロケールから決定

## 2. 画面遷移全体

### 2.1 ルート構成

| 区分 | パス | ファイル | 概要 |
|---|---|---|---|
| ルート | `/` | `app/index.tsx` | `/guild` へ即時リダイレクト |
| タブ | `/guild` | `app/(tabs)/guild.tsx` | キャラクター管理の起点 |
| タブ | `/dungeon` | `app/(tabs)/dungeon.tsx` | ダンジョン進行管理 |
| タブ | `/shop` | `app/(tabs)/shop.tsx` | ショップハブ |
| タブ | `/more` | `app/(tabs)/more.tsx` | 設定・デバッグ |
| スタック | `/guild/hire` | `app/guild/hire.tsx` | 冒険者雇用 |
| スタック | `/inventory` | `app/inventory/index.tsx` | 倉庫閲覧 |
| スタック | `/characters/[id]` | `app/characters/[id]/index.tsx` | キャラ詳細 |
| スタック | `/characters/[id]/equipment` | `app/characters/[id]/equipment.tsx` | 装備変更 |
| スタック | `/characters/[id]/tactics` | `app/characters/[id]/tactics.tsx` | タクティクス編集 |
| スタック | `/dungeon/party` | `app/dungeon/party.tsx` | パーティ管理 |
| スタック | `/dungeon/exploration` | `app/dungeon/exploration.tsx` | 探索進行 |
| スタック | `/dungeon/battle` | `app/dungeon/battle.tsx` | 戦闘シミュレーション |
| スタック | `/shop/equipment` | `app/shop/equipment.tsx` | 装備ショップ |
| スタック | `/shop/consumable` | `app/shop/consumable.tsx` | 消耗品ショップ |
| スタック | `/shop/premium` | `app/shop/premium.tsx` | プレミアムショップUI |
| スタック | `/debug/battle-effects` | `app/debug/battle-effects.tsx` | 戦闘エフェクト検証 |
| 旧/未接続 | `/characters/new` | `app/characters/new.tsx` | 旧キャラ作成画面 |
| 旧/未接続 | `/result` | `app/result.tsx` | 旧戦闘結果画面 |

### 2.2 下部タブ

- 表示タブは `Guild / Dungeon / Shop / More` の4件
- タブバーはカスタム実装
- ホーム専用タブは存在しない

### 2.3 主な遷移

- `/guild` → `/guild/hire`
- `/guild` → `/inventory`
- `/guild` → `/characters/[id]`
- `/characters/[id]` → `/characters/[id]/equipment`
- `/characters/[id]` → `/characters/[id]/tactics`
- `/dungeon` → `/dungeon/party`
- `/dungeon` → `/dungeon/exploration`
- `/dungeon/exploration` → `/dungeon/battle`
- `/dungeon/battle` → 直前画面へ自動復帰
- `/shop` → 各ショップ詳細
- `/more` → `/inventory`
- `/more` → `/debug/battle-effects`

## 3. 画面仕様

### 3.1 `/guild` ギルド

目的:
キャラクター一覧の確認と、雇用・詳細確認の起点。

主表示:

- ヘッダー
  - タイトル
  - 倉庫ボタン
  - 所持金表示
- 新規冒険者作成ボタン
- キャラクター一覧
  - 立ち絵
  - 名前
  - クラス / レベル
  - 星座
  - 所属パーティ名

主要操作:

- 倉庫ボタンで `/inventory` へ遷移
- 作成ボタンで `/guild/hire` へ遷移
- 一覧行タップで `/characters/[id]` へ遷移

補足:

- 一覧は `charactersRepository.list(DEFAULT_PARTY_ID)` を基準に取得
- キャラクター0件時は空表示

### 3.2 `/guild/hire` 冒険者雇用

目的:
新規キャラクターをクラス選択付きで作成する。

入力:

- クラス選択
- 名前入力

表示情報:

- 選択中クラスの画像、説明、基礎ステータス
- 現在所持金
- 雇用コスト

主要仕様:

- 名前未入力時はエラーアラート
- 雇用成功時は前画面へ戻る
- 所持金不足時は作成せず警告表示
- 生成キャラにはランダム星座とクラス既定タクティクスを付与

現行クラス:

- GUARDIAN
- SWORDMAN
- BERSERKER
- CLERIC
- WITCH
- THIEF

### 3.3 `/inventory` 倉庫

目的:
所持装備、装備中装備、所持消耗品の横断確認。

表示タブ:

- すべて
- 道具
- 装備カテゴリ別フィルタ

表示セクション:

- 所持装備
- 装備中
- 所持アイテム（道具）

主要仕様:

- 装備はカテゴリごとにグルーピング表示
- 装備中一覧はキャラ名と装備部位付き
- 消耗品は所持数表示のみ
- 本画面から装備変更や使用はできない

### 3.4 `/characters/[id]` キャラクター詳細

目的:
1キャラの基礎情報、装備概要、タクティクス概要を閲覧する。

主表示:

- プロフィール
  - 画像
  - 名前
  - クラス / レベル
  - 星座
- ステータスカード
  - HP / MP / ATK / DEF / SPD / MP回復
  - 基礎値と装備補正の内訳
- 装備セクション
  - 武器 / 防具
  - 装備名
  - ステータス要約
- タクティクスセクション
  - 優先度上位3件を表示

主要操作:

- 装備セクション右上から装備変更画面へ
- タクティクスセクション右上からタクティクス編集画面へ

### 3.5 `/characters/[id]/equipment` 装備変更

目的:
対象キャラの武器・防具を倉庫から選んで装備する。

表示:

- 武器 / 防具タブ
- 現在装備
- 装備可能な所持装備一覧

主要仕様:

- クラス制限に合う装備のみ一覧表示
- 装備タップで即装備
- 現在装備があれば解除可能
- 所持数はスタック数ベース

制約:

- 変更対象は `weapon` / `armor` の2枠のみ
- アクセサリ枠は存在しない

### 3.6 `/characters/[id]/tactics` タクティクス編集

目的:
AI行動ルールの追加・編集・削除・並び替えを行う。

表示:

- 対象キャラ名付きタイトル
- ルール説明
- ルール追加ボタン
- ドラッグ可能なルール一覧

主要仕様:

- 優先度は並び順から再計算して保存
- ルール追加・編集はモーダルで実施
- スキル候補はキャラのクラス定義に依存

### 3.7 `/dungeon` ダンジョン

目的:
各パーティの探索先、探索状態、出撃導線を管理する。

現行ダンジョン:

- `crestoria_dungeon_1_200`
- 1F から 200F まで

主表示:

- 共有ダンジョン情報
  - 現在の到達フロンティア
- パーティカード一覧
  - パーティ名
  - 6枠の編成状況
  - 探索対象フロア
  - step数
  - AUTOバッジやIDLE表示
  - 操作ボタン

主要操作:

- 編集ボタンで `/dungeon/party?partyId=...`
- フロア・step変更モーダル表示
- Explore / Resume Explore で探索開始
- AUTO周回 / AUTO停止

主要仕様:

- 各パーティごとに選択フロアと探索step数を保持
- 選択可能フロアは「階段発見済み」進捗から算出
- step数候補は `20,30,40,50,60,70,80,90,100`
- パーティメンバー0人でもフロア選択は可能だが探索開始は不可

現状注意:

- `AUTO` モードは UI 状態として保存されるが、実際の自動周回処理は未実装
- `autoRunCount / autoLootCount / autoElapsedSeconds` は表示されるが更新処理は現状存在しない

### 3.8 `/dungeon/party` パーティ管理

目的:
複数パーティの作成、名称変更、削除、6枠編成を行う。

主表示:

- パーティ切替チップ
- パーティ追加 / 改名 / 削除
- 6スロット編成
- 未所属キャラクター一覧

主要操作:

- 新規パーティ作成
- パーティ名変更
- デフォルト以外のパーティ削除
- スロットタップでキャラ選択モーダル
- 未所属一覧から空き枠へ即追加
- 倉庫ボタンで `/inventory`

主要仕様:

- 1パーティ最大6名
- デフォルトパーティは削除不可
- キャラは特定パーティのスロットに割当

### 3.9 `/dungeon/exploration` 探索

目的:
指定パーティで階層探索を進行し、遭遇戦闘や宝箱処理を行う。

入力パラメータ:

- `dungeonId`
- `floor`
- `partyId`
- `steps`

主表示:

- 現在フロア
- 経過時間
- step進捗バー
- 探索度
- 階段発見状態
- イベントログ
- パーティHP/MPストリップ
- 宝箱取得数
- Retreat / Pause-Resume ボタン

主要仕様:

- 1秒ごとに探索stepを進行
- 罠イベントは探索中パーティHPに即反映
- 宝箱報酬は装備インベントリへ付与
- 通常エンカウント発生時は `/dungeon/battle` へ遷移
- ボス遭遇時は「戦う / 見送る」の選択を表示
- 探索完了時は結果モーダルを表示し、ダンジョンタブへ戻す

保存:

- 階ごとの探索度 / 階段発見状態を永続化
- 探索開始時のパーティスナップショットを Store に保存
- 戦闘復帰後、HP/MP の変化を探索側へ同期

### 3.10 `/dungeon/battle` 戦闘

目的:
戦闘シミュレーションを自動実行し、ログ再生と結果反映を行う。

入力パラメータ:

- `dungeonId`
- `floor`
- `explorationSeed`
- `encounter`
- `partyId`

表示:

- 階層表示
- 結果バッジ
- 戦闘速度切替
- AUTO一時停止 / 再開
- 戦闘ログ
- 敵表示と被弾エフェクト
- 味方ステータスストリップ

主要仕様:

- 画面遷移後は自動で戦闘開始
- 戦闘シミュレーション結果からログとリプレイ状態を生成
- 勝利時のみ EXP とドロップを付与
- 生存者に戦闘EXPを配布
- レベルアップ時はリザルトログを追加
- 戦闘後の HP/MP を characters テーブルへ反映
- ログ再生完了後、約 1.2 秒で前画面へ自動復帰

探索との連携:

- 探索中戦闘では `explorationSeed` をキーに報酬とパーティ状態を探索画面へ返却

### 3.11 `/shop` ショップハブ

目的:
装備、消耗品、プレミアムの各ショップへ遷移する。

遷移先:

- `/shop/equipment`
- `/shop/consumable`
- `/shop/premium`

### 3.12 `/shop/equipment` 装備ショップ

目的:
装備を購入する。

表示:

- 武器 / 防具タブ
- 所持金
- 商品一覧
  - 装備名
  - ステータス要約
  - 所持数
  - 価格

主要仕様:

- 購入時にゴールド消費
- 不足時はアラート表示
- 購入成功時は倉庫数量と所持金を再取得

現状注意:

- 売却機能は存在しない

### 3.13 `/shop/consumable` 消耗品ショップ

目的:
消耗品を購入する。

表示タブ:

- 回復
- MP
- 治療

主要仕様:

- 所持金と所持数を表示
- 購入時にゴールド消費
- 購入成功時は一覧再読み込み

現状注意:

- 使用機能は未実装
- 在庫制限やまとめ買い機能はない

### 3.14 `/shop/premium` プレミアムショップ

目的:
ジェム商品UIを表示する。

表示:

- ジェム所持数風の表示
- ジェムパック3件
- バンドル商品1件

現状注意:

- 課金処理、購入ハンドラ、永続化は未実装
- 画面は静的なモックに近い

### 3.15 `/more` More / 設定

目的:
設定、補助画面、デバッグ機能の集約。

主機能:

- 倉庫画面への導線
- デバッグ画面導線
- 言語切替 `ja / en`
- BGM / SFX トグル
- 戦闘速度切替
- DBリセット
- 既定キャラクター一括生成
- 戦闘遷移演出テスト 3種

主要仕様:

- 言語設定は DB 永続化あり
- 戦闘速度は DB 永続化あり
- DBリセットは確認ダイアログあり
- 既定キャラ生成は重複名を避けて配置

現状注意:

- `BGM` と `SFX` のトグルは画面内 state のみで、保存も音声制御も未接続

### 3.16 `/debug/battle-effects` 戦闘エフェクトデバッグ

目的:
戦闘エフェクトのプレビュー確認。

主要仕様:

- 単体攻撃、全体攻撃、ヒットフラッシュ、ダメージ表示を任意再生
- 実戦闘の導線ではなく開発用

### 3.17 旧画面

`/characters/new`

- 旧式のキャラ作成画面
- 現在の通常導線からは遷移しない

`/result`

- 旧式の勝敗表示画面
- 現行の探索→戦闘フローでは使用されていない

## 4. データ保存仕様

### 4.1 DB

SQLite ファイル:

- `tactics_battle_v2.db`

主な永続化対象:

- characters
- parties
- party_members
- tactics_rules
- battle_sessions
- battle_logs
- dungeon_progress
- dungeon_floor_exploration_progress
- dungeon_party_ui_state
- equipment / inventory 関連
- consumable_inventory
- shop_catalog 関連
- wallet
- app_settings

### 4.2 設定値

永続化あり:

- 言語
- 戦闘速度

永続化なし:

- More画面の BGM/SFX トグル

### 4.3 Store

`battleStore`

- 直近戦闘のログ
- 戦闘結果
- 探索へ返す報酬とパーティ同期データ

`explorationRunStore`

- 探索中パーティの HP/MP スナップショット
- 罠ダメージや戦闘後同期の反映先

`selectedPartyStore`

- ダンジョン編成画面の選択中パーティID

## 5. 現行仕様として重要な注意点

- 起点画面は `/guild` で、ホーム画面は存在しない
- ダンジョンは現状 1件のみ
- AUTO周回は見た目上の状態管理までで、実処理は未実装
- プレミアムショップは静的UI
- 消耗品は購入・一覧表示までで、使用処理は未実装
- `result` と `characters/new` は旧画面として残存

## 6. 参照元

主に以下の実装を基準に整理:

- `tactics-battle-app/app/**`
- `tactics-battle-app/src/db/**`
- `tactics-battle-app/src/stores/**`
- `tactics-battle-app/src/types/**`
- `tactics-battle-app/src/constants/**`
