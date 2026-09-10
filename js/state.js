// ==========================================
// js/state.js (マスター定数・ゲーム状態管理)
// ==========================================

export const API_URL = 'https://script.google.com/macros/s/AKfycbz555Zht6Z6ULzHLqtYugytj0zIzfZgPCAB0C0UG-HENlhJw4EEQmsjELTby9yiDw0XtQ/exec';

// Settings & Constants
export const RARITY_CAPS = { 'N': 5, 'R': 10, 'SR': 15, 'SSR': 20, 'UR': 30 };
export const EVO_COST_XP = { 'N': 10000, 'R': 50000, 'SR': 200000, 'SSR': 500000 };
export const EVO_STOCK_REQ = 10;
export const REBORN_COST_XP = 100000;
export const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR'];
export const SKILL_TYPES = ['ATK', 'TIME', 'EXP'];

export const LV_BONUS_RATE = 0.01;
export const EXP_REQ = 100;
export const MAT_EXP = { 'N': 25, 'R': 50, 'SR': 100, 'SSR': 200, 'UR': 500 };
export const SELL_PRICES = { 'N': 250, 'R': 500, 'SR': 1000, 'SSR': 2000, 'UR': 5000 };
export const LOGIN_BONUS_EXP = 30000;
export const MAX_ITEM_LEVEL = 10;
export const MASTER_COUNT = 10;

export const TITLES = [
    { id:'t01', name:'三日坊主卒業', req:'loginDays>=3', val:3, reward:30000, desc:'通算3日プレイ' },
    { id:'t02', name:'一週間の奇跡', req:'loginDays>=7', val:7, reward:50000, desc:'通算7日プレイ' },
    { id:'t03', name:'習慣化の達人', req:'loginDays>=14', val:14, reward:100000, desc:'通算14日プレイ' },
    { id:'t04', name:'月間MVP', req:'loginDays>=30', val:30, reward:300000, desc:'通算30日プレイ' },
    { id:'t05', name:'季節を超えて', req:'loginDays>=100', val:100, reward:1000000, desc:'通算100日プレイ' },
    { id:'t06', name:'伝説の常連', req:'loginDays>=365', val:365, reward:5000000, desc:'通算365日プレイ' },
    { id:'t07', name:'ビギナー', req:'totalKill>=5', val:5, reward:30000, desc:'累計5体撃破' },
    { id:'t08', name:'エース', req:'totalKill>=20', val:20, reward:50000, desc:'累計20体撃破' },
    { id:'t09', name:'ベテラン', req:'totalKill>=50', val:50, reward:100000, desc:'累計50体撃破' },
    { id:'t10', name:'ヒーロー', req:'totalKill>=100', val:100, reward:300000, desc:'累計100体撃破' },
    { id:'t11', name:'破壊神', req:'totalKill>=500', val:500, reward:1000000, desc:'累計500体撃破' },
    { id:'t12', name:'知識の芽生え', req:'totalCorrect>=50', val:50, reward:30000, desc:'累計50問正解' },
    { id:'t13', name:'知識の探求者', req:'totalCorrect>=200', val:200, reward:50000, desc:'累計200問正解' },
    { id:'t14', name:'知の巨人', req:'totalCorrect>=500', val:500, reward:100000, desc:'累計500問正解' },
    { id:'t15', name:'歩く百科事典', req:'totalCorrect>=1000', val:1000, reward:300000, desc:'累計1000問正解' },
    { id:'t16', name:'全知全能', req:'totalCorrect>=5000', val:5000, reward:5000000, desc:'累計5000問正解' },
    { id:'t17', name:'集中モード', req:'maxCombo>=20', val:20, reward:30000, desc:'1プレイ20コンボ' },
    { id:'t18', name:'ゾーン突入', req:'maxCombo>=40', val:40, reward:50000, desc:'1プレイ40コンボ' },
    { id:'t19', name:'神の領域', req:'maxCombo>=60', val:60, reward:100000, desc:'1プレイ60コンボ' },
    { id:'t20', name:'完全無欠', req:'perfect', val:1, reward:50000, desc:'HP満タンでクリア' },
    { id:'t21', name:'スピードスター', req:'speed', val:1, reward:50000, desc:'残り9秒以上で正解' },
    { id:'t22', name:'コレクター', req:'collection>=5', val:5, reward:30000, desc:'図鑑5種収集' },
    { id:'t23', name:'マニア', req:'collection>=15', val:15, reward:100000, desc:'図鑑15種収集' },
    { id:'t24', name:'博物館館長', req:'collection>=30', val:30, reward:300000, desc:'図鑑30種収集' },
    { id:'t25', name:'アイテム愛好家', req:'itemMax', val:1, reward:100000, desc:'アイテムLv.MAX' },
    { id:'t26', name:'小金持ち', req:'xp>=100000', val:100000, reward:30000, desc:'所持EXP 10万達成' },
    { id:'t27', name:'大富豪', req:'xp>=1000000', val:1000000, reward:100000, desc:'所持EXP 100万達成' },
    { id:'t28', name:'億万長者', req:'xp>=10000000', val:10000000, reward:500000, desc:'所持EXP 1000万達成' },
    { id:'t29', name:'奇跡の出会い', req:'ssr', val:1, reward:100000, desc:'SSR入手' },
    { id:'t30', name:'限界突破', req:'lvMax', val:1, reward:100000, desc:'キャラLv.20到達' },
    { id:'t31', name:'未知との遭遇', req:'randomClear', val:1, reward:30000, desc:'ランダムモードクリア' },
    { id:'t32', name:'自ら縛る者', req:'oathClear', val:1, reward:30000, desc:'誓約付きクリア' },
    { id:'t33', name:'限界のその先へ', req:'evolved', val:1, reward:100000, desc:'キャラを進化させる' },
    { id:'t34', name:'愛着の証', req:'mastered', val:1, reward:100000, desc:'キャラをマスター(10個)にする' },
    { id:'t35', name:'神引きの右腕', req:'ur', val:1, reward:150000, desc:'UR入手' },
    { id:'t36', name:'輪廻転生', req:'reborn', val:1, reward:300000, desc:'URキャラを転生させる' },
    { id:'t37', name:'計算の神様', req:'calcA', val:1, reward:50000, desc:'計算クエストでランクA以上' }
];

