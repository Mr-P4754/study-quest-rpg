/**
 * ==========================================
 * js/farm-engine.js
 * キャラクターファーム（牧場）システムエンジン
 * ==========================================
 */

import {
    gameState,
    rawData,
    saveGame,
    FARM_DEFAULT_SLOTS,
    FARM_MAX_SLOTS,
    RARITY_CAPS,
    EXP_REQ
} from './state.js?v=10.5.0';

import {
    playSE,
    renderSafeImg
} from './utils.js?v=10.5.0';

import { GRADE_DEPTH_MAP } from './studyel-engine.js?v=10.5.0';
import { showAlert, showConfirm } from './ui-manager.js?v=10.5.0';

// ----------------------------------------------------
// 内部状態管理
// ----------------------------------------------------
let selectedSlotForAssignment = null; // キャラ預け入れ対象のスロットインデックス (0〜9)

// キャラクタータップ時のリアクション台詞リスト
const FARM_REACTION_MESSAGES = [
    '今日もたくさん勉強しようね！🌿',
    'なでてくれてありがとう♪💖',
    'すくすく育ってるよ！✨',
    'クイズの正解、楽しみに待ってるよ！📖',
    '牧場のおひさま、ぽかぽかで気持ちいい〜☀️',
    'いつも応援してるよ！がんばって！✊',
    '経験値をもらって、どんどん強くなるぞー！🔥'
];

/**
 * 学年深度係数を取得
 * @param {string} grade 学年文字列（例: '小3', '中1', '高校' 等）
 * @returns {number} 学年係数 (0.65 〜 1.85, 未知は 1.00)
 */
export function getFarmGradeWeight(grade) {
    if (!grade) return 1.00;
    const str = String(grade).trim();
    for (const k in GRADE_DEPTH_MAP) {
        if (str.includes(k)) return GRADE_DEPTH_MAP[k];
    }
    return 1.00;
}

/**
 * クイズ正解時のファームEXP加算処理（リアルタイムバックグラウンド分配）
 * @param {string|object} gradeOrQ 学年文字列または問題オブジェクト
 */
export function addFarmExp(gradeOrQ) {
    if (!gameState.farm) {
        gameState.farm = {
            unlockedSlots: FARM_DEFAULT_SLOTS,
            slots: Array(FARM_MAX_SLOTS).fill(null),
            totalCareCount: 0
        };
    }

    // 学年の判定
    let gradeStr = '';
    if (typeof gradeOrQ === 'string') {
        gradeStr = gradeOrQ;
    } else if (gradeOrQ && typeof gradeOrQ === 'object') {
        gradeStr = gradeOrQ.grade || '';
    }

    const weight = getFarmGradeWeight(gradeStr);
    const gainedExp = Math.round(1.0 * weight * 100) / 100;

    let hasUpdated = false;
    const unlocked = Number(gameState.farm.unlockedSlots) || FARM_DEFAULT_SLOTS;

    // 解放枠内の配置キャラクターへ経験値を分配
    for (let i = 0; i < unlocked; i++) {
        const charId = gameState.farm.slots[i];
        if (!charId) continue;

        const inv = gameState.charaInventory[charId];
        if (!inv) continue;

        const master = rawData.characters ? rawData.characters.find(c => String(c.id) === String(charId)) : null;
        const currentR = inv.currentRarity || (master ? master.rarity : 'N');
        const maxLv = RARITY_CAPS[currentR] || 10;

        inv.exp = Math.round(((Number(inv.exp) || 0) + gainedExp) * 100) / 100;

        // レベルアップおよびレアリティ上限到達後のストック還元処理
        while (inv.exp >= EXP_REQ) {
            if (inv.level < maxLv) {
                inv.exp -= EXP_REQ;
                inv.level++;
            } else {
                // レベル上限到達後: レベルは維持し、余剰EXP 100 ごとに在庫ストック数 (count) を +1 還元
                inv.exp -= EXP_REQ;
                inv.count = (Number(inv.count) || 0) + 1;
            }
        }
        inv.exp = Math.round(inv.exp * 100) / 100;
        hasUpdated = true;
    }

    if (hasUpdated) {
        gameState.farm.totalCareCount = (Number(gameState.farm.totalCareCount) || 0) + 1;
        saveGame();
    }
}

