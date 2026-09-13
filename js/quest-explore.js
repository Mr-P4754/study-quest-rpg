// ==========================================
// js/quest-explore.js (オープンワールド探索・オトモ連れ歩き統合エンジン Ver 2.2)
// ==========================================

import {
    gameState,
    playData,
    rawData,
    rogueData,
    runtimeState,
    saveGame
} from './state.js?v=10.5.0';

import {
    playSE,
    playBGM,
    isGradeMatch,
    renderSafeImg
} from './utils.js?v=10.5.0';

import {
    updateUI,
    startCountdown,
    getCharaStats,
    backToTitle,
    updateSpUI
} from './battle-core.js?v=10.5.0';

import {
    showAppModal,
    showConfirm,
    updateTitleInfo
} from './ui-manager.js?v=10.5.0';

import { cloudSync } from './api.js?v=10.5.0';
import { generateAvatarSvg } from './avatar-engine.js?v=10.5.0';
import { getStudyelSvgDataUri } from './studyel-engine.js?v=10.5.0';

// --- フィールド幾何・ゲームバランス定数 ---
const MAP_SIZE = 1200;
const START_POS = { x: 600, y: 600 };
const GOAL_DISTANCE = 480;
const CORRIDOR_T_MIN = 0.2;
const CORRIDOR_T_MAX = 0.9;
const CORRIDOR_WIDTH_MIN = 100;
const CORRIDOR_WIDTH_MAX = 160;

const PLAYER_RADIUS = 20;
const PLAYER_SPEED = 1.6; // 従来の2.8から約43%減速（敵を簡単に回避できない落ち着いた探索速度）
const ENEMY_RADIUS = 20;
const ENEMY_WANDER_SPEED = 0.7;
const ENEMY_CHASE_SPEED = 1.4; // プレイヤー速度1.6に対して肉薄する追尾速度
const ENEMY_SEARCH_RADIUS = 160;
const COLLISION_DISTANCE = 40;
const STEP_DISTANCE = 32;
const INVINCIBLE_DURATION = 1500;

// アニメーションループ & 入力状態管理
let animationFrameId = null;
let lastFrameTime = 0;
let respawnTimer = null;
let pendingRespawnCount = 0;

// 入力状態
const keysDown = {};
let joystickVector = { x: 0, y: 0 };

// キャッシュ済みグラフィックアセット
let cachedAvatarImg = null;
let cachedOtomoImg = null;
let otomoDrawInfo = { type: 'icon', icon: '✏️', img: null };

// ==========================================
// 1. オトモ属性パッシブ判定 & アセット事前キャッシュ
// ==========================================

export function getOtomoPassive() {
    const charId = (gameState.equippedParty && gameState.equippedParty[0]) ? gameState.equippedParty[0] : (gameState.equipped || '1');
    let char = (rawData.characters && rawData.characters.length > 0)
        ? rawData.characters.find(c => String(c.id) === String(charId))
        : null;

    if (!char) {
        char = { id: '1', name: 'えんぴつ君', type: 'TIME', rarity: 'N', icon: '✏️' };
    }

    let type = String(char.type || char['タイプ'] || 'TIME').toUpperCase();
    if (char.skills && Array.isArray(char.skills) && char.skills.includes('ALL')) {
        type = 'ALL';
    }
    if (char.isStudyel && char.id.includes('transcend')) {
        type = 'ALL';
    }

    return {
        char,
        type,
        hasAtk: type === 'ATK' || type === 'ALL',
        hasTime: type === 'TIME' || type === 'ALL',
        hasExp: type === 'EXP' || type === 'ALL',
        hasAll: type === 'ALL'
    };
}

export async function preloadRogueAssets() {
    // 1. プレイヤーアバターSVG事前キャッシュ
    try {
        const avSvg = generateAvatarSvg(gameState.avatar, 80);
        if (avSvg) {
            await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    cachedAvatarImg = img;
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(avSvg);
            });
        }
    } catch (e) {
        console.warn('[SQ-Rogue] アバターキャッシュ生成失敗:', e);
    }

    // 2. オトモグラフィック事前キャッシュ
    try {
        const { char } = getOtomoPassive();
        otomoDrawInfo = { type: 'icon', icon: char.icon || '✏️', img: null };

        let imgUrl = char.imageUrl || char.image || '';
        if (char.isStudyel) {
            const formKey = (char.id && char.id.split('_')[1]) ? char.id.split('_')[1] : 'general';
            imgUrl = getStudyelSvgDataUri(4, formKey, true);
        }

        if (imgUrl && (imgUrl.startsWith('http') || imgUrl.startsWith('data:image'))) {
            await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    cachedOtomoImg = img;
                    otomoDrawInfo = { type: 'image', icon: '', img };
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = imgUrl;
            });
        }
    } catch (e) {
        console.warn('[SQ-Rogue] オトモキャッシュ生成失敗:', e);
    }
}

// ==========================================
// 2. 探索ログ管理
// ==========================================

