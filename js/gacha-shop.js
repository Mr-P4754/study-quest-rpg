// ==========================================
// js/gacha-shop.js (ガチャ・図鑑・育成・ショップ・実績)
// ==========================================

import {
    gameState,
    rawData,
    dailyMissions,
    runtimeState,
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
    saveGame
} from './state.js?v=10.2.6';

import {
    getRarityIndex,
    getDisplayName,
    playSE,
    renderSafeImg
} from './utils.js?v=10.2.6';

import {
    showAppModal,
    showAlert,
    showConfirm,
    updateTitleInfo,
    hideCurrentCategoryOverlay,
    returnToCurrentCategory,
    closeAllCategoryModals,
    updateCategoryBadges
} from './ui-manager.js?v=10.2.6';

let selectedMaterials = {};
let viewingCharaId = null;
let currentShopTab = 'buy';
let zukanSortMode = 'default';

// ==========================================
// ガチャ＆図鑑
// ==========================================
export function openGacha() { 
    closeAllCategoryModals();
    document.getElementById('gacha-overlay')?.classList.remove('hidden'); 
    renderZukan(); 
    const xpSpan = document.getElementById('gacha-xp');
    if (xpSpan) xpSpan.innerText = gameState.xp; 
}

export function closeGacha() { 
    document.getElementById('gacha-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
    updateTitleInfo();
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
    const gXp = document.getElementById('gacha-xp');
    if(gXp) gXp.innerText = gameState.xp;
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
    
    const isEquipped = String(gameState.equipped) === String(id);
    const btnEquip = document.getElementById('btn-equip') || document.querySelector('.btn-equip-action');
    if (btnEquip) {
        if (isEquipped) {
            btnEquip.innerText = '✅ 装備中';
            btnEquip.disabled = true;
            btnEquip.style.opacity = '0.7';
            btnEquip.style.cursor = 'default';
        } else {
            btnEquip.innerText = '🛡️ このキャラを装備';
            btnEquip.disabled = false;
            btnEquip.style.opacity = '1.0';
            btnEquip.style.cursor = 'pointer';
        }
    }

    const btnEnhance = document.getElementById('btn-enhance');
    if (btnEnhance) {
        btnEnhance.disabled = isMax;
        btnEnhance.style.opacity = isMax ? "0.5" : "1.0";
        btnEnhance.style.cursor = isMax ? "not-allowed" : "pointer";
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

export function equipCurrentChara() {
    if (!viewingCharaId) return;
    gameState.equipped = String(viewingCharaId);
    saveGame();
    updateTitleInfo();
    renderZukan();
    alert("装備を変更しました！");
    closeCharaDetail();
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
    const currentR = o.currentRarity || (c ? c.rarity : 'N');
    const price = (typeof SELL_PRICES !== 'undefined' && SELL_PRICES[currentR]) ? SELL_PRICES[currentR] : 250;
    if (!(await showConfirm(`素材を1体売却して ${price} XPを獲得しますか？`))) return; 
    o.count--; 
    gameState.xp += price; 
    saveGame(); 
    openCharaDetail(viewingCharaId); 
    updateTitleInfo();
}

// ==========================================
// ショップ
// ==========================================
export function openShop() { 
    closeAllCategoryModals();
    currentShopTab = 'buy';
    document.getElementById('shop-overlay')?.classList.remove('hidden'); 
    renderShop(); 
}

export function closeShop() { 
    document.getElementById('shop-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
    updateTitleInfo();
}

export function switchShopTab(tab) {
    currentShopTab = tab;
    renderShop();
}
if (typeof window !== 'undefined') {
    window.switchShopTab = switchShopTab;
}

export function renderShop() {
    const shopXp = document.getElementById('shop-xp'); if(shopXp) shopXp.innerText = gameState.xp;
    const l=document.getElementById('shop-list'); if(!l) return;
    l.innerHTML=`<div class="page-counter-container"><div class="page-item">📕 <span>${gameState.inventory.redPages||0}</span></div><div class="page-item">📘 <span>${gameState.inventory.bluePages||0}</span></div></div><div class="item-tab-container"><div class="item-tab ${currentShopTab==='buy'?'active':''}" onclick="switchShopTab('buy')">学習アイテム</div><div class="item-tab ${currentShopTab==='exchange'?'active':''}" onclick="switchShopTab('exchange')">アイテム交換</div></div>`; 
    if(currentShopTab === 'buy') {
        if(rawData.shopItems) rawData.shopItems.forEach(i=>{ 
            const lv = (gameState.itemLevels && gameState.itemLevels[i.id]) ? gameState.itemLevels[i.id] : 0;
            const p = i.price * (lv + 1);
            const isMax = lv >= MAX_ITEM_LEVEL;
            l.innerHTML+=`<div class="shop-item"><div class="shop-icon">${i.icon}</div><div class="shop-info"><div class="shop-name">${i.name}</div><div class="shop-desc">${i.desc}</div></div><div class="shop-right"><div class="shop-level-tag">Lv.${lv} / ${MAX_ITEM_LEVEL}</div><button class="shop-buy-btn" ${isMax?'disabled':''} onclick="buyItem('${i.id}',${p})">${isMax?'MAX':'⬆ '+p+'XP'}</button></div></div>`; 
        }); 
    } else {
        const rates = [ { id: 'xpBookSmall', name: '小の書', cost: 20, gain: 200, icon: '📔' }, { id: 'xpBookMedium', name: '中の書', cost: 35, gain: 500, icon: '📕' }, { id: 'xpBookLarge', name: '大の書', cost: 50, gain: 1000, icon: '📘' } ];
        rates.forEach(ex => {
            const canEx = (gameState.inventory.redPages >= ex.cost && gameState.inventory.bluePages >= ex.cost);
            const currentCount = gameState.inventory[ex.id] || 0;
            l.innerHTML += `<div class="shop-item"><div class="shop-icon">${ex.icon}</div><div class="shop-info"><div class="shop-name">${ex.name}</div><div class="shop-desc">キャラXP +${ex.gain}</div><div style="font-size:0.8em; color:#7f8c8d;">所持: ${currentCount}冊</div><div style="font-size:0.8em; color:#e67e22; font-weight:bold;">必要: 📕${ex.cost} & 📘${ex.cost}</div></div><div class="shop-right"><button class="shop-buy-btn" ${canEx?'':'disabled'} onclick="exchangeBook('${ex.id}', ${ex.cost})">交換</button></div></div>`;
        });
    }
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
    updateTitleInfo(); 
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
    updateTitleInfo();
    playSE('win'); 
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