/**
 * ファーム画面を開く
 */
export function openFarmMenu() {
    // カテゴリーメニューを閉じる
    document.getElementById('cat-gacha-overlay')?.classList.add('hidden');

    const overlay = document.getElementById('farm-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        renderFarmUI();
        playSE('select');
    }
}

/**
 * ファーム画面を閉じる
 */
export function closeFarmMenu() {
    document.getElementById('farm-overlay')?.classList.add('hidden');
    // 元のカテゴリーメニューに戻る
    document.getElementById('cat-gacha-overlay')?.classList.remove('hidden');
    playSE('cancel');
}

/**
 * ファーム画面全体の描画
 */
export function renderFarmUI() {
    if (!gameState.farm) {
        gameState.farm = {
            unlockedSlots: FARM_DEFAULT_SLOTS,
            slots: Array(FARM_MAX_SLOTS).fill(null),
            totalCareCount: 0
        };
    }

    renderFarmHeader();
    renderFarmPasture();
    renderFarmSlots();
}

/**
 * ファームヘッダー・ステータスバーの描画
 */
function renderFarmHeader() {
    const unlocked = Number(gameState.farm.unlockedSlots) || FARM_DEFAULT_SLOTS;
    const assignedCount = gameState.farm.slots.slice(0, unlocked).filter(Boolean).length;

    const infoEl = document.getElementById('farm-status-info');
    if (infoEl) {
        infoEl.innerHTML = `
            <span class="farm-stat-badge">🏡 解放枠: <b>${unlocked} / ${FARM_MAX_SLOTS}</b></span>
            <span class="farm-stat-badge">🐾 預け中: <b>${assignedCount}体</b></span>
        `;
    }
}

/**
 * 牧場ビジュアルエリア（上部草原・浮遊待機アニメーション）の描画
 */
function renderFarmPasture() {
    const pastureEl = document.getElementById('farm-pasture-area');
    if (!pastureEl) return;

    pastureEl.innerHTML = '';

    const unlocked = Number(gameState.farm.unlockedSlots) || FARM_DEFAULT_SLOTS;
    const activeCharas = [];

    for (let i = 0; i < unlocked; i++) {
        const charId = gameState.farm.slots[i];
        if (!charId) continue;
        const master = rawData.characters ? rawData.characters.find(c => String(c.id) === String(charId)) : null;
        if (master) {
            activeCharas.push({ charId, master, slotIndex: i });
        }
    }

    if (activeCharas.length === 0) {
        pastureEl.innerHTML = `
            <div class="farm-empty-pasture">
                <div class="farm-empty-icon">🌿</div>
                <div class="farm-empty-text">スロットにキャラクターを預けると、<br>ここに集まってのんびり過ごします🐾</div>
            </div>
        `;
        return;
    }

    // 草原の装飾要素（花や草）
    const decoEl = document.createElement('div');
    decoEl.className = 'farm-pasture-decorations';
    decoEl.innerHTML = `
        <span class="farm-flower" style="left: 12%; bottom: 15%;">🌸</span>
        <span class="farm-flower" style="left: 38%; bottom: 25%;">🌼</span>
        <span class="farm-flower" style="left: 70%; bottom: 12%;">🌷</span>
        <span class="farm-flower" style="left: 88%; bottom: 22%;">🍀</span>
    `;
    pastureEl.appendChild(decoEl);

    // キャラクターの配置
    activeCharas.forEach((item, idx) => {
        const sprite = document.createElement('div');
        sprite.className = 'farm-chara-sprite';
        sprite.setAttribute('data-chara-id', item.charId);

        // 自然な散らばり配置（左右均等分散＋上下ランダム）
        const total = activeCharas.length;
        const colWidth = 85 / Math.max(1, total);
        const posX = 8 + (idx * colWidth) + (Math.sin(idx * 2.5) * 3);
        const posY = 15 + ((idx % 3) * 20) + (Math.cos(idx * 1.8) * 8);

        sprite.style.left = `${Math.min(88, Math.max(5, posX))}%`;
        sprite.style.bottom = `${Math.min(70, Math.max(8, posY))}%`;
        sprite.style.animationDelay = `${(idx * 0.35).toFixed(2)}s`;

        const imgHtml = renderSafeImg(item.master.imageUrl, '🐾', '', 'width:56px;height:56px;border-radius:50%;object-fit:cover;');
        sprite.innerHTML = `
            <div class="farm-chara-avatar">
                ${imgHtml}
                <div class="farm-chara-shadow"></div>
            </div>
            <div class="farm-chara-name">${item.master.name}</div>
        `;

        // タップ時のハート演出 & リアクション吹き出し
        sprite.addEventListener('click', (e) => {
            e.stopPropagation();
            onFarmCharaTap(sprite, item.master);
        });

        pastureEl.appendChild(sprite);
    });
}

