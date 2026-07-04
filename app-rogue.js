// ==========================================
// app-rogue.js (ローグライク探索・コアエンジン)
// ==========================================

let rogueData = {
    floor: 1,
    steps: 0,
    maxSteps: 30,
    playerX: 0,
    playerY: 0,
    map: [],
    mapWidth: 11,
    mapHeight: 11,
    earnedXp: 0,
    exploreLevel: 1,
    atkBuff: 1.0,
    active: false,
    tileSize: 32
};

const ROGUE_TILES = {
    WALL: '🌲', FLOOR: '🟫', VISITED: '🟫', ENEMY: '👾', STAIRS: '🚪', PLAYER: '🧙',
    FOUNTAIN: '⛲', BOOK: '📜', TRAP: '🕸️', STATUE: '🗿', CURSE: '💀', SHOP: '🛍️'
    // ライフ減トラップ(SWAMP)は排除
};

function startRogueMode() {
    const g = document.getElementById('rogue-grade-select')?.value;
    if(!g) return alert("学年を選択してください");
    let qList = rawData.questions.filter(q => q.grade == g);
    if(qList.length === 0) return alert("問題がありません");

    // 選択された学年の問題を保存しておく
    playData.rogueQuestions = qList;

    rogueData.floor = 1;
    rogueData.earnedXp = 0;
    rogueData.exploreLevel = 1;
    rogueData.atkBuff = 1.0;
    rogueData.active = true;
    gameState.lives = 3; 
    
    document.getElementById('rogue-menu-overlay')?.classList.add('hidden');
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('field-screen').classList.remove('hidden');
    
    if (!window.rogueKeyHandlerRegistered) {
        window.addEventListener('keydown', (e) => {
            if (!rogueData.active || !document.getElementById('game-screen').classList.contains('hidden')) return;
            if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') moveRoguePlayer(0, -1);
            if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') moveRoguePlayer(0, 1);
            if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') moveRoguePlayer(-1, 0);
            if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') moveRoguePlayer(1, 0);
        });
        window.rogueKeyHandlerRegistered = true;
    }
    
    generateRogueFloor();
}

function generateRogueFloor() {
    rogueData.maxSteps = Math.max(15, 35 - rogueData.floor);
    rogueData.steps = rogueData.maxSteps;

    const w = rogueData.mapWidth;
    const h = rogueData.mapHeight;
    rogueData.map = Array.from({ length: h }, () => Array(w).fill(ROGUE_TILES.WALL));

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            rogueData.map[y][x] = ROGUE_TILES.FLOOR; // 未踏破マス
        }
    }

    rogueData.playerX = 1;
    rogueData.playerY = 1;
    rogueData.map[1][1] = ROGUE_TILES.VISITED; // スタート位置は踏破済み

    if (rogueData.floor % 5 === 0) {
        rogueData.map[5][5] = ROGUE_TILES.SHOP;
        rogueData.map[h - 2][w - 2] = ROGUE_TILES.STAIRS;
    } else {
        rogueData.map[h - 2][w - 2] = ROGUE_TILES.STAIRS;
    }

    updateRogueUI();
    drawRogueMap();
}

function drawRogueMap() {
    const canvas = document.getElementById('rogue-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Canvasのサイズをタイルのサイズに合わせて調整
    canvas.width = rogueData.mapWidth * rogueData.tileSize;
    canvas.height = rogueData.mapHeight * rogueData.tileSize;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${rogueData.tileSize * 0.75}px "BIZ UDPGothic"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y < rogueData.mapHeight; y++) {
        for (let x = 0; x < rogueData.mapWidth; x++) {
            const px = x * rogueData.tileSize + rogueData.tileSize / 2;
            const py = y * rogueData.tileSize + rogueData.tileSize / 2;
            
            if (x === rogueData.playerX && y === rogueData.playerY) {
                ctx.fillText(ROGUE_TILES.PLAYER, px, py);
            } else {
                ctx.fillText(rogueData.map[y][x], px, py);
            }
        }
    }
}

