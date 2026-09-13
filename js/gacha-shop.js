// ==========================================
// js/gacha-shop.js (ガチャ・図鑑・ミキサー・ショップ・実績)
// ==========================================

import {
    gameState,
    rawData,
    dailyMissions,
    RARITY_CAPS,
    EVO_COST_XP,
    EVO_STOCK_REQ,
    REBORN_COST_XP,
    RARITY_ORDER,
    LV_BONUS_RATE,
    EXP_REQ,
    MAT_EXP,
    SELL_PRICES,
    LOGIN_BONUS_EXP,
    MAX_ITEM_LEVEL,
    MASTER_COUNT,
    TITLES,
    MISSIONS,
    MISSION_ALL_CLEAR,
    FARM_DEFAULT_SLOTS,
    FARM_MAX_SLOTS,
    saveGame
} from './state.js?v=10.5.0';

import {
    getDisplayName,
    playSE,
    renderSafeImg
} from './utils.js?v=10.5.0';

import {
    showAlert,
    showConfirm,
    updateTitleInfo,
    returnToCurrentCategory,
    closeAllCategoryModals,
    updateCategoryBadges
} from './ui-manager.js?v=10.5.0';

import {
    generateAvatarSvg,
    isAvatarPartUnlocked,
    AVATAR_PARTS_DEF
} from './avatar-engine.js?v=10.5.0';

let selectedMaterials = {};
let viewingCharaId = null;
let currentShopTab = 'item';
let currentSubShopTab = 'buy';
let zukanSortMode = 'default';

// ミキサー合成の状態管理
let currentMixerRarity = 'N';
let selectedMixerMaterials = {}; // { [charId]: number }

/**
 * 全画面のXP表示を一括同期するヘルパー関数
 */
export function updateAllXpDisplays() {
    const xpStr = Number(gameState.xp).toLocaleString();
    const ids = ['gacha-xp', 'gacha-menu-xp', 'zukan-xp', 'mixer-xp', 'shop-xp', 'title-xp'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = xpStr;
    });
    updateTitleInfo();
}

// ==========================================
// ガチャ・図鑑・ミキサー 画面制御
// ==========================================

/** ガチャ専用メニューを開く */
export function openGachaMenu() {
    closeAllCategoryModals();
    document.getElementById('gacha-menu-overlay')?.classList.remove('hidden');
    document.getElementById('zukan-overlay')?.classList.add('hidden');
    document.getElementById('mixer-overlay')?.classList.add('hidden');
    updateAllXpDisplays();
}

/** ガチャ専用メニューを閉じる */
export function closeGachaMenu() {
    document.getElementById('gacha-menu-overlay')?.classList.add('hidden');
    returnToCurrentCategory();
    updateTitleInfo();
}

/** 図鑑専用メニューを開く */
export function openZukanMenu() {
    closeAllCategoryModals();
    document.getElementById('zukan-overlay')?.classList.remove('hidden');
    document.getElementById('gacha-menu-overlay')?.classList.add('hidden');
    document.getElementById('mixer-overlay')?.classList.add('hidden');
    switchZukanTab('chara');
    updateAllXpDisplays();
}

/** 図鑑専用メニューを閉じる */
export function closeZukanMenu() {
    document.getElementById('zukan-overlay')?.classList.add('hidden');
    returnToCurrentCategory();
    updateTitleInfo();
}

/** ミキサー合成メニューを開く */
export function openMixerMenu() {
    closeAllCategoryModals();
    document.getElementById('mixer-overlay')?.classList.remove('hidden');
    document.getElementById('gacha-menu-overlay')?.classList.add('hidden');
    document.getElementById('zukan-overlay')?.classList.add('hidden');
    selectedMixerMaterials = {};
    switchMixerRarity(currentMixerRarity || 'N');
    updateAllXpDisplays();
}

/** ミキサー合成メニューを閉じる */
export function closeMixerMenu() {
    document.getElementById('mixer-overlay')?.classList.add('hidden');
    returnToCurrentCategory();
    updateTitleInfo();
}

// 既存コードとの後方互換エイリアス
export function openGacha() {
    openGachaMenu();
}

export function closeGacha() {
    closeGachaMenu();
}

export async function rollGacha(times) {
    const cost = times === 10 ? 30000 : 3000;
    if (gameState.xp < cost) return alert("XPが足りません！");
    if (!(await showConfirm(`${cost} XPを消費してガチャを${times}回引きますか？`))) return;
    gameState.xp -= cost;
    executeGacha(times, null);
}

export async function rollGuaranteedTenGacha(targetRarity, cost) {
    if (gameState.xp < cost) return alert("XPが足りません！");
    if (!(await showConfirm(`${cost} XPを消費して【${targetRarity} 1体確定10連】を引きますか？`))) return;
    gameState.xp -= cost;
    executeGacha(10, targetRarity);
}

export function executeGacha(times, guaranteedRarity) {
    if (!rawData.characters || rawData.characters.length === 0) return alert("キャラデータがありません");
    const pool = { 'N': [], 'R': [], 'SR': [], 'SSR': [], 'UR': [] };
    rawData.characters.forEach(c => { if(pool[c.rarity]) pool[c.rarity].push(c); });
    
    const getRandChar = (targetRarity) => {
        let rPool = pool[targetRarity];
        if (!rPool || rPool.length === 0) {
            const available = Object.keys(pool).filter(k => pool[k].length > 0);
            rPool = pool[available[available.length - 1]];
        }
        return rPool[Math.floor(Math.random() * rPool.length)];
    };

    const drawSingle = (isGuaranteed) => {
        if (isGuaranteed && guaranteedRarity) return getRandChar(guaranteedRarity);
        const rand = Math.random();
        // N: 55% / R: 30% / SR: 11% / SSR: 3.5% / UR: 0.5%
        if (rand < 0.005) return getRandChar('UR');
        if (rand < 0.040) return getRandChar('SSR');
        if (rand < 0.150) return getRandChar('SR');
        if (rand < 0.450) return getRandChar('R');
        return getRandChar('N');
    };

    const results = [];
    for (let i = 0; i < times; i++) {
        const isGuaranteed = (times === 10 && i === 9 && guaranteedRarity);
        const c = drawSingle(isGuaranteed);
        results.push(c);
        
        if (!gameState.charaInventory[c.id]) {
            gameState.charaInventory[c.id] = { level: 1, count: 1, exp: 0, currentRarity: c.rarity };
        } else {
            if (typeof gameState.charaInventory[c.id].level !== 'number' || gameState.charaInventory[c.id].level < 1) {
                gameState.charaInventory[c.id].level = 1;
            }
            gameState.charaInventory[c.id].count = (gameState.charaInventory[c.id].count || 0) + 1;
        }
    }
    
    playSE('win');
    if(typeof updateMissionProgress === 'function') updateMissionProgress('gacha', 1);
    saveGame();
    updateTitleInfo();
    showGachaResult(results);
}

export function showGachaResult(charas) {
    const container = document.getElementById('gr-container');
    if (!container) return;
    if (charas.length === 1) {
        const c = charas[0];
        let imgTag = renderSafeImg(c.imageUrl, '📦', '', 'width:100px;height:100px;object-fit:contain;margin:10px auto;display:block;');
        container.innerHTML = `
            <div class="gacha-result-card">
                <div class="rarity-${c.rarity}" style="font-size:1.5em; font-weight:bold;">${c.rarity}</div>
                ${imgTag}
                <div style="font-size:1.2em; font-weight:bold; color:#2c3e50;">${c.name}</div>
                <div style="font-size:0.85em; color:#7f8c8d; margin-top:5px;">${c.desc || ''}</div>
            </div>
        `;
    } else {
        let gridHtml = `<div class="gr-grid">`;
        charas.forEach((c, index) => {
            let imgTag = renderSafeImg(c.imageUrl, '📦', 'gr-mini-img');
            const isLast = (index === 9);
            const extraStyle = isLast ? 'border: 2px solid #f1c40f; background: #fffbe6;' : '';
            gridHtml += `
                <div class="gr-mini-card" style="${extraStyle}">
                    <div class="rarity-${c.rarity}" style="font-size:0.8em; font-weight:bold;">${c.rarity}</div>
                    ${imgTag}
                    <div style="font-size:0.75em; font-weight:bold; color:#2c3e50; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${c.name}</div>
                </div>
            `;
        });
        gridHtml += `</div>`;
        container.innerHTML = gridHtml;
    }
    document.getElementById('gacha-result-overlay')?.classList.remove('hidden');
    renderZukan();
    updateAllXpDisplays();
    checkTitles();
}

/**
 * 持ち物ガチャ（1回 2,000 XP / 10連 20,000 XP）
 */
export async function rollHeldItemGacha(times) {
    const cost = times === 10 ? 20000 : 2000;
    if (gameState.xp < cost) return alert("XPが足りません！");
    if (!(await showConfirm(`${cost.toLocaleString()} XPを消費して持ち物ガチャを${times}回引きますか？`))) return;
    gameState.xp -= cost;
    executeHeldItemGacha(times);
}

/**
 * 持ち物ガチャの抽選実行ロジック
 */
export function executeHeldItemGacha(times) {
    if (!rawData.heldItems || rawData.heldItems.length === 0) return alert("持ち物データがありません");
    const pool = { 'N': [], 'R': [], 'SR': [], 'SSR': [], 'UR': [] };
    rawData.heldItems.forEach(item => {
        const r = item.rarity || 'N';
        if (pool[r]) pool[r].push(item);
        else pool['N'].push(item);
    });

    const getRandItem = (targetRarity) => {
        let rPool = pool[targetRarity];
        if (!rPool || rPool.length === 0) {
            const available = Object.keys(pool).filter(k => pool[k].length > 0);
            if (available.length === 0) return rawData.heldItems[0];
            rPool = pool[available[available.length - 1]];
        }
        return rPool[Math.floor(Math.random() * rPool.length)];
    };

    const drawSingle = () => {
        const rand = Math.random();
        // N: 50% / R: 30% / SR: 14% / SSR: 5% / UR: 1%
        if (rand < 0.01) return getRandItem('UR');
        if (rand < 0.06) return getRandItem('SSR');
        if (rand < 0.20) return getRandItem('SR');
        if (rand < 0.50) return getRandItem('R');
        return getRandItem('N');
    };

    if (!gameState.heldItemInventory) gameState.heldItemInventory = {};

    const results = [];
    for (let i = 0; i < times; i++) {
        const item = drawSingle();
        results.push(item);

        const itemId = String(item.id);
        if (!gameState.heldItemInventory[itemId]) {
            gameState.heldItemInventory[itemId] = { count: 1 };
        } else {
            gameState.heldItemInventory[itemId].count = (gameState.heldItemInventory[itemId].count || 0) + 1;
        }
    }

    playSE('win');
    if (typeof updateMissionProgress === 'function') updateMissionProgress('gacha', 1);
    saveGame();
    updateAllXpDisplays();
    showHeldItemGachaResult(results);
}

/**
 * 持ち物ガチャの結果モーダル表示
 */