export function addRogueLog(text) {
    if (!rogueData.logs) rogueData.logs = [];
    rogueData.logs.push(text);
    if (rogueData.logs.length > 3) {
        rogueData.logs.shift();
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

// ==========================================
// 3. 探索モード開始 & 初期化
// ==========================================

export async function startRogueMode() {
    const g = document.getElementById('rogue-grade-select')?.value;
    if (!g) return alert("学年を選択してください");
    if (typeof window.ensureGradeLoaded === 'function') await window.ensureGradeLoaded(g);
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.choices && q.choices.length >= 2 && q.subject !== 'タイピング' && q.unit !== 'タイピング');
    if (qList.length === 0) return alert("問題がありません");

    playData.rogueQuestions = qList;
    playData.isTyping = false;
    playData.isCalculation = false;
    playData.isSurvival = false;
    playData.isRandom = false;
    playData.isRevenge = false;

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
    rogueData.accumulatedDist = 0;
    rogueData.invincibleUntil = 0;
    rogueData.playerHistory = [];
    rogueData.lastEncounterEnemyId = null;
    rogueData.currentShopEntity = null;
    rogueData.isPaused = false;
    pendingRespawnCount = 0;
    gameState.lives = rogueData.maxLives;

    document.getElementById('rogue-menu-overlay')?.classList.add('hidden');
    document.getElementById('title-screen')?.classList.add('hidden');
    document.getElementById('field-screen')?.classList.remove('hidden');

    // グラフィックの事前キャッシュ
    await preloadRogueAssets();

    // 入力イベントリスナーの登録
    setupInputHandlers();

    // マップ＆エンティティ生成
    generateRogueFloor();
    renderRogueLogs();
    playBGM();

    // ゲームループ開始
    startRogueLoop();
}

// ==========================================
// 4. フロア・幾何配置アルゴリズム (コリドー帯＆ゴール配置)
// ==========================================

export function generateRogueFloor() {
    const passive = getOtomoPassive();
    const baseSteps = passive.hasTime ? 60 : 50;
    rogueData.maxSteps = baseSteps + (rogueData.bonusSteps || 0);
    rogueData.steps = rogueData.maxSteps;

    // スタート地点 S (600, 600)
    rogueData.playerX = START_POS.x;
    rogueData.playerY = START_POS.y;
    rogueData.startPos = { x: START_POS.x, y: START_POS.y };
    rogueData.playerHistory = [];
    rogueData.accumulatedDist = 0;
    rogueData.invincibleUntil = Date.now() + 1000; // 開始直後は1秒無敵

    // ゴール地点 G: Sから「歩数の30%」の距離（デフォルト50歩なら 50 * 32 * 0.3 = 480px）
    const goalDist = Math.round(rogueData.maxSteps * STEP_DISTANCE * 0.3);
    const theta = Math.random() * Math.PI * 2;
    const gx = Math.round(START_POS.x + goalDist * Math.cos(theta));
    const gy = Math.round(START_POS.y + goalDist * Math.sin(theta));
    rogueData.goalPos = { x: gx, y: gy };

    // S -> G のベクトル・単位ベクトル・法線ベクトル
    const vx = gx - START_POS.x;
    const vy = gy - START_POS.y;
    const actualDist = Math.hypot(vx, vy) || goalDist;
    const ux = vx / actualDist;
    const uy = vy / actualDist;
    const nx = -uy;
    const ny = ux;

    // 階層別モンスター上限数: min(10, 3 + floor((floor-1)/3))
    const maxEnemies = Math.min(10, 3 + Math.floor((rogueData.floor - 1) / 3));
    rogueData.enemies = [];

    for (let i = 0; i < maxEnemies; i++) {
        // 内分点比率 t (0.2 〜 0.9)
        const t = CORRIDOR_T_MIN + Math.random() * (CORRIDOR_T_MAX - CORRIDOR_T_MIN);
        // 幅 ±100px 〜 ±160px のコリドー帯
        const sign = (Math.random() < 0.5 ? -1 : 1);
        const w = sign * (CORRIDOR_WIDTH_MIN + Math.random() * (CORRIDOR_WIDTH_MAX - CORRIDOR_WIDTH_MIN));

        let ex = Math.round(START_POS.x + t * vx + w * nx);
        let ey = Math.round(START_POS.y + t * vy + w * ny);
        ex = Math.max(80, Math.min(MAP_SIZE - 80, ex));
        ey = Math.max(80, Math.min(MAP_SIZE - 80, ey));

        const charData = getRogueEnemyChar(false, rogueData.floor);
        rogueData.enemies.push({
            id: 'enemy_' + Date.now() + '_' + i,
            x: ex,
            y: ey,
            baseX: ex,
            baseY: ey,
            wanderAngle: Math.random() * Math.PI * 2,
            wanderTimer: Math.floor(Math.random() * 60),
            state: 'wander',
            charData
        });
    }

    // 探索オブジェクトの配置（コリドー外・寄り道エリア中心）
    rogueData.objects = [];

    // 宝箱: 2〜3個 (+0〜2)
    const chestCount = (2 + Math.floor(Math.random() * 2)) + Math.floor(Math.random() * 3);
    for (let i = 0; i < chestCount; i++) {
        const pos = sampleSideAreaPos(START_POS, rogueData.goalPos, ux, uy, nx, ny);
        rogueData.objects.push({
            id: 'chest_' + i,
            type: 'chest',
            x: pos.x,
            y: pos.y,
            collected: false
        });
    }

    // 癒しの泉: 1個 (+0〜1)
    const fountainCount = 1 + (Math.random() < 0.3 ? 1 : 0);
    for (let i = 0; i < fountainCount; i++) {
        const pos = sampleSideAreaPos(START_POS, rogueData.goalPos, ux, uy, nx, ny);
        rogueData.objects.push({
            id: 'fountain_' + i,
            type: 'fountain',
            x: pos.x,
            y: pos.y,
            collected: false
        });
    }

    // 古代の石碑: 1個 (+0〜1)
    const monumentCount = 1 + (Math.random() < 0.2 ? 1 : 0);
    for (let i = 0; i < monumentCount; i++) {
        const pos = sampleSideAreaPos(START_POS, rogueData.goalPos, ux, uy, nx, ny);
        rogueData.objects.push({
            id: 'monument_' + i,
            type: 'monument',
            x: pos.x,
            y: pos.y,
            collected: false
        });
    }

    // 中間商人: 5Fごとのみ1個（他フロアは低確率15%）
    const needShop = (rogueData.floor % 5 === 0) || (Math.random() < 0.15);
    if (needShop) {
        const pos = sampleSideAreaPos(START_POS, rogueData.goalPos, ux, uy, nx, ny);
        rogueData.objects.push({
            id: 'shop_entity',
            type: 'shop',
            x: pos.x,
            y: pos.y,
            collected: false
        });
    }

    rogueData.shopBought = false;
    pendingRespawnCount = 0;

    addRogueLog(`🚩 ${rogueData.floor}F に到達した`);
    updateRogueUI();
}

/**
 * 寄り道エリア（コリドー帯の外側かつマップ内）の座標をサンプリング
 */
function sampleSideAreaPos(start, goal, ux, uy, nx, ny) {
    for (let attempt = 0; attempt < 15; attempt++) {
        const t = Math.random();
        const sign = (Math.random() < 0.5 ? -1 : 1);
        const w = sign * (180 + Math.random() * 260); // コリドー外側 (180〜440px)
        const x = Math.round(start.x + t * (goal.x - start.x) + w * nx);
        const y = Math.round(start.y + t * (goal.y - start.y) + w * ny);
        if (x >= 70 && x <= MAP_SIZE - 70 && y >= 70 && y <= MAP_SIZE - 70) {
            return { x, y };
        }
    }
    return {
        x: Math.round(100 + Math.random() * (MAP_SIZE - 200)),
        y: Math.round(100 + Math.random() * (MAP_SIZE - 200))
    };
}

// ==========================================
// 5. 操作入力システム (バーチャルジョイスティック + PCキーボード)
// ==========================================

function setupInputHandlers() {
    if (window.rogueInputInitialized) return;
    window.rogueInputInitialized = true;

    // PCキーボード入力 (WASD / 矢印キー)
    window.addEventListener('keydown', (e) => {
        if (!rogueData.active || isRoguePaused()) return;
        const k = e.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
            keysDown[k] = true;
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (keysDown[k]) {
            delete keysDown[k];
        }
    });

    // バーチャルアナログジョイスティック
    const joyZone = document.getElementById('rogue-joystick-zone');
    const joyKnob = document.getElementById('rogue-joystick-knob');
    if (joyZone && joyKnob) {
        let touchId = null;
        let baseRect = null;
        const maxRadius = 38;

        const updateJoystick = (clientX, clientY) => {
            if (!baseRect) return;
            const centerX = baseRect.left + baseRect.width / 2;
            const centerY = baseRect.top + baseRect.height / 2;
            const dx = clientX - centerX;
            const dy = clientY - centerY;
            const dist = Math.hypot(dx, dy);

            if (dist === 0) {
                joystickVector = { x: 0, y: 0 };
                joyKnob.style.transform = 'translate(0px, 0px)';
                return;
            }

            const clampedDist = Math.min(dist, maxRadius);
            const normX = dx / dist;
            const normY = dy / dist;
            const power = clampedDist / maxRadius;

            joystickVector = { x: normX * power, y: normY * power };
            joyKnob.style.transform = `translate(${normX * clampedDist}px, ${normY * clampedDist}px)`;
        };

        joyZone.addEventListener('touchstart', (e) => {
            if (touchId !== null) return;
            const touch = e.changedTouches[0];
            touchId = touch.identifier;
            baseRect = joyZone.getBoundingClientRect();
            updateJoystick(touch.clientX, touch.clientY);
            e.preventDefault();
        }, { passive: false });

        joyZone.addEventListener('touchmove', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                    e.preventDefault();
                    break;
                }
            }
        }, { passive: false });

        const resetJoy = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    touchId = null;
                    joystickVector = { x: 0, y: 0 };
                    joyKnob.style.transform = 'translate(0px, 0px)';
                    break;
                }
            }
        };
        joyZone.addEventListener('touchend', resetJoy);
        joyZone.addEventListener('touchcancel', resetJoy);
    }
}