function moveRoguePlayer(dx, dy) {
    const nx = rogueData.playerX + dx;
    const ny = rogueData.playerY + dy;

    if (nx < 0 || nx >= rogueData.mapWidth || ny < 0 || ny >= rogueData.mapHeight) return;
    if (rogueData.map[ny][nx] === ROGUE_TILES.WALL) return;

    rogueData.playerX = nx;
    rogueData.playerY = ny;
    rogueData.steps--;

    const tile = rogueData.map[ny][nx];
    
    // 未踏破マスの場合は踏破済みにし、ランダムエンカウントを判定
    if (tile === ROGUE_TILES.FLOOR) {
        rogueData.map[ny][nx] = ROGUE_TILES.VISITED;
        triggerRogueRNGEvent();
    } else {
        // ショップや階段の場合は処理を実行
        processRogueTile(tile);
    }

    // イベント発生で戦闘画面に移行していない場合のみ歩数切れチェック
    if (rogueData.steps <= 0 && tile !== ROGUE_TILES.STAIRS && rogueData.active && document.getElementById('game-screen').classList.contains('hidden')) {
        showAppModal("歩数がゼロになりました。拠点に強制送還されます。", "alert").then(() => {
            exitRogueSystem(false);
        });
        return;
    }

    updateRogueUI();
    drawRogueMap();
}

// 新規追加: ランダムエンカウントロジック
function triggerRogueRNGEvent() {
    // 発生確率: 序盤は低く、階層ごとに5%ずつ上昇 (最大80%)
    let eventChance = Math.min(0.8, 0.1 + (rogueData.floor * 0.05));
    if (Math.random() > eventChance) return; // 何も起こらない

    // イベント発生時の敵出現確率: 序盤30%〜階層ごとに5%上昇 (最大80%)
    let enemyChance = Math.min(0.8, 0.3 + (rogueData.floor * 0.05));
    
    if (Math.random() < enemyChance) {
        showCutIn("⚠️敵出現");
        setTimeout(() => triggerRogueBattle(), 800);
    } else {
        // バフ・デバフの獲得 (SWAMPは除外)
        const gimmicks = [ROGUE_TILES.FOUNTAIN, ROGUE_TILES.BOOK, ROGUE_TILES.TRAP, ROGUE_TILES.STATUE, ROGUE_TILES.CURSE];
        const g = gimmicks[Math.floor(Math.random() * gimmicks.length)];
        processRogueTile(g);
    }
}

// processRogueTile から SWAMP の分岐を削除
function processRogueTile(tile) {
    switch (tile) {
        case ROGUE_TILES.STAIRS:
            rogueData.floor++;
            showCutIn(`階層クリア 次へ`);
            generateRogueFloor();
            break;
        case ROGUE_TILES.FOUNTAIN:
            gameState.lives = Math.min(3, gameState.lives + 1);
            showCutIn("❤️ライフ回復");
            break;
        case ROGUE_TILES.BOOK:
            rogueData.exploreLevel++;
            showCutIn("📜探索レベルUP");
            break;
        case ROGUE_TILES.TRAP:
            rogueData.exploreLevel = Math.max(1, rogueData.exploreLevel - 1);
            showCutIn("🕸️忘却の罠 レベルDOWN");
            break;
        case ROGUE_TILES.STATUE:
            rogueData.atkBuff += 0.3;
            showCutIn("🗿剣の像 攻撃力UP");
            break;
        case ROGUE_TILES.CURSE:
            rogueData.atkBuff = Math.max(0.1, rogueData.atkBuff - 0.2);
            showCutIn("💀呪い 攻撃力DOWN");
            break;
        case ROGUE_TILES.SHOP:
            triggerRogueShop();
            break;
    }
}

function triggerRogueBattle() {
    const baseHp = 3000;
    const rate = 1.0 + (rogueData.floor * 0.15);
    const calculatedHp = Math.floor(baseHp * rate);

    // 学年選択で保存した問題プールを使用
    let qList = [...playData.rogueQuestions].sort(() => Math.random() - 0.5);
    
    playData.questions = qList;
    playData.qIndex = 0;
    playData.currentBoss = { name: `${rogueData.floor}F 守護モンスター`, hp: calculatedHp, icon: "👾" };
    playData.isRevenge = false;
    playData.activeOaths = [];
    playData.isRandom = false;
    playData.isTyping = false;
    playData.isCalculation = false;
    playData.isSurvival = false;
    playData.context = null;

    gameState.score = 0;
    gameState.combo = 0;
    gameState.enemyHP = calculatedHp;
    gameState.maxHP = calculatedHp;
    
    const charaStats = getCharaStats();
    gameState.maxTime = 10 * charaStats.time;
    gameState.timeLeft = gameState.maxTime; 

    isGameActive = false;
    isPaused = false;

    document.getElementById('field-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    const uienemyName = document.getElementById('ui-enemy-name');
    if (uienemyName) uienemyName.innerText = playData.currentBoss.name;
    const enemyIcon = document.getElementById('ui-enemy-icon');
    if (enemyIcon) { enemyIcon.innerHTML = "👾"; enemyIcon.classList.remove('shake-anim'); }
    
    const enemyBox = document.querySelector('.enemy-visual-box');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out');
    const hpFrame = document.querySelector('.enemy-hp-frame');
    if (hpFrame) hpFrame.style.display = '';
    const timerBar = document.getElementById('ui-timer'); 
    if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); 
    if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);

    updateUI();
    startCountdown();
}