export const MISSIONS = [
    { id: 'play', target: 1, reward: 5000, title: "本日の挑戦", desc: "クエストを1回プレイ" },
    { id: 'kill', target: 1, reward: 10000, title: "ボス撃破！", desc: "ボスを1体倒す" },
    { id: 'correct', target: 10, reward: 10000, title: "修行の成果", desc: "合計10問正解する" },
    { id: 'maxCombo', target: 5, reward: 10000, title: "コンボマスター", desc: "5コンボ以上達成" },
    { id: 'enhance', target: 1, reward: 5000, title: "装備のメンテナンス", desc: "キャラを1回強化" },
    { id: 'typing', target: 1, reward: 5000, title: "指先の体操", desc: "タイピングを1回プレイ" },
    { id: 'calc', target: 1, reward: 5000, title: "脳の準備運動", desc: "計算クエストを1回プレイ" },
    { id: 'gacha', target: 1, reward: 5000, title: "本日の運試し", desc: "ガチャを1回引く" },
    { id: 'shop', target: 1, reward: 5000, title: "購買意欲", desc: "ショップでアイテム購入/交換" }
];
export const MISSION_ALL_CLEAR = 60000;

export const ROGUE_TILES = {
    WALL: '🌲', FLOOR: '🟫', VISITED: '🟫', ENEMY: '👾', STAIRS: '🚪', PLAYER: '🧙',
    FOUNTAIN: '⛲', BOOK: '📜', TRAP: '🕸️', STATUE: '🗿', CURSE: '💀', SHOP: '🛍️'
};