export function showHeldItemGachaResult(items) {
    const container = document.getElementById('gr-container');
    if (!container) return;
    if (items.length === 1) {
        const item = items[0];
        let imgTag = renderSafeImg(item.imageUrl, '🧰', '', 'width:100px;height:100px;object-fit:contain;margin:10px auto;display:block;');
        let valText = '';
        if (item.value && Number(item.value) !== 1.0) {
            const diff = Math.round((Number(item.value) - 1.0) * 100);
            valText = `${item.type || 'ATK'} ${diff >= 0 ? '+' : ''}${diff}%`;
        }
        container.innerHTML = `
            <div class="gacha-result-card">
                <div class="rarity-${item.rarity || 'N'}" style="font-size:1.5em; font-weight:bold;">${item.rarity || 'N'}</div>
                ${imgTag}
                <div style="font-size:1.2em; font-weight:bold; color:#2c3e50;">${item.name}</div>
                ${valText ? `<div style="font-size:0.9em; font-weight:bold; color:#2563eb; margin-top:4px;">${valText}</div>` : ''}
                ${item.special ? `<div style="font-size:0.85em; font-weight:bold; color:#d97706; margin-top:2px;">✨ ${item.special}</div>` : ''}
                <div style="font-size:0.85em; color:#7f8c8d; margin-top:5px;">${item.desc || ''}</div>
                <div style="font-size:0.8em; color:#16a34a; font-weight:bold; margin-top:8px;">所持数: ${gameState.heldItemInventory[item.id]?.count || 1}個</div>
            </div>
        `;
    } else {
        let gridHtml = `<div class="gr-grid">`;
        items.forEach((item, index) => {
            let imgTag = renderSafeImg(item.imageUrl, '🧰', 'gr-mini-img');
            const isLast = (index === 9);
            const extraStyle = isLast ? 'border: 2px solid #f1c40f; background: #fffbe6;' : '';
            gridHtml += `
                <div class="gr-mini-card" style="${extraStyle}">
                    <div class="rarity-${item.rarity || 'N'}" style="font-size:0.8em; font-weight:bold;">${item.rarity || 'N'}</div>
                    ${imgTag}
                    <div style="font-size:0.75em; font-weight:bold; color:#2c3e50; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${item.name}</div>
                    <div style="font-size:0.7em; color:#64748b;">所持: ${gameState.heldItemInventory[item.id]?.count || 1}個</div>
                </div>
            `;
        });
        gridHtml += `</div>`;
        container.innerHTML = gridHtml;
    }
    document.getElementById('gacha-result-overlay')?.classList.remove('hidden');
    if (typeof renderHeldItemZukan === 'function') renderHeldItemZukan();
    updateAllXpDisplays();
    checkTitles();
}

export function closeGachaResult() { 
    document.getElementById('gacha-result-overlay')?.classList.add('hidden'); 
}

export function renderZukan() { 
    const g = document.getElementById('zukan-grid'); 
    if(!g) return; 
    g.innerHTML = ''; 
    if(!rawData.characters) return;
    const list = [...rawData.characters];
    list.sort((a, b) => {
        const invA = gameState.charaInventory[a.id]; 
        const invB = gameState.charaInventory[b.id];
        if (zukanSortMode === 'rarity_desc' || zukanSortMode === 'rarity_asc') { 
            const rOrder = { 'UR':5, 'SSR':4, 'SR':3, 'R':2, 'N':1 }; 
            const rA = (invA && invA.currentRarity) ? invA.currentRarity : a.rarity;
            const rB = (invB && invB.currentRarity) ? invB.currentRarity : b.rarity;
            const valA = rOrder[rA] || 0; 
            const valB = rOrder[rB] || 0; 
            return zukanSortMode === 'rarity_desc' ? valB - valA : valA - valB; 
        }
        if (zukanSortMode === 'type') { return (a.type || "").localeCompare(b.type || ""); }
        if (zukanSortMode === 'level') { const lvA = invA ? invA.level : -1; const lvB = invB ? invB.level : -1; if (lvA !== lvB) return lvB - lvA; }
        if (zukanSortMode === 'stock') { const cntA = invA ? invA.count : -1; const cntB = invB ? invB.count : -1; if (cntA !== cntB) return cntB - cntA; }
        return 0;
    });
    list.forEach(c => { 
        const data = gameState.charaInventory[c.id]; 
        const isOwned = !!data; 
        const div = document.createElement('div');
        let masterClass = ''; 
        if (isOwned && data.count >= MASTER_COUNT) masterClass = 'mastered';
        div.className = `char-card ${isOwned ? 'owned' : ''} ${gameState.equipped == c.id ? 'active' : ''} ${masterClass}`;
        let visual, nameText, lvlBadge = '', stockBadge = ''; 
        let decoName = "???"; 
        if(isOwned) {
            if (typeof data.level !== 'number' || data.level < 1) data.level = 1;
            visual = renderSafeImg(c.imageUrl, '📦', 'char-img');
            const currentRarity = data.currentRarity || c.rarity; 
            decoName = getDisplayName(c, data); 
            nameText = `<span class="rarity-${currentRarity}">${currentRarity}</span> / ${c.type}`;
            lvlBadge = `<div class="char-lvl-badge">Lv.${data.level}</div>`; 
            if(data.count > 0) stockBadge = `<div class="char-stock-badge">+${data.count}</div>`;
            div.onclick = () => openCharaDetail(c.id);
        } else { 
            visual = `<div style="font-size:2em;line-height:50px;color:#bdc3c7;">?</div>`; 
            nameText = "???"; 
        }
        div.innerHTML = `${lvlBadge}${stockBadge}${visual}<div style="font-weight:bold;font-size:0.8em;">${nameText}</div><div style="font-size:0.7em; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${decoName}</div>`;
        g.appendChild(div);
    });
}

export function changeZukanSort() {
    const sel = document.getElementById('zukan-sort-select');
    if (!sel) return;
    zukanSortMode = sel.value;
    renderZukan();
}

// ==========================================
// ミキサー合成ロジック
// ==========================================

/**
 * ミキサーの対象レアリティを切り替える
 * @param {'N'|'R'|'SR'|'SSR'} rarity - 対象レアリティ
 */