// 後方互換性ラッパー（既存スクリプトや外部呼び出し対応）
export function moveRoguePlayer(dx, dy) {
    if (!rogueData.active || isRoguePaused()) return;
    const nx = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, rogueData.playerX + dx * 24));
    const ny = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, rogueData.playerY + dy * 24));
    const dist = Math.hypot(nx - rogueData.playerX, ny - rogueData.playerY);
    rogueData.playerX = nx;
    rogueData.playerY = ny;
    consumeDistance(dist);
}

// ==========================================
// 6. 60fps ゲームループ & ポーズ制御 (EX-14)
// ==========================================

export function isRoguePaused() {
    if (!rogueData.active || rogueData.isPaused || rogueData.isAnimating) return true;
    if (!document.getElementById('game-screen')?.classList.contains('hidden')) return true;
    if (!document.getElementById('rogue-shop-overlay')?.classList.contains('hidden')) return true;
    if (!document.getElementById('app-modal-overlay')?.classList.contains('hidden')) return true;
    if (!document.getElementById('result-overlay')?.classList.contains('hidden')) return true;
    if (!document.getElementById('pause-overlay')?.classList.contains('hidden')) return true;
    return false;
}

export function startRogueLoop() {
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(rogueGameLoop);
}

export function stopRogueLoop() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

export function resumeRogueLoop() {
    rogueData.isPaused = false;
    startRogueLoop();
}

function rogueGameLoop(now) {
    if (!rogueData.active) {
        animationFrameId = null;
        return;
    }

    const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;

    if (!isRoguePaused()) {
        updateRogueWorld(dt, now);
    }

    renderRogueWorld(now);
    animationFrameId = requestAnimationFrame(rogueGameLoop);
}

// ==========================================
// 7. ワールド状態更新 (移動・オトモ追従・敵AI・当たり判定)
// ==========================================