export const GUIDE_DATA = {
    categories: [
        { id: 'main', name: '▶ メインクエスト', icon: '⚔️' },
        { id: 'special', name: '✨ スペシャルクエスト', icon: '🌟' },
        { id: 'gacha', name: '💎 ガチャ・育成', icon: '📦' },
        { id: 'system', name: '⚙️ システム・その他', icon: '🔧' }
    ],
    topics: {
        'normal': {
            categoryId: 'main',
            title: '通常クエスト',
            icon: '⚔️',
            summary: '学習の基本モード。敵を倒してXPや強化アイテムを獲得！',
            contentHtml: `
                <h4>① 操作手順</h4>
                <p>1. メイン画面から<b>「▶ メインクエスト」</b>を選択します。<br>
                2. <b>「学年」→「教科」→「単元」</b>の順に選択します。<br>
                3. （任意）ボスHPの変更や「😈 誓約」「🕊️ 救済」を設定します。<br>
                4. <b>「出撃する」</b>を押してバトルを開始します。</p>

                <h4>② 遊び方・ダメージの仕組み</h4>
                <p>・出題される4択問題から正解をタップします。<br>
                ・<b>解答速度</b>が早いほど、また<b>連続正解（コンボ）</b>が続くほど与えるダメージが増加します！<br>
                ・装備キャラクターのステータス（ATK/TIME/EXP）やショップ装備の効果が加算されます。<br>
                ・誤答または時間切れでライフ（❤️）が1つ減少します。</p>

                <h4>③ ドロップ報酬</h4>
                <p>敵を撃破すると大量の<b>XP</b>に加え、強化合成素材となる<b>「赤のページ (📕)」「青のページ (📘)」</b>を獲得できます。</p>
            `
        },
        'random': {
            categoryId: 'main',
            title: 'ランダムモード（未知の迷宮）',
            icon: '🎲',
            summary: '指定した学年の全範囲からランダム出題！EXP1.5倍！',
            contentHtml: `
                <h4>① 操作手順</h4>
                <p>1. メインクエスト画面から<b>「🎲 未知の迷宮」</b>を選択します。<br>
                2. 挑戦したい<b>「学年」</b>を選択します（ボスHPも指定可能）。<br>
                3. <b>「探索開始」</b>を押して出撃します。</p>

                <h4>② 遊び方と特徴</h4>
                <p>・選択した学年の全教科・全単元から問題がランダムに出題される総合実力試しモードです。<br>
                ・幅広い単元の復習や学年末の総まとめに最適です。</p>

                <h4>③ 特典</h4>
                <p>クリア時の<b>獲得XPが通常の1.5倍</b>になります！</p>
            `
        },
        'typing': {
            categoryId: 'main',
            title: 'タイピングクエスト',
            icon: '⌨️',
            summary: 'PCキーボード専用！正確なタイピングでモンスターを撃破！',
            contentHtml: `
                <h4>① 必須環境</h4>
                <p>⚠️ <b>PC・物理キーボード専用モード</b>です。<br>
                ※スマートフォンのフリック入力や画面キーボードではプレイできません。</p>

                <h4>② 操作手順と遊び方</h4>
                <p>1. メインクエスト画面から<b>「⌨️ タイピングクエスト」</b>を選択します。<br>
                2. 学年を選択して<b>「キーボードで出撃」</b>を押します。<br>
                3. 画面に表示される問題文とローマ字をキーボードで入力します。<br>
                4. ミスなく打ち切ると敵に特大ダメージを与えます！</p>
            `
        },
        'team_battle': {
            categoryId: 'special',
            title: 'チームバトルクエスト',
            icon: '⚔️',
            summary: '3体交代制のリアルタイム高速バトル！編成コスト制・動的敵レベル・属性相性で敵チームを撃破！',
            contentHtml: `
                <h4>① 操作手順と編成コスト制（上限10）</h4>
                <p>1. タイトル画面から<b>「✨ スペシャルクエスト」→「⚔️ チームバトル」</b>を選択します。<br>
                2. <b>「👥 パーティー編成」</b>を開き、手持ちキャラから<b>前衛1体・後衛2体（計3体）</b>を編成します。<br>
                ・<b>コスト制</b>: N:2 / R:3 / SR:4 / SSR:5 / UR:6（3体の<b>合計コスト10以内</b>が必須条件です）。<br>
                ・所持キャラ一覧でレア度順・レベル順・属性順・図鑑番号順のソートが可能です。<br>
                3. 出撃準備画面で<b>学年・教科・単元</b>を選択し、<b>「出撃開始」</b>を押します。</p>

                <h4>② リアルタイムバトル・カットイン・キャラ交代</h4>
                <p>・戦闘開始時および敵変更時には<b>3秒カウントダウンカットイン</b>が入り、緊張感あふれるバトルが開幕します。<br>
                ・<b>10秒制限時間タイマー</b>が常時減少します。素早く解答するほど大ダメージ！<br>
                ・画面下の<b>控えキャラパネルをタップ</b>すると、瞬時にアクティブキャラが交代します。<br>
                ・交代時、残り時間割合を引き継ぎ、新キャラのTIMEステータスに応じて制限時間が延長されます。</p>

                <h4>③ 属性相性と3すくみルール</h4>
                <p>・<b>炎(ATK) ＞ 水(TIME) ＞ 雷(EXP) ＞ 炎(ATK)</b> の3すくみ相性関係です。<br>
                ・<b>攻撃時</b>: 有利属性なら<b>最大1.5倍</b>の弱点特効ダメージ！不利属性は0.5倍となります。<br>
                ・<b>ALL属性</b>: 攻撃時は1.25倍保証（弱点時は1.5倍）されます。<br>
                ・前衛カードのバッジに「相性:○ ⚔×1.5」や「相性:△ ⚔×0.5」のように現在の攻撃相性補正が表示されます（等倍時は非表示）。</p>

                <h4>④ 敵チームの動的レベル・被ダメージ・報酬保証システム</h4>
                <p>・<b>敵チームの選出とレベル</b>: 敵チームも味方と同様に<b>合計コスト10以下</b>の公平ルールで選出されます。出現レベルはプレイヤー出撃チームの<b>最高レベル重視加重平均（80%/15%/5%）</b>に基づいて、Stage 1: 0.8倍 / Stage 2: 1.0倍 / Stage 3: 1.2倍 ＋ レアリティ微補正（Lv.1〜）でどこまでも強く動的にスケーリングされます。<br>
                ・<b>被ダメージ</b>: 出題後<b>2秒間はスリップダメージ無効の安全時間</b>です。2秒経過後より1秒ごとに敵攻撃力の<b>通常0.3倍（フレンド対戦時は0.4倍）スリップダメージ</b>、時間切れや不正解で<b>1.0倍ペナルティダメージ</b>を受けます。敵からの攻撃にも属性相性補正（敵有利1.5倍 / 敵不利0.5倍軽減）が乗るため、不利な時は即座に有利な控えキャラへ交代しましょう！<br>
                ・<b>倒した敵モンスターを直接獲得！</b> 全3ステージ制覇できなくても、そこまでに倒した敵キャラクター（インベントリ追加＆図鑑登録）と与えたダメージ割合に応じた大量XPを確実に獲得できます！</p>
            `
        },
        'rogue': {
            categoryId: 'special',
            title: '探索クエスト（オープンワールド）',
            icon: '🧭',
            summary: 'オトモと一緒に広大なフィールドを探索！直線コリドーと寄り道で大量XP獲得！',
            contentHtml: `
                <h4>① 操作手順</h4>
                <p>1. スペシャルクエスト画面から<b>「🧭 探索」</b>を選択し、学年を選んで出撃します。<br>
                2. <b>操作方法</b>: 画面左下の<b>バーチャルジョイスティック</b>、またはPCの<b>WASD / 矢印キー</b>、画面直接タップで滑らかに移動できます。<br>
                3. 現在装備しているキャラクターが<b>「オトモ」</b>として一緒に連れ歩き、固有の探索支援スキルを発揮します！</p>

                <h4>② オトモの属性パッシブ効果</h4>
                <p>・<b>🔥 ATK (炎)</b>: モンスター接触時に敵HPを 15% 先制攻撃！<br>
                ・<b>💧 TIME (水)</b>: 各階層の最大歩数が常時 +10歩（初期50歩 ➔ 60歩）！<br>
                ・<b>⚡ EXP (雷)</b>: 宝箱の獲得報酬（XP・素材）が2倍、中間ショップ全品20%OFF！<br>
                ・<b>✨ ALL (万能)</b>: 全効果の複合 ＋ ゲート方角の常時感知（足元コンパス）！</p>

                <h4>③ フィールド構造と探索のコツ</h4>
                <p>・<b>🚪（ボス扉）</b>: スタート地点から直線距離480pxの位置に配置。触れると階層ボスとの決戦になります。<br>
                ・<b>👾（モンスター）</b>: スタート〜ゴールを結ぶ最短直線帯（コリドー）に密集！避けて大回りするか、倒して突き進むかの判断が重要です。<br>
                ・<b>🎁（宝箱）</b>: 寄り道エリアに配置。一時XPや強化素材を獲得できます。<br>
                ・<b>⛲（癒しの泉）</b>: 減ったライフが1回復します（ライフ満タン時は温存可能）。<br>
                ・<b>📜（古代の石碑）</b>: 触れるとステータス変化（攻撃力や探索Lvの増減）が発生します。<br>
                ・<b>🛍️（商人）</b>: 獲得した一時XPで強化薬や歩数を購入できます（利用後消滅）。</p>

                <h4>④ 歩数スタミナ制限</h4>
                <p>ヘッダーのスタミナゲージは、32px移動ごとに1歩消費されます。歩数が0になると<b>拠点へ強制送還</b>されるため、残り歩数と相談しながらゴールを目指しましょう。</p>
            `
        },
        'survival': {
            categoryId: 'special',
            title: 'サバイバルモード',
            icon: '🔥',
            summary: 'ライフが尽きるまでエンドレス特訓！装備キャラが直接成長！',
            contentHtml: `
                <h4>① 操作手順と遊び方</h4>
                <p>1. スペシャルクエスト画面から<b>「🔥 サバイバルモード」</b>を選択します。<br>
                2. 学年を選択して開始します。<br>
                3. ライフが尽きるまで連続で問題が出題されます。正解すると残り時間が少し回復します。</p>

                <h4>② キャラクター直接育成</h4>
                <p>このモードでは、現在装備している<b>文房具キャラクターが直接経験値を獲得してレベルアップ</b>します！お気に入りキャラの育成に最適です。</p>
            `
        },
        'calc': {
            categoryId: 'special',
            title: '計算クエスト',
            icon: '🧮',
            summary: 'タイムアタック！成績に応じて強化アイテムを大量獲得！',
            contentHtml: `
                <h4>① 操作手順</h4>
                <p>1. スペシャルクエスト画面から<b>「🧮 計算クエスト」</b>を選択します。<br>
                2. <b>問題形式</b>（たし算・ひき算・かけ算・わり算・ランダム）を選択します。<br>
                3. <b>タイムアタック形式</b>（100問TA または 3分間TA）を選択します。<br>
                4. <b>利き手</b>（右利き/左利き）を選択し、挑戦を開始します。</p>

                <h4>② 遊び方と報酬</h4>
                <p>・画面のテンキーを使って素早く計算結果を入力します。<br>
                ・クリアタイムや正解数に応じて<b>ランク評価（S〜D）</b>が決定します。<br>
                ・高ランクほど強化合成素材（📕/📘 ページ）を大量に獲得できます！</p>
            `
        },
        'oath': {
            categoryId: 'special',
            title: '誓約・救済の儀',
            icon: '😈',
            summary: '難易度を変化させて倍率やクリアしやすさを調整！',
            contentHtml: `
                <h4>① 設定方法</h4>
                <p>クエスト出撃前のモーダルで<b>「😈 誓約へ」</b>または<b>「🕊️ 救済へ」</b>ボタンを押して開きます。有効にしたい項目をタップしてチェックを入れます。</p>

                <h4>② 😈 誓約の儀（ハンデ）</h4>
                <p>・制限時間短縮、攻撃力半減、ノーダメージクリアなどの厳しい条件を自らに課します。<br>
                ・課した誓約に応じて、クリア時の<b>獲得EXPが1.5〜2.0倍</b>に跳ね上がります！</p>

                <h4>③ 🕊️ 救済の儀（加護）</h4>
                <p>・制限時間2倍、ライフ増加、攻撃力2倍などの強力なサポートを受けられます。<br>
                ・苦手な単元を確実にクリアしたい時や問題の復習に最適です（※獲得EXPは少し低下します）。</p>
            `
        },
        'studyel': {
            categoryId: 'gacha',
            title: '妖精スタディエル育成',
            icon: '🧚',
            summary: '問題を解いてタマゴから成体へ！頼れる相棒を育てよう！',
            contentHtml: `
                <h4>① スタディエルって？</h4>
                <p>キミの日々の学習を応援してくれる学習の妖精です。<br>
                最初は小さな<b>「なぞのタマゴ」</b>ですが、通常クエストやランダム演習、タイピングを解くことでどんどん成長していきます！<br>
                連れて歩くだけで、戦闘時間を伸ばしたり獲得EXPを増やしてくれる<b>「発動効果」</b>がいつでも発動します。</p>

                <h4>② 成長の流れ（ステージ推移）</h4>
                <p>・🥚 <b>なぞのタマゴ（〜300問）</b>: 問題を解いて温めよう！300問正解で殻を破って誕生！<br>
                ・🐣 <b>幼体（〜1,000問）</b>: ベビー誕生！タイマーが少し伸びる！<br>
                ・✨ <b>若体（〜2,000問）</b>: 得意教科のオーラが出現！解いた問題によって姿が変化していく！<br>
                ・👑 <b>成体（2,000問〜）</b>: 最高レア（UR・コスト6）として実戦バトルに参加解禁！<br>
                ・🌟 <b>超越期（3,000問〜）</b>: 鍛え続けることで、通常キャラの限界（×3.00）を超えて強くなる！</p>

                <h4>③ どんな姿に進化する？（全7種類）</h4>
                <p>幼体・若体の頃（301〜2,000問の間）にたくさん解いた教科のバランスで、2,000問達成時に進化先が決まります！<br>
                ・🔥 <b>理系が多い</b>: 剛理のスタディエル（攻撃力に特化！）<br>
                ・⚡ <b>文系が多い</b>: 叡文のスタディエル（もらえるEXPがアップ！）<br>
                ・💧 <b>タイピング等が多い</b>: 機技のスタディエル（タイマーがさらに延長！）<br>
                ・🌈 <b>まんべんなく解く</b>: 万象のスタディエル（虹色オーラの万能タイプ！）<br>
                ※2教科の組み合わせ（理文融合・理技錬成・文技探究）の複合タイプもあるよ！</p>

                <h4>④ 挑戦レベル（難しい問題ほど強く育つ！）</h4>
                <p>解いた問題の学年（難易度）によって<b>「挑戦レベル（Lv.○.○○）」</b>が上がっていきます。<br>
                ・<b>中学・高校生の問題に挑むほど</b>: 2,000問達成時の<b>属性の効果が最大×1.80</b>に！さらに初期レベルも<b>最大Lv.10</b>で誕生！<br>
                ・<b>超越期（3,000問〜）の熟成速度が2倍</b>: 挑戦レベルが標準以上（小3以上 / Lv.1.00〜）なら、<b>100問正解ごとに属性の効果が+0.01アップ</b>します（低学年中心だと200問ごと・最大×3.00）。<br>
                ※ぜひ自分の学年や難問にどんどん挑んで、最強のスタディエルを目指そう！</p>

                <h4>⑤ より強いスタディエルを育てる3大コツ</h4>
                <p>1. <b>難しい学年の問題に挑戦する</b>: 「挑戦レベル」が高くなり、覚醒時の初期レベルや属性の効果が大幅UP！<br>
                2. <b>すばやく正確に解く</b>: 正答率が高くすばやく解くほど、<b>「タイマー延長（最大+1.5秒）」</b>がつきます。<br>
                3. <b>連続正解（コンボ）を狙う</b>: 最大コンボ数が多いほど、<b>「5COMBOごとに攻撃力アップ（最大+20%）」</b>がつきます！</p>

                <h4>⑥ 巣立ち（次のタマゴへ）</h4>
                <p>成体まで育て上げたスタディエルは、ずっとキミの仲間として残り、いつでも出撃メンバーに選べます。<br>
                「巣立ち」を選ぶと、育てた相棒を残したまま、次の世代のタマゴから新しいスタディエルを育て直すことができます！</p>
            `
        },
        'gacha': {
            categoryId: 'gacha',
            title: 'ガチャ＆文房具図鑑',
            icon: '💎',
            summary: 'XPを使ってキャラを獲得・装備・編成！',
            contentHtml: `
                <h4>① 操作手順</h4>
                <p>1. メイン画面から<b>「💎 ガチャ・図鑑」</b>を選択します。<br>
                2. <b>「1回引く（3,000XP）」</b>または<b>「10連引く（30,000XP）」</b>を選択します。<br>
                3. 「特定レア度確定10連」が開催されている場合は確定ガチャも選択可能です。</p>

                <h4>② 排出確率テーブル</h4>
                <p>・<b>N</b>: 55.0%<br>
                ・<b>R</b>: 30.0%<br>
                ・<b>SR</b>: 11.0%<br>
                ・<b>SSR</b>: 3.5%<br>
                ・<b>UR</b>: 0.5%</p>

                <h4>③ 装備とステータス効果</h4>
                <p>獲得したキャラを図鑑から装備すると、クエスト中に以下の効果を発揮します。<br>
                ・<b>ATK（攻撃力アップ）</b>: 与えるダメージが増加します。<br>
                ・<b>TIME（制限時間延長）</b>: 各問題の回答制限時間が増加します。<br>
                ・<b>EXP（獲得量アップ）</b>: クエストクリア時の獲得EXPが増加します。</p>
            `
        },
        'enhance': {
            categoryId: 'gacha',
            title: '強化・進化・転生',
            icon: '🌟',
            summary: 'キャラを極限まで鍛え上げる3大育成システム！',
            contentHtml: `
                <h4>① 強化合成</h4>
                <p>1. 図鑑から育てたいキャラクターを選択し<b>「強化」</b>を押します。<br>
                2. 素材とするページ（📕📘）や不要なキャラクターを選択して合成します。<br>
                3. キャラクターのレベルが上昇し、ステータス補正値が強化されます。</p>

                <h4>② 限界突破・進化</h4>
                <p>・キャラクターがレベル上限（MAX）に達し、同キャラの在庫が10体以上あると<b>「進化」</b>が可能です。<br>
                ・進化すると<b>レアリティが1段階上昇</b>（例: SR → SSR）し、レベル上限とステータスが大幅に強化されます！</p>

                <h4>③ 転生（URキャラ専用システム）</h4>
                <p>・最高レアリティ（UR）がレベルMAXになると<b>「転生」</b>が解禁されます。<br>
                ・転生を行うとレベルは1に戻りますが、<b>第2の属性スキルや「ALL属性」</b>を習得！<br>
                ・複数属性（例: <b>SSR / TIME・EXP</b> や <b>UR / ALL</b>）を持つ最強のキャラクターへと生まれ変わります。</p>
            `
        },
        'shop': {
            categoryId: 'gacha',
            title: 'ショップ（常時装備アイテム）',
            icon: '🛍️',
            summary: 'XPを消費して永続ステータスアップアイテムを購入・強化！',
            contentHtml: `
                <h4>① 操作手順</h4>
                <p>1. メイン画面から<b>「💎 ガチャ・図鑑」</b>を開きます。<br>
                2. 上部の<b>「ショップ」タブ</b>を選択します。<br>
                3. 強化したいアイテムを選び、XPを消費して購入・レベルアップします。</p>

                <h4>② ショップ装備の効果（永続適用）</h4>
                <p>・<b>⚔️ 攻撃の腕輪</b>: 基礎攻撃力が常時アップします。<br>
                ・<b>⏳ 時の砂時計</b>: 制限時間が常時延長されます。<br>
                ・<b>📜 賢者のペンダント</b>: 獲得EXPが常時増加します。<br>
                ※装備キャラのステータスに加えて常時合算適用されます！</p>
            `
        },
        'system': {
            categoryId: 'system',
            title: 'データ管理・ミッション・実績',
            icon: '☁️',
            summary: 'クラウドセーブによるバックアップとやり込み報酬！',
            contentHtml: `
                <h4>① ☁️ クラウドセーブ（重要）</h4>
                <p>1. タイトル画面から<b>「⚙️ データ管理」</b>を選択します。<br>
                2. <b>「クラウドに保存」</b>を押すと、現在のセーブデータが安全にサーバーへバックアップされ、固有の<b>引き継ぎID</b>が発行されます。<br>
                3. 別端末やブラウザを変更する際は、発行されたIDを入力して<b>「クラウドから復元」</b>を行うことでデータを引き継げます。<br>
                ※ブラウザのキャッシュ消去によるデータ消失を防ぐため、定期的な保存を推奨します。</p>

                <h4>② 📋 デイリーミッション＆実績（称号）</h4>
                <p>・毎日更新されるデイリーミッションを達成して「受取」を押すと、大量のXPを獲得できます。<br>
                ・特定条件（撃破数、討伐、育成など）を満たすと実績が解除され、豪華な称号とXPボーナスを受け取れます。</p>
            `
        }
    }
};

