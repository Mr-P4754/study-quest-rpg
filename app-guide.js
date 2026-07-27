// ==========================================
// app-guide.js (ヘルプ・プレイガイド制御モジュール)
// ==========================================

const GUIDE_DATA = {
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
                <h4>① 基本ルール</h4>
                <p>学年・教科・単元を選択して出撃します。出題される問題に正解すると敵にダメージを与えられます。</p>
                <h4>② ドロップアイテム</h4>
                <p>敵を撃破すると、強化素材として使用できる<b>「赤のページ (📕)」「青のページ (📘)」</b>などがドロップします。</p>
                <h4>③ 制限時間とライフ</h4>
                <p>問題ごとに制限時間があります。時間切れまたは誤答でライフ (❤️) が減少します。</p>
            `
        },
        'random': {
            categoryId: 'main',
            title: 'ランダムモード',
            icon: '🎲',
            summary: '指定した学年の全範囲から出題！EXP1.5倍！',
            contentHtml: `
                <h4>① モード概要</h4>
                <p>選択した学年の全教科・全単元から問題がランダムに出題される実力試しモードです。</p>
                <h4>② 特典</h4>
                <p>クリア時の<b>獲得EXPが通常の1.5倍</b>になります！総合的な学力を高めるのに最適です。</p>
            `
        },
        'typing': {
            categoryId: 'main',
            title: 'タイピングクエスト',
            icon: '⌨️',
            summary: 'PCキーボード専用！タイピングで敵を撃破！',
            contentHtml: `
                <h4>① 必須環境</h4>
                <p>このモードは<b>物理キーボード（PC等）が必須</b>です。フリック入力や画面キーボードでは動作しません。</p>
                <h4>② 遊び方</h4>
                <p>画面に表示されたローマ字を正確にタイピングしてください。ミスなく打ち切ると敵に大ダメージを与えます。</p>
            `
        },
        'rogue': {
            categoryId: 'special',
            title: '探索クエスト（ローグライク）',
            icon: '🧭',
            summary: 'ダンジョンを探索して大量のXPと限定アイテムを獲得！',
            contentHtml: `
                <h4>① ダンジョンの進み方</h4>
                <p>十字キーでプレイヤーを操作し、未踏破のマスを開拓しながら<b>🚪（階段）</b>を目指します。</p>
                <h4>② 歩数制限と強制送還</h4>
                <p>1階層ごとに歩数上限があります。歩数が0になると<b>拠点へ強制送還</b>されるため、計画的に移動しましょう。</p>
                <h4>③ イベントマス</h4>
                <p><b>⛲ (ライフ回復)</b>、<b>📜 (探索LvUP)</b>、<b>🛍️ (中間ショップ)</b> などのイベントをうまく活用しましょう！</p>
                <h4>④ 階層ボス</h4>
                <p>5階層ごとに強力なボスが出現します。撃破すると大きなボーナスを獲得できます。</p>
            `
        },
        'survival': {
            categoryId: 'special',
            title: 'サバイバルモード',
            icon: '🔥',
            summary: 'ライフが尽きるまでエンドレス特訓！装備キャラが直接成長！',
            contentHtml: `
                <h4>① モードの仕組み</h4>
                <p>次々と出題される問題を解き続けるエンドレスモードです。正解すると残り時間が少し回復します。</p>
                <h4>② キャラの直接育成</h4>
                <p>このモードでは、現在装備している<b>文房具キャラが直接経験値を獲得してレベルアップ</b>します！</p>
            `
        },
        'calc': {
            categoryId: 'special',
            title: '計算クエスト',
            icon: '🧮',
            summary: 'タイムアタック！成績に応じて強化アイテムを大量獲得！',
            contentHtml: `
                <h4>① 2つのモード</h4>
                <p><b>100問タイムアタック</b>と<b>3分間タイムアタック</b>から選んで挑戦できます。</p>
                <h4>② 獲得報酬</h4>
                <p>クリア時の評価ランク (S〜D) に応じて、<b>📕/📘 ページ</b>がまとめて手に入ります。</p>
                <h4>③ 利き手設定</h4>
                <p>テンキーの位置を「右手用」「左手用」に切替可能です。操作しやすい方を選びましょう。</p>
            `
        },
        'oath': {
            categoryId: 'special',
            title: '誓約・救済の儀',
            icon: '😈',
            summary: '難易度を変化させて倍率やクリアしやすさを調整！',
            contentHtml: `
                <h4>😈 誓約の儀（ハンデ）</h4>
                <p>制限時間短縮や攻撃力半減などのペナルティを課す代わりに、<b>獲得EXPが1.5〜2.0倍</b>にアップします。</p>
                <h4>🕊️ 救済の儀（加護）</h4>
                <p>制限時間2倍やライフ増加などのサポートを受けられます（※獲得EXPは少し低下します）。苦手な単元の克服に活用しましょう！</p>
            `
        },
        'gacha': {
            categoryId: 'gacha',
            title: 'ガチャ＆文房具図鑑',
            icon: '💎',
            summary: 'XPを使ってキャラを獲得・育成・強化！',
            contentHtml: `
                <h4>① ガチャ</h4>
                <p>クエストで溜めたXPを使ってガチャを引くことができます。高レアリティ (SSR/UR) の文房具を獲得しましょう。</p>
                <h4>② キャラ効果</h4>
                <p>装備したキャラは<b>「攻撃力アップ」「時間延長」「XP獲得量アップ」</b>などのスキルを発揮します。</p>
            `
        },
        'enhance': {
            categoryId: 'gacha',
            title: '強化・進化・転生',
            icon: '🌟',
            summary: 'キャラを極限まで鍛え上げる3つのステップ！',
            contentHtml: `
                <h4>① 強化合成</h4>
                <p>強化用の書物（📕📘）や不要なキャラを消費して、キャラのレベルを上げます。</p>
                <h4>② 限界突破・進化</h4>
                <p>レベルMAX＋同キャラの在庫10個で<b>レアリティが1段階アップ</b>します！</p>
                <h4>③ 転生 (UR専用)</h4>
                <p>URキャラがレベルMAXになると<b>「転生」</b>が可能になり、レベル1に戻る代わりに新たなスキルを習得します！</p>
            `
        },
        'system': {
            categoryId: 'system',
            title: 'データ管理・ミッション',
            icon: '☁️',
            summary: 'バックアップとやり込み報酬について',
            contentHtml: `
                <h4>☁️ クラウドセーブの重要性</h4>
                <p>データはブラウザに保存されています。キャッシュ消去等による消失を防ぐため、<b>「データ管理」から定期的にクラウドへ保存</b>してください。発行されたIDで別端末への引き継ぎも可能です。</p>
                <h4>📝 ミッション・称号</h4>
                <p>毎日のデイリーミッションや実績（称号）を達成することで、大量のXPを受け取ることができます。</p>
            `
        }
    }
};

const GuideModule = {
    initContainer() {
        if (!document.getElementById('guide-modal-container')) {
            const container = document.createElement('div');
            container.id = 'guide-modal-container';
            document.body.appendChild(container);
        }
    },

    // 指定されたトピック、または全一覧を開く
    open(topicId = null) {
        this.initContainer();
        const container = document.getElementById('guide-modal-container');

        if (topicId && GUIDE_DATA.topics[topicId]) {
            this.renderTopicDetail(topicId);
        } else {
            this.renderCategoryList();
        }
        container.querySelector('.overlay')?.classList.remove('hidden');
    },

    close() {
        const overlay = document.querySelector('#guide-modal-container .overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    // ① カテゴリ＆トピック一覧画面の描画
    renderCategoryList() {
        const container = document.getElementById('guide-modal-container');
        let categoriesHtml = '';

        GUIDE_DATA.categories.forEach(cat => {
            const catTopics = Object.keys(GUIDE_DATA.topics)
                .filter(key => GUIDE_DATA.topics[key].categoryId === cat.id)
                .map(key => {
                    const t = GUIDE_DATA.topics[key];
                    return `
                        <div class="guide-card-item" onclick="GuideModule.renderTopicDetail('${key}')">
                            <div class="guide-card-icon">${t.icon}</div>
                            <div class="guide-card-text">
                                <div class="guide-card-title">${t.title}</div>
                                <div class="guide-card-sub">${t.summary}</div>
                            </div>
                        </div>
                    `;
                }).join('');

            categoriesHtml += `
                <div class="guide-category-section">
                    <h3 class="guide-category-title">${cat.icon} ${cat.name}</h3>
                    <div class="guide-card-grid">${catTopics}</div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="overlay" style="z-index: 900;">
                <div class="modal" style="max-width: 520px; max-height: 85vh;">
                    <div class="guide-header">
                        <h2 style="color:#1abc9c; margin:0;">📖 プレイガイド</h2>
                        <button class="guide-close-x" onclick="GuideModule.close()">✕</button>
                    </div>
                    <div style="flex: 1; overflow-y: auto; text-align: left; padding: 5px;">
                        ${categoriesHtml}
                    </div>
                    <button class="menu-btn" style="margin-top:15px; background:#95a5a6;" onclick="GuideModule.close()">閉じる</button>
                </div>
            </div>
        `;
    },

    // ② トピック詳細画面の描画
    renderTopicDetail(topicId) {
        const container = document.getElementById('guide-modal-container');
        const topic = GUIDE_DATA.topics[topicId];
        if (!topic) return;

        container.innerHTML = `
            <div class="overlay" style="z-index: 910;">
                <div class="modal" style="max-width: 480px; max-height: 85vh;">
                    <div class="guide-header">
                        <h2 style="color:#3498db; margin:0; font-size:1.2em;">${topic.icon} ${topic.title}</h2>
                        <button class="guide-close-x" onclick="GuideModule.close()">✕</button>
                    </div>
                    <div class="guide-detail-body">
                        ${topic.contentHtml}
                    </div>
                    <div style="display:flex; gap:10px; margin-top:15px;">
                        <button class="menu-btn" style="background:#34495e; flex:1;" onclick="GuideModule.renderCategoryList()">一覧に戻る</button>
                        <button class="menu-btn" style="background:#95a5a6; flex:1;" onclick="GuideModule.close()">閉じる</button>
                    </div>
                </div>
            </div>
        `;
    }
};
