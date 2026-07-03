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
    WALL: '🌲',
    FLOOR: '🟫',
    ENEMY: '👾',
    STAIRS: '🚪',
    PLAYER: '🧙',
    FOUNTAIN: '⛲',
    SWAMP: '🟩',
    BOOK: '📜',
    TRAP: '🕸️',
    STATUE: '🗿',
    CURSE: '💀',
    SHOP: '🛍️'
};

function startRogueMode() {
    rogueData.floor = 1;
    rogueData.earnedXp = 0;
    rogueData.exploreLevel = 1;
    rogueData.atkBuff = 1.0;
    rogueData.active = true;
    
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('field-screen').classList.remove('hidden');
    
    // キーボード移動のイベントリスナー（重複登録防止）
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
            rogueData.map[y][x] = ROGUE_TILES.FLOOR;
        }
    }

    rogueData.playerX = 1;
    rogueData.playerY = 1;

    // 5の倍数階は安全なショップ階
    if (rogueData.floor % 5 === 0) {
        rogueData.map[5][5] = ROGUE_TILES.SHOP;
        rogueData.map[h - 2][w - 2] = ROGUE_TILES.STAIRS;
    } else {
        rogueData.map[h - 2][w - 2] = ROGUE_TILES.STAIRS;
        
        const spawnables = [
            ROGUE_TILES.FOUNTAIN, ROGUE_TILES.SWAMP, ROGUE_TILES.BOOK, 
            ROGUE_TILES.TRAP, ROGUE_TILES.STATUE, ROGUE_TILES.CURSE
        ];
        
        // 敵の配置（階層が進むごとに増加）
        const enemyCount = Math.min(8, 2 + Math.floor(rogueData.floor * 0.6));
        let count = 0;
        while (count < enemyCount) {
            let rx = Math.floor(Math.random() * (w - 2)) + 1;
            let ry = Math.floor(Math.random() * (h - 2)) + 1;
            if (rogueData.map[ry][rx] === ROGUE_TILES.FLOOR && (rx !== 1 || ry !== 1)) {
                rogueData.map[ry][rx] = ROGUE_TILES.ENEMY;
                count++;
            }
        }

        // ギミックマスの配置
        const gimmickCount = 4;
        count = 0;
        while (count < gimmickCount) {
            let rx = Math.floor(Math.random() * (w - 2)) + 1;
            let ry = Math.floor(Math.random() * (h - 2)) + 1;
            if (rogueData.map[ry][rx] === ROGUE_TILES.FLOOR && (rx !== 1 || ry !== 1)) {
                rogueData.map[ry][rx] = spawnables[Math.floor(Math.random() * spawnables.length)];
                count++;
            }
        }
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
    rogueData.map[ny][nx] = ROGUE_TILES.FLOOR; // 踏んだマスは床になる

    processRogueTile(tile);

    if (rogueData.steps <= 0 && tile !== ROGUE_TILES.STAIRS && rogueData.active) {
        showAppModal("歩数がゼロになりました。拠点に強制送還されます。", "alert").then(() => {
            exitRogueSystem(false);
        });
        return;
    }

    updateRogueUI();
    drawRogueMap();
}

function processRogueTile(tile) {
    switch (tile) {
        case ROGUE_TILES.STAIRS:
            rogueData.floor++;
            showCutIn(`階層クリア 次へ`);
            generateRogueFloor();
            break;
        case ROGUE_TILES.ENEMY:
            triggerRogueBattle();
            break;
        case ROGUE_TILES.FOUNTAIN:
            gameState.lives = Math.min(3, gameState.lives + 1);
            showCutIn("❤️ライフ回復");
            break;
        case ROGUE_TILES.SWAMP:
            gameState.lives--;
            showCutIn("🟩毒の沼 ライフ減少");
            if (gameState.lives <= 0) {
                showAppModal("ライフが尽きました。拠点に強制送還されます。", "alert").then(() => exitRogueSystem(false));
            }
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

    let qList = rawData.questions.sort(() => Math.random() - 0.5);
    
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

    isGameActive = false;
    isPaused = false;

    document.getElementById('field-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    const uienemyName = document.getElementById('ui-enemy-name');
    if (uienemyName) uienemyName.innerText = playData.currentBoss.name;
    const enemyIcon = document.getElementById('ui-enemy-icon');
    if (enemyIcon) enemyIcon.innerHTML = "👾";

    // HPバーの表示調整
    const hpFrame = document.querySelector('.enemy-hp-frame');
    if (hpFrame) hpFrame.style.display = '';

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

    document.getElementById('field-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');

    if (success) {
        alert(`探索完了！\nクラウドセーブ可能な恒久XPとして ${rogueData.earnedXp} XP が加算されました。`);
    } else {
        alert(`探索失敗...\n拠点に強制送還されましたが、道中で残った ${rogueData.earnedXp} XP は回収されました。`);
    }
    if (typeof updateTitleInfo === 'function') updateTitleInfo();
}