function updateRogueWorld(dt, now) {
    // 1. 移動ベクトル計算 (バーチャルジョイスティック + PCキーボード)
    let moveX = joystickVector.x;
    let moveY = joystickVector.y;

    if (keysDown['arrowleft'] || keysDown['a']) moveX -= 1;
    if (keysDown['arrowright'] || keysDown['d']) moveX += 1;
    if (keysDown['arrowup'] || keysDown['w']) moveY -= 1;
    if (keysDown['arrowdown'] || keysDown['s']) moveY += 1;

    const mag = Math.hypot(moveX, moveY);
    if (mag > 0.05) {
        const normX = (mag > 1) ? (moveX / mag) : moveX;
        const normY = (mag > 1) ? (moveY / mag) : moveY;
        const dx = normX * PLAYER_SPEED;
        const dy = normY * PLAYER_SPEED;

        const nextX = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, rogueData.playerX + dx));
        const nextY = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, rogueData.playerY + dy));
        const actualDist = Math.hypot(nextX - rogueData.playerX, nextY - rogueData.playerY);

        rogueData.playerX = nextX;
        rogueData.playerY = nextY;

        // 過去座標リングバッファ更新 (オトモ追従用)
        rogueData.playerHistory.unshift({ x: nextX, y: nextY });
        if (rogueData.playerHistory.length > 20) {
            rogueData.playerHistory.pop();
        }

        // 歩数スタミナ消費計算 (32pxごとに1歩減少)
        consumeDistance(actualDist);
    }

    // 2. 敵AI更新 (徘徊 ＆ 追尾)
    for (const enemy of rogueData.enemies) {
        const edx = rogueData.playerX - enemy.x;
        const edy = rogueData.playerY - enemy.y;
        const distToPlayer = Math.hypot(edx, edy);

        if (distToPlayer <= ENEMY_SEARCH_RADIUS) {
            // 追尾モード
            enemy.state = 'chase';
            const normEx = edx / distToPlayer;
            const normEy = edy / distToPlayer;
            enemy.x = Math.max(ENEMY_RADIUS, Math.min(MAP_SIZE - ENEMY_RADIUS, enemy.x + normEx * ENEMY_CHASE_SPEED));
            enemy.y = Math.max(ENEMY_RADIUS, Math.min(MAP_SIZE - ENEMY_RADIUS, enemy.y + normEy * ENEMY_CHASE_SPEED));
        } else {
            // 徘徊モード
            enemy.state = 'wander';
            enemy.wanderTimer--;
            if (enemy.wanderTimer <= 0) {
                enemy.wanderAngle += (Math.random() - 0.5) * Math.PI;
                enemy.wanderTimer = 40 + Math.floor(Math.random() * 40);
            }
            const wx = Math.cos(enemy.wanderAngle) * ENEMY_WANDER_SPEED;
            const wy = Math.sin(enemy.wanderAngle) * ENEMY_WANDER_SPEED;
            enemy.x = Math.max(ENEMY_RADIUS, Math.min(MAP_SIZE - ENEMY_RADIUS, enemy.x + wx));
            enemy.y = Math.max(ENEMY_RADIUS, Math.min(MAP_SIZE - ENEMY_RADIUS, enemy.y + wy));
        }
    }

    // 3. 当たり判定チェック
    checkCollisions();
}

/**
 * 累計距離積算 ＆ 歩数スタミナ消費
 */
function consumeDistance(dist) {
    rogueData.accumulatedDist = (rogueData.accumulatedDist || 0) + dist;
    while (rogueData.accumulatedDist >= STEP_DISTANCE) {
        rogueData.accumulatedDist -= STEP_DISTANCE;
        rogueData.steps--;
        updateRogueUI();

        if (rogueData.steps <= 0) {
            stopRogueLoop();
            showAppModal("歩数がゼロになりました。拠点に強制送還されます。", "alert").then(() => {
                exitRogueSystem(false);
            });
            return;
        }
    }
}

/**
 * 各種当たり判定
 */
function checkCollisions() {
    const isInvincible = (Date.now() < (rogueData.invincibleUntil || 0));

    // A. モンスター接触判定
    if (!isInvincible) {
        for (const enemy of rogueData.enemies) {
            const d = Math.hypot(rogueData.playerX - enemy.x, rogueData.playerY - enemy.y);
            if (d <= COLLISION_DISTANCE) {
                // エンカウント発生！
                rogueData.lastEncounterEnemyId = enemy.id;
                rogueData.isAnimating = true;
                stopRogueLoop();

                showRogueCutIn("敵出現⚠️");
                addRogueLog(`⚠️ ${enemy.charData?.name || 'モンスター'}が現れた！`);

                setTimeout(() => {
                    rogueData.isAnimating = false;
                    triggerRogueBattle(false, enemy.charData);
                }, 600);
                return;
            }
        }
    }

    // B. ゴール（🚪）接触判定
    const distToGoal = Math.hypot(rogueData.playerX - rogueData.goalPos.x, rogueData.playerY - rogueData.goalPos.y);
    if (distToGoal <= COLLISION_DISTANCE + 6) {
        stopRogueLoop();
        showConfirm(`🚪 ${rogueData.floor}F のボス扉を開けますか？\n（強力な階層ボスとの戦闘になります）`).then(yes => {
            if (yes) {
                triggerRogueBattle(true);
            } else {
                // 後退させて再エンカウント防止
                const normX = (rogueData.playerX - rogueData.goalPos.x) / (distToGoal || 1);
                const normY = (rogueData.playerY - rogueData.goalPos.y) / (distToGoal || 1);
                rogueData.playerX += normX * 30;
                rogueData.playerY += normY * 30;
                resumeRogueLoop();
            }
        });
        return;
    }

    // C. 探索オブジェクト接触判定
    for (const obj of rogueData.objects) {
        if (obj.collected) continue;
        const d = Math.hypot(rogueData.playerX - obj.x, rogueData.playerY - obj.y);
        if (d <= COLLISION_DISTANCE) {
            handleObjectInteraction(obj);
            break;
        }
    }
}