// Reactive Game State Variables
export const rawData = {
    questions: [],
    characters: [],
    bosses: [],
    shopItems: [],
    typing: [],
    randomBosses: [],
    config: [],
    gifts: []
};

export const playData = { 
    questions: [],
    qIndex: 0,
    currentBoss: null,
    isRevenge: false,
    activeOaths: [],
    activeReliefs: [],
    isRandom: false,
    isTyping: false,
    isCalculation: false,
    isSurvival: false, 
    typingTarget: null,
    typingIndex: 0,
    typingMissed: false, 
    calcType: null,
    calcMode: null,
    calcQuestions: [],
    calcQIndex: 0,
    calcInput: '',
    calcCorrect: 0,
    calcElapsed: 0,
    calcTimeLeft: 0,
    calcCountTarget: 0,
    context: null,
    selectedBossHp: null,
    currentQ: null,
    rogueQuestions: [],
    rogueEnemyCharId: null,
    handPreference: 'right'
};

export const gameState = { 
    score: 0,
    combo: 0,
    lives: 3,
    enemyHP: 100,
    maxHP: 100,
    timer: null,
    timeLeft: 0,
    maxTime: 10, 
    xp: 0,
    equipped: '1',
    itemLevels: {},
    charaInventory: {},
    teamParty: [null, null, null],
    stats: {
        totalPlay: 0,
        totalKill: 0,
        totalCorrect: 0,
        maxCombo: 0,
        loginDays: 0,
        achieved_perfect: false,
        achieved_speed: false,
        achieved_random: false,
        achieved_oath: false,
        achieved_evolve: false,
        achieved_reborn: false,
        achieved_calcA: false
    },
    subjectStats: {},
    unlockedTitles: [],
    claimedGifts: [], 
    revengeList: [],
    unitProgress: {},
    inventory: {
        redPages: 0,
        bluePages: 0,
        xpBookSmall: 0,
        xpBookMedium: 0,
        xpBookLarge: 0
    },
    calcRecords: {},
    studyel: getDefaultStudyelState(),
    avatar: {
        base: 0,
        skinColor: "#fcd34d",
        eyes: 0,
        mouth: 0,
        hair: 0,
        hairColor: "#1e293b",
        outfit: 0,
        accessory: 0,
        msgId: 0
    }
};

