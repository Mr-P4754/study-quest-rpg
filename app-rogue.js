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
    tileSize: 32,
    isAnimating: false,
    shopBought: false
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
    rogueData.isAnimating = false;
    rogueData.shopBought = false;
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

    rogueData.shopBought = false; // 追加: 階層移動時にショップ購入権をリセット

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
    if (rogueData.isAnimating) return;

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
    let eventChance = Math.min(0.8, 0.1 + (rogueData.floor * 0.05));
    if (Math.random() > eventChance) return; 

    let enemyChance = Math.min(0.8, 0.3 + (rogueData.floor * 0.05));
    
    if (Math.random() < enemyChance) {
        rogueData.isAnimating = true; // 敵出現時は操作をロック
        showRogueCutIn("敵出現⚠️"); // ← 変更
        setTimeout(() => {
            rogueData.isAnimating = false; // ロック解除してバトル開始
            triggerRogueBattle(false);
        }, 800);
    } else {
        const gimmicks = [ROGUE_TILES.FOUNTAIN, ROGUE_TILES.BOOK, ROGUE_TILES.TRAP, ROGUE_TILES.STATUE, ROGUE_TILES.CURSE];
        const g = gimmicks[Math.floor(Math.random() * gimmicks.length)];
        processRogueTile(g);
    }
}

// processRogueTile 関数内の修正（階段マスの処理変更）
function processRogueTile(tile) {
    switch (tile) {
        case ROGUE_TILES.STAIRS:
            // カットインを削除し、直接ボス戦へ移行
            triggerRogueBattle(true);
            break;
        case ROGUE_TILES.FOUNTAIN:
            gameState.lives = Math.min(3, gameState.lives + 1);
            showRogueCutIn("ライフ❤️ +1"); // ← 変更
            break;
        case ROGUE_TILES.BOOK:
            rogueData.exploreLevel++;
            showRogueCutIn("探索レベル📜UP"); // ← 変更
            break;
        case ROGUE_TILES.TRAP:
            rogueData.exploreLevel = Math.max(1, rogueData.exploreLevel - 1);
            showRogueCutIn("探索レベル📜DOWN"); // ← 変更
            break;
        case ROGUE_TILES.STATUE:
            rogueData.atkBuff += 0.3;
            showRogueCutIn("攻撃力⚔️ +30％"); // ← 変更
            break;
        case ROGUE_TILES.CURSE:
            rogueData.atkBuff = Math.max(0.1, rogueData.atkBuff - 0.2);
            showRogueCutIn("攻撃力⚔️ -20％"); // ← 変更
            break;
        case ROGUE_TILES.SHOP:
            triggerRogueShop();
            break;
    }
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
        // 購入済みか、XPが足りない場合はボタンを無効化
        const canBuy = !rogueData.shopBought && (rogueData.earnedXp >= item.price);
        const btnText = rogueData.shopBought ? '品切れ' : `⬇️ ${item.price}XP`;
        list.innerHTML += `
            <div class="shop-item">
                <div class="shop-icon">${item.icon}</div>
                <div class="shop-info">
                    <div class="shop-name">${item.name}</div>
                    <div class="shop-desc">${item.desc}</div>
                </div>
                <div class="shop-right">
                    <button class="shop-buy-btn" ${canBuy ? '' : 'disabled'} onclick="${item.action}(${item.price})">${btnText}</button>
                </div>
            </div>
        `;
    });
}

function buyRogueHeal(price) {
    if (rogueData.shopBought || rogueData.earnedXp < price) return;
    rogueData.earnedXp -= price;
    rogueData.shopBought = true; // 購入済みにする
    gameState.lives = Math.min(3, gameState.lives + 1);
    playSE('hit');
    renderRogueShopContents();
    updateRogueUI();
}

function buyRogueAtk(price) {
    if (rogueData.shopBought || rogueData.earnedXp < price) return;
    rogueData.earnedXp -= price;
    rogueData.shopBought = true;
    rogueData.atkBuff += 0.5;
    playSE('hit');
    renderRogueShopContents();
    updateRogueUI();
}

