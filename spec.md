MVPコンテンツ仕様（ジョブ／ボスAI／テストシナリオ）
0. MVP前提

戦闘：ターン制、敵1体（ボス想定）

行動：各ユニットは自ターンに1行動

行動選択：タクティクス優先度順（上から評価→最初に通った行動）

スキル：MP消費＋クールダウン（CD）

状態異常：MVPは POISON と STUN のみ使用（STUNはボス側のみでもOK）

装備：なし（ステータスは固定）

1. ステータス（MVP固定）
1.1 共通ステータス

max_hp

atk

def

spd（行動順に使用）

max_mp

mp_regen（毎ターン固定回復：MVPなら 0〜2 程度）

1.2 ダメージ計算（MVP簡易）

物理ダメ（スキル/通常攻撃共通）
damage = max(1, power + attacker.atk - defender.def)

魔法ダメ（ヒールや一部魔法に使うなら）
MVPでは「ヒールは固定値」「ダメージは物理のみ」でもOK。

2. MVPジョブ（4種）とスキル

目的：

タンク（防御・ヘイト・自己耐久）

ヒーラー（回復・毒消し）

火力（単体高火力）

サポ（バフ/デバフ）
を最低限揃えて、タクティクスが活きる構成にする

2.1 ジョブ：ガーディアン（TANK）

役割：耐久＋防御姿勢＋被ダメ軽減（MVPはヘイト無しでも成立する）

スキル

Guard Stance（防御態勢）

type: buff（self）

MP: 4 / CD: 3

効果：3ターン DEF_UP(+4)（※数値はMVP固定）

tags: buff, defense

Shield Bash（シールドバッシュ）

type: attack（enemy single）

MP: 5 / CD: 4

power: 6

付与：30%で STUN(1turn)

tags: damage, control

Fortify（要塞化）

type: buff（self）

MP: 6 / CD: 5

効果：2ターン DAMAGE_TAKEN_REDUCTION(30%)（被ダメ0.7倍）

tags: buff, defense

2.2 ジョブ：クレリック（HEALER）

役割：回復＋毒消し（タクティクスが最も分かりやすい）

スキル

Heal（ヒール）

type: heal（ally single）

MP: 6 / CD: 1

効果：heal = 18 + 0（MVP固定）

tags: heal

Greater Heal（大回復）

type: heal（ally single）

MP: 10 / CD: 3

効果：heal = 35

tags: heal

Cleanse（毒消し）

type: cleanse（ally single）

MP: 4 / CD: 1

効果：状態異常 POISON を解除

tags: cleanse

Bless（祝福）

type: buff（ally single）

MP: 6 / CD: 4

効果：3ターン ATK_UP(+3)

tags: buff

2.3 ジョブ：ブレード（DPS単体）

役割：単体火力・自己強化（「1ターン目バーサク」例が作れる）

スキル

Berserk（バーサク）

type: buff（self）

MP: 6 / CD: 5

効果：3ターン ATK_UP(+6)、同時に DEF_DOWN(-2)（火力とリスク）

tags: buff, damage

Power Strike（強打）

type: attack（enemy single）

MP: 5 / CD: 1

power: 10

tags: damage

Execute（処刑）

type: attack（enemy single）

MP: 8 / CD: 4

power: 14

条件向け特性：敵HP%が低いほど追加+6（例：敵HP%<30%ならpower+6）

tags: damage, finisher

2.4 ジョブ：アーケイン（SUPPORT/DEBUFF）

役割：ボス相手に「デバフ維持」「行動抑制」を実現

スキル

Weaken（弱体化）

type: debuff（enemy single）

MP: 6 / CD: 3

効果：3ターン ATK_DOWN(-4)

tags: debuff

Armor Break（防御破壊）

type: debuff（enemy single）

MP: 6 / CD: 3

効果：3ターン DEF_DOWN(-4)

tags: debuff

Poison（毒）

type: status（enemy single）

MP: 5 / CD: 2

効果：POISON(3turn)（毎ターン 6 ダメージ固定）

tags: dot, status

Mana Charge（魔力充填）

type: utility（self）

MP: 0 / CD: 4

効果：即時 mp + 10

tags: utility

3. 敵（ボス1体）の行動パターン（MVP）
3.1 ボス：ヴェノム・タイラント（強敵）

コンセプト：毒＋大技＋終盤の激昂で「ヒール/毒消し/防御/デバフ」が活きる

ステータス（例）

max_hp: 260

atk: 14

def: 6

spd: 9

max_mp: 999（MP管理なし）

mp_regen: 0

ボススキル

Claw（爪撃）