/**
 * スタディエルの初期状態オブジェクトを生成するヘルパー関数
 */
export function getDefaultStudyelState(generation = 1, history = []) {
    return {
        stage: 1,            // 1:タマゴ, 2:幼体, 3:若体, 4:成体, 5:超越
        totalCorrect: 0,     // 累計正解数 (0〜3000+)
        nextMilestone: 100,  // 次回節目ボーナス基準値
        generation: generation, // 世代数
        categories: {
            science: 0,      // 理系正解数
            humanities: 0,   // 文系正解数
            general: 0       // その他正解数
        },
        trainingStats: {
            totalAttempts: 0,    // 正誤問わず解答試行総数
            totalCorrect: 0,     // 幼体・若体期正解数
            totalTimeSpent: 0,   // 総解答秒数
            maxCombo: 0,         // 最大コンボ数
            totalGradeWeight: 0  // 学年係数累計
        },
        finalStats: {
            formId: null,        // 成体ID (例: studyel_science_gen1)
            name: '',            // 成体表示名
            baseValue: 1.50,     // 現在の補正値 (最大3.00)
            bonusTime: 0.0,      // 追加秒数
            bonusDamage: 0.0,    // コンボ追加ダメージ率
            level: 1             // 覚醒初期レベル
        },
        history: Array.isArray(history) ? history : [] // 歴代成体IDリスト
    };
}