function buyRogueSteps(price) {
    if (rogueData.shopBought || rogueData.earnedXp < price) return;
    rogueData.earnedXp -= price;
    rogueData.shopBought = true;
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

function getRogueEnemyChar(isBoss, floor) {
    let rarity = 'N';
    if (isBoss) {
        if (floor % 100 === 0) rarity = 'UR';
        else if (floor % 50 === 0) rarity = 'SSR';
        else if (floor % 5 === 0) rarity = 'SR';
        else rarity = 'R';
    } else {
        const rand = Math.random();
        if (rand < 0.01) rarity = 'UR';
        else if (rand < 0.05) rarity = 'SSR';
        else if (rand < 0.20) rarity = 'SR';
        else if (rand < 0.50) rarity = 'R';
        else rarity = 'N';
    }
    
    let pool = rawData.characters.filter(c => c.rarity === rarity);
    if (!pool || pool.length === 0) pool = rawData.characters; // フォールバック
    return pool[Math.floor(Math.random() * pool.length)];
}

// 【変更】triggerRogueBattle 全体を以下に差し替え
function triggerRogueBattle(isBoss = false) {
    rogueData.isBossBattle = isBoss;
    const enemyChar = getRogueEnemyChar(isBoss, rogueData.floor);
    playData.rogueEnemyCharId = enemyChar.id;

    // HP倍率の計算
    let hpMultiplier = 1.0;
    if (isBoss) {
        if (rogueData.floor % 5 === 0) hpMultiplier = 1.5;
        else hpMultiplier = 1.25;
    }
    const calculatedHp = Math.floor(1000 * Number(enemyChar.value || 1.0) * hpMultiplier);

    let qList = [...playData.rogueQuestions].sort(() => Math.random() - 0.5);
    
    playData.questions = qList;
    playData.qIndex = 0;

    let bossName = isBoss ? `${rogueData.floor}F ボス: ${enemyChar.name}` : enemyChar.name;
    let iconUrl = (enemyChar.imageUrl && enemyChar.imageUrl.startsWith('http')) ? enemyChar.imageUrl : "👾";

    playData.currentBoss = { name: bossName, hp: calculatedHp, icon: iconUrl };
    playData.isRevenge = false;

    // 5階層ごとのボス戦では誓約をランダムに1つ発動
    playData.activeOaths = [];
    if (isBoss && rogueData.floor % 5 === 0) {
        const oaths = ['rapid', 'backwater', 'weak'];
        playData.activeOaths = [ oaths[Math.floor(Math.random() * oaths.length)] ];
    }

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
    if (playData.activeOaths.includes('rapid')) gameState.maxTime *= 0.5;
    gameState.timeLeft = gameState.maxTime; 
    
    // 背水の誓約があればライフを1にする
    gameState.lives = playData.activeOaths.includes('backwater') ? 1 : 3;

    isGameActive = false;
    isPaused = false;

    document.getElementById('field-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    const uienemyName = document.getElementById('ui-enemy-name');
    let displayBossName = bossName;
    if (playData.activeOaths.length > 0) displayBossName = "【誓約】" + bossName;
    if (uienemyName) uienemyName.innerText = displayBossName;
    
    const enemyIcon = document.getElementById('ui-enemy-icon');
    if (enemyIcon) { 
        if(iconUrl.startsWith('http')) { enemyIcon.innerHTML = `<img src="${iconUrl}">`; } else { enemyIcon.innerHTML = iconUrl; }
        enemyIcon.classList.remove('shake-anim'); 
    }
    
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

function showRogueCutIn(t) {
    const container = document.getElementById('rogue-canvas-container');
    if (!container) return;
    const d = document.createElement('div');
    d.style.position = 'absolute';
    d.style.top = '40px'; // 歩数や階層の下（キャンバス上部）
    d.style.left = '50%';
    d.style.fontSize = '1.2em';
    d.style.fontWeight = 'bold';
    d.style.color = '#f1c40f';
    d.style.textShadow = '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
    d.style.zIndex = '100';
    d.style.pointerEvents = 'none';
    d.style.whiteSpace = 'nowrap';
    d.style.animation = 'damageFloat 1.2s ease-out forwards';
    d.innerText = t;
    container.appendChild(d);
    setTimeout(() => d.remove(), 1200);
}