function triggerRogueShop() {
    const shopOverlay = document.getElementById('rogue-shop-overlay');
    if (!shopOverlay) return;
    renderRogueShopContents();
    shopOverlay.classList.remove('hidden');
}

function closeRogueShop() {
    document.getElementById('rogue-shop-overlay')?.classList.add('hidden');
}

function renderRogueShopContents() {
    const shopXp = document.getElementById('rogue-shop-xp');
    if (shopXp) shopXp.innerText = rogueData.earnedXp;

    const list = document.getElementById('rogue-shop-list');
    if (!list) return;

    list.innerHTML = `
        <div style="background:rgba(0,0,0,0.05); padding:10px; border-radius:8px; margin-bottom:10px; font-weight:bold; color:#e67e22; text-align:center;">
            🛒 一時探索ショップ (現在のXPを消費)
        </div>
    `;

    const rogueItems = [
        { id: 'r_heal', name: 'ライフ回復薬', price: 500, desc: 'ライフを1回復する', icon: '❤️', action: 'buyRogueHeal' },
        { id: 'r_atk', name: '攻撃の秘薬', price: 1000, desc: '攻撃バフ倍率を +0.5 上昇', icon: '⚔️', action: 'buyRogueAtk' },
        { id: 'r_step', name: '韋駄天の靴', price: 300, desc: '残り歩数を +10 追加する', icon: '👟', action: 'buyRogueSteps' }
    ];

    rogueItems.forEach(item => {
        const canBuy = rogueData.earnedXp >= item.price;
        list.innerHTML += `
            <div class="shop-item">
                <div class="shop-icon">${item.icon}</div>
                <div class="shop-info">
                    <div class="shop-name">${item.name}</div>
                    <div class="shop-desc">${item.desc}</div>
                </div>
                <div class="shop-right">
                    <button class="shop-buy-btn" ${canBuy ? '' : 'disabled'} onclick="${item.action}(${item.price})">⬇️ ${item.price}XP</button>
                </div>
            </div>
        `;
    });
}

function buyRogueHeal(price) {
    if (rogueData.earnedXp < price) return;
    rogueData.earnedXp -= price;
    gameState.lives = Math.min(3, gameState.lives + 1);
    playSE('hit');
    renderRogueShopContents();
    updateRogueUI();
}

function buyRogueAtk(price) {
    if (rogueData.earnedXp < price) return;
    rogueData.earnedXp -= price;
    rogueData.atkBuff += 0.5;
    playSE('hit');
    renderRogueShopContents();
    updateRogueUI();
}

function buyRogueSteps(price) {
    if (rogueData.earnedXp < price) return;
    rogueData.earnedXp -= price;
    rogueData.steps += 10;
    playSE('hit');
    renderRogueShopContents();
    updateRogueUI();
}

function updateRogueUI() {
    const l = document.getElementById('rogue-life');
    if (l) l.innerText = '❤️'.repeat(Math.max(0, gameState.lives));
    const f = document.getElementById('rogue-floor');
    if (f) f.innerText = rogueData.floor;
    const s = document.getElementById('rogue-steps');
    if (s) s.innerText = `${rogueData.steps}/${rogueData.maxSteps}`;
    const e = document.getElementById('rogue-explv');
    if (e) e.innerText = rogueData.exploreLevel;
    const x = document.getElementById('rogue-ctxp');
    if (x) x.innerText = rogueData.earnedXp;
}

function escapeRogueConfirm() {
    showConfirm("探索を中断して拠点に戻りますか？\n（獲得した残りのXPは引き継がれます）").then(yes => {
        if (yes) exitRogueSystem(true);
    });
}

function exitRogueSystem(success) {
    rogueData.active = false;
    gameState.xp += rogueData.earnedXp;
    saveGame();

    // 【修正】ゲーム状態と各種UIを完全に初期化する関数を呼ぶ
    if (typeof backToTitle === 'function') {
        backToTitle();
    }
    
    // 確実に探索画面も隠す
    document.getElementById('field-screen')?.classList.add('hidden');

    if (success) {
        alert(`探索完了！\nクラウドセーブ可能な恒久XPとして ${rogueData.earnedXp} XP が加算されました。`);
    } else {
        alert(`探索失敗...\n拠点に強制送還されましたが、道中で残った ${rogueData.earnedXp} XP は回収されました。`);
    }
    
    if (typeof updateTitleInfo === 'function') updateTitleInfo();
}
