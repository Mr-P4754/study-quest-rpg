// ==========================================
// js/quest-explore.js (ローグライク探索・コアエンジン)
// ==========================================

import {
    gameState,
    playData,
    rawData,
    rogueData,
    runtimeState,
    ROGUE_TILES,
    saveGame
} from './state.js?v=10.1.2';

import {
    playSE,
    playBGM,
    isGradeMatch
} from './utils.js?v=10.1.2';

import {
    updateUI,
    startCountdown,
    getCharaStats,
    backToTitle
} from './battle-core.js?v=10.1.2';

import {
    showAppModal,
    showConfirm,
    updateTitleInfo
} from './ui-manager.js?v=10.1.2';

export function addRogueLog(text) {
    if (!rogueData.logs) rogueData.logs = [];
    rogueData.logs.push(text);
    if (rogueData.logs.length > 3) {
        rogueData.logs.shift(); // 直前3件を保持
    }
    renderRogueLogs();
}

export function renderRogueLogs() {
    const list = document.getElementById('rogue-log-list');
    if (!list) return;
    list.innerHTML = '';
    if (!rogueData.logs || rogueData.logs.length === 0) {
        list.innerHTML = '<div class="rogue-log-item" style="color:#7f8c8d;">探索を開始しました。</div>';
        return;
    }
    rogueData.logs.forEach((msg, idx) => {
        const isLatest = (idx === rogueData.logs.length - 1);
        list.innerHTML += `<div class="rogue-log-item" style="${isLatest ? 'color:#f1c40f; font-weight:bold;' : 'color:#bdc3c7;'}">${msg}</div>`;
    });
}

export async function startRogueMode() {
    const g = document.getElementById('rogue-grade-select')?.value;
    if(!g) return alert("学年を選択してください");
    if (typeof window.ensureGradeLoaded === 'function') await window.ensureGradeLoaded(g);
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.choices && q.choices.length >= 2 && q.subject !== 'タイピング' && q.unit !== 'タイピング');
    if(qList.length === 0) return alert("問題がありません");

    // 選択された学年の問題を保存しておく
    playData.rogueQuestions = qList;
    playData.isTyping = false;
    playData.isCalculation = false;
    playData.isSurvival = false;
    playData.isRandom = false;
    playData.isRevenge = false;
    if (typeof window !== 'undefined' && window.handleTypingInput) {
        document.removeEventListener('keydown', window.handleTypingInput);
    }

    rogueData.floor = 1;
    rogueData.earnedXp = 0;
    rogueData.exploreLevel = 1;
    rogueData.atkBuff = 1.0;
    rogueData.bonusSteps = 0;
    rogueData.maxLives = 3;
    rogueData.active = true;
    rogueData.isAnimating = false;
    rogueData.shopBought = false;
    rogueData.logs = [`🚩 1F の探索を開始`];
    gameState.lives = rogueData.maxLives;
    
    document.getElementById('rogue-menu-overlay')?.classList.add('hidden');
    document.getElementById('title-screen')?.classList.add('hidden');
    document.getElementById('field-screen')?.classList.remove('hidden');
    
    if (typeof window !== 'undefined' && !window.rogueKeyHandlerRegistered) {
        window.addEventListener('keydown', (e) => {
            if (!rogueData.active || 
                !document.getElementById('game-screen')?.classList.contains('hidden') ||
                !document.getElementById('rogue-shop-overlay')?.classList.contains('hidden') ||
                !document.getElementById('app-modal-overlay')?.classList.contains('hidden') ||
                !document.getElementById('result-overlay')?.classList.contains('hidden')
            ) return;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
            if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') moveRoguePlayer(0, -1);
            if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') moveRoguePlayer(0, 1);
            if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') moveRoguePlayer(-1, 0);
            if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') moveRoguePlayer(1, 0);
        });
        window.rogueKeyHandlerRegistered = true;
    }
    
    generateRogueFloor();
    renderRogueLogs();
    playBGM();
}