/**
 * 牧場キャラクタータップ時のハート＆吹き出し演出
 */
function onFarmCharaTap(spriteEl, master) {
    playSE('select');

    // 💖 ハートパーティクルの生成
    for (let i = 0; i < 3; i++) {
        const heart = document.createElement('div');
        heart.className = 'farm-heart-particle';
        heart.innerText = ['💖', '💕', '✨'][i];
        heart.style.left = `${30 + (i * 15) + (Math.random() * 10 - 5)}%`;
        heart.style.bottom = `80%`;
        heart.style.animationDelay = `${i * 0.1}s`;
        spriteEl.appendChild(heart);

        setTimeout(() => heart.remove(), 1200);
    }

    // 既存の吹き出しがあれば除去
    const existingBubble = spriteEl.querySelector('.farm-speech-bubble');
    if (existingBubble) existingBubble.remove();

    // 吹き出しの作成
    const bubble = document.createElement('div');
    bubble.className = 'farm-speech-bubble';
    const msg = FARM_REACTION_MESSAGES[Math.floor(Math.random() * FARM_REACTION_MESSAGES.length)];
    bubble.innerText = msg;
    spriteEl.appendChild(bubble);

    setTimeout(() => {
        if (bubble.parentNode) bubble.remove();
    }, 2200);
}

/**
 * スロット一覧エリア（下部カードリスト）の描画
 */