export function switchMixerRarity(rarity) {
    currentMixerRarity = rarity;
    selectedMixerMaterials = {};
    
    // タブの選択状態更新
    ['N', 'R', 'SR', 'SSR'].forEach(r => {
        const btn = document.getElementById(`mixer-tab-${r}`);
        if (btn) {
            if (r === rarity) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });

    renderMixerSlots();
    renderMixerMaterialList();
}

/**
 * ミキサー投入スロット（10枠）の描画
 */
export function renderMixerSlots() {
    const grid = document.getElementById('mixer-slots-grid');
    const countSpan = document.getElementById('mixer-selected-count');
    const execBtn = document.getElementById('btn-mixer-execute');
    if (!grid) return;

    // 選択中の素材をフラットな配列（最大10個）に展開
    const selectedList = [];
    for (const [charId, count] of Object.entries(selectedMixerMaterials)) {
        const c = rawData.characters ? rawData.characters.find(x => String(x.id) === String(charId)) : null;
        for (let i = 0; i < count; i++) {
            selectedList.push({ charId, chara: c });
        }
    }

    const totalCount = selectedList.length;
    if (countSpan) countSpan.innerText = totalCount;

    // 10枠のスロットサークルを描画
    let html = '';
    for (let i = 0; i < 10; i++) {
        if (i < totalCount) {
            const item = selectedList[i];
            const c = item.chara;
            const imgTag = c ? renderSafeImg(c.imageUrl, '📦', 'mixer-slot-img') : '<span>?</span>';
            html += `
                <div class="mixer-slot filled" title="${c ? c.name : ''}" onclick="adjustMixerMaterial('${item.charId}', -1)">
                    ${imgTag}
                    <div class="mixer-slot-remove">✕</div>
                </div>
            `;
        } else {
            html += `
                <div class="mixer-slot empty">
                    <span class="mixer-slot-num">${i + 1}</span>
                </div>
            `;
        }
    }
    grid.innerHTML = html;

    // 合成ボタンの活性状態
    if (execBtn) {
        if (totalCount === 10) {
            execBtn.disabled = false;
            execBtn.innerText = `🧪 合成を実行する（${currentMixerRarity} 10体 ➔ 上位レア1体）`;
        } else {
            execBtn.disabled = true;
            execBtn.innerText = `🧪 合成を実行する（残り ${10 - totalCount}体必要）`;
        }
    }
}

/**
 * ミキサー素材候補キャラ一覧の描画
 */
export function renderMixerMaterialList() {
    const listEl = document.getElementById('mixer-material-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!rawData.characters) return;

    // 全体で現在選択中の総数
    const totalSelected = Object.values(selectedMixerMaterials).reduce((sum, n) => sum + n, 0);

    // 対象レアリティかつ除外条件を満たさないキャラを抽出
    const candidates = rawData.characters.filter(c => {
        // レアリティ判定
        const inv = gameState.charaInventory[c.id];
        const currentR = (inv && inv.currentRarity) ? inv.currentRarity : c.rarity;
        if (currentR !== currentMixerRarity) return false;

        // 特殊キャラ保護
        if (c.isStudyel || String(c.id).startsWith('studyel_')) return false;
        if (c.category === 'ボス' || c.isBoss || String(c.id).startsWith('boss_')) return false;
        if (c.noGacha) return false;

        // 出撃・編成中キャラ保護（メイン枠・サブ枠ともに除外）
        if (Array.isArray(gameState.equippedParty) && gameState.equippedParty.filter(Boolean).map(String).includes(String(c.id))) return false;
        if (String(gameState.equipped) === String(c.id)) return false;
        if (Array.isArray(gameState.teamParty) && gameState.teamParty.map(String).includes(String(c.id))) return false;

        // ファーム（牧場）配置中キャラ保護（除外）
        if (gameState.farm && Array.isArray(gameState.farm.slots) && gameState.farm.slots.filter(Boolean).map(String).includes(String(c.id))) return false;

        // 在庫数判定（手持ちに1体以上存在するか）
        const stockCount = inv ? inv.count : 0;
        return stockCount > 0;
    });

    if (candidates.length === 0) {
        listEl.innerHTML = `
            <div class="mixer-empty-hint">
                このレアリティ（${currentMixerRarity}）でミキサーに投入できる余剰キャラがいません。<br>
                <small class="text-gray">※装備中・編成中・ファーム配置中・特殊キャラは素材として使用できません。</small>
            </div>
        `;
        return;
    }

    candidates.forEach(c => {
        const inv = gameState.charaInventory[c.id];
        const maxStock = inv ? inv.count : 0;
        const selectedCount = selectedMixerMaterials[c.id] || 0;
        const remainingStock = maxStock - selectedCount;

        const canAdd = (totalSelected < 10) && (selectedCount < maxStock);
        const canRemove = selectedCount > 0;

        const card = document.createElement('div');
        card.className = `mixer-material-card ${selectedCount > 0 ? 'selected' : ''}`;
        
        const imgTag = renderSafeImg(c.imageUrl, '📦', 'mixer-mat-img');

        card.innerHTML = `
            <div class="mixer-mat-visual">
                ${imgTag}
            </div>
            <div class="mixer-mat-info">
                <div class="mixer-mat-name">${c.name}</div>
                <div class="mixer-mat-stock">在庫: ${maxStock}体 (残: <span class="${remainingStock === 0 ? 'text-red font-bold' : ''}">${remainingStock}</span>)</div>
            </div>
            <div class="mixer-mat-actions">
                <button type="button" class="mixer-qty-btn btn-minus" ${canRemove ? '' : 'disabled'} onclick="adjustMixerMaterial('${c.id}', -1)">-</button>
                <span class="mixer-qty-num ${selectedCount > 0 ? 'text-orange font-bold' : ''}">${selectedCount}</span>
                <button type="button" class="mixer-qty-btn btn-plus" ${canAdd ? '' : 'disabled'} onclick="adjustMixerMaterial('${c.id}', 1)">+</button>
            </div>
        `;
        listEl.appendChild(card);
    });
}

/**
 * ミキサー素材の増減調整
 * @param {string} charId - キャラID
 * @param {number} delta - 変化量 (+1 または -1)
 */
export function adjustMixerMaterial(charId, delta) {
    const inv = gameState.charaInventory[charId];
    if (!inv || inv.count <= 0) return;

    const current = selectedMixerMaterials[charId] || 0;
    const totalSelected = Object.values(selectedMixerMaterials).reduce((sum, n) => sum + n, 0);

    if (delta > 0) {
        if (totalSelected >= 10) {
            showAlert("投入スロットは最大10体までです。");
            return;
        }
        if (current >= inv.count) {
            showAlert("これ以上投入できる在庫がありません。");
            return;
        }
    } else if (delta < 0) {
        if (current <= 0) return;
    }

    const next = current + delta;
    if (next > 0) {
        selectedMixerMaterials[charId] = next;
    } else {
        delete selectedMixerMaterials[charId];
    }

    playSE('hit');
    renderMixerSlots();
    renderMixerMaterialList();
}

/**
 * ミキサー投入選択の全解除
 */
export function clearMixerSelection() {
    selectedMixerMaterials = {};
    playSE('miss');
    renderMixerSlots();
    renderMixerMaterialList();
}

/**
 * ミキサー合成の実行
 */
export async function executeMixerSynthesis() {
    // 投入数再検証
    const totalSelected = Object.values(selectedMixerMaterials).reduce((sum, n) => sum + n, 0);
    if (totalSelected !== 10) {
        showAlert("素材キャラが10体選択されていません。");
        return;
    }

    // 在庫数再検証
    for (const [charId, count] of Object.entries(selectedMixerMaterials)) {
        const inv = gameState.charaInventory[charId];
        if (!inv || inv.count < count) {
            showAlert("素材キャラの在庫数が不足しています。画面を更新してください。");
            renderMixerMaterialList();
            return;
        }
    }

    // 次のレアリティ
    const nextRarityMap = { 'N': 'R', 'R': 'SR', 'SR': 'SSR', 'SSR': 'UR' };
    const nextRarity = nextRarityMap[currentMixerRarity];
    if (!nextRarity) {
        showAlert("これ以上上位のレアリティは合成できません。");
        return;
    }

    // 排出候補プール作成
    const pool = (rawData.characters || []).filter(c => {
        if (c.rarity !== nextRarity) return false;
        if (c.isBoss || c.isStudyel || c.noGacha) return false;
        if (String(c.id).startsWith('boss_') || String(c.id).startsWith('studyel_')) return false;
        if (c.category === 'ボス') return false;
        return true;
    });

    if (pool.length === 0) {
        showAlert(`合成先（${nextRarity}）の排出対象キャラクターが見つかりません。`);
        return;
    }

    const confirmMsg = `選択した ${currentMixerRarity} キャラ10体を消費して、\n【${nextRarity} キャラ 1体】をミキサー合成しますか？\n※消費した素材キャラは戻りません。`;
    if (!(await showConfirm(confirmMsg))) return;

    // 素材の安全な消費
    for (const [charId, count] of Object.entries(selectedMixerMaterials)) {
        const inv = gameState.charaInventory[charId];
        inv.count -= count;
        if (inv.count < 0) inv.count = 0;
    }

    // 抽選
    const resultChara = pool[Math.floor(Math.random() * pool.length)];

    // 排出キャラの付与
    if (!gameState.charaInventory[resultChara.id]) {
        gameState.charaInventory[resultChara.id] = {
            level: 1,
            count: 1,
            exp: 0,
            currentRarity: resultChara.rarity
        };
    } else {
        if (typeof gameState.charaInventory[resultChara.id].level !== 'number' || gameState.charaInventory[resultChara.id].level < 1) {
            gameState.charaInventory[resultChara.id].level = 1;
        }
        gameState.charaInventory[resultChara.id].count = (gameState.charaInventory[resultChara.id].count || 0) + 1;
    }

    // セーブと状態更新
    saveGame();
    selectedMixerMaterials = {};
    playSE('win');

    // 結果モーダルの表示
    showGachaResult([resultChara]);

    // ミキサー画面・図鑑の再描画
    renderMixerSlots();
    renderMixerMaterialList();
    renderZukan();
    updateAllXpDisplays();
}

// ==========================================
// キャラ詳細・強化合成・進化・転生
// ==========================================
export function openCharaDetail(id) { 
    viewingCharaId = id; 
    const c = rawData.characters ? rawData.characters.find(x => String(x.id) == String(id)) : null; 
    const o = gameState.charaInventory[id] || gameState.charaInventory[String(id)] || (c ? gameState.charaInventory[c.id] : null); 
    if(!c || !o) return; 
    if (typeof o.level !== 'number' || o.level < 1) o.level = 1;
    const currentR = o.currentRarity || c.rarity; 
    const currentSkills = (o.skills && o.skills.length > 0) ? o.skills : [c.type];
    const baseVal = (o.isEvolved && o.customValue) ? o.customValue : Number(c.value);
    
    const cdName = document.getElementById('cd-name'); 
    if(cdName) cdName.innerHTML = getDisplayName(c, o);
    const cdRarity = document.getElementById('cd-rarity'); 
    if(cdRarity) { cdRarity.innerText = currentR; cdRarity.className = "rarity-" + currentR; }
    const maxLv = RARITY_CAPS[currentR] || 10;
    const isMax = o.level >= maxLv;
    const cdLv = document.getElementById('cd-lv'); 
    if(cdLv) cdLv.innerText = 'Lv.' + o.level + ' / ' + maxLv;
    
    let skillHtml = ''; 
    currentSkills.forEach(s => { skillHtml += `<span class="skill-tag ${s}">${s}</span>`; });
    const cdType = document.getElementById('cd-type'); 
    if(cdType) cdType.innerHTML = `<div class="skill-tag-container">${skillHtml}</div>`;
    
    let val = baseVal + (o.level * LV_BONUS_RATE); 
    const cdVal = document.getElementById('cd-val'); 
    if(cdVal) cdVal.innerText = 'x' + val.toFixed(2); 
    const cdStock = document.getElementById('cd-stock'); 
    if(cdStock) cdStock.innerText = o.count + "個"; 
    const cdDesc = document.getElementById('cd-desc'); 
    if(cdDesc) cdDesc.innerText = c.desc || "";
    
    const detailBtnRow = document.querySelector('.detail-btn-row');
    if(detailBtnRow) {
        if (document.querySelector('.item-use-area')) document.querySelector('.item-use-area').remove();
        const canUse = !isMax;
        detailBtnRow.insertAdjacentHTML('beforebegin', `<div class="item-use-area"><div style="font-weight:bold; font-size:0.8em; color:#2c3e50; margin-bottom:5px;">育成アイテム</div><div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px;"><button class="book-use-btn" onclick="useExpItem('xpBookSmall', 200)" ${canUse && (gameState.inventory.xpBookSmall||0)>0?'':'disabled'}>小(${gameState.inventory.xpBookSmall||0})</button><button class="book-use-btn" onclick="useExpItem('xpBookMedium', 500)" ${canUse && (gameState.inventory.xpBookMedium||0)>0?'':'disabled'}>中(${gameState.inventory.xpBookMedium||0})</button><button class="book-use-btn" onclick="useExpItem('xpBookLarge', 1000)" ${canUse && (gameState.inventory.xpBookLarge||0)>0?'':'disabled'}>大(${gameState.inventory.xpBookLarge||0})</button></div></div>`);
    }

    // 持ち物枠（HeldItems）のレンダリング
    const cardEl = document.getElementById('cd-helditem-card');
    const actWrap = document.getElementById('cd-helditem-action-wrap');
    if (cardEl) {
        const heldItemId = o.heldItem;
        const itemData = heldItemId && rawData.heldItems ? rawData.heldItems.find(it => String(it.id) === String(heldItemId)) : null;

        if (itemData) {
            cardEl.className = 'helditem-slot-card equipped';
            let iconHtml = itemData.imageUrl 
                ? renderSafeImg(itemData.imageUrl, '🧰', 'helditem-icon-img') 
                : '🧰';
            let valText = '';
            if (itemData.value && Number(itemData.value) !== 1.0) {
                const diff = Math.round((Number(itemData.value) - 1.0) * 100);
                valText = `${itemData.type || 'ATK'} ${diff >= 0 ? '+' : ''}${diff}%`;
            } else if (itemData.type) {
                valText = `${itemData.type}`;
            }

            let specText = '';
            if (itemData.special === 'INIT_SP_1') specText = '⚡ 開幕SP+1';
            else if (itemData.special === 'PINCH_SHIELD') specText = '🛡️ 瀕死シールド(1回)';
            else if (itemData.special) specText = `✨ ${itemData.special}`;

            cardEl.innerHTML = `
                <div class="helditem-icon-box">${iconHtml}</div>
                <div class="helditem-info-col">
                    <div class="helditem-name-row">
                        <span class="rarity-${itemData.rarity || 'N'}" style="font-size:0.75em; font-weight:bold;">${itemData.rarity || 'N'}</span>
                        <span class="helditem-name">${itemData.name || '持ち物'}</span>
                    </div>
                    ${valText ? `<div class="helditem-effect-desc">📈 効果: ${valText}</div>` : ''}
                    ${specText ? `<div class="helditem-special-desc">${specText}</div>` : ''}
                </div>
            `;

            if (actWrap) {
                actWrap.innerHTML = `
                    <button class="btn-helditem-action btn-helditem-equip" onclick="openHeldItemSelectModal('${id}')">変更</button>
                    <button class="btn-helditem-action btn-helditem-unequip" onclick="unequipHeldItem('${id}')">外す</button>
                `;
            }
        } else {
            cardEl.className = 'helditem-slot-card';
            cardEl.innerHTML = `
                <div class="helditem-icon-box">➕</div>
                <div class="helditem-empty-text" onclick="openHeldItemSelectModal('${id}')">未装備（タップして選択）</div>
            `;
            if (actWrap) {
                actWrap.innerHTML = `
                    <button class="btn-helditem-action btn-helditem-equip" onclick="openHeldItemSelectModal('${id}')">選択</button>
                `;
            }
        }
    }
    
    // 装備スロット（メイン / サブ1 / サブ2）ボタンの更新
    const party = Array.isArray(gameState.equippedParty) ? gameState.equippedParty : [(gameState.equipped || '1'), null, null];
    const unlocked = Number(gameState.unlockedSlots) || 1;

    for (let i = 0; i < 3; i++) {
        const btn = document.getElementById(`btn-equip-slot-${i}`);
        if (!btn) continue;
        const isSlotUnlocked = i < unlocked;
        const isEquippedHere = String(party[i]) === String(id);

        if (i === 0) {
            // メイン枠
            if (isEquippedHere) {
                btn.innerHTML = '✅ メイン中';
                btn.disabled = true;
                btn.className = 'slot-equip-btn slot-main active';
            } else {
                btn.innerHTML = '🛡️ メイン';
                btn.disabled = false;
                btn.className = 'slot-equip-btn slot-main';
            }
        } else {
            // サブ枠
            if (!isSlotUnlocked) {
                btn.innerHTML = `🔒 サブ${i}`;
                btn.disabled = true;
                btn.className = 'slot-equip-btn slot-sub locked';
            } else if (isEquippedHere) {
                btn.innerHTML = `❌ 外す(サブ${i})`;
                btn.disabled = false;
                btn.className = 'slot-equip-btn slot-sub unequip-active';
            } else {
                btn.innerHTML = `🗡️ サブ${i}`;
                btn.disabled = false;
                btn.className = 'slot-equip-btn slot-sub';
            }
        }
    }

    const btnEnhance = document.getElementById('btn-enhance');
    if (btnEnhance) {
        btnEnhance.disabled = isMax;
        btnEnhance.style.opacity = isMax ? "0.5" : "1.0";
        btnEnhance.style.cursor = isMax ? "not-allowed" : "pointer";
    }

    const isAssignedToFarm = gameState.farm && Array.isArray(gameState.farm.slots) && gameState.farm.slots.filter(Boolean).map(String).includes(String(id));
    const btnSell = document.getElementById('btn-sell');
    if (btnSell) {
        if (isAssignedToFarm) {
            btnSell.disabled = true;
            btnSell.style.opacity = "0.5";
            btnSell.style.cursor = "not-allowed";
            btnSell.title = "ファーム配置中のため売却不可";
        } else {
            btnSell.disabled = (o.count <= 0);
            btnSell.style.opacity = (o.count <= 0) ? "0.5" : "1.0";
            btnSell.style.cursor = (o.count <= 0) ? "not-allowed" : "pointer";
            btnSell.title = "";
        }
    }

    const cdExpText = document.getElementById('cd-exp-text'); 
    if(cdExpText) cdExpText.innerText = isMax ? 'MAX' : ((o.exp || 0) + ' / ' + EXP_REQ); 
    const cdExpBar = document.getElementById('cd-exp-bar'); 
    if(cdExpBar) cdExpBar.style.width = isMax ? '100%' : (Math.min(100, ((o.exp || 0) / EXP_REQ * 100)) + '%');
    const cdImg = document.getElementById('cd-img');
    if(cdImg) { if(c.imageUrl && (c.imageUrl.startsWith('http') || c.imageUrl.startsWith('data:image'))) cdImg.src = c.imageUrl; else cdImg.src = ''; }
    document.getElementById('chara-detail-overlay')?.classList.remove('hidden'); 
    
    const evoContainer = document.getElementById('evo-container'); 
    if(evoContainer) {
        evoContainer.innerHTML = ''; 
        evoContainer.classList.add('hidden');
        if (o.level >= maxLv && o.count >= EVO_STOCK_REQ && currentR !== 'UR') {
            const cost = EVO_COST_XP[currentR]; 
            const btn = document.createElement('button'); 
            btn.className = 'detail-btn'; 
            btn.style.background = 'linear-gradient(to bottom, #f1c40f, #e67e22)'; 
            btn.style.borderBottom = '5px solid #d35400'; 
            btn.style.marginBottom = '10px'; 
            btn.style.height = 'auto'; 
            btn.style.minHeight = '60px'; 
            btn.style.flexDirection = 'column'; 
            btn.style.padding = '8px'; 
            btn.innerHTML = `<div style="font-weight:bold; font-size:1.1em; margin-bottom:4px;">🌟 限界突破・進化！</div><div style="font-size:0.75em; font-weight:normal;">消費: ${cost.toLocaleString()} XP ／ 素材 ${EVO_STOCK_REQ}個</div>`; 
            btn.onclick = executeEvolution; 
            evoContainer.appendChild(btn); 
            evoContainer.classList.remove('hidden');
        }
        if (currentR === 'UR' && o.level >= maxLv && o.count >= EVO_STOCK_REQ && !c.isStudyel) {
            const btn = document.createElement('button'); 
            btn.className = 'detail-btn'; 
            btn.style.background = 'linear-gradient(to right, #3498db, #8e44ad)'; 
            btn.style.borderBottom = '5px solid #5b2c6f'; 
            btn.style.marginBottom = '10px'; 
            btn.style.height = 'auto'; 
            btn.style.minHeight = '60px'; 
            btn.style.flexDirection = 'column'; 
            btn.style.padding = '8px';
            btn.innerHTML = `<div style="font-weight:bold; font-size:1.1em; margin-bottom:4px;">🪽 転生する</div><div style="font-size:0.75em; font-weight:normal;">消費: ${REBORN_COST_XP.toLocaleString()} XP ／ 素材 ${EVO_STOCK_REQ}個</div>`; 
            btn.onclick = executeReincarnation; 
            evoContainer.appendChild(btn); 
            evoContainer.classList.remove('hidden');
        }
    }
}

export function closeCharaDetail() {
    document.getElementById('chara-detail-overlay')?.classList.add('hidden');
    renderZukan();
}

/**
 * 指定装備スロット（0: メイン, 1: サブ1, 2: サブ2）への装備または解除処理
 */
export function handleSlotEquip(slotIndex) {
    if (!viewingCharaId) return;
    const unlocked = Number(gameState.unlockedSlots) || 1;
    if (slotIndex >= unlocked) {
        return showAlert("このスロットは未解放です。ショップで解放許可証を購入してください。");
    }

    if (!Array.isArray(gameState.equippedParty)) {
        gameState.equippedParty = [String(gameState.equipped || '1'), null, null];
    }

    const currentId = String(viewingCharaId);
    const isEquippedHere = String(gameState.equippedParty[slotIndex]) === currentId;

    if (isEquippedHere) {
        if (slotIndex === 0) {
            return showAlert("メイン装備枠のキャラクターは外せません。別のキャラクターをメインに装備してください。");
        } else {
            // サブ枠から外す
            gameState.equippedParty[slotIndex] = null;
            saveGame();
            updateTitleInfo();
            renderZukan();
            openCharaDetail(viewingCharaId);
            playSE('select');
            return;
        }
    }

    // 別スロットに既に装備されている場合は、重複防止のためそのスロットから自動で外す
    for (let i = 0; i < 3; i++) {
        if (String(gameState.equippedParty[i]) === currentId) {
            if (i === 0) {
                return showAlert("メイン装備中のキャラクターをサブ枠に移動することはできません。先に別のキャラをメインに装備してください。");
            }
            gameState.equippedParty[i] = null;
        }
    }

    // 指定スロットに装備
    gameState.equippedParty[slotIndex] = currentId;
    saveGame();
    updateTitleInfo();
    renderZukan();
    openCharaDetail(viewingCharaId);
    playSE('select');
}

export function equipCurrentChara() {
    handleSlotEquip(0);
}

export async function useExpItem(itemId, gain) {
    if ((gameState.inventory[itemId] || 0) <= 0) return;
    const itemNames = { 'xpBookSmall':'小の書', 'xpBookMedium':'中の書', 'xpBookLarge':'大の書' };
    const itemName = itemNames[itemId] || '経験値アイテム';
    if (!(await showConfirm(`【確認】\n${itemName} を使用して、経験値を +${gain} しますか？`))) return;

    const inv = gameState.charaInventory[viewingCharaId];
    const master = rawData.characters ? rawData.characters.find(c => c.id == viewingCharaId) : null;
    if(!inv) return;
    
    const maxL = RARITY_CAPS[inv.currentRarity || (master ? master.rarity : 'N')] || 10;
    if (inv.level >= maxL) return alert("Lv.MAXです");

    gameState.inventory[itemId]--;
    inv.exp = (Number(inv.exp) || 0) + gain;
    
    let lvUp = 0;
    while (inv.exp >= EXP_REQ && inv.level < maxL) { inv.exp -= EXP_REQ; inv.level++; lvUp++; }
    if (inv.level >= maxL) inv.exp = 0;
    
    saveGame(); 
    playSE('start'); 
    if (lvUp > 0) alert(`レベルアップ！ Lv.${inv.level}`);
    openCharaDetail(viewingCharaId);
}

export async function executeEvolution() {
    const o = gameState.charaInventory[viewingCharaId];
    const c = rawData.characters ? rawData.characters.find(x => x.id == viewingCharaId) : null;
    if(!o || !c) return;
    const currentR = o.currentRarity || c.rarity;
    const maxLv = RARITY_CAPS[currentR] || 10;
    
    if (o.level < maxLv || o.count < EVO_STOCK_REQ || currentR === 'UR') return;
    
    const cost = EVO_COST_XP[currentR];
    if (gameState.xp < cost) return alert(`XPが足りません！\n必要: ${cost} XP`);
    
    if (!(await showConfirm(`【進化確認】\n${cost} XP と素材${EVO_STOCK_REQ}個を消費して進化させますか？`))) return;
    
    gameState.xp -= cost;
    o.count -= EVO_STOCK_REQ;
    
    const nextIdx = RARITY_ORDER.indexOf(currentR) + 1;
    o.currentRarity = RARITY_ORDER[nextIdx];
    o.level = 1;
    o.exp = 0;
    o.isEvolved = true;
    o.customValue = (o.customValue || Number(c.value)) + 0.5;
    
    gameState.stats.achieved_evolve = true;
    saveGame(); 
    playSE('win'); 
    alert("限界突破・進化しました！");
    openCharaDetail(viewingCharaId); 
    updateTitleInfo();
    checkTitles();
}

export async function executeReincarnation() {
    const o = gameState.charaInventory[viewingCharaId];
    const c = rawData.characters ? rawData.characters.find(x => x.id == viewingCharaId) : null;
    if(!o || !c) return;
    
    const currentR = o.currentRarity || c.rarity;
    const maxLv = RARITY_CAPS[currentR] || 30;
    if (currentR !== 'UR' || o.level < maxLv || o.count < EVO_STOCK_REQ) return;
    
    if (gameState.xp < REBORN_COST_XP) return alert(`XPが足りません！\n必要: ${REBORN_COST_XP} XP`);
    
    if (!(await showConfirm(`【転生確認】\n${REBORN_COST_XP} XP と素材${EVO_STOCK_REQ}個を消費して転生させますか？\n(レベルは1に戻り、新たなスキルを習得します)`))) return;
    
    gameState.xp -= REBORN_COST_XP;
    o.count -= EVO_STOCK_REQ;
    o.level = 1;
    o.exp = 0;
    o.reincarnationCount = (o.reincarnationCount || 0) + 1;
    o.customValue = (o.customValue || Number(c.value)) + 1.0;
    
    if (!o.skills) o.skills = [c.type];
    const availableSkills = ['ATK', 'TIME', 'EXP'].filter(s => !o.skills.includes(s));
    if (availableSkills.length > 0) { o.skills.push(availableSkills[Math.floor(Math.random() * availableSkills.length)]); } else if (!o.skills.includes('ALL')) { o.skills = ['ALL']; }
    
    gameState.stats.achieved_reborn = true;
    saveGame(); 
    playSE('win'); 
    alert("転生に成功しました！新たな力を得ました。");
    openCharaDetail(viewingCharaId); 
    updateTitleInfo();
    checkTitles();
}

export function openEnhanceMenu() { 
    const t = gameState.charaInventory[viewingCharaId]; 
    const chara = rawData.characters ? rawData.characters.find(x => x.id === viewingCharaId) : null; 
    if (!t || !chara) return;
    const currentR = t.currentRarity || chara.rarity; 
    const maxLv = RARITY_CAPS[currentR] || 10;
    if (t.level >= maxLv) return alert("すでにLv.MAXです");
    selectedMaterials = {}; 
    document.getElementById('material-select-overlay')?.classList.remove('hidden'); 
    document.getElementById('chara-detail-overlay')?.classList.add('hidden'); 
    renderEnhanceList(); 
}

export function closeEnhanceMenu() {
    document.getElementById('material-select-overlay')?.classList.add('hidden');
    selectedMaterials = {};
    if (viewingCharaId) {
        openCharaDetail(viewingCharaId);
    } else {
        document.getElementById('chara-detail-overlay')?.classList.remove('hidden');
    }
}

export function renderEnhanceList() {
    const list = document.getElementById('material-list'); 
    if(!list) return; 
    list.innerHTML = ''; 
    let totalGain = 0;
    if(!rawData.characters) return;
    rawData.characters.forEach(c => {
        if (c.id === viewingCharaId) return; 
        // ファーム配置中キャラ保護（除外）
        if (gameState.farm && Array.isArray(gameState.farm.slots) && gameState.farm.slots.filter(Boolean).map(String).includes(String(c.id))) return;
        const inv = gameState.charaInventory[c.id]; 
        if (!inv || inv.count <= 0) return;
        const selectCount = selectedMaterials[c.id] || 0; 
        const expVal = MAT_EXP[c.rarity] || 25; 
        if(selectCount > 0) totalGain += (expVal * selectCount);
        let visual = renderSafeImg(c.imageUrl, '📦', '', 'width:40px;height:40px;');
        let activeClass = selectCount > 0 ? 'selected' : ''; 
        let badge = selectCount > 0 ? `<div class="mat-select-badge">${selectCount}</div>` : '';
        list.innerHTML += `<div class="mat-card ${activeClass}" onclick="toggleMaterial('${c.id}', ${inv.count})">${badge}<div class="rarity-${c.rarity}">${c.rarity}</div>${visual}<div style="font-weight:bold; font-size:0.8em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.name}</div><div style="font-size:0.7em;">所持: ${inv.count}</div><div class="mat-exp-val">+${expVal}</div></div>`;
    });
    updateEnhancePreview(totalGain);
}

export function toggleMaterial(id, maxCount) { 
    const t = gameState.charaInventory[viewingCharaId];
    const chara = rawData.characters ? rawData.characters.find(x => x.id === viewingCharaId) : null;
    if (!t || !chara) return;
    const currentR = t.currentRarity || chara.rarity;
    const neededExp = getNeededExpForMax(t, currentR);

    if (!selectedMaterials[id]) selectedMaterials[id] = 0; 
    const currentGain = getSelectedTotalExp();

    if (selectedMaterials[id] >= maxCount || currentGain >= neededExp) {
        selectedMaterials[id] = 0;
    } else {
        selectedMaterials[id]++;
    }
    renderEnhanceList(); 
}

export function getNeededExpForMax(t, currentR) {
    const maxLv = RARITY_CAPS[currentR] || 10;
    if (t.level >= maxLv) return 0;
    return ((maxLv - t.level) * EXP_REQ) - (Number(t.exp) || 0);
}

export function getSelectedTotalExp() {
    let total = 0;
    if (!rawData.characters) return 0;
    Object.keys(selectedMaterials).forEach(id => {
        const cnt = selectedMaterials[id] || 0;
        if (cnt > 0) {
            const matChar = rawData.characters.find(c => c.id === id);
            const expVal = matChar ? (MAT_EXP[matChar.rarity] || 25) : 25;
            total += (expVal * cnt);
        }
    });
    return total;
}

export function updateEnhancePreview(gainExp) {
    const enhanceTotal = document.getElementById('enhance-total-exp'); 
    if(enhanceTotal) enhanceTotal.innerText = gainExp;
    const t = gameState.charaInventory[viewingCharaId]; 
    const chara = rawData.characters ? rawData.characters.find(x => x.id === viewingCharaId) : null; 
    if (!t || !chara) return;
    const currentR = t.currentRarity || chara.rarity; 
    const maxLv = RARITY_CAPS[currentR] || 10;
    let simExp = (Number(t.exp) || 0) + gainExp; 
    let simLv = t.level;
    while (simExp >= EXP_REQ && simLv < maxLv) { simExp -= EXP_REQ; simLv++; }
    if (simLv >= maxLv) simExp = 0;

    const preview = document.getElementById('enhance-lv-preview');
    if(!preview) return;
    if (simLv >= maxLv) { 
        preview.innerHTML = `Lv.${t.level} <span style="font-weight:bold; color:#e74c3c;">➞ Lv.${maxLv} (MAX)</span>`; 
    } else if (simLv > t.level) { 
        preview.innerHTML = `Lv.${t.level} <span style="font-weight:bold; color:#e67e22;">➞ Lv.${simLv}</span> (あと${EXP_REQ - simExp})`; 
    } else { 
        preview.innerText = `Lv.${t.level} (あと${EXP_REQ - simExp})`; 
        preview.style.color = '#7f8c8d'; 
    }
}

export async function executeBulkEnhance() {
    const totalSelected = Object.values(selectedMaterials).reduce((a, b) => a + b, 0); 
    if (totalSelected === 0) return alert("素材を選択してください");
    
    const t = gameState.charaInventory[viewingCharaId]; 
    const chara = rawData.characters ? rawData.characters.find(x => x.id === viewingCharaId) : null;
    if (!t || !chara) return;
    const currentR = t.currentRarity || (chara ? chara.rarity : 'N'); 
    const maxLv = RARITY_CAPS[currentR] || 10;
    if (t.level >= maxLv) return alert("すでにLv.MAXです");

    let totalGain = 0; 
    Object.keys(selectedMaterials).forEach(id => { 
        const count = selectedMaterials[id]; 
        if (count > 0 && rawData.characters) { 
            const matChar = rawData.characters.find(c => c.id === id); 
            if(matChar) { const expVal = MAT_EXP[matChar.rarity] || 25; totalGain += (expVal * count); } 
        } 
    });

    if (!(await showConfirm(`選択した素材（最大${totalSelected}体）を消費して強化しますか？\n獲得EXP: +${totalGain}`))) return;
    
    let usedCount = 0;
    let actualExpGained = 0;
    let lvUpCount = 0;

    for (const id of Object.keys(selectedMaterials)) {
        let count = selectedMaterials[id] || 0;
        const matChar = rawData.characters ? rawData.characters.find(c => c.id === id) : null;
        const expVal = matChar ? (MAT_EXP[matChar.rarity] || 25) : 25;

        while (count > 0 && t.level < maxLv) {
            if (gameState.charaInventory[id] && gameState.charaInventory[id].count > 0) {
                gameState.charaInventory[id].count--;
                count--;
                usedCount++;
                actualExpGained += expVal;
                t.exp = (Number(t.exp) || 0) + expVal;

                while (t.exp >= EXP_REQ && t.level < maxLv) {
                    t.exp -= EXP_REQ;
                    t.level++;
                    lvUpCount++;
                }
                if (t.level >= maxLv) {
                    t.exp = 0;
                    break;
                }
            } else {
                break;
            }
        }
    }

    updateMissionProgress('enhance', 1); 
    checkTitles(); 
    saveGame();
    
    const isNowMax = t.level >= maxLv;
    let msg = `強化完了！\n経験値 +${actualExpGained} を獲得しました。`;
    if (lvUpCount > 0) msg += `\nレベルが Lv.${t.level} に上がりました！`;
    if (isNowMax) msg += `\n🎉 Lv.MAXに到達しました！`;
    if (usedCount < totalSelected) msg += `\n（Lv.MAXに到達したため、余剰の素材${totalSelected - usedCount}体は消費されずに残りました）`;
    
    alert(msg);
    selectedMaterials = {}; 
    renderEnhanceList(); 
    updateEnhancePreview(0);
    
    if(chara) {
        const cdLv = document.getElementById('cd-lv'); if(cdLv) cdLv.innerText = 'Lv.' + t.level + ' / ' + maxLv; 
        const cdExpText = document.getElementById('cd-exp-text'); if(cdExpText) cdExpText.innerText = isNowMax ? 'MAX' : (t.exp + ' / ' + EXP_REQ); 
        const cdExpBar = document.getElementById('cd-exp-bar'); if(cdExpBar) cdExpBar.style.width = isNowMax ? '100%' : (Math.min(100, (t.exp / EXP_REQ * 100)) + '%');
        const baseVal = (t.isEvolved && t.customValue) ? t.customValue : Number(chara.value); 
        const cdVal = document.getElementById('cd-val'); if(cdVal) cdVal.innerText='x'+(baseVal+(t.level*LV_BONUS_RATE)).toFixed(2);
        const btnEnhance = document.getElementById('btn-enhance');
        if (btnEnhance) {
            btnEnhance.disabled = isNowMax;
            btnEnhance.style.opacity = isNowMax ? "0.5" : "1.0";
            btnEnhance.style.cursor = isNowMax ? "not-allowed" : "pointer";
        }
    }
}

export async function sellCharaStock() { 
    const o = gameState.charaInventory[viewingCharaId]; 
    const c = rawData.characters ? rawData.characters.find(x => x.id == viewingCharaId) : null;
    if (!o || o.count <= 0) return;

    // ファーム配置中キャラ保護ガード
    if (gameState.farm && Array.isArray(gameState.farm.slots) && gameState.farm.slots.filter(Boolean).map(String).includes(String(viewingCharaId))) {
        return showAlert('このキャラクターはファーム（牧場）に配置されているため、素材売却できません。先にファームから外してください。');
    }

    const currentR = o.currentRarity || (c ? c.rarity : 'N');
    const price = (typeof SELL_PRICES !== 'undefined' && SELL_PRICES[currentR]) ? SELL_PRICES[currentR] : 250;
    if (!(await showConfirm(`素材を1体売却して ${price} XPを獲得しますか？`))) return; 
    o.count--; 
    gameState.xp += price; 
    saveGame(); 
    openCharaDetail(viewingCharaId); 
    updateAllXpDisplays();
}

// ==========================================
// ショップ（アイテム・アバター）
// ==========================================

// アバターショップアイテム定義（全13種）
export const AVATAR_SHOP_ITEMS = [
    { key: 'base_2', category: 'base', index: 2, name: 'キリッと顎', price: 30000, desc: '顎のラインがシャープな輪郭' },
    { key: 'skinColor_3', category: 'skinColor', index: 3, name: '小麦肌', price: 20000, desc: '健康的で日焼けした小麦色の肌' },
    { key: 'skinColor_4', category: 'skinColor', index: 4, name: '蒼白肌', price: 20000, desc: 'クールでミステリアスな色白肌' },
    { key: 'hairColor_6', category: 'hairColor', index: 6, name: '翠（エメラルド）', price: 20000, desc: '鮮やかなエメラルドグリーンの髪色' },
    { key: 'hairColor_7', category: 'hairColor', index: 7, name: '紫（パープル）', price: 20000, desc: '高貴で妖艶なパープルの髪色' },
    { key: 'hairColor_8', category: 'hairColor', index: 8, name: '桃（ピンク）', price: 20000, desc: '華やかでポップなピンクの髪色' },
    { key: 'eyes_4', category: 'eyes', index: 4, name: '星目', price: 40000, desc: '星の輝きを瞳に宿したキラキラアイ' },
    { key: 'eyes_5', category: 'eyes', index: 5, name: 'ジト目', price: 40000, desc: 'クールで物憂げなアンニュイアイ' },
    { key: 'mouth_3', category: 'mouth', index: 3, name: '八重歯', price: 25000, desc: 'チラリと覗く可愛い八重歯' },
    { key: 'mouth_4', category: 'mouth', index: 4, name: 'ぽかん', price: 25000, desc: '口を丸く開けたおとぼけマウス' },
    { key: 'hair_6', category: 'hair', index: 6, name: 'ウルフカット', price: 50000, desc: '外ハネがワイルドでスタイリッシュな髪型' },
    { key: 'hair_7', category: 'hair', index: 7, name: 'アフロ', price: 50000, desc: '圧倒的なボリュームを誇るアフロヘア' },
    { key: 'hair_8', category: 'hair', index: 8, name: 'ロングストレート', price: 50000, desc: '美しく流れるサラサラの直毛ロング' },
    { key: 'outfit_4', category: 'outfit', index: 4, name: 'ナイトアーマー', price: 80000, desc: '誇り高き騎士の全身甲冑' },
    { key: 'outfit_5', category: 'outfit', index: 5, name: 'サイバーコート', price: 80000, desc: 'ネオンラインが輝く近未来ハイテクコート' },
    { key: 'accessory_5', category: 'accessory', index: 5, name: 'ヘッドセット', price: 60000, desc: 'ゲーミング＆オペレーター用マイク付きヘッドフォン' },
    { key: 'accessory_6', category: 'accessory', index: 6, name: '眼帯', price: 60000, desc: 'ミステリアスな海賊風アイパッチ' },
    { key: 'accessory_7', category: 'accessory', index: 7, name: '猫耳カチューシャ', price: 60000, desc: '愛らしい猫耳がついたカチューシャ' }
];

export function openShop() { 
    closeAllCategoryModals();
    currentShopTab = currentShopTab || 'item';
    document.getElementById('shop-overlay')?.classList.remove('hidden'); 
    switchShopTab(currentShopTab);
    updateAllXpDisplays();
}

export function closeShop() { 
    document.getElementById('shop-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
    updateTitleInfo();
}

export function switchShopTab(tab) {
    if (tab === 'buy' || tab === 'exchange') {
        currentSubShopTab = tab;
        currentShopTab = 'item';
    } else {
        currentShopTab = tab;
    }

    const tabItem = document.getElementById('shop-tab-item');
    const tabAvatar = document.getElementById('shop-tab-avatar');
    const shopList = document.getElementById('shop-list');
    const avatarList = document.getElementById('avatar-shop-list');

    if (currentShopTab === 'avatar') {
        if (tabItem) tabItem.classList.remove('active');
        if (tabAvatar) tabAvatar.classList.add('active');
        if (shopList) shopList.classList.add('hidden');
        if (avatarList) avatarList.classList.remove('hidden');
        renderAvatarShop();
    } else {
        if (tabItem) tabItem.classList.add('active');
        if (tabAvatar) tabAvatar.classList.remove('active');
        if (shopList) shopList.classList.remove('hidden');
        if (avatarList) avatarList.classList.add('hidden');
        renderShop();
    }
    updateAllXpDisplays();
}

export function renderShop() {
    updateAllXpDisplays();
    const l = document.getElementById('shop-list'); 
    if(!l) return;
    
    l.innerHTML = `
        <div class="page-counter-container">
            <div class="page-item">📕 <span>${gameState.inventory.redPages || 0}</span></div>
            <div class="page-item">📘 <span>${gameState.inventory.bluePages || 0}</span></div>
        </div>
        <div class="item-tab-container">
            <div class="item-tab ${currentSubShopTab === 'buy' ? 'active' : ''}" onclick="switchShopTab('buy')">学習アイテム</div>
            <div class="item-tab ${currentSubShopTab === 'exchange' ? 'active' : ''}" onclick="switchShopTab('exchange')">アイテム交換</div>
        </div>
    `; 

    if (currentSubShopTab === 'buy') {
        // スロット拡張アイテム（サブスロット解放許可証Ⅰ & Ⅱ）
        const slotItems = [
            {
                id: 'slot_permit_1',
                slotIndex: 1,
                name: 'サブスロット解放許可証Ⅰ',
                desc: 'キャラクター装備枠の「サブ1枠」を永続解放します（補正値20%適用）。',
                cost: 5000000,
                icon: '📜',
                isUnlocked: (Number(gameState.unlockedSlots) || 1) >= 2,
                canBuy: (Number(gameState.unlockedSlots) || 1) < 2
            },
            {
                id: 'slot_permit_2',
                slotIndex: 2,
                name: 'サブスロット解放許可証Ⅱ',
                desc: 'キャラクター装備枠の「サブ2枠」を永続解放します（補正値20%適用）。※許可証Ⅰ所持が前提',
                cost: 10000000,
                icon: '📜',
                isUnlocked: (Number(gameState.unlockedSlots) || 1) >= 3,
                canBuy: (Number(gameState.unlockedSlots) || 1) === 2
            }
        ];

        slotItems.forEach(item => {
            let btnHtml = '';
            if (item.isUnlocked) {
                btnHtml = `<button class="shop-buy-btn" disabled style="background:#27ae60; cursor:default;">所持済み</button>`;
            } else if (!item.canBuy) {
                btnHtml = `<button class="shop-buy-btn" disabled style="opacity:0.5; cursor:not-allowed;" title="許可証Ⅰの購入が必要です">🔒 要許可証Ⅰ</button>`;
            } else {
                const canAfford = gameState.xp >= item.cost;
                btnHtml = `<button class="shop-buy-btn" ${canAfford ? '' : 'disabled'} onclick="buySlotPermit(${item.slotIndex}, ${item.cost})">
                    ${item.cost.toLocaleString()} XP
                </button>`;
            }

            l.innerHTML += `
                <div class="shop-item special-slot-item">
                    <div class="shop-icon">${item.icon}</div>
                    <div class="shop-info">
                        <div class="shop-name font-bold text-orange">${item.name}</div>
                        <div class="shop-desc">${item.desc}</div>
                    </div>
                    <div class="shop-right">
                        <div class="shop-level-tag">${item.isUnlocked ? '解放済み' : '未解放'}</div>
                        ${btnHtml}
                    </div>
                </div>
            `;
        });

        // ファーム拡張許可証（第4枠〜第10枠）
        const farmUnlocked = Number(gameState.farm?.unlockedSlots) || FARM_DEFAULT_SLOTS;
        const isFarmMax = farmUnlocked >= FARM_MAX_SLOTS;
        const nextFarmSlot = farmUnlocked + 1;
        const farmCost = nextFarmSlot * 500000;
        
        let farmBtnHtml = '';
        if (isFarmMax) {
            farmBtnHtml = `<button class="shop-buy-btn" disabled style="background:#27ae60; cursor:default;">最大解放済み</button>`;
        } else {
            const canAffordFarm = gameState.xp >= farmCost;
            farmBtnHtml = `<button class="shop-buy-btn" ${canAffordFarm ? '' : 'disabled'} onclick="buyFarmSlotPermit(${nextFarmSlot}, ${farmCost})">
                ${farmCost.toLocaleString()} XP
            </button>`;
        }

        l.innerHTML += `
            <div class="shop-item special-slot-item">
                <div class="shop-icon">🏡</div>
                <div class="shop-info">
                    <div class="shop-name font-bold text-orange">ファーム拡張許可証 (${isFarmMax ? 'MAX' : `第${nextFarmSlot}枠`})</div>
                    <div class="shop-desc">キャラクターファーム（牧場）の配置スロット枠を永続的に+1拡張します。（最大${FARM_MAX_SLOTS}枠）</div>
                </div>
                <div class="shop-right">
                    <div class="shop-level-tag">${farmUnlocked} / ${FARM_MAX_SLOTS} 枠</div>
                    ${farmBtnHtml}
                </div>
            </div>
        `;

        if (rawData.shopItems) {
            rawData.shopItems.forEach(i => { 
                const lv = (gameState.itemLevels && gameState.itemLevels[i.id]) ? gameState.itemLevels[i.id] : 0;
                const p = i.price * (lv + 1);
                const isMax = lv >= MAX_ITEM_LEVEL;
                l.innerHTML += `
                    <div class="shop-item">
                        <div class="shop-icon">${i.icon}</div>
                        <div class="shop-info">
                            <div class="shop-name">${i.name}</div>
                            <div class="shop-desc">${i.desc}</div>
                        </div>
                        <div class="shop-right">
                            <div class="shop-level-tag">Lv.${lv} / ${MAX_ITEM_LEVEL}</div>
                            <button class="shop-buy-btn" ${isMax ? 'disabled' : ''} onclick="buyItem('${i.id}', ${p})">
                                ${isMax ? 'MAX' : '⬆ ' + p.toLocaleString() + 'XP'}
                            </button>
                        </div>
                    </div>
                `; 
            }); 
        }
    } else {
        const rates = [
            { id: 'xpBookSmall', name: '小の書', cost: 20, gain: 200, icon: '📔' },
            { id: 'xpBookMedium', name: '中の書', cost: 35, gain: 500, icon: '📕' },
            { id: 'xpBookLarge', name: '大の書', cost: 50, gain: 1000, icon: '📘' }
        ];
        rates.forEach(ex => {
            const canEx = (gameState.inventory.redPages >= ex.cost && gameState.inventory.bluePages >= ex.cost);
            const currentCount = gameState.inventory[ex.id] || 0;
            l.innerHTML += `
                <div class="shop-item">
                    <div class="shop-icon">${ex.icon}</div>
                    <div class="shop-info">
                        <div class="shop-name">${ex.name}</div>
                        <div class="shop-desc">キャラXP +${ex.gain}</div>
                        <div style="font-size:0.8em; color:#7f8c8d;">所持: ${currentCount}冊</div>
                        <div style="font-size:0.8em; color:#e67e22; font-weight:bold;">必要: 📕${ex.cost} & 📘${ex.cost}</div>
                    </div>
                    <div class="shop-right">
                        <button class="shop-buy-btn" ${canEx ? '' : 'disabled'} onclick="exchangeBook('${ex.id}', ${ex.cost})">交換</button>
                    </div>
                </div>
            `;
        });
    }
}

/**
 * アバターアイテムショップの描画
 */
export function renderAvatarShop() {
    const listEl = document.getElementById('avatar-shop-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    updateAllXpDisplays();

    const def = AVATAR_PARTS_DEF;

    AVATAR_SHOP_ITEMS.forEach(item => {
        const isOwned = isAvatarPartUnlocked(item.category, item.index);
        const canAfford = gameState.xp >= item.price;

        // プレビュー用アバターデータ生成
        const previewAvatar = {
            base: 0, skinColor: "#fcd34d", eyes: 0, mouth: 0, hair: 0, hairColor: "#1e293b", outfit: 0, accessory: 0
        };
        if (item.category === 'skinColor') {
            previewAvatar.skinColor = def.skinColors[item.index] || previewAvatar.skinColor;
        } else if (item.category === 'hairColor') {
            previewAvatar.hairColor = def.hairColors[item.index] || previewAvatar.hairColor;
            previewAvatar.hair = 1;
        } else {
            previewAvatar[item.category] = item.index;
        }
        const svgHtml = generateAvatarSvg(previewAvatar, 52);

        const card = document.createElement('div');
        card.className = `shop-item ${isOwned ? 'owned-item' : ''}`;
        card.innerHTML = `
            <div class="shop-avatar-preview">
                ${svgHtml}
            </div>
            <div class="shop-info">
                <div class="shop-name">${item.name} ${isOwned ? '<span class="owned-tag">所持済</span>' : ''}</div>
                <div class="shop-desc">${item.desc}</div>
                <div class="shop-price-text">必要XP: <span class="text-orange font-bold">${item.price.toLocaleString()} XP</span></div>
            </div>
            <div class="shop-right">
                <button class="shop-buy-btn ${isOwned ? 'btn-owned' : ''}" 
                    ${(isOwned || !canAfford) ? 'disabled' : ''} 
                    onclick="buyAvatarItem('${item.key}', ${item.price})">
                    ${isOwned ? '所持済' : (canAfford ? '購入' : 'XP不足')}
                </button>
            </div>
        `;
        listEl.appendChild(card);
    });
}

/**
 * アバターパーツのXP購入処理
 * @param {string} partKey - パーツ識別子（例: 'hair_6'）
 * @param {number} cost - 必要XP
 */
export async function buyAvatarItem(partKey, cost) {
    if (!Array.isArray(gameState.unlockedAvatars)) gameState.unlockedAvatars = [];
    if (gameState.unlockedAvatars.includes(partKey)) {
        showAlert("既にこのパーツは所持しています。");
        return;
    }
    if (gameState.xp < cost) {
        showAlert("所持XPが足りません！");
        return;
    }

    const itemDef = AVATAR_SHOP_ITEMS.find(x => x.key === partKey);
    const itemName = itemDef ? itemDef.name : partKey;

    if (!(await showConfirm(`${cost.toLocaleString()} XPを消費して「${itemName}」を購入しますか？`))) return;

    gameState.xp -= cost;
    gameState.unlockedAvatars.push(partKey);
    saveGame();
    playSE('win');
    showAlert(`🎉 「${itemName}」を購入しました！\nアバター編集から自由に着用できます。`);
    updateAllXpDisplays();
    renderAvatarShop();
}

export function buySlotPermit(slotIndex, cost) {
    if ((Number(gameState.unlockedSlots) || 1) >= slotIndex + 1) {
        return showAlert("既に解放済みです。");
    }
    if (slotIndex === 2 && (Number(gameState.unlockedSlots) || 1) < 2) {
        return showAlert("先に「サブスロット解放許可証Ⅰ」を購入してください。");
    }
    if (gameState.xp < cost) {
        return showAlert(`XPが不足しています（必要: ${cost.toLocaleString()} XP）。`);
    }

    gameState.xp -= cost;
    gameState.unlockedSlots = Math.max(Number(gameState.unlockedSlots) || 1, slotIndex + 1);
    updateMissionProgress('shop', 1);
    saveGame();
    updateTitleInfo();
    updateAllXpDisplays();
    renderShop();
    playSE('win');
    showAlert(`🎉 「サブスロット解放許可証${slotIndex === 1 ? 'Ⅰ' : 'Ⅱ'}」を購入しました！\n装備スロット${slotIndex + 1}が解放されました。`);
}

export function buyFarmSlotPermit(targetSlot, cost) {
    if (!gameState.farm) {
        gameState.farm = {
            unlockedSlots: FARM_DEFAULT_SLOTS,
            slots: Array(FARM_MAX_SLOTS).fill(null),
            totalCareCount: 0
        };
    }
    const currentUnlocked = Number(gameState.farm.unlockedSlots) || FARM_DEFAULT_SLOTS;
    if (currentUnlocked >= FARM_MAX_SLOTS) {
        return showAlert("ファームスロットは既に最大まで解放されています。");
    }
    if (currentUnlocked >= targetSlot) {
        return showAlert("既に解放済みです。");
    }
    if (gameState.xp < cost) {
        return showAlert(`XPが不足しています（必要: ${cost.toLocaleString()} XP）。`);
    }

    gameState.xp -= cost;
    gameState.farm.unlockedSlots = Math.min(FARM_MAX_SLOTS, currentUnlocked + 1);
    updateMissionProgress('shop', 1);
    saveGame();
    updateTitleInfo();
    updateAllXpDisplays();
    renderShop();
    playSE('win');
    showAlert(`🎉 「ファーム拡張許可証（第${gameState.farm.unlockedSlots}枠）」を購入しました！\nファームに預けられるキャラクター枠が ${gameState.farm.unlockedSlots} 枠になりました。`);
}

export function buyItem(id, p) { 
    if (!gameState.itemLevels) gameState.itemLevels = {}; 
    if((gameState.itemLevels[id]||0) >= 10) return; 
    if(gameState.xp < p) return alert("XP不足"); 
    gameState.xp -= p; 
    gameState.itemLevels[id] = (gameState.itemLevels[id] || 0) + 1; 
    updateMissionProgress('shop', 1); 
    saveGame(); 
    openShop(); 
    updateAllXpDisplays(); 
    checkTitles(); 
}

export function exchangeBook(bookId, cost) { 
    if (gameState.inventory.redPages < cost || gameState.inventory.bluePages < cost) return; 
    gameState.inventory.redPages -= cost; 
    gameState.inventory.bluePages -= cost; 
    gameState.inventory[bookId] = (gameState.inventory[bookId] || 0) + 1; 
    updateMissionProgress('shop', 1); 
    saveGame(); 
    renderShop(); 
    updateAllXpDisplays();
    playSE('win'); 
}

if (typeof window !== 'undefined') {
    window.switchShopTab = switchShopTab;
    window.openGachaMenu = openGachaMenu;
    window.closeGachaMenu = closeGachaMenu;
    window.openZukanMenu = openZukanMenu;
    window.closeZukanMenu = closeZukanMenu;
    window.openMixerMenu = openMixerMenu;
    window.closeMixerMenu = closeMixerMenu;
    window.updateAllXpDisplays = updateAllXpDisplays;
    window.switchMixerRarity = switchMixerRarity;
    window.renderMixerSlots = renderMixerSlots;
    window.renderMixerMaterialList = renderMixerMaterialList;
    window.adjustMixerMaterial = adjustMixerMaterial;
    window.clearMixerSelection = clearMixerSelection;
    window.executeMixerSynthesis = executeMixerSynthesis;
    window.renderAvatarShop = renderAvatarShop;
    window.buyAvatarItem = buyAvatarItem;
}

// ==========================================
// ミッション・称号・ログインボーナス
// ==========================================
export function openMissions() { 
    closeAllCategoryModals();
    document.getElementById('mission-overlay')?.classList.remove('hidden'); 
    renderMissions(); 
}

export function closeMissions() { 
    document.getElementById('mission-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

export function renderMissions() { 
    const l=document.getElementById('mission-list'); if(!l) return; l.innerHTML=''; let all=true; 
    MISSIONS.forEach(m=>{ 
        const p=dailyMissions.progress[m.id]||0; 
        const fin=p>=m.target; const clm=dailyMissions.claimed[m.id]; 
        if(!fin)all=false; 
        l.innerHTML+=`<div class="mission-item"><b>${m.title}</b> (${p}/${m.target})<br><small>${m.desc}</small><button class="mission-btn ${fin&&!clm?'active':'disabled'}" onclick="claimMission('${m.id}',${m.reward})">${clm?'受取済':'受取'}</button></div>`; 
    }); 
    if(all){ 
        const isClaimed = dailyMissions.claimed.allClear;
        let btnStyle = isClaimed ? '' : 'background:#f1c40f; border-color:#d35400;'; 
        let btnClass = isClaimed ? 'disabled' : ''; 
        let btnText = isClaimed ? '受取済' : `${MISSION_ALL_CLEAR} EXPを受け取る`;
        let btnAction = isClaimed ? '' : 'onclick="claimAllClear()"';
        l.innerHTML += `<div style="margin-top:10px; padding:10px; background:#fef5e7; border:2px solid #e67e22; border-radius:10px;"><div style="font-weight:bold; color:#e67e22;">コンプリート報酬</div><button class="mission-btn ${btnClass}" style="width:100%; margin-top:5px; ${btnStyle}" ${btnAction}>${btnText}</button></div>`; 
    } 
}

export function claimMission(id, r) { 
    if(dailyMissions.claimed[id]) return; 
    dailyMissions.claimed[id] = true; 
    gameState.xp += r; 
    saveGame(); 
    renderMissions(); 
    updateTitleInfo(); 
    updateMissionBadge(); 
    alert(r + " XP を獲得しました！"); 
}

export function claimAllClear() { 
    if(dailyMissions.claimed.allClear) return; 
    dailyMissions.claimed.allClear = true; 
    gameState.xp += MISSION_ALL_CLEAR; 
    saveGame(); 
    renderMissions(); 
    updateTitleInfo(); 
    updateMissionBadge(); 
    alert(MISSION_ALL_CLEAR + " XP を獲得しました！"); 
}

export function updateMissionProgress(t, v) { 
    if(t === 'maxCombo') dailyMissions.progress[t] = Math.max(dailyMissions.progress[t] || 0, v); 
    else dailyMissions.progress[t] = (dailyMissions.progress[t] || 0) + v; 
    saveGame(); 
    updateMissionBadge(); 
}

export function updateMissionBadge() { 
    let c = 0; 
    MISSIONS.forEach(m => { 
        if((dailyMissions.progress[m.id] || 0) >= m.target && !dailyMissions.claimed[m.id]) c++; 
    }); 
    document.getElementById('mission-badge')?.classList.toggle('hidden', c === 0); 
    updateCategoryBadges();
}

export function openTitles() { 
    closeAllCategoryModals();
    document.getElementById('titles-overlay')?.classList.remove('hidden'); 
    renderTitles(); 
}

export function closeTitles() { 
    document.getElementById('titles-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

export function renderTitles() {
    const list = document.getElementById('titles-list'); if(!list) return; list.innerHTML = '';
    let collectionCount = 0; 
    let hasSSR = false; let hasUR = false; let hasLvMax = false; let hasMastered = false;
    
    if(gameState.charaInventory) {
        collectionCount = Object.keys(gameState.charaInventory).length;
        Object.keys(gameState.charaInventory).forEach(id => {
            const c = rawData.characters ? rawData.characters.find(x => x.id === id) : null;
            const inv = gameState.charaInventory[id];
            if(c && c.rarity === 'SSR') hasSSR = true;
            if(c && c.rarity === 'UR') hasUR = true;
            if(inv && inv.level >= 20) hasLvMax = true;
            if(inv && inv.count >= MASTER_COUNT) hasMastered = true;
        });
    }

    TITLES.forEach(t => {
        const isClaimed = gameState.unlockedTitles.includes(t.id); let isUnlocked = false;
        if (isClaimed) isUnlocked = true;
        else {
            if (t.req.includes('collection') && collectionCount >= t.val) isUnlocked = true;
            else if (t.req.includes('xp') && gameState.xp >= t.val) isUnlocked = true;
            else if (t.req === 'ssr' && hasSSR) isUnlocked = true;
            else if (t.req === 'ur' && hasUR) isUnlocked = true;
            else if (t.req === 'lvMax' && hasLvMax) isUnlocked = true;
            else if (t.req === 'itemMax' && Object.values(gameState.itemLevels).some(lv => lv >= MAX_ITEM_LEVEL)) isUnlocked = true;
            else if (t.req === 'perfect' && gameState.stats.achieved_perfect) isUnlocked = true;
            else if (t.req === 'speed' && gameState.stats.achieved_speed) isUnlocked = true;
            else if (t.req === 'randomClear' && gameState.stats.achieved_random) isUnlocked = true;
            else if (t.req === 'oathClear' && gameState.stats.achieved_oath) isUnlocked = true;
            else if (t.req === 'evolved' && gameState.stats.achieved_evolve) isUnlocked = true;
            else if (t.req === 'mastered' && hasMastered) isUnlocked = true;
            else if (t.req === 'reborn' && gameState.stats.achieved_reborn) isUnlocked = true;
            else if (t.req === 'calcA' && gameState.stats.achieved_calcA) isUnlocked = true;
            else { 
                const match = t.req.match(/^[a-zA-Z]+/);
                if(match) {
                    const key = match[0]; 
                    if ((gameState.stats[key] || 0) >= t.val) isUnlocked = true; 
                }
            }
        }
        let statusClass = isClaimed ? 'claimed' : (isUnlocked ? 'unlocked' : '');
        let btnText = isClaimed ? '受取済' : (isUnlocked ? `受取: ${t.reward}XP` : '未達成');
        let btnAction = (isUnlocked && !isClaimed) ? `onclick="claimTitle('${t.id}', ${t.reward})"` : '';
        list.innerHTML += `<div class="title-item ${statusClass}"><div class="title-header"><span class="title-name">${t.name}</span><button class="title-reward-btn" ${btnAction}>${btnText}</button></div><div class="title-req">${t.desc}</div></div>`;
    });
}

export function claimTitle(id, reward) {
    if(gameState.unlockedTitles.includes(id)) return;
    gameState.unlockedTitles.push(id); 
    gameState.xp += reward; 
    saveGame(); 
    renderTitles(); 
    updateTitleInfo(); 
    checkTitles();
    alert(`称号を獲得しました！\n報酬: ${reward} XP`);
}

export function checkTitles() {
    let count = 0; let collectionCount = 0; 
    let hasSSR = false; let hasUR = false; let hasLvMax = false; let hasMastered = false;
    
    if(gameState.charaInventory && rawData.characters && rawData.characters.length > 0) {
        collectionCount = Object.keys(gameState.charaInventory).length;
        Object.keys(gameState.charaInventory).forEach(id => {
            const c = rawData.characters.find(x => x.id === id); const inv = gameState.charaInventory[id];
            if(c && c.rarity === 'SSR') hasSSR = true;
            if(c && c.rarity === 'UR') hasUR = true;
            if(inv && inv.level >= 20) hasLvMax = true;
            if(inv && inv.count >= MASTER_COUNT) hasMastered = true;
        });
    }
    let hasItemMax = false;
    if(gameState.itemLevels) Object.values(gameState.itemLevels).forEach(lv => { if(lv >= MAX_ITEM_LEVEL) hasItemMax = true; });

    TITLES.forEach(t => {
        if (gameState.unlockedTitles.includes(t.id)) return;
        let cleared = false;
        if (t.req === 'perfect' && gameState.stats.achieved_perfect) cleared = true;
        else if (t.req === 'speed' && gameState.stats.achieved_speed) cleared = true;
        else if (t.req === 'ssr' && hasSSR) cleared = true;
        else if (t.req === 'ur' && hasUR) cleared = true;
        else if (t.req === 'lvMax' && hasLvMax) cleared = true;
        else if (t.req === 'itemMax' && hasItemMax) cleared = true;
        else if (t.req === 'randomClear' && gameState.stats.achieved_random) cleared = true;
        else if (t.req === 'oathClear' && gameState.stats.achieved_oath) cleared = true;
        else if (t.req === 'evolved' && gameState.stats.achieved_evolve) cleared = true;
        else if (t.req === 'mastered' && hasMastered) cleared = true;
        else if (t.req === 'reborn' && gameState.stats.achieved_reborn) cleared = true;
        else if (t.req === 'calcA' && gameState.stats.achieved_calcA) cleared = true;
        else if (t.req.includes('collection')) { if (collectionCount >= t.val) cleared = true; }
        else if (t.req.includes('xp')) { if (gameState.xp >= t.val) cleared = true; }
        else { 
            try { 
                const match = t.req.match(/^[a-zA-Z]+/);
                if(match) {
                    const key = match[0];
                    const val = gameState.stats[key] || 0; 
                    if (val >= t.val) cleared = true; 
                }
            } catch(e){} 
        }
        if (cleared) count++;
    });
    const badge = document.getElementById('title-badge');
    if(badge) {
        if(count > 0) { badge.classList.remove('hidden'); badge.innerText = count > 9 ? '!' : count; } else { badge.classList.add('hidden'); }
    }

    updateCategoryBadges();
}

export function checkLoginBonus() { 
    const d = new Date().toLocaleDateString('ja-JP'); 
    if(localStorage.getItem('sq_last_login') !== d){ 
        gameState.xp += LOGIN_BONUS_EXP; 
        localStorage.setItem('sq_last_login', d); 
        gameState.stats.loginDays = (gameState.stats.loginDays || 0) + 1;
        saveGame(); 
        document.getElementById('login-bonus-overlay')?.classList.remove('hidden'); 
        updateTitleInfo(); 
        checkTitles();
    } 
}

export function closeLoginBonus() { 
    document.getElementById('login-bonus-overlay')?.classList.add('hidden'); 
}

export function checkMissionDate() { 
    const d = new Date().toLocaleDateString('ja-JP'); 
    const saved = localStorage.getItem('sq_missions');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            dailyMissions.date = parsed.date || "";
            dailyMissions.progress = parsed.progress || dailyMissions.progress;
            dailyMissions.claimed = parsed.claimed || dailyMissions.claimed;
        } catch(e) {}
    }
    if(dailyMissions.date !== d){ 
        dailyMissions.date = d;
        dailyMissions.progress = { play: 0, kill: 0, correct: 0, maxCombo: 0, enhance: 0, typing: 0, calc: 0, gacha: 0, shop: 0 };
        dailyMissions.claimed = { play: false, kill: false, correct: false, maxCombo: false, enhance: false, typing: false, calc: false, gacha: false, shop: false, allClear: false };
        saveGame(); 
    } 
    updateMissionBadge(); 
}

// ==========================================
// 持ち物（HeldItems）着脱・選択・図鑑制御 (Ver 10.5.0)
// ==========================================

/**
 * 特定持ち物の全キャラ合計装備数を算出
 */
export function getHeldItemAssignedCount(itemId) {
    if (!gameState.charaInventory) return 0;
    return Object.values(gameState.charaInventory).filter(c => c && String(c.heldItem) === String(itemId)).length;
}

/**
 * 特定持ち物の未装備在庫数を算出
 */
export function getHeldItemAvailableCount(itemId) {
    const total = gameState.heldItemInventory && gameState.heldItemInventory[itemId] ? (Number(gameState.heldItemInventory[itemId].count) || 0) : 0;
    const assigned = getHeldItemAssignedCount(itemId);
    return Math.max(0, total - assigned);
}

let selectingCharaIdForHeldItem = null;

/**
 * 持ち物選択モーダルを開く
 */
export function openHeldItemSelectModal(charaId) {
    selectingCharaIdForHeldItem = charaId;
    const listEl = document.getElementById('helditem-select-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const chara = rawData.characters ? rawData.characters.find(c => String(c.id) === String(charaId)) : null;
    const userChara = gameState.charaInventory ? gameState.charaInventory[charaId] : null;
    const currentEquippedId = userChara ? userChara.heldItem : null;

    // 所有している持ち物の中から、利用可能（または現在このキャラが装備中）なアイテムを一覧化
    const allHeld = rawData.heldItems || [];
    const availableItems = allHeld.filter(item => {
        const avail = getHeldItemAvailableCount(item.id);
        const isCurrentlyEquippedByThis = String(currentEquippedId) === String(item.id);
        return avail > 0 || isCurrentlyEquippedByThis;
    });

    if (availableItems.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; padding:30px 10px; color:#64748b;">
                <div style="font-size:2em; margin-bottom:8px;">🧰</div>
                <div style="font-weight:bold; font-size:0.9em;">装備可能な持ち物がありません</div>
                <div style="font-size:0.75em; margin-top:5px; color:#94a3b8;">ガチャで持ち物を手に入れよう！</div>
            </div>
        `;
    } else {
        availableItems.forEach(item => {
            const avail = getHeldItemAvailableCount(item.id);
            const isEquippedHere = String(currentEquippedId) === String(item.id);
            const iconHtml = item.imageUrl ? renderSafeImg(item.imageUrl, '🧰', 'helditem-icon-img') : '🧰';

            let valText = '';
            if (item.value && Number(item.value) !== 1.0) {
                const diff = Math.round((Number(item.value) - 1.0) * 100);
                valText = `${item.type || 'ATK'} ${diff >= 0 ? '+' : ''}${diff}%`;
            } else if (item.type) {
                valText = `${item.type}`;
            }

            let specText = '';
            if (item.special === 'INIT_SP_1') specText = '⚡ 開幕SP+1';
            else if (item.special === 'PINCH_SHIELD') specText = '🛡️ 瀕死シールド(1回)';
            else if (item.special) specText = `✨ ${item.special}`;

            const card = document.createElement('div');
            card.className = 'helditem-select-card';
            card.innerHTML = `
                <div class="helditem-icon-box">${iconHtml}</div>
                <div class="helditem-info-col">
                    <div class="helditem-name-row">
                        <span class="rarity-${item.rarity || 'N'}" style="font-size:0.75em; font-weight:bold;">${item.rarity || 'N'}</span>
                        <span class="helditem-name">${item.name}</span>
                    </div>
                    ${valText ? `<div class="helditem-effect-desc">📈 効果: ${valText}</div>` : ''}
                    ${specText ? `<div class="helditem-special-desc">${specText}</div>` : ''}
                    <div style="font-size:0.72em; color:#64748b; margin-top:2px;">${item.desc || ''}</div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0;">
                    <span class="helditem-stock-tag ${avail > 0 ? 'available' : ''}">未装備: ${avail}個</span>
                    ${isEquippedHere ? '<span style="font-size:0.7em; color:#2563eb; font-weight:bold;">装備中</span>' : ''}
                </div>
            `;
            card.onclick = () => equipHeldItem(charaId, item.id);
            listEl.appendChild(card);
        });
    }

    document.getElementById('helditem-select-overlay')?.classList.remove('hidden');
}

/**
 * 持ち物選択モーダルを閉じる
 */
export function closeHeldItemSelectModal() {
    document.getElementById('helditem-select-overlay')?.classList.add('hidden');
    selectingCharaIdForHeldItem = null;
}

/**
 * キャラクターに持ち物を装備
 */
export function equipHeldItem(charaId, itemId) {
    if (!gameState.charaInventory || !gameState.charaInventory[charaId]) return;

    const currentItem = gameState.charaInventory[charaId].heldItem;
    if (String(currentItem) === String(itemId)) {
        closeHeldItemSelectModal();
        return;
    }

    // 在庫チェック
    const avail = getHeldItemAvailableCount(itemId);
    if (avail <= 0) {
        alert("そのアイテムは他のキャラクターがすべて装備中です。");
        return;
    }

    gameState.charaInventory[charaId].heldItem = String(itemId);
    playSE('select');
    saveGame();
    closeHeldItemSelectModal();
    openCharaDetail(charaId);
}

/**
 * キャラクターから持ち物を解除
 */
export function unequipHeldItem(charaId) {
    if (!gameState.charaInventory || !gameState.charaInventory[charaId]) return;
    gameState.charaInventory[charaId].heldItem = null;
    playSE('select');
    saveGame();
    openCharaDetail(charaId);
}

/**
 * 図鑑の表示タブ（キャラクター / 持ち物）切り替え
 */
let currentZukanTab = 'chara';

export function switchZukanTab(tab) {
    currentZukanTab = tab;
    const btnChara = document.getElementById('zukan-tab-chara');
    const btnHeld = document.getElementById('zukan-tab-helditem');
    const gridChara = document.getElementById('zukan-grid');
    const gridHeld = document.getElementById('helditem-zukan-grid');
    const titleEl = document.getElementById('zukan-modal-title');
    const sortWrap = document.getElementById('zukan-sort-select')?.parentElement;

    if (tab === 'chara') {
        btnChara?.classList.add('active');
        btnHeld?.classList.remove('active');
        gridChara?.classList.remove('hidden');
        gridHeld?.classList.add('hidden');
        if (titleEl) titleEl.innerText = '📖 文房具キャラ図鑑';
        if (sortWrap) sortWrap.style.display = '';
        renderZukan();
    } else {
        btnChara?.classList.remove('active');
        btnHeld?.classList.add('active');
        gridChara?.classList.add('hidden');
        gridHeld?.classList.remove('hidden');
        if (titleEl) titleEl.innerText = '🧰 持ち物図鑑';
        if (sortWrap) sortWrap.style.display = 'none';
        renderHeldItemZukan();
    }
}

/**
 * 持ち物図鑑の描画
 */
export function renderHeldItemZukan() {
    const grid = document.getElementById('helditem-zukan-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const allHeld = rawData.heldItems || [];
    if (allHeld.length === 0) {
        grid.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;">持ち物マスターデータを読み込み中または未登録です</div>';
        return;
    }

    const container = document.createElement('div');
    container.style.cssText = 'display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; padding:5px;';

    allHeld.forEach(item => {
        const count = gameState.heldItemInventory && gameState.heldItemInventory[item.id] ? (Number(gameState.heldItemInventory[item.id].count) || 0) : 0;
        const isOwned = count > 0;
        const assigned = getHeldItemAssignedCount(item.id);

        let iconHtml = item.imageUrl
            ? renderSafeImg(item.imageUrl, '🧰', 'gr-mini-img', isOwned ? '' : 'filter:grayscale(100%) opacity(40%);')
            : (isOwned ? '🧰' : '❓');

        let valText = '';
        if (item.value && Number(item.value) !== 1.0) {
            const diff = Math.round((Number(item.value) - 1.0) * 100);
            valText = `${item.type || 'ATK'} ${diff >= 0 ? '+' : ''}${diff}%`;
        } else if (item.type) {
            valText = `${item.type}`;
        }

        let specText = '';
        if (item.special === 'INIT_SP_1') specText = '⚡ 開幕SP+1';
        else if (item.special === 'PINCH_SHIELD') specText = '🛡️ 瀕死シールド(1回)';
        else if (item.special) specText = `✨ ${item.special}`;

        const card = document.createElement('div');
        card.className = 'gr-mini-card';
        card.style.cssText = isOwned
            ? 'background:#fff; border:2px solid #cbd5e1; border-radius:10px; padding:8px; text-align:center;'
            : 'background:#f8fafc; border:2px dashed #cbd5e1; border-radius:10px; padding:8px; text-align:center; opacity:0.6;';

        card.innerHTML = `
            <div class="rarity-${item.rarity || 'N'}" style="font-size:0.8em; font-weight:bold;">${item.rarity || 'N'}</div>
            ${iconHtml}
            <div style="font-size:0.8em; font-weight:bold; color:${isOwned ? '#1e293b' : '#94a3b8'}; margin-top:2px;">
                ${isOwned ? item.name : '？？？'}
            </div>
            ${isOwned && valText ? `<div style="font-size:0.72em; font-weight:bold; color:#2563eb;">${valText}</div>` : ''}
            ${isOwned && specText ? `<div style="font-size:0.7em; font-weight:bold; color:#d97706;">${specText}</div>` : ''}
            <div style="font-size:0.72em; color:${isOwned ? '#16a34a' : '#94a3b8'}; font-weight:bold; margin-top:4px;">
                ${isOwned ? `所持: ${count}個 (装備中: ${assigned})` : '未所持'}
            </div>
        `;
        container.appendChild(card);
    });

    grid.appendChild(container);
}