export const dailyMissions = {
    date: "",
    progress: { play: 0, kill: 0, correct: 0, maxCombo: 0, enhance: 0, typing: 0, calc: 0, gacha: 0, shop: 0 },
    claimed: { play: false, kill: false, correct: false, maxCombo: false, enhance: false, typing: false, calc: false, gacha: false, shop: false, allClear: false }
};

export const rogueData = {
    floor: 1,
    steps: 0,
    maxSteps: 50,
    playerX: 600,
    playerY: 600,
    mapWidth: 1200,
    mapHeight: 1200,
    earnedXp: 0,
    exploreLevel: 1,
    atkBuff: 1.0,
    bonusSteps: 0,
    active: false,
    tileSize: 32,
    isAnimating: false,
    shopBought: false,
    maxLives: 3,
    isBossBattle: false,
    // オープンワールド用拡張プロパティ
    enemies: [],
    objects: [],
    startPos: { x: 600, y: 600 },
    goalPos: { x: 600, y: 120 },
    accumulatedDist: 0,
    invincibleUntil: 0,
    playerHistory: [],
    lastEncounterEnemyId: null,
    currentShopEntity: null,
    isPaused: false
};

// Runtime UI / Game Flags
export const runtimeState = {
    currentUserId: "",
    currentCategory: null,
    viewingCharaId: null,
    isGameActive: false,
    isPaused: false,
    tempOaths: [],
    tempReliefs: [],
    oathOrigin: 'normal',
    currentShopTab: 'buy',
    countdownTimer: null,
    appModalResolve: null,
    isMuted: true,
    selectedMaterialIds: [],
    selectedBookType: null,
    selectedBookCount: 0,
    zukanCurrentFilter: 'ALL',
    zukanCurrentSort: 'default'
};

// Data Management Functions
export function initUserId() {
    let id = localStorage.getItem('sq_user_id');
    if (!id) {
        id = Math.random().toString(36).substring(2, 10);
        localStorage.setItem('sq_user_id', id);
    }
    runtimeState.currentUserId = id;
}