function renderFarmSlots() {
    const gridEl = document.getElementById('farm-slots-grid');
    if (!gridEl) return;

    gridEl.innerHTML = '';

    const unlocked = Number(gameState.farm.unlockedSlots) || FARM_DEFAULT_SLOTS;

    for (let i = 0; i < FARM_MAX_SLOTS; i++) {
        const card = document.createElement('div');
        const charId = gameState.farm.slots[i];

        if (i >= unlocked) {
            // 未解放枠（ロック中）
            card.className = 'farm-slot-card farm-slot-locked';
            card.innerHTML = `
                <div class="farm-slot-header">
                    <span class="farm-slot-number">スロット ${i + 1}</span>
                    <span class="farm-lock-tag">🔒 ロック中</span>
                </div>
                <div class="farm-slot-body text-center">
                    <div class="farm-lock-icon">🔒</div>
                    <div class="farm-lock-desc">ショップの「学習アイテム」で<br>「ファーム拡張許可証」を購入すると解放されます</div>
                </div>
            `;
        } else if (!charId) {
            // 解放済み・空き枠
            card.className = 'farm-slot-card farm-slot-empty';
            card.innerHTML = `
                <div class="farm-slot-header">
                    <span class="farm-slot-number">スロット ${i + 1}</span>
                    <span class="farm-ready-tag">✨ 解放済み</span>
                </div>
                <div class="farm-slot-body text-center">
                    <button class="farm-assign-btn" onclick="openFarmSelectModal(${i})">
                        <span class="plus-icon">➕</span>
                        <span>キャラを預ける</span>
                    </button>
                    <div class="farm-empty-hint">所持キャラクターから預けて育成！</div>
                </div>
            `;
        } else {
            // 配置済み枠
            const inv = gameState.charaInventory[charId];
            const master = rawData.characters ? rawData.characters.find(c => String(c.id) === String(charId)) : null;

            if (!inv || !master) {
                // 不整合データの安全復旧
                gameState.farm.slots[i] = null;
                saveGame();
                renderFarmSlots();
                return;
            }

            const currentR = inv.currentRarity || master.rarity;
            const maxLv = RARITY_CAPS[currentR] || 10;
            const isMaxLv = inv.level >= maxLv;
            const expProgress = isMaxLv ? 100 : Math.min(100, Math.floor(((Number(inv.exp) || 0) / EXP_REQ) * 100));
            const expText = isMaxLv ? 'MAX (余剰EXPでストック還元)' : `${(Number(inv.exp) || 0).toFixed(1)} / ${EXP_REQ}`;

            card.className = 'farm-slot-card farm-slot-active';
            const imgHtml = renderSafeImg(master.imageUrl, '🐾', '', 'width:56px;height:56px;border-radius:10px;object-fit:cover;');

            card.innerHTML = `
                <div class="farm-slot-header">
                    <span class="farm-slot-number">スロット ${i + 1}</span>
                    <span class="farm-rarity-badge rarity-${currentR}">${currentR}</span>
                </div>
                <div class="farm-slot-chara-row">
                    <div class="farm-chara-img-box">${imgHtml}</div>
                    <div class="farm-chara-meta">
                        <div class="farm-chara-title">${master.name}</div>
                        <div class="farm-chara-level-row">
                            <span class="farm-lv-text ${isMaxLv ? 'text-gold font-bold' : ''}">Lv.${inv.level} / ${maxLv}</span>
                            <span class="farm-stock-text">📦 余剰ストック: <b>${inv.count || 0}</b></span>
                        </div>
                        <div class="farm-exp-bar-wrap">
                            <div class="farm-exp-bar" style="width: ${expProgress}%;"></div>
                        </div>
                        <div class="farm-exp-subtext">${expText}</div>
                    </div>
                </div>
                <div class="farm-slot-actions">
                    <button class="farm-action-btn btn-swap" onclick="openFarmSelectModal(${i})">🔄 交代</button>
                    <button class="farm-action-btn btn-remove" onclick="removeFarmSlot(${i})">❌ 外す</button>
                </div>
            `;
        }

        gridEl.appendChild(card);
    }
}

/**
 * キャラクター預け入れモーダルを開く
 * @param {number} slotIndex 対象スロットインデックス (0〜9)
 */
export function openFarmSelectModal(slotIndex) {
    selectedSlotForAssignment = slotIndex;
    const modal = document.getElementById('farm-select-overlay');
    if (modal) {
        modal.classList.remove('hidden');
        renderFarmSelectModal();
        playSE('select');
    }
}

/**
 * キャラクター預け入れモーダルを閉じる
 */
export function closeFarmSelectModal() {
    selectedSlotForAssignment = null;
    document.getElementById('farm-select-overlay')?.classList.add('hidden');
    playSE('cancel');
}

/**
 * キャラクター選択リストの描画
 */