/**
 * 探索オブジェクト回収インタラクション
 */
function handleObjectInteraction(obj) {
    const passive = getOtomoPassive();

    switch (obj.type) {
        case 'chest': {
            obj.collected = true;
            playSE('hit');
            let expGain = 1200 + rogueData.floor * 300;
            let materialDrop = 'redPages';
            const matKeys = ['redPages', 'bluePages', 'xpBookSmall'];
            const randMat = matKeys[Math.floor(Math.random() * matKeys.length)];

            if (passive.hasExp) {
                expGain *= 2;
                if (gameState.inventory) {
                    gameState.inventory[randMat] = (gameState.inventory[randMat] || 0) + 2;
                }
                showRogueCutIn(`宝箱🎁 XP+${expGain} & 素材×2 (EXPオトモ効果！)`);
                addRogueLog(`🎁 宝箱を開けた！(EXP+${expGain}, 素材×2)`);
            } else {
                if (gameState.inventory) {
                    gameState.inventory[randMat] = (gameState.inventory[randMat] || 0) + 1;
                }
                showRogueCutIn(`宝箱🎁 XP+${expGain} & 素材獲得`);
                addRogueLog(`🎁 宝箱を開けた！(EXP+${expGain})`);
            }
            rogueData.earnedXp += expGain;
            updateRogueUI();
            break;
        }
        case 'fountain': {
            // ライフ満タンならスルー
            if (gameState.lives >= rogueData.maxLives) {
                // スルー可能（消滅させない）
                return;
            }
            obj.collected = true;
            gameState.lives = Math.min(rogueData.maxLives, gameState.lives + 1);
            playSE('hit');
            showRogueCutIn("ライフ❤️ +1 回復！");
            addRogueLog("⛲ 癒しの泉で傷を癒やした (❤️+1)");
            updateRogueUI();
            break;
        }
        case 'monument': {
            obj.collected = true;
            playSE('hit');
            const isBuff = (Math.random() < 0.6);
            if (isBuff) {
                const buffType = Math.floor(Math.random() * 3);
                if (buffType === 0) {
                    rogueData.atkBuff += 0.2;
                    showRogueCutIn("攻撃力⚔️ +20％ UP！");
                    addRogueLog("📜 石碑の加護を受けた (攻撃力+20%)");
                } else if (buffType === 1) {
                    rogueData.exploreLevel++;
                    showRogueCutIn("探索レベル📜 +1 UP！");
                    addRogueLog(`📜 古代の知識を得た (探索Lv.${rogueData.exploreLevel})`);
                } else {
                    gameState.lives = Math.min(rogueData.maxLives, gameState.lives + 1);
                    showRogueCutIn("生命力❤️ +1 回復！");
                    addRogueLog("📜 石碑に祈りを捧げた (❤️+1)");
                }
            } else {
                const debuffType = Math.floor(Math.random() * 2);
                if (debuffType === 0) {
                    rogueData.atkBuff = Math.max(0.2, rogueData.atkBuff - 0.15);
                    showRogueCutIn("攻撃力⚔️ -15％ DOWN...");
                    addRogueLog("📜 石碑の罠にかかった (攻撃力-15%)");
                } else {
                    rogueData.exploreLevel = Math.max(1, rogueData.exploreLevel - 1);
                    showRogueCutIn("探索レベル📜 -1 DOWN...");
                    addRogueLog(`📜 石碑の呪いを受けた (探索Lv.${rogueData.exploreLevel})`);
                }
            }
            updateRogueUI();
            break;
        }
        case 'shop': {
            rogueData.currentShopEntity = obj;
            triggerRogueShop();
            break;
        }
    }
}

// ==========================================
// 8. 戦闘終了・復帰フック (battle-core.js 連携)
// ==========================================

export function onRogueBattleEnd(victory) {
    if (!victory) {
        exitRogueSystem(false);
        return;
    }

    // 接触した敵を削除
    if (rogueData.lastEncounterEnemyId) {
        rogueData.enemies = rogueData.enemies.filter(e => e.id !== rogueData.lastEncounterEnemyId);
        rogueData.lastEncounterEnemyId = null;
    }

    // 1.5秒間の半透明無敵時間
    rogueData.invincibleUntil = Date.now() + INVINCIBLE_DURATION;

    // 画面外リスポーンタイマー予約
    const maxEnemies = Math.min(10, 3 + Math.floor((rogueData.floor - 1) / 3));
    if (rogueData.enemies.length < maxEnemies) {
        scheduleEnemyRespawn();
    }

    updateRogueUI();
    resumeRogueLoop();
}

/**
 * 画面外動的リスポーン (EX-05)
 */
function scheduleEnemyRespawn() {
    pendingRespawnCount++;
    setTimeout(() => {
        if (!rogueData.active) return;
        const maxEnemies = Math.min(10, 3 + Math.floor((rogueData.floor - 1) / 3));
        if (rogueData.enemies.length >= maxEnemies) {
            pendingRespawnCount = Math.max(0, pendingRespawnCount - 1);
            return;
        }

        const canvas = document.getElementById('rogue-canvas');
        const cam = getCameraOffset(canvas || { width: 400, height: 400 });
        const viewW = canvas ? canvas.width : 400;
        const viewH = canvas ? canvas.height : 400;

        // カメラ枠外 +50〜200px のドーナツ状エリア
        for (let attempt = 0; attempt < 12; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.hypot(viewW / 2, viewH / 2) + (60 + Math.random() * 140);
            const rx = Math.round(rogueData.playerX + Math.cos(angle) * dist);
            const ry = Math.round(rogueData.playerY + Math.sin(angle) * dist);

            // 外壁内かつゴールから一定距離離れているか確認
            if (rx >= 70 && rx <= MAP_SIZE - 70 && ry >= 70 && ry <= MAP_SIZE - 70) {
                const charData = getRogueEnemyChar(false, rogueData.floor);
                rogueData.enemies.push({
                    id: 'enemy_respawn_' + Date.now(),
                    x: rx,
                    y: ry,
                    baseX: rx,
                    baseY: ry,
                    wanderAngle: Math.random() * Math.PI * 2,
                    wanderTimer: 50,
                    state: 'wander',
                    charData
                });
                break;
            }
        }
        pendingRespawnCount = Math.max(0, pendingRespawnCount - 1);
    }, 2500);
}