export function loadSaveData() {
    const safeParse = (key, defaultVal) => {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined || raw === "undefined") return defaultVal;
            let parsed = JSON.parse(raw);
            if (typeof parsed === 'string') {
                try { parsed = JSON.parse(parsed); } catch(e){}
            }
            return parsed || defaultVal;
        } catch (e) {
            return defaultVal;
        }
    };

    try {
        gameState.xp = parseInt(localStorage.getItem('sq_xp') || '0', 10);
    } catch(e) {
        gameState.xp = 0;
    }
    gameState.equipped = localStorage.getItem('sq_equip') || '1';
    gameState.itemLevels = safeParse('sq_items_v2', {});
    gameState.charaInventory = safeParse('sq_inventory', {});
    
    // 【多段自動復旧ネット】
    // もし charaInventory が空、または破損している場合、直近のバックアップまたは旧キーから復元を試行
    if (!gameState.charaInventory || Object.keys(gameState.charaInventory).length === 0) {
        // 1. 自動バックアップ (sq_save_backup) からの自動復元試行
        const backupRaw = localStorage.getItem('sq_save_backup');
        if (backupRaw) {
            try {
                const backup = JSON.parse(backupRaw);
                if (backup && backup.charaInventory && Object.keys(backup.charaInventory).length > 0) {
                    console.log('[SQ-Restore] 自動バックアップ (sq_save_backup) から生徒データを自動復元しました。');
                    gameState.charaInventory = backup.charaInventory;
                    if (backup.xp && !gameState.xp) gameState.xp = parseInt(backup.xp, 10);
                    if (backup.itemLevels && (!gameState.itemLevels || Object.keys(gameState.itemLevels).length === 0)) gameState.itemLevels = backup.itemLevels;
                    if (backup.equipped) gameState.equipped = String(backup.equipped);
                    if (backup.stats && (!gameState.stats || gameState.stats.totalPlay === 0)) gameState.stats = backup.stats;
                    if (backup.unlockedTitles && (!gameState.unlockedTitles || gameState.unlockedTitles.length === 0)) gameState.unlockedTitles = backup.unlockedTitles;
                    if (backup.inventory && (!gameState.inventory || gameState.inventory.redPages === 0)) gameState.inventory = backup.inventory;
                    // 復元した正常データをメインストレージへ再保存
                    localStorage.setItem('sq_inventory', JSON.stringify(gameState.charaInventory));
                    localStorage.setItem('sq_xp', gameState.xp);
                    localStorage.setItem('sq_items_v2', JSON.stringify(gameState.itemLevels));
                }
            } catch (e) {
                console.warn('[SQ-Restore] バックアップ自動復元失敗:', e);
            }
        }

        // 2. 旧キー (sq_charas) からの救出復元
        if (!gameState.charaInventory || Object.keys(gameState.charaInventory).length === 0) {
            const oldCharas = localStorage.getItem('sq_charas');
            if (oldCharas) {
                try {
                    const idList = JSON.parse(oldCharas);
                    if (Array.isArray(idList) && idList.length > 0) {
                        idList.forEach(id => {
                            gameState.charaInventory[id] = { level: 1, count: 1, exp: 0 };
                        });
                        localStorage.setItem('sq_inventory', JSON.stringify(gameState.charaInventory));
                        console.log('[SQ-Restore] 旧キャラキー (sq_charas) から復元しました。');
                    }
                } catch(e) {}
            }
        }

        // 3. 最低保証（新規プレイまたは復旧データ無しの初期状態）
        if (!gameState.charaInventory || Object.keys(gameState.charaInventory).length === 0) {
            gameState.charaInventory = { "1": { level: 1, count: 1, exp: 0 } };
        }
    }
    
    // 全所持キャラクターのレベル最低値保証（Lv.1未満または未設定ならLv.1に補正）
    if (gameState.charaInventory) {
        Object.keys(gameState.charaInventory).forEach(id => {
            const item = gameState.charaInventory[id];
            if (item) {
                if (typeof item.level !== 'number' || item.level < 1) item.level = 1;
                if (typeof item.count !== 'number' || item.count < 1) item.count = 1;
                if (typeof item.exp !== 'number' || item.exp < 0) item.exp = 0;
            }
        });
    }
    
    gameState.stats = safeParse('sq_stats', {
        totalPlay: 0,
        totalKill: 0,
        totalCorrect: 0,
        maxCombo: 0,
        loginDays: 0,
        achieved_perfect: false,
        achieved_speed: false,
        achieved_random: false,
        achieved_oath: false,
        achieved_evolve: false,
        achieved_reborn: false,
        achieved_calcA: false
    });
    gameState.subjectStats = safeParse('sq_subject_stats', {});
    gameState.unlockedTitles = safeParse('sq_titles', []);
    gameState.claimedGifts = safeParse('sq_claimed_gifts', []);
    gameState.revengeList = safeParse('sq_revenge', []);
    gameState.unitProgress = safeParse('sq_unit_progress', {});
    gameState.calcRecords = safeParse('sq_calc_records', {});
    
    // チームバトル用パーティーデータのロードと検証
    const loadedParty = safeParse('sq_team_party', [null, null, null]);
    if (Array.isArray(loadedParty) && loadedParty.length === 3) {
        gameState.teamParty = [
            (loadedParty[0] && gameState.charaInventory[loadedParty[0]]) ? String(loadedParty[0]) : null,
            (loadedParty[1] && gameState.charaInventory[loadedParty[1]]) ? String(loadedParty[1]) : null,
            (loadedParty[2] && gameState.charaInventory[loadedParty[2]]) ? String(loadedParty[2]) : null
        ];
    } else {
        gameState.teamParty = [null, null, null];
    }
    
    // デフォルト編成（もし未編成かつ装備キャラがいる場合、前衛にセット）
    if (!gameState.teamParty[0] && gameState.equipped && gameState.charaInventory[gameState.equipped]) {
        gameState.teamParty[0] = String(gameState.equipped);
    }
    
    const loadedInv = safeParse('sq_item_inventory', {});
    gameState.inventory = {
        redPages: Number(loadedInv.redPages) || 0,
        bluePages: Number(loadedInv.bluePages) || 0,
        xpBookSmall: Number(loadedInv.xpBookSmall) || 0,
        xpBookMedium: Number(loadedInv.xpBookMedium) || 0,
        xpBookLarge: Number(loadedInv.xpBookLarge) || 0
    };
    
    try {
        const parsedMissions = safeParse('sq_missions', {
            date: "",
            progress: { play: 0, kill: 0, correct: 0, maxCombo: 0, enhance: 0, typing: 0, calc: 0, gacha: 0, shop: 0 },
            claimed: { play: false, kill: false, correct: false, maxCombo: false, enhance: false, typing: false, calc: false, gacha: false, shop: false, allClear: false }
        });
        dailyMissions.date = parsedMissions.date || "";
        dailyMissions.progress = parsedMissions.progress || { play: 0, kill: 0, correct: 0, maxCombo: 0, enhance: 0, typing: 0, calc: 0, gacha: 0, shop: 0 };
        dailyMissions.claimed = parsedMissions.claimed || { play: false, kill: false, correct: false, maxCombo: false, enhance: false, typing: false, calc: false, gacha: false, shop: false, allClear: false };
    } catch(e) {}

    // スタディエル育成データのロードと安全な初期値フォールバック復元
    const loadedStudyel = safeParse('sq_studyel', null);
    if (loadedStudyel && typeof loadedStudyel === 'object') {
        gameState.studyel = Object.assign(getDefaultStudyelState(loadedStudyel.generation || 1, loadedStudyel.history || []), loadedStudyel);
        if (!gameState.studyel.categories) gameState.studyel.categories = { science: 0, humanities: 0, general: 0 };
        if (!gameState.studyel.trainingStats) gameState.studyel.trainingStats = { totalAttempts: 0, totalCorrect: 0, totalTimeSpent: 0, maxCombo: 0, totalGradeWeight: 0 };
        if (!gameState.studyel.finalStats) gameState.studyel.finalStats = { formId: null, name: '', baseValue: 1.50, bonusTime: 0.0, bonusDamage: 0.0, level: 1 };
        if (!Array.isArray(gameState.studyel.history)) gameState.studyel.history = [];
    } else {
        gameState.studyel = getDefaultStudyelState();
    }

    // アバター設定データのロード
    const loadedAvatar = safeParse('sq_avatar', null);
    if (loadedAvatar && typeof loadedAvatar === 'object') {
        gameState.avatar = Object.assign({
            base: 0, skinColor: "#fcd34d", eyes: 0, mouth: 0, hair: 0, hairColor: "#1e293b", outfit: 0, accessory: 0, msgId: 0
        }, loadedAvatar);
    }

    if (typeof window !== 'undefined' && typeof window.StudyelEngine?.restoreCharacters === 'function') {
        window.StudyelEngine.restoreCharacters();
    }
}