export function generateRogueFloor() {
    // 階層による歩数上限の減少を廃止し、固定値(30) + ボーナス歩数に変更
    rogueData.maxSteps = 30 + (rogueData.bonusSteps || 0);
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

    rogueData.shopBought = false; // 階層移動時にショップ購入権をリセット

    if (rogueData.floor % 5 === 0) {
        rogueData.map[5][5] = ROGUE_TILES.SHOP;
        rogueData.map[h - 2][w - 2] = ROGUE_TILES.STAIRS;
    } else {
        rogueData.map[h - 2][w - 2] = ROGUE_TILES.STAIRS;
    }

    addRogueLog(`🚩 ${rogueData.floor}F に到達した`);
    updateRogueUI();
    drawRogueMap();
}

export function drawRogueMap() {
    const canvas = document.getElementById('rogue-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
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

export function moveRoguePlayer(dx, dy) {
    if (!rogueData.active || rogueData.isAnimating) return;
    if (!document.getElementById('game-screen')?.classList.contains('hidden')) return;
    if (!document.getElementById('rogue-shop-overlay')?.classList.contains('hidden')) return;
    if (!document.getElementById('app-modal-overlay')?.classList.contains('hidden')) return;
    if (!document.getElementById('result-overlay')?.classList.contains('hidden')) return;

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
    // 敵出現アニメーション中 (!rogueData.isAnimating) の場合は強制送還チェックを保留する
    if (rogueData.steps <= 0 && tile !== ROGUE_TILES.STAIRS && rogueData.active && !rogueData.isAnimating && document.getElementById('game-screen')?.classList.contains('hidden')) {
        showAppModal("歩数がゼロになりました。拠点に強制送還されます。", "alert").then(() => {
            exitRogueSystem(false);
        });
        return;
    }

    updateRogueUI();
    drawRogueMap();
}

export function triggerRogueRNGEvent() {
    let eventChance = Math.min(0.8, 0.1 + (rogueData.floor * 0.05));
    if (Math.random() > eventChance) return; 

    let enemyChance = Math.min(0.8, 0.3 + (rogueData.floor * 0.05));
    
    if (Math.random() < enemyChance) {
        rogueData.isAnimating = true; // 敵出現時は操作をロック
        showRogueCutIn("敵出現⚠️");
        addRogueLog("⚠️ モンスターが現れた！");
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

export function processRogueTile(tile) {
    switch (tile) {
        case ROGUE_TILES.STAIRS:
            addRogueLog(`🚪 ${rogueData.floor}F ボス扉に到達！`);
            triggerRogueBattle(true);
            break;
        case ROGUE_TILES.FOUNTAIN:
            if (!rogueData.maxLives) rogueData.maxLives = 3;
            gameState.lives = Math.min(rogueData.maxLives, gameState.lives + 1);
            showRogueCutIn("ライフ❤️ +1");
            addRogueLog("⛲ 癒しの泉でライフが回復した (❤️+1)");
            break;
        case ROGUE_TILES.BOOK:
            rogueData.exploreLevel++;
            showRogueCutIn("探索レベル📜UP");
            addRogueLog(`📜 古文書を発見！探索Lvが上昇 (Lv.${rogueData.exploreLevel})`);
            break;
        case ROGUE_TILES.TRAP:
            rogueData.exploreLevel = Math.max(1, rogueData.exploreLevel - 1);
            showRogueCutIn("探索レベル📜DOWN");
            addRogueLog(`🕸️ 罠にかかった！探索Lvが低下 (Lv.${rogueData.exploreLevel})`);
            break;
        case ROGUE_TILES.STATUE: {
            const buff = Math.floor(Math.random() * 5) + 1;
            rogueData.atkBuff += (buff / 100);
            showRogueCutIn(`攻撃力⚔️ +${buff}％`);
            addRogueLog(`🗿 女神像の加護を受けた (攻撃力+${buff}%)`);
            break;
        }
        case ROGUE_TILES.CURSE: {
            const debuff = Math.floor(Math.random() * 5) + 1;
            rogueData.atkBuff = Math.max(0.1, rogueData.atkBuff - (debuff / 100));
            showRogueCutIn(`攻撃力⚔️ -${debuff}％`);
            addRogueLog(`💀 呪いを受けた (攻撃力-${debuff}%)`);
            break;
        }
        case ROGUE_TILES.SHOP:
            addRogueLog("🛍️ 中間ショップを発見した！");
            triggerRogueShop();
            break;
    }
}

export function triggerRogueShop() {
    const shopOverlay = document.getElementById('rogue-shop-overlay');
    if (!shopOverlay) return;
    renderRogueShopContents();
    shopOverlay.classList.remove('hidden');
}

export function closeRogueShop() {
    document.getElementById('rogue-shop-overlay')?.classList.add('hidden');
}

export function renderRogueShopContents() {
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
        { id: 'r_heal', name: 'ライフ上限UP薬', price: 30000, desc: '最大ライフ枠と現在ライフを+1', icon: '❤️', action: 'buyRogueHeal' },
        { id: 'r_atk', name: '攻撃の秘薬', price: 20000, desc: '攻撃バフ倍率を +0.5 上昇', icon: '⚔️', action: 'buyRogueAtk' },
        { id: 'r_step', name: '韋駄天の靴', price: 30000, desc: '残り歩数上限を +10 追加する', icon: '👟', action: 'buyRogueSteps' }
    ];

    rogueItems.forEach(item => {
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

export function buyRogueHeal(price) {
    if (rogueData.shopBought || rogueData.earnedXp < price) return;
    rogueData.earnedXp -= price;
    rogueData.shopBought = true;
    
    if (!rogueData.maxLives) rogueData.maxLives = 3;
    rogueData.maxLives += 1;
    gameState.lives += 1;
    
    playSE('hit');
    addRogueLog("💊 ライフ上限UP薬を購入 (❤️最大+1)");
    renderRogueShopContents();
    updateRogueUI();
}

export function buyRogueAtk(price) {
    if (rogueData.shopBought || rogueData.earnedXp < price) return;
    rogueData.earnedXp -= price;
    rogueData.shopBought = true;
    rogueData.atkBuff += 0.5;
    playSE('hit');
    addRogueLog("⚔️ 攻撃の秘薬を購入 (攻撃力+0.5)");
    renderRogueShopContents();
    updateRogueUI();
}

export function buyRogueSteps(price) {
    if (rogueData.shopBought || rogueData.earnedXp < price) return;
    rogueData.earnedXp -= price;
    rogueData.shopBought = true;
    rogueData.bonusSteps = (rogueData.bonusSteps || 0) + 10;
    rogueData.maxSteps += 10;
    rogueData.steps += 10;
    playSE('hit');
    addRogueLog("👟 韋駄天の靴を購入 (歩数+10)");
    renderRogueShopContents();
    updateRogueUI();
}

export function updateRogueUI() {
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

export function escapeRogueConfirm() {
    showConfirm("探索を中断して拠点に戻りますか？\n（獲得した残りのXPは引き継がれます）").then(yes => {
        if (yes) exitRogueSystem(true);
    });
}

export function exitRogueSystem(success) {
    rogueData.active = false;
    gameState.xp += rogueData.earnedXp;
    saveGame();

    if (typeof backToTitle === 'function') {
        backToTitle();
    }
    
    document.getElementById('field-screen')?.classList.add('hidden');

    const resTitle = document.getElementById('res-title');
    if (resTitle) {
        resTitle.innerText = success ? "EXPLORE COMPLETE!" : "EXPLORE FAILED...";
        resTitle.style.color = success ? "#f1c40f" : "#bdc3c7";
    }
    
    const resIcon = document.getElementById('res-icon');
    if (resIcon) resIcon.innerText = success ? "🏆" : "💨";

    const resScoreSpan = document.getElementById('res-score');
    if (resScoreSpan && resScoreSpan.previousSibling && resScoreSpan.previousSibling.nodeType === 3) {
        resScoreSpan.previousSibling.nodeValue = "最終到達階層: ";
    }
    if (resScoreSpan) resScoreSpan.innerText = rogueData.floor + "F";

    const resDetails = document.getElementById('res-details');
    if (resDetails) {
        if (success) {
            resDetails.innerHTML = `<div style="font-size: 1.1em; font-weight: bold; color: #2c3e50;">探索目標を達成し帰還しました！</div><div style="font-size: 0.9em; margin-top: 5px;">獲得した一時EXPを回収しました。</div>`;
        } else {
            resDetails.innerHTML = `<div style="font-size: 1.1em; font-weight: bold; color: #c0392b;">探索失敗…拠点へ強制送還されました。</div><div style="font-size: 0.9em; margin-top: 5px;">獲得した一時EXPを回収しました。</div>`;
        }
        resDetails.style.display = 'block';
    }

    const resDrop = document.getElementById('res-drop');
    if (resDrop) resDrop.style.display = 'none';

    const resXpLabel = document.getElementById('res-xp-label');
    if (resXpLabel) resXpLabel.innerText = "獲得EXP";
    
    const resXpSpan = document.getElementById('res-xp');
    if (resXpSpan) {
        resXpSpan.style.lineHeight = "1.1";
        resXpSpan.innerHTML = `+<span style="color:#f1c40f;">${rogueData.earnedXp}</span>`;
    }

    if (success) playSE('win'); else playSE('lose');

    document.getElementById('result-overlay')?.classList.remove('hidden');
    
    if (typeof updateTitleInfo === 'function') updateTitleInfo();
}

export function getRogueEnemyChar(isBoss, floor) {
    let rarity = 'N';
    if (isBoss) {
        if (floor % 100 === 0) rarity = 'UR';
        else if (floor % 50 === 0) rarity = 'SSR';
        else if (floor % 5 === 0) rarity = 'SR';
        else rarity = 'R';
    } else {
        const rand = Math.random();
        // N: 50% / R: 35% / SR: 12% / SSR: 2.8% / UR: 0.2%
        if (rand < 0.002) rarity = 'UR';
        else if (rand < 0.030) rarity = 'SSR';
        else if (rand < 0.150) rarity = 'SR';
        else if (rand < 0.500) rarity = 'R';
        else rarity = 'N';
    }
    
    let pool = (rawData.characters || []).filter(c => c.rarity === rarity);
    if (!pool || pool.length === 0) pool = rawData.characters || [];
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
    return { id: '1', name: 'スライム', rarity: 'N', value: 1.0 };
}

export function triggerRogueBattle(isBoss = false) {
    rogueData.isBossBattle = isBoss;
    const enemyChar = getRogueEnemyChar(isBoss, rogueData.floor) || { id: '1', name: 'スライム', rarity: 'N', value: 1.0 };
    playData.rogueEnemyCharId = enemyChar.id;

    let hpMultiplier = 1.0;
    if (isBoss) {
        if (rogueData.floor % 5 === 0) hpMultiplier = 1.5;
        else hpMultiplier = 1.25;
    }
    const calculatedHp = Math.floor(1000 * Number(enemyChar.value || 1.0) * hpMultiplier);

    let qList = [...playData.rogueQuestions].sort(() => Math.random() - 0.5);
    
    playData.questions = qList;
    playData.qIndex = 0;

    let rarityText = `[${enemyChar.rarity}] `;
    let bossName = isBoss ? `${rogueData.floor}F ボス: ${rarityText}${enemyChar.name}` : `${rarityText}${enemyChar.name}`;
    let iconUrl = (enemyChar.imageUrl && enemyChar.imageUrl.startsWith('http')) ? enemyChar.imageUrl : "👾";

    playData.currentBoss = { name: bossName, hp: calculatedHp, icon: iconUrl };
    playData.isRevenge = false;

    playData.activeOaths = [];
    if (isBoss && rogueData.floor % 5 === 0) {
        const oaths = ['rapid', 'weak'];
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

    runtimeState.isGameActive = false;
    runtimeState.isPaused = false;
    if (typeof window !== 'undefined' && window.handleTypingInput) {
        document.removeEventListener('keydown', window.handleTypingInput);
    }

    document.getElementById('field-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');

    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    document.getElementById('ui-question')?.classList.remove('hidden');

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

export function showRogueCutIn(t) {
    const container = document.getElementById('rogue-canvas-container');
    if (!container) return;
    const d = document.createElement('div');
    d.className = 'rogue-cutin';
    d.style.position = 'absolute';
    d.style.top = '40px';
    d.style.left = '50%';
    d.style.transform = 'translateX(-50%)';
    d.style.zIndex = '100';
    d.style.pointerEvents = 'none';
    d.style.whiteSpace = 'nowrap';
    d.innerText = t;
    container.appendChild(d);
    setTimeout(() => d.remove(), 1200);
}