// ==========================================
// 9. Canvas レンダリングエンジン (カメラ追従・ミニマップ・コンパス)
// ==========================================

function getCameraOffset(canvas) {
    const halfW = canvas.width / 2;
    const halfH = canvas.height / 2;
    const camX = Math.max(0, Math.min(MAP_SIZE - canvas.width, rogueData.playerX - halfW));
    const camY = Math.max(0, Math.min(MAP_SIZE - canvas.height, rogueData.playerY - halfH));
    return { x: camX, y: camY };
}

export function drawRogueMap() {
    // 互換性エクスポート
    const canvas = document.getElementById('rogue-canvas');
    if (canvas) renderRogueWorld(performance.now());
}

function renderRogueWorld(now) {
    const canvas = document.getElementById('rogue-canvas');
    const container = document.getElementById('rogue-canvas-container');
    if (!canvas || !container) return;

    // コンテナ矩形に合わせた解像度調整
    const rect = container.getBoundingClientRect();
    const targetW = Math.max(300, Math.min(500, Math.floor(rect.width)));
    const targetH = Math.max(300, Math.min(500, Math.floor(rect.height)));
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    const cam = getCameraOffset(canvas);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // 1. 背景グリッド ＆ 自然フィールドタイル描画
    drawFieldBackground(ctx, cam, canvas.width, canvas.height);

    // 2. 探索オブジェクト描画 (宝箱, 泉, 石碑, 商人, ゴール🚪)
    drawExplorationObjects(ctx, now);

    // 3. 敵モンスターシンボル描画 (シャドウ, 浮遊呼吸)
    drawEnemyEntities(ctx, now);

    // 4. 足元ゲートポインター (コンパス矢印)
    drawGoalPointer(ctx, now);

    // 5. オトモ連れ歩き描画 (斜め後ろふんわり浮遊)
    drawOtomoCompanion(ctx, now);

    // 6. プレイヤーアバター描画 (円形アバター, 無敵時点滅)
    drawPlayerAvatar(ctx, now);

    ctx.restore();

    // 7. HUDオーバーレイ描画: 360°レーダーミニマップ (Canvas右上に固定)
    drawRadarMiniMap(ctx, canvas.width, canvas.height);
}

/**
 * フィールド背景・グリッド描画
 */
function drawFieldBackground(ctx, cam, viewW, viewH) {
    // フィールド基底色 (深緑〜ダークストーン)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // 64px タイルグリッド線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const startX = Math.floor(Math.max(0, cam.x) / 64) * 64;
    const endX = Math.min(MAP_SIZE, cam.x + viewW + 64);
    const startY = Math.floor(Math.max(0, cam.y) / 64) * 64;
    const endY = Math.min(MAP_SIZE, cam.y + viewH + 64);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += 64) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += 64) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // 外壁境界線
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, MAP_SIZE - 6, MAP_SIZE - 6);

    // スタート地点サークル
    ctx.fillStyle = 'rgba(52, 152, 219, 0.15)';
    ctx.beginPath();
    ctx.arc(START_POS.x, START_POS.y, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

/**
 * 探索オブジェクト描画
 */
function drawExplorationObjects(ctx, now) {
    // ゴール (🚪 ボス扉)
    const gx = rogueData.goalPos.x;
    const gy = rogueData.goalPos.y;
    const pulse = Math.sin(now / 250) * 4;

    // ゴール光彩
    ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
    ctx.beginPath();
    ctx.arc(gx, gy, 36 + pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚪', gx, gy);

    // 各種オブジェクト
    for (const obj of rogueData.objects) {
        if (obj.collected) continue;

        // 足元シャドウ
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(obj.x, obj.y + 16, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        let icon = '🎁';
        let fontSize = 28;
        if (obj.type === 'fountain') icon = '⛲';
        else if (obj.type === 'monument') icon = '📜';
        else if (obj.type === 'shop') icon = '🛍️';

        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillText(icon, obj.x, obj.y + Math.sin(now / 300 + obj.x) * 2);
    }
}

/**
 * 敵エンティティ描画
 */
function drawEnemyEntities(ctx, now) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const enemy of rogueData.enemies) {
        const floatY = Math.sin(now / 220 + enemy.baseX) * 3;

        // 足元シャドウ
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(enemy.x, enemy.y + 18, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 敵シンボルアイコン (👾)
        ctx.font = '32px sans-serif';
        ctx.fillText('👾', enemy.x, enemy.y + floatY);
    }
}

/**
 * 足元ゲートポインター (コンパス矢印)
 */
function drawGoalPointer(ctx, now) {
    const gx = rogueData.goalPos.x;
    const gy = rogueData.goalPos.y;
    const px = rogueData.playerX;
    const py = rogueData.playerY;

    const angle = Math.atan2(gy - py, gx - px);
    const pointerDist = 34;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);

    // 金色の回転コンパス矢印
    ctx.fillStyle = 'rgba(241, 196, 15, 0.85)';
    ctx.beginPath();
    ctx.moveTo(pointerDist + 12, 0);
    ctx.lineTo(pointerDist, -6);
    ctx.lineTo(pointerDist + 3, 0);
    ctx.lineTo(pointerDist, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

/**
 * オトモ連れ歩き描画
 */
function drawOtomoCompanion(ctx, now) {
    // 過去座標バッファを参照 (約12〜15フレーム前)
    const hist = rogueData.playerHistory;
    let tx = rogueData.playerX - 26;
    let ty = rogueData.playerY + 22;

    if (hist && hist.length >= 10) {
        const target = hist[Math.min(hist.length - 1, 12)];
        tx = target.x - 18;
        ty = target.y + 16;
    }

    const floatY = Math.sin(now / 180) * 4;

    // 足元シャドウ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(tx, ty + 16, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (otomoDrawInfo.type === 'image' && otomoDrawInfo.img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(tx, ty + floatY, 16, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(otomoDrawInfo.img, tx - 16, ty + floatY - 16, 32, 32);
        ctx.restore();

        // 属性グローリング
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty + floatY, 16, 0, Math.PI * 2);
        ctx.stroke();
    } else {
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(otomoDrawInfo.icon || '✏️', tx, ty + floatY);
    }
}

/**
 * プレイヤーアバター描画
 */
function drawPlayerAvatar(ctx, now) {
    const px = rogueData.playerX;
    const py = rogueData.playerY;

    // 無敵時間中の半透明点滅 (100ms周期)
    const isInvincible = (Date.now() < (rogueData.invincibleUntil || 0));
    if (isInvincible && Math.floor(now / 90) % 2 === 0) {
        ctx.globalAlpha = 0.35;
    }

    // 足元シャドウ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(px, py + 18, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // アバター描画 (直径40px = 半径20px)
    if (cachedAvatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, 20, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(cachedAvatarImg, px - 20, py - 20, 40, 40);
        ctx.restore();

        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 20, 0, Math.PI * 2);
        ctx.stroke();
    } else {
        ctx.font = '32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧙', px, py);
    }

    ctx.globalAlpha = 1.0;
}