export function saveGame() {
    // 【最優先・絶対厳守安全ガード】
    // charaInventory が未定義、オブジェクトでない、または空の場合はセーブデータ破壊を防ぐため即座に保存を中断
    if (!gameState.charaInventory || typeof gameState.charaInventory !== 'object' || Object.keys(gameState.charaInventory).length === 0) {
        console.warn('[SQ-Security] セーブデータの保護ガードが作動しました: charaInventory が空または未ロードのため saveGame を中断しました。');
        return;
    }

    // メインセーブデータの安全書き込み
    localStorage.setItem('sq_xp', gameState.xp);
    localStorage.setItem('sq_equip', gameState.equipped);
    localStorage.setItem('sq_items_v2', JSON.stringify(gameState.itemLevels));
    localStorage.setItem('sq_inventory', JSON.stringify(gameState.charaInventory));
    localStorage.setItem('sq_team_party', JSON.stringify(gameState.teamParty));
    localStorage.setItem('sq_missions', JSON.stringify(dailyMissions));
    localStorage.setItem('sq_stats', JSON.stringify(gameState.stats));
    localStorage.setItem('sq_subject_stats', JSON.stringify(gameState.subjectStats || {}));
    localStorage.setItem('sq_titles', JSON.stringify(gameState.unlockedTitles));
    localStorage.setItem('sq_claimed_gifts', JSON.stringify(gameState.claimedGifts));
    localStorage.setItem('sq_revenge', JSON.stringify(gameState.revengeList || []));
    localStorage.setItem('sq_unit_progress', JSON.stringify(gameState.unitProgress || {}));
    localStorage.setItem('sq_calc_records', JSON.stringify(gameState.calcRecords || {}));
    localStorage.setItem('sq_item_inventory', JSON.stringify(gameState.inventory));
    localStorage.setItem('sq_studyel', JSON.stringify(gameState.studyel));
    localStorage.setItem('sq_avatar', JSON.stringify(gameState.avatar));

    // 【自動バックアップ二重保存】万一の破損時に備え、正常なセーブデータのスナップショットを別キーへ退避保存
    try {
        const backupSnapshot = {
            timestamp: Date.now(),
            xp: gameState.xp,
            equipped: gameState.equipped,
            itemLevels: gameState.itemLevels,
            charaInventory: gameState.charaInventory,
            teamParty: gameState.teamParty,
            stats: gameState.stats,
            subjectStats: gameState.subjectStats,
            unlockedTitles: gameState.unlockedTitles,
            claimedGifts: gameState.claimedGifts,
            inventory: gameState.inventory,
            studyel: gameState.studyel,
            avatar: gameState.avatar
        };
        localStorage.setItem('sq_save_backup', JSON.stringify(backupSnapshot));
    } catch (backupErr) {
        console.warn('[SQ-Security] バックアップ保存スキップ:', backupErr);
    }
}