function renderFarmSelectModal() {
    const listEl = document.getElementById('farm-select-chara-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    const slotTitleEl = document.getElementById('farm-select-slot-title');
    if (slotTitleEl && selectedSlotForAssignment !== null) {
        slotTitleEl.innerText = `スロット ${selectedSlotForAssignment + 1} に預けるキャラを選択`;
    }

    if (!rawData.characters) return;

    // 現在ファームに配置済みのキャラIDリスト（重複配置防止用）
    const unlocked = Number(gameState.farm.unlockedSlots) || FARM_DEFAULT_SLOTS;
    const currentAssigned = gameState.farm.slots.slice(0, unlocked).filter(Boolean).map(String);

    // 所持しているキャラクターのみフィルタリング
    const ownedCharas = rawData.characters.filter(c => {
        const inv = gameState.charaInventory[c.id];
        return inv && inv.level >= 1;
    });

    if (ownedCharas.length === 0) {
        listEl.innerHTML = `<div class="p-20 text-center text-gray">預けられるキャラクターがいません。</div>`;
        return;
    }

    // レアリティ順にソート（UR -> SSR -> SR -> R -> N）
    const rarityRank = { 'UR': 5, 'SSR': 4, 'SR': 3, 'R': 2, 'N': 1 };
    ownedCharas.sort((a, b) => {
        const invA = gameState.charaInventory[a.id];
        const invB = gameState.charaInventory[b.id];
        const rA = invA?.currentRarity || a.rarity;
        const rB = invB?.currentRarity || b.rarity;
        const rankDiff = (rarityRank[rB] || 0) - (rarityRank[rA] || 0);
        if (rankDiff !== 0) return rankDiff;
        return Number(b.id) - Number(a.id);
    });

    ownedCharas.forEach(c => {
        const inv = gameState.charaInventory[c.id];
        const currentR = inv.currentRarity || c.rarity;
        const maxLv = RARITY_CAPS[currentR] || 10;
        const isAssigned = currentAssigned.includes(String(c.id));
        const isCurrentSlot = String(gameState.farm.slots[selectedSlotForAssignment]) === String(c.id);

        const card = document.createElement('div');
        card.className = `farm-chara-choice-card ${isAssigned ? 'assigned' : ''} ${isCurrentSlot ? 'current' : ''}`;

        const imgHtml = renderSafeImg(c.imageUrl, '🐾', '', 'width:48px;height:48px;border-radius:8px;object-fit:cover;');

        card.innerHTML = `
            <div class="farm-choice-visual">${imgHtml}</div>
            <div class="farm-choice-info">
                <div class="farm-choice-name-row">
                    <span class="rarity-${currentR} font-bold">${currentR}</span>
                    <span class="farm-choice-name">${c.name}</span>
                </div>
                <div class="farm-choice-meta">
                    <span>Lv.${inv.level} / ${maxLv}</span>
                    <span>所持数: ${inv.count}</span>
                </div>
            </div>
            <div class="farm-choice-status">
                ${isCurrentSlot 
                    ? `<span class="badge-current">配置中</span>`
                    : isAssigned 
                        ? `<span class="badge-assigned">他スロット配置中</span>`
                        : `<button class="farm-select-btn" onclick="assignFarmSlot(${selectedSlotForAssignment}, '${c.id}')">預ける</button>`}
            </div>
        `;

        if (!isAssigned) {
            card.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    assignFarmSlot(selectedSlotForAssignment, c.id);
                }
            };
        }

        listEl.appendChild(card);
    });
}

/**
 * キャラクターをファームスロットへ配置
 * @param {number} slotIndex スロットインデックス (0〜9)
 * @param {string} charId キャラクターID
 */
export function assignFarmSlot(slotIndex, charId) {
    if (slotIndex === null || slotIndex === undefined || !charId) return;

    const unlocked = Number(gameState.farm.unlockedSlots) || FARM_DEFAULT_SLOTS;
    if (slotIndex >= unlocked) {
        return showAlert('このスロットはまだ解放されていません。');
    }

    // 重複配置の防止ガード
    for (let i = 0; i < unlocked; i++) {
        if (i !== slotIndex && String(gameState.farm.slots[i]) === String(charId)) {
            return showAlert('このキャラクターは既に他のスロットに配置されています。');
        }
    }

    gameState.farm.slots[slotIndex] = String(charId);
    saveGame();

    closeFarmSelectModal();
    renderFarmUI();
    playSE('start');
}

/**
 * ファームスロットからキャラクターを外す
 * @param {number} slotIndex スロットインデックス (0〜9)
 */
export async function removeFarmSlot(slotIndex) {
    if (slotIndex === null || slotIndex === undefined) return;

    const charId = gameState.farm.slots[slotIndex];
    if (!charId) return;

    const master = rawData.characters ? rawData.characters.find(c => String(c.id) === String(charId)) : null;
    const charaName = master ? master.name : 'このキャラクター';

    if (!(await showConfirm(`【確認】\n${charaName} をファームから外しますか？`))) {
        return;
    }

    gameState.farm.slots[slotIndex] = null;
    saveGame();

    renderFarmUI();
    playSE('cancel');
}

/**
 * ファームの遊び方ヘルプモーダルを開く
 */
export function openFarmHelp() {
    playSE('select');
    const modal = document.getElementById('farm-help-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * ファームヘルプモーダルを閉じる
 */
export function closeFarmHelp() {
    playSE('cancel');
    document.getElementById('farm-help-modal')?.classList.add('hidden');
}