/**
 * 360°レーダーミニマップ描画 (Canvas右上に固定)
 */
function drawRadarMiniMap(ctx, viewW, viewH) {
    const radarRadius = 40;
    const cx = viewW - radarRadius - 12;
    const cy = radarRadius + 12;
    const scale = (radarRadius * 2) / MAP_SIZE; // 1200px -> 80px

    ctx.save();

    // 半透明背景
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
    ctx.fill();

    // 金色外枠
    ctx.strokeStyle = 'rgba(241, 196, 15, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
    ctx.clip();

    // ゴール (🚪)
    const mgx = cx - radarRadius + rogueData.goalPos.x * scale;
    const mgy = cy - radarRadius + rogueData.goalPos.y * scale;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(mgx, mgy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 敵 (赤点)
    ctx.fillStyle = '#e74c3c';
    for (const e of rogueData.enemies) {
        const mex = cx - radarRadius + e.x * scale;
        const mey = cy - radarRadius + e.y * scale;
        ctx.beginPath();
        ctx.arc(mex, mey, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // 宝箱・オブジェクト (黄色/水色点)
    for (const obj of rogueData.objects) {
        if (obj.collected) continue;
        ctx.fillStyle = (obj.type === 'chest' ? '#38bdf8' : '#eab308');
        const mox = cx - radarRadius + obj.x * scale;
        const moy = cy - radarRadius + obj.y * scale;
        ctx.beginPath();
        ctx.arc(mox, moy, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // プレイヤー自位置 (青白点)
    const mpx = cx - radarRadius + rogueData.playerX * scale;
    const mpy = cy - radarRadius + rogueData.playerY * scale;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mpx, mpy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
}

// ==========================================
// 10. バトル突入＆先制攻撃連携 (triggerRogueBattle)
// ==========================================

export function getRogueEnemyChar(isBoss, floor) {
    let rarity = 'N';
    if (isBoss) {
        if (floor % 100 === 0) rarity = 'UR';
        else if (floor % 50 === 0) rarity = 'SSR';
        else if (floor % 5 === 0) rarity = 'SR';
        else rarity = 'R';
    } else {
        const rand = Math.random();
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

export function triggerRogueBattle(isBoss = false, customEnemyChar = null) {
    rogueData.isBossBattle = isBoss;
    const enemyChar = customEnemyChar || getRogueEnemyChar(isBoss, rogueData.floor) || { id: '1', name: 'スライム', rarity: 'N', value: 1.0 };
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

    // 5Fごとのボス誓約ギミック
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
    gameState.maxHP = calculatedHp;

    // オトモ先制攻撃判定 (ATK または ALL 属性で 15% 削減)
    const passive = getOtomoPassive();
    if (passive.hasAtk) {
        gameState.enemyHP = Math.floor(calculatedHp * 0.85);
        showRogueCutIn("🔥 オトモの先制攻撃！敵HP -15%！");
        addRogueLog("🔥 オトモの先制攻撃が命中！敵HPを15%削った！");
    } else {
        gameState.enemyHP = calculatedHp;
    }

    const charaStats = getCharaStats();
    gameState.maxTime = 10 * charaStats.time;
    if (playData.activeOaths.includes('rapid')) gameState.maxTime *= 0.5;
    gameState.timeLeft = gameState.maxTime;

    runtimeState.isGameActive = false;
    runtimeState.isPaused = false;
    playData.currentSP = 0;
    playData.bonusExp = 0;
    updateSpUI();
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
        if (iconUrl.startsWith('http')) { 
            enemyIcon.innerHTML = renderSafeImg(iconUrl, '👾'); 
        } else { 
            enemyIcon.innerHTML = iconUrl; 
        }
        enemyIcon.classList.remove('shake-anim');
    }

    const enemyBox = document.querySelector('.enemy-visual-box');
    if (enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out');
    const hpFrame = document.querySelector('.enemy-hp-frame');
    if (hpFrame) hpFrame.style.display = '';
    const timerBar = document.getElementById('ui-timer');
    if (timerBar) timerBar.style.width = '100%';
    const timerText = document.getElementById('ui-timer-text');
    if (timerText) timerText.innerText = gameState.maxTime.toFixed(1);

    updateUI();
    startCountdown();
}

// ==========================================
// 11. 中間ショップシステム (EXP属性20%OFF適用)
// ==========================================

export function triggerRogueShop() {
    const shopOverlay = document.getElementById('rogue-shop-overlay');
    if (!shopOverlay) return;
    renderRogueShopContents();
    shopOverlay.classList.remove('hidden');
}

export function closeRogueShop() {
    document.getElementById('rogue-shop-overlay')?.classList.add('hidden');

    // 接触した商人を削除して探索再開
    if (rogueData.currentShopEntity) {
        rogueData.objects = rogueData.objects.filter(obj => obj !== rogueData.currentShopEntity);
        rogueData.currentShopEntity = null;
        addRogueLog("🛍️ 商人は旅立った");
    }
    resumeRogueLoop();
}

export function renderRogueShopContents() {
    const shopXp = document.getElementById('rogue-shop-xp');
    if (shopXp) shopXp.innerText = rogueData.earnedXp;

    const list = document.getElementById('rogue-shop-list');
    if (!list) return;

    const passive = getOtomoPassive();
    const discountRate = passive.hasExp ? 0.8 : 1.0;
    const discountBadge = passive.hasExp ? '<span style="background:#f1c40f; color:#000; padding:2px 6px; border-radius:4px; font-size:0.8em; margin-left:6px;">⚡ EXPオトモ 20%OFF</span>' : '';

    list.innerHTML = `
        <div style="background:rgba(0,0,0,0.05); padding:10px; border-radius:8px; margin-bottom:10px; font-weight:bold; color:#e67e22; text-align:center;">
            🛒 一時探索ショップ (獲得XPを消費) ${discountBadge}
        </div>
    `;

    const rogueItems = [
        { id: 'r_heal', name: 'ライフ上限UP薬', basePrice: 30000, desc: '最大ライフ枠と現在ライフを+1', icon: '❤️', action: 'buyRogueHeal' },
        { id: 'r_atk', name: '攻撃の秘薬', basePrice: 20000, desc: '攻撃バフ倍率を +0.5 上昇', icon: '⚔️', action: 'buyRogueAtk' },
        { id: 'r_step', name: '韋駄天の靴', basePrice: 30000, desc: '残り歩数上限を +10 追加する', icon: '👟', action: 'buyRogueSteps' }
    ];

    rogueItems.forEach(item => {
        const finalPrice = Math.floor(item.basePrice * discountRate);
        const canBuy = !rogueData.shopBought && (rogueData.earnedXp >= finalPrice);
        const btnText = rogueData.shopBought ? '品切れ' : `⬇️ ${finalPrice.toLocaleString()}XP`;
        list.innerHTML += `
            <div class="shop-item">
                <div class="shop-icon">${item.icon}</div>
                <div class="shop-info">
                    <div class="shop-name">${item.name}</div>
                    <div class="shop-desc">${item.desc}</div>
                </div>
                <div class="shop-right">
                    <button class="shop-buy-btn" ${canBuy ? '' : 'disabled'} onclick="${item.action}(${finalPrice})">${btnText}</button>
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

// ==========================================
// 12. UI表示更新 & 探索終了 (exitRogueSystem)
// ==========================================

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

    // 歩数スタミナプログレスバー更新
    const bar = document.getElementById('rogue-stamina-fill');
    const text = document.getElementById('rogue-stamina-text');
    if (bar && text) {
        const pct = Math.max(0, Math.min(100, (rogueData.steps / (rogueData.maxSteps || 50)) * 100));
        bar.style.width = pct + '%';
        text.innerText = `歩数: ${rogueData.steps} / ${rogueData.maxSteps}`;
        if (pct > 50) bar.style.backgroundColor = '#2ecc71';
        else if (pct > 25) bar.style.backgroundColor = '#e67e22';
        else bar.style.backgroundColor = '#e74c3c';
    }
}

export function escapeRogueConfirm() {
    stopRogueLoop();
    showConfirm("探索を中断して拠点に戻りますか？\n（獲得した残りの一時XPは引き継がれます）").then(yes => {
        if (yes) {
            exitRogueSystem(true);
        } else {
            resumeRogueLoop();
        }
    });
}

export function exitRogueSystem(success) {
    stopRogueLoop();
    rogueData.active = false;
    gameState.xp += (rogueData.earnedXp || 0);
    saveGame();
    if (cloudSync) {
        cloudSync.requestSync();
    }

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

export function showRogueCutIn(t) {
    const container = document.getElementById('rogue-canvas-container');
    if (!container) return;
    const d = document.createElement('div');
    d.className = 'rogue-cutin';
    d.style.position = 'absolute';
    d.style.top = '25px';
    d.style.left = '50%';
    d.style.transform = 'translateX(-50%)';
    d.style.zIndex = '100';
    d.style.pointerEvents = 'none';
    d.style.whiteSpace = 'nowrap';
    d.style.background = 'rgba(0, 0, 0, 0.75)';
    d.style.color = '#f1c40f';
    d.style.padding = '6px 14px';
    d.style.borderRadius = '20px';
    d.style.fontWeight = 'bold';
    d.style.fontSize = '0.9em';
    d.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    d.innerText = t;
    container.appendChild(d);
    setTimeout(() => d.remove(), 1200);
}

// 後方互換性エクスポート (main.js / 外部参照対応)
export function processRogueTile(tile) {}
export function triggerRogueRNGEvent() {}