type: attack（single）

power: 6

tags: basic

Venom Spit（毒液）

type: status（single）

CD: 2

効果：POISON(3turn)（毎ターン 8 ダメ固定）

tags: poison

Crushing Slam（粉砕）

type: attack（single）

CD: 3

power: 14

追加：対象に DEF_DOWN(-2, 2turn)（MVPならデバフ追加は省略可）

tags: big_hit

Enrage（激昂）

type: buff（self）

CD: 999（=1回だけのつもり）

発動条件：ボスHP% <= 40%

効果：以後 ATK +4（永続）

tags: phase

行動AI（優先度）

ボスもプレイヤーと同じ「上から評価」方式でOK。

if hp_percent <= 0.40 AND not has_buff(ENRAGED) → Enrage

if Crushing Slam usable AND (turn % 3 == 0 OR target_is_tank) → Crushing Slam（ターゲット：最もHPが高い味方、など固定でもOK）

if Venom Spit usable AND exists_ally_without_status(POISON) → Venom Spit（ターゲット：毒でない味方のうちHP%が低い者）

else → Claw（ターゲット：HP%が最も低い味方、もしくは固定で先頭）

ターゲット指定はMVPでは固定で良いですが、
「毒を撒く対象を選ぶ」だけ入れるとクレリックの価値がはっきり出ます。

4. MVP戦闘テストシナリオ（3本）

目的：

ルール優先度が正しく働く

条件参照（HP%、毒状態、ターン）を使える

“指示ミスによる無駄”も再現できる

乱数がある場合、seed固定で再現できる

シナリオA：基本動作（回復が発動するか）

PT（4人）

Guardian / Cleric / Blade / Arcane

初期ステータス（例）

Guardian: HP 120 / ATK 8 / DEF 10 / SPD 8 / MP 20

Cleric: HP 80 / ATK 5 / DEF 6 / SPD 10 / MP 35

Blade: HP 90 / ATK 12/ DEF 5 / SPD 12 / MP 25

Arcane: HP 75 / ATK 6 / DEF 5 / SPD 11 / MP 30

タクティクス（例）

Guardian

Guard Stance：turn == 1

Fortify：self_hp_percent < 0.5

Shield Bash：turn % 4 == 0

Cleric

Greater Heal：lowest_ally_hp_percent < 0.25

Heal：lowest_ally_hp_percent < 0.45

Bless：turn == 1（ターゲット：Blade）

Blade

Berserk：turn == 1

Execute：enemy_hp_percent < 0.30

Power Strike：true（常に）

Arcane

Weaken：enemy_missing_debuff(ATK_DOWN)

Armor Break：enemy_missing_debuff(DEF_DOWN)

Poison：enemy_missing_status(POISON)

Mana Charge：self_mp < 6

期待観測

turn1で Guardianが防御、Bladeがバーサク、Arcaneがデバフ開始

Clericは回復が必要なければBless、必要なら回復が割り込む

シナリオB：毒消しの検証（状態異常参照）

ボスAIはそのまま（毒液を撃つ）

Clericタクティクスだけ変更

Cleanse：any_ally_has_status(POISON)（ターゲット：毒の味方のうちHP%最低）

Greater Heal：lowest_ally_hp_percent < 0.25

Heal：lowest_ally_hp_percent < 0.45

Bless：turn == 1（Blade）

期待観測

毒が付いたターンに Cleanse が割り込んで発動

毒が無い時は Cleanse がターゲット不在で不成立になり、次へ進む（仕様通り）

シナリオC：無駄行動の許容（指示ミス再現）

わざとミスったルールを入れて「仕様として無駄が起きる」を確認する。

例：Cleric（悪い例）

Cleanse：turn <= 3（※毒が無くても打とうとする）

Heal：lowest_ally_hp_percent < 0.45

期待観測

turn1〜3は毒が無い場合でも Cleanse を試みる

ターゲット不在 → ルール不成立 → Healへ（or 通常攻撃へ）
※この挙動が バグではなく仕様であることをログで確認できる

5. 実装チェック用ログ（最低限）

各キャラのターンで以下を出力できるとデバッグが爆速になります。

ターン番号、行動者

ルールの評価結果（usable / condition / target）

実行した行動（スキル名と対象）

ダメージ／回復量

状態異常付与／解除

6. 5人PTにする場合のMVP拡張（任意）

5人目は「純バッファ」を入れると、タクティクスの幅が増えます。

例：バード（SUPPORT）

War Song：味方全体ATK+2（3T）

Soothing Tune：味方全体小回復（8）

Quick Tempo：味方全体SPD+2（2T）
