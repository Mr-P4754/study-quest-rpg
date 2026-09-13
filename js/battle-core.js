// ==========================================
// js/battle-core.js (戦闘共通エンジン・UI更新・カットイン・リザルト)
// ==========================================

import {
    gameState,
    playData,
    rawData,
    rogueData,
    runtimeState,
    LV_BONUS_RATE,
    RARITY_CAPS,
    saveGame
} from './state.js?v=10.5.0';

import {
    getDisplayName,
    getGradeMultiplier,
    playSE,
    playBGM,
    stopBGM,
    isGradeMatch,
    renderSafeImg
} from './utils.js?v=10.5.0';

import {
    updateMissionProgress,
    checkTitles
} from './gacha-shop.js?v=10.5.0';

import {
    showAppModal,
    showConfirm,
    updateTitleInfo,
    addCalcRecord
} from './ui-manager.js?v=10.5.0';

import { cloudSync } from './api.js?v=10.5.0';

export function showCutIn(t) { 
    const str = String(t);
    const d = document.createElement('div'); 
    d.className = 'cutin'; 
    d.innerText = str; 

    if (str.includes('✕')) {
        d.classList.add('cutin-miss');
    } else if (str.startsWith('-') || /^\d+$/.test(str.replace(/^-/, ''))) {
        d.classList.add('cutin-damage');
    } else if (str.includes('+') || str === 'GOOD!') {
        d.classList.add('cutin-heal');
    } else if (str === 'GO!' || /^[1-3]$/.test(str)) {
        d.classList.add('cutin-countdown');
    } else {
        d.classList.add('cutin-damage');
    }

    document.body.appendChild(d); 
    setTimeout(() => d.remove(), 1300); 
}

/**
 * 必殺技（アクティブスキル）専用の上下2段カットイン演出（文字被り防止・可読性最適化）
 * @param {string} skillTitle 技名（例: '⚡ ラッキーボーナス！'）
 * @param {string} effectText 効果値（例: '+200 XP', '-500 HP'）
 * @param {'damage'|'heal'|'exp'|'all'} effectType 効果の属性
 */
export function showSkillCutIn(skillTitle, effectText, effectType = 'damage') {
    const container = document.createElement('div');
    container.className = 'cutin-skill-container';

    const banner = document.createElement('div');
    banner.className = 'cutin-skill-banner';
    banner.innerText = skillTitle;

    const value = document.createElement('div');
    value.className = `cutin-skill-value cutin-skill-${effectType}`;
    value.innerText = effectText;

    container.appendChild(banner);
    container.appendChild(value);

    document.body.appendChild(container);
    setTimeout(() => container.remove(), 1400);
}

export function updateUI() { 
    const uiLife = document.getElementById('ui-life'); 
    if(uiLife) uiLife.innerText = '❤️'.repeat(Math.max(0, gameState.lives)); 
    const uiScore = document.getElementById('ui-score'); 
    if(uiScore) uiScore.innerText = playData.isCalculation ? playData.calcQIndex : gameState.score; 
    const uiCombo = document.getElementById('ui-combo'); 
    if(uiCombo) uiCombo.innerText = playData.isCalculation ? playData.calcCorrect : gameState.combo; 
    const uiHp = document.getElementById('ui-hp'); 
    if(uiHp) uiHp.style.width = (gameState.maxHP > 0 ? (gameState.enemyHP/gameState.maxHP*100) : 0)+'%'; 
    const uiHpText = document.getElementById('ui-hp-text'); 
    if(uiHpText) uiHpText.innerText = `${gameState.enemyHP}/${gameState.maxHP}`; 
}

export function togglePause() { 
    runtimeState.isPaused = !runtimeState.isPaused; 
    const overlay = document.getElementById('pause-overlay');
    if(overlay) overlay.classList.toggle('hidden', !runtimeState.isPaused);
    if(runtimeState.isPaused) {
        const infoBox = document.getElementById('pause-chara-info');
        if(!infoBox) return;
        const party = Array.isArray(gameState.equippedParty) ? gameState.equippedParty : [(gameState.equipped || '1'), null, null];
        const mainId = party[0] || '1';
        const mainChara = rawData.characters ? rawData.characters.find(c => String(c.id) == String(mainId)) : null;

        // 最大3体のミニアイコン（30px）を並べて表示
        let iconsHtml = '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">';
        for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
            const isUnlocked = slotIdx < (Number(gameState.unlockedSlots) || 1);
            const cId = party[slotIdx];
            const c = cId && rawData.characters ? rawData.characters.find(x => String(x.id) === String(cId)) : null;
            if (!isUnlocked) {
                iconsHtml += '<div style="width:30px; height:30px; border-radius:6px; background:#34495e; display:flex; align-items:center; justify-content:center; font-size:14px; opacity:0.5;" title="未解放スロット">🔒</div>';
            } else if (c) {
                const img = (c.imageUrl && (c.imageUrl.startsWith('http') || c.imageUrl.startsWith('data:image')))
                    ? renderSafeImg(c.imageUrl, '✏️', '', 'width:30px; height:30px; object-fit:cover; border-radius:6px; background:#fff; border:1px solid #f39c12;')
                    : '<div style="width:30px; height:30px; border-radius:6px; background:#fff; border:1px solid #f39c12; display:flex; align-items:center; justify-content:center; font-size:16px;">✏️</div>';
                iconsHtml += img;
            } else {
                iconsHtml += '<div style="width:30px; height:30px; border-radius:6px; background:rgba(255,255,255,0.1); border:1px dashed #7f8c8d; display:flex; align-items:center; justify-content:center; font-size:11px; color:#bdc3c7;" title="空きスロット">空</div>';
            }
        }
        iconsHtml += '</div>';

        if(mainChara) {
            const inv = (gameState.charaInventory && gameState.charaInventory[mainId]) || (gameState.charaInventory && gameState.charaInventory[mainChara.id]) || { level: 1 };
            const baseVal = (inv.isEvolved && inv.customValue) ? inv.customValue : mainChara.value;
            const r = inv.currentRarity || mainChara.rarity;
            const name = getDisplayName(mainChara, inv);
            let val = Number(baseVal) + (inv.level * LV_BONUS_RATE);
            infoBox.innerHTML = `
                ${iconsHtml}
                <div style="text-align:left;">
                    <div style="font-weight:bold; color:#ecf0f1; font-size:0.9em;">${name}</div>
                    <div style="color:#f39c12; font-weight:bold; font-size:0.8em;">Lv.${inv.level}</div>
                    <div style="font-size:0.7em; color:#bdc3c7;"><span class="rarity-${r}" style="font-weight:bold; font-size:1.2em; margin-right:5px;">${r}</span>メイン効果: x${val.toFixed(2)}</div>
                </div>
            `;
        } else { infoBox.innerHTML = `${iconsHtml}<div style="color:#bdc3c7; font-size:0.8em;">装備なし</div>`; }
    }
}

export function resumeGame() { 
    runtimeState.isPaused = false; 
    document.getElementById('pause-overlay')?.classList.add('hidden'); 
}

export async function retryGame() { 
    if (!(await showConfirm("やり直しますか？"))) return; 
    runtimeState.isGameActive = false; 
    clearInterval(gameState.timer); 
    resumeGame(); 
    gameState.timeLeft = 0;
    
    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';

    const qBox = document.getElementById('ui-question');
    if (qBox) { qBox.style.removeProperty('height'); qBox.style.removeProperty('min-height'); }

    const uiScoreSpan = document.getElementById('ui-score'); if(uiScoreSpan && uiScoreSpan.previousSibling && uiScoreSpan.previousSibling.nodeType === 3) uiScoreSpan.previousSibling.nodeValue = "SCORE ";
    const uiComboSpan = document.getElementById('ui-combo'); if(uiComboSpan && uiComboSpan.previousSibling && uiComboSpan.previousSibling.nodeType === 3) uiComboSpan.previousSibling.nodeValue = "COMBO ";
    const resScoreSpan = document.getElementById('res-score'); if(resScoreSpan && resScoreSpan.previousSibling && resScoreSpan.previousSibling.nodeType === 3) resScoreSpan.previousSibling.nodeValue = "獲得スコア: ";
    
    if (playData.isCalculation) { 
        if (typeof window.startCalcGame === 'function') window.startCalcGame(); 
    }
    else if (playData.isTyping) { 
        if (playData.activeOaths && playData.activeOaths.length > 0) { runtimeState.tempOaths = [...playData.activeOaths]; runtimeState.oathOrigin = 'typing'; }
        if (playData.activeReliefs && playData.activeReliefs.length > 0) { runtimeState.tempReliefs = [...playData.activeReliefs]; runtimeState.oathOrigin = 'typing'; }
        if (typeof window.startTypingGame === 'function') window.startTypingGame(); 
    }
    else if (playData.isSurvival) {
        if (playData.activeOaths && playData.activeOaths.length > 0) { runtimeState.tempOaths = [...playData.activeOaths]; runtimeState.oathOrigin = 'survival'; }
        if (playData.activeReliefs && playData.activeReliefs.length > 0) { runtimeState.tempReliefs = [...playData.activeReliefs]; runtimeState.oathOrigin = 'survival'; }
        if (typeof window.startSurvivalGame === 'function') window.startSurvivalGame(); 
    }
    else if (playData.isRandom) { 
        if (playData.activeOaths && playData.activeOaths.length > 0) { runtimeState.tempOaths = [...playData.activeOaths]; runtimeState.oathOrigin = 'random'; }
        if (playData.activeReliefs && playData.activeReliefs.length > 0) { runtimeState.tempReliefs = [...playData.activeReliefs]; runtimeState.oathOrigin = 'random'; }
        if (typeof window.startRandomGame === 'function') window.startRandomGame(); 
    }
    else if (playData.activeOaths && playData.activeOaths.length > 0) {
        runtimeState.tempOaths = [...playData.activeOaths];
        runtimeState.oathOrigin = 'normal';
        if (typeof window.startOathGame === 'function') window.startOathGame(); 
    }
    else if (playData.activeReliefs && playData.activeReliefs.length > 0) {
        runtimeState.tempReliefs = [...playData.activeReliefs];
        runtimeState.oathOrigin = 'normal';
        if (typeof window.startReliefGame === 'function') window.startReliefGame(); 
    }
    else if (playData.isRevenge) { 
        if (typeof window.startRevengeMode === 'function') window.startRevengeMode(); 
    }
    else if (typeof rogueData !== 'undefined' && rogueData.active) { 
        alert("探索モード中はリトライできません。"); 
        resumeGame(); 
    }
    else { 
        if (typeof window.startGame === 'function') window.startGame(); 
    }
}

export async function backToTitleFromPause() { 
    if (!(await showConfirm("戻りますか？"))) return; 
    runtimeState.isGameActive = false; 
    clearInterval(gameState.timer); 
    backToTitle(); 
}

export function startCountdown() {
    const qBox = document.getElementById('ui-question'); 
    const cGrid = document.getElementById('ui-choices');
    if(qBox) qBox.innerText = "READY..."; 
    if(cGrid) cGrid.innerHTML = ""; 
    let count = 3; 
    showCutIn(count); 
    playSE('count'); 
    if (runtimeState.countdownTimer) clearInterval(runtimeState.countdownTimer);
    runtimeState.countdownTimer = setInterval(() => {
        if (document.getElementById('game-screen')?.classList.contains('hidden')) { 
            clearInterval(runtimeState.countdownTimer); 
            return; 
        }
        count--;
        if(count > 0) { 
            showCutIn(count); 
            playSE('count'); 
        } 
        else if(count === 0) { 
            showCutIn("GO!"); 
            playSE('start'); 
        } 
        else {
            clearInterval(runtimeState.countdownTimer); 
            runtimeState.isGameActive = true;
            if (playData.isCalculation) { 
                if (typeof window.nextCalcQuestion === 'function') window.nextCalcQuestion(); 
                if (typeof window.startCalcTimer === 'function') window.startCalcTimer(); 
            } 
            else if (playData.isTyping && !(typeof rogueData !== 'undefined' && rogueData.active)) { 
                if (typeof window.nextTypingQuestion === 'function') window.nextTypingQuestion(); 
            } 
            else { 
                if (typeof window.nextQuestion === 'function') window.nextQuestion(); 
            }
            playBGM();
        }
    }, 1000);
}

export function startTimer() { 
    if(gameState.timer) clearInterval(gameState.timer); 
    if(!runtimeState.isGameActive) return; 
    
    // スタディエルの連れ歩きパッシブタイマー延長バフを取得
    const studyelTimeBuff = (typeof window !== 'undefined' && typeof window.StudyelEngine?.getTimerBuff === 'function')
        ? window.StudyelEngine.getTimerBuff()
        : 0;

    const baseMaxTime = gameState.maxTime + studyelTimeBuff;

    if (!playData.isSurvival) {
        gameState.timeLeft = baseMaxTime; 
    } else if (!gameState.timeLeft || gameState.timeLeft <= 0) {
        gameState.timeLeft = baseMaxTime;
    }
    
    const bar = document.getElementById('ui-timer'); 
    const timerText = document.getElementById('ui-timer-text');
    if(bar) bar.style.width = '100%';
    if(timerText) timerText.innerText = gameState.timeLeft.toFixed(1);

    gameState.timer = setInterval(() => { 
        if(runtimeState.isPaused || !runtimeState.isGameActive) return; 
        gameState.timeLeft = Math.max(0, gameState.timeLeft - 0.1); 
        if(bar) bar.style.width = Math.max(0, (gameState.timeLeft / baseMaxTime) * 100) + '%'; 
        if(timerText) timerText.innerText = gameState.timeLeft.toFixed(1);

        // スタディエルExピンチ時加護判定（ライフ1＆残り2秒以下でタイマー全回復）
        if (gameState.lives === 1 && gameState.timeLeft <= 2.0 && gameState.timeLeft > 0) {
            if (typeof window !== 'undefined' && typeof window.StudyelEngine?.canTriggerPinchHeal === 'function') {
                if (window.StudyelEngine.canTriggerPinchHeal()) {
                    window.StudyelEngine.triggerPinchHeal();
                    gameState.timeLeft = baseMaxTime;
                    if(bar) bar.style.width = '100%';
                    if(timerText) timerText.innerText = gameState.timeLeft.toFixed(1);
                }
            }
        }

        // 持ち物PINCH_SHIELD判定（ライフ1＆残り2秒以下で1回のみタイマー全回復＆保護）
        if (gameState.lives === 1 && gameState.timeLeft <= 2.0 && gameState.timeLeft > 0 && !playData.pinchShieldTriggered) {
            const party = Array.isArray(gameState.equippedParty) ? gameState.equippedParty : [(gameState.equipped || '1'), null, null];
            const unlockedCount = Number(gameState.unlockedSlots) || 1;
            let hasShield = false;
            for (let i = 0; i < unlockedCount; i++) {
                const cId = party[i];
                if (!cId || !gameState.charaInventory || !gameState.charaInventory[cId]) continue;
                const hId = gameState.charaInventory[cId].heldItem;
                if (!hId || !rawData.heldItems) continue;
                const hItem = rawData.heldItems.find(it => String(it.id) === String(hId));
                if (hItem && hItem.special === 'PINCH_SHIELD') {
                    hasShield = true;
                    break;
                }
            }

            if (hasShield) {
                playData.pinchShieldTriggered = true;
                gameState.timeLeft = baseMaxTime;
                if (bar) bar.style.width = '100%';
                if (timerText) timerText.innerText = gameState.timeLeft.toFixed(1);
                playSE('special');
                if (typeof showCutIn === 'function') {
                    showCutIn('🛡️ ピンチシールド発動！', '#3b82f6');
                }
            }
        }

        if(gameState.timeLeft <= 0) { 
            clearInterval(gameState.timer); 
            if (typeof window.judge === 'function') window.judge(false, null); 
        } 
    }, 100); 
}

/**
 * 戦闘開始時の持ち物特殊効果（INIT_SP_1 など）を適用
 */
export function applyBattleStartHeldItemBuffs() {
    playData.pinchShieldTriggered = false;
    const party = Array.isArray(gameState.equippedParty) ? gameState.equippedParty : [(gameState.equipped || '1'), null, null];
    const mainCharId = party[0];
    if (mainCharId && gameState.charaInventory && gameState.charaInventory[mainCharId]) {
        const heldItemId = gameState.charaInventory[mainCharId].heldItem;
        if (heldItemId && rawData.heldItems && rawData.heldItems.length > 0) {
            const itemData = rawData.heldItems.find(it => String(it.id) === String(heldItemId));
            if (itemData && itemData.special === 'INIT_SP_1') {
                playData.currentSP = 1;
                updateSpUI();
                return;
            }
        }
    }
    playData.currentSP = 0;
    updateSpUI();
}

export function getCharaStats(options = {}) { 
    let stats = { atk: 1.0, time: 1.0, exp: 1.0 };
    
    // スロットごとの適用率（メイン枠: 100%, サブ枠: 20%）。QR対戦・専用モードではメイン枠のみ適用
    const slotWeights = (options && options.mainOnly) ? [1.0] : [1.0, 0.2, 0.2];
    const party = Array.isArray(gameState.equippedParty) ? gameState.equippedParty : [(gameState.equipped || '1'), null, null];
    const unlockedCount = (options && options.mainOnly) ? 1 : (Number(gameState.unlockedSlots) || 1);

    if(rawData.characters && rawData.characters.length > 0) {
        slotWeights.forEach((weight, slotIdx) => {
            if (slotIdx >= unlockedCount) return;
            const charId = party[slotIdx];
            if (!charId) return;

            const charaData = rawData.characters.find(c => String(c.id) === String(charId));
            if (!charaData) return;

            let userChara = (gameState.charaInventory && gameState.charaInventory[charId]) || (gameState.charaInventory && gameState.charaInventory[charaData.id]);
            let level = (userChara && typeof userChara.level === 'number' && userChara.level >= 1) ? userChara.level : 1;
            let baseVal = (userChara && userChara.isEvolved && userChara.customValue) ? userChara.customValue : Number(charaData.value || 1.0);
            let finalVal = Number(baseVal) + (level * LV_BONUS_RATE);
            let bonusAmount = Math.max(0, finalVal - 1.0); // 1.0からの超過補正量

            let skills = (userChara && userChara.skills && userChara.skills.length > 0) ? userChara.skills : [charaData.type || 'ATK'];
            skills.forEach(type => { 
                const weightedBonus = bonusAmount * weight;
                if(type === 'ALL') { 
                    stats.atk += weightedBonus; 
                    stats.time += weightedBonus; 
                    stats.exp += weightedBonus; 
                } else { 
                    if(type === 'ATK') stats.atk += weightedBonus; 
                    if(type === 'TIME') stats.time += weightedBonus; 
                    if(type === 'EXP') stats.exp += weightedBonus; 
                } 
            });

            // 持ち物（HeldItems）によるステータス加算（メイン100%, サブ各20%）
            if (userChara && userChara.heldItem && rawData.heldItems && rawData.heldItems.length > 0) {
                const heldItemData = rawData.heldItems.find(it => String(it.id) === String(userChara.heldItem));
                if (heldItemData) {
                    const itemVal = Number(heldItemData.value || 1.0);
                    const itemBonus = Math.max(0, itemVal - 1.0) * weight;
                    const itemType = heldItemData.type || 'ATK';
                    if (itemType === 'ALL') {
                        stats.atk += itemBonus;
                        stats.time += itemBonus;
                        stats.exp += itemBonus;
                    } else if (itemType === 'ATK') {
                        stats.atk += itemBonus;
                    } else if (itemType === 'TIME') {
                        stats.time += itemBonus;
                    } else if (itemType === 'EXP') {
                        stats.exp += itemBonus;
                    }
                }
            }
        });
    }
    if(gameState.itemLevels && rawData.shopItems) {
        Object.keys(gameState.itemLevels).forEach(itemId => {
            const item = rawData.shopItems.find(i => String(i.id) === String(itemId)); 
            const level = gameState.itemLevels[itemId];
            if(item && level > 0) { 
                if(item.type === 'ATK') stats.atk += (Number(item.value) * level); 
                if(item.type === 'TIME') stats.time += (Number(item.value) * level); 
                if(item.type === 'EXP') stats.exp += (Number(item.value) * level); 
            }
        });
    }
    if (playData.activeOaths && playData.activeOaths.includes('weak') && !playData.isSurvival) stats.atk *= 0.5;
    if (playData.activeReliefs && playData.activeReliefs.includes('power') && !playData.isSurvival) stats.atk *= 2.0;

    if (typeof rogueData !== 'undefined' && rogueData.active) {
        stats.atk *= rogueData.atkBuff;
        stats.atk *= (1.0 + (rogueData.exploreLevel - 1) * 0.005);
    }

    return stats;
}

/**
 * SP（スキルポイント）を加算しUIを更新
 */
export function addSP(amount = 1) {
    if (typeof playData.currentSP !== 'number') playData.currentSP = 0;
    const oldSP = playData.currentSP;
    playData.currentSP = Math.min(3, playData.currentSP + amount);
    if (playData.currentSP > oldSP) {
        playSE('special');
    }
    updateSpUI();
}

/**
 * 戦闘画面のSPゲージと必殺技ボタンの表示を更新
 */
export function updateSpUI() {
    const sp = Math.min(3, Math.max(0, playData.currentSP || 0));
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`sp-dot-${i}`);
        if (dot) {
            if (i <= sp) dot.classList.add('active');
            else dot.classList.remove('active');
        }
    }

    const skillBtn = document.getElementById('btn-active-skill');
    const skillNameEl = document.getElementById('ui-skill-btn-name');
    const skillAttr = getMainCharaSkillAttribute();
    
    const skillNames = {
        'ATK': 'パワースマッシュ',
        'TIME': 'タイムリカバリー',
        'EXP': 'ラッキーボーナス',
        'ALL': 'ミラクルバースト'
    };

    if (skillNameEl) {
        skillNameEl.innerText = skillNames[skillAttr] || '必殺技';
    }

    if (skillBtn) {
        skillBtn.className = `active-skill-btn skill-btn-${skillAttr.toLowerCase()}`;
        if (sp >= 1 && !runtimeState.isFinished && !runtimeState.isPaused && (gameState.lives > 0) && (gameState.timeLeft > 0)) {
            skillBtn.disabled = false;
            skillBtn.classList.add('ready');
        } else {
            skillBtn.disabled = true;
            skillBtn.classList.remove('ready');
        }
    }
}

/**
 * メイン枠キャラクターのステータス比率から必殺技属性を自動判定
 * (同値トップ: ATK > TIME > EXP, 特殊キャラ/均等: ALL)
 */
export function getMainCharaSkillAttribute() {
    const mainId = (gameState.equippedParty && gameState.equippedParty[0]) ? gameState.equippedParty[0] : (gameState.equipped || '1');
    const cMaster = rawData.characters ? rawData.characters.find(c => String(c.id) === String(mainId)) : null;
    if (!cMaster) return 'ATK';

    // ボスまたはスタディエル等の特殊キャラ判定
    const isBoss = cMaster.category === 'boss' || String(cMaster.id).startsWith('boss_');
    const isStudyel = cMaster.category === 'studyel' || String(cMaster.id).startsWith('studyel_');
    if (isBoss || isStudyel) return 'ALL';

    const inv = (gameState.charaInventory && gameState.charaInventory[mainId]) || {};
    const level = (typeof inv.level === 'number' && inv.level >= 1) ? inv.level : 1;
    const baseVal = (inv.isEvolved && inv.customValue) ? inv.customValue : Number(cMaster.value || 1.0);
    const finalVal = Number(baseVal) + (level * LV_BONUS_RATE);
    const skills = (inv.skills && inv.skills.length > 0) ? inv.skills : [cMaster.type || 'ATK'];

    let stats = { atk: 1.0, time: 1.0, exp: 1.0 };
    skills.forEach(type => {
        if (type === 'ALL') {
            stats.atk = finalVal;
            stats.time = finalVal;
            stats.exp = finalVal;
        } else if (type === 'ATK') {
            stats.atk = finalVal;
        } else if (type === 'TIME') {
            stats.time = finalVal;
        } else if (type === 'EXP') {
            stats.exp = finalVal;
        }
    });

    // 3値が完全に均等の場合は ALL
    if (stats.atk === stats.time && stats.time === stats.exp) {
        return 'ALL';
    }

    // 部分的な同値トップの解決: ATK > TIME > EXP
    const maxVal = Math.max(stats.atk, stats.time, stats.exp);
    if (stats.atk === maxVal) return 'ATK';
    if (stats.time === maxVal) return 'TIME';
    if (stats.exp === maxVal) return 'EXP';
    return 'ATK';
}

/**
 * 必殺技（アクティブスキル）を発動
 */
export function triggerActiveSkill() {
    // 【発動の絶対防壁・レースコンディション対策】
    if (gameState.lives <= 0 || gameState.timeLeft <= 0 || runtimeState.isFinished || runtimeState.isPaused || (playData.currentSP || 0) < 1) {
        return;
    }

    // SP消費
    playData.currentSP -= 1;
    updateSpUI();

    // タイマー一時停止（二重トリガー・スリップ防止）
    runtimeState.isPaused = true;

    // メインキャラのレア度減衰レート（UR: 1.0, SSR: 0.8, SR: 0.6, R: 0.4, N: 0.2）
    const mainId = (gameState.equippedParty && gameState.equippedParty[0]) ? gameState.equippedParty[0] : (gameState.equipped || '1');
    const cMaster = rawData.characters ? rawData.characters.find(c => String(c.id) === String(mainId)) : null;
    const inv = (gameState.charaInventory && gameState.charaInventory[mainId]) || {};
    const rarity = inv.currentRarity || (cMaster ? cMaster.rarity : 'N');
    const rateMap = { 'UR': 1.0, 'SSR': 0.8, 'SR': 0.6, 'R': 0.4, 'N': 0.2 };
    const rate = rateMap[rarity] || 0.2;

    const skillAttr = getMainCharaSkillAttribute();
    const stats = getCharaStats();

    playSE('special');

    // カットイン演出・スキル効果の即時適用（上下2段表示で文字被りを防止）
    const skillNameMap = {
        'ATK': 'パワースマッシュ',
        'TIME': 'タイムリカバリー',
        'EXP': 'ラッキーボーナス',
        'ALL': 'ミラクルバースト'
    };
    const sName = skillNameMap[skillAttr] || '必殺技';

    let isEnemyDefeated = false;
    const baseDamage = Math.floor(100 * stats.atk);

    if (skillAttr === 'ATK') {
        const damage = Math.floor(baseDamage * (2.0 * rate));
        gameState.enemyHP = Math.max(0, gameState.enemyHP - damage);
        gameState.score += damage;
        showSkillCutIn(`⚡ ${sName}！`, `-${damage} HP`, 'damage');
        const enemyIcon = document.getElementById('ui-enemy-icon');
        if (enemyIcon) {
            enemyIcon.classList.remove('shake-anim');
            void enemyIcon.offsetWidth;
            enemyIcon.classList.add('shake-anim');
        }
        if (!playData.isSurvival && gameState.enemyHP <= 0) {
            isEnemyDefeated = true;
        }
    } else if (skillAttr === 'TIME') {
        const healTime = (gameState.maxTime || 10) * (1.0 * rate);
        gameState.timeLeft = Math.min(gameState.maxTime || 10, gameState.timeLeft + healTime);
        showSkillCutIn(`⚡ ${sName}！`, `+${healTime.toFixed(1)}s`, 'heal');
    } else if (skillAttr === 'EXP') {
        const gainedBonus = Math.floor(1000 * rate);
        playData.bonusExp = (playData.bonusExp || 0) + gainedBonus;
        showSkillCutIn(`⚡ ${sName}！`, `+${gainedBonus} XP`, 'exp');
    } else if (skillAttr === 'ALL') {
        const damage = Math.floor(baseDamage * (1.5 * rate));
        gameState.enemyHP = Math.max(0, gameState.enemyHP - damage);
        gameState.score += damage;
        const healTime = (gameState.maxTime || 10) * (0.5 * rate);
        gameState.timeLeft = Math.min(gameState.maxTime || 10, gameState.timeLeft + healTime);
        const gainedBonus = Math.floor(500 * rate);
        playData.bonusExp = (playData.bonusExp || 0) + gainedBonus;
        showSkillCutIn(`⚡ ${sName}！`, `-${damage} HP / +${healTime.toFixed(1)}s / +${gainedBonus}XP`, 'all');
        const enemyIcon = document.getElementById('ui-enemy-icon');
        if (enemyIcon) {
            enemyIcon.classList.remove('shake-anim');
            void enemyIcon.offsetWidth;
            enemyIcon.classList.add('shake-anim');
        }
        if (!playData.isSurvival && gameState.enemyHP <= 0) {
            isEnemyDefeated = true;
        }
    }

    updateUI();

    // 演出完了（約1.5秒後）にタイマー再開、または敵撃破処理
    setTimeout(() => {
        if (!runtimeState.isGameActive || runtimeState.isFinished) return;
        if (isEnemyDefeated) {
            const enemyBox = document.querySelector('.enemy-visual-box'); 
            if (enemyBox) { 
                enemyBox.classList.add('anim-paused'); 
                enemyBox.classList.add('fade-out'); 
            } 
            finishGame(true);
        } else {
            runtimeState.isPaused = false;
            updateSpUI();
        }
    }, 1500);
}

export function finishGame(isClear) { 
    runtimeState.isGameActive = false; 
    clearInterval(gameState.timer); 
    stopBGM(); 
    let earned = 0; 
    let dropInfo = { count: 0, icon: '' };
    let isCampaign = false;
    let calcRank = 'F';

    const resDrop = document.getElementById('res-drop');
    const resXpSpan = document.getElementById('res-xp');
    const resXpLabel = document.getElementById('res-xp-label');
    if (resXpLabel) resXpLabel.innerText = "獲得XP";
    
    if (typeof rogueData !== 'undefined' && rogueData.active) {
        const stats = getCharaStats();
        if (isClear) {
            playSE('win');
            let baseExp = rogueData.isBossBattle ? 2000 : 500;
            let floorScale = 1 + (rogueData.floor * 0.1);
            let expLvScale = 1 + ((rogueData.exploreLevel - 1) * 0.05);
            let gained = Math.floor(baseExp * floorScale * expLvScale * stats.exp);
            rogueData.earnedXp += gained;
            earned = gained;

            if (playData.rogueEnemyCharId) {
                const charId = String(playData.rogueEnemyCharId);
                const cMaster = rawData.characters ? rawData.characters.find(c => String(c.id) === charId) : null;
                const r = cMaster ? cMaster.rarity : 'N';
                if (!gameState.charaInventory[charId]) {
                    gameState.charaInventory[charId] = { level: 1, count: 1, exp: 0, currentRarity: r };
                } else {
                    if (typeof gameState.charaInventory[charId].level !== 'number' || gameState.charaInventory[charId].level < 1) {
                        gameState.charaInventory[charId].level = 1;
                    }
                    gameState.charaInventory[charId].count = (gameState.charaInventory[charId].count || 0) + 1;
                }
                const cName = cMaster ? cMaster.name : '仲間';
                const cRarity = cMaster ? cMaster.rarity : 'N';
                dropInfo = { count: 1, icon: '📦', name: cName, rarity: cRarity, isRogueChar: true };
            } else {
                dropInfo = { count: 0, icon: '', isRogueChar: false };
            }
        } else {
            playSE('lose');
            gameState.lives = 0;
            if (typeof window.exitRogueSystem === 'function') {
                window.exitRogueSystem(false);
            }
            return;
        }
        if (resXpLabel) resXpLabel.innerText = "獲得一時XP";
        if (resXpSpan) resXpSpan.innerHTML = `+${earned}`;
    } else if (playData.isSurvival) {
        const correctCount = gameState.score; 
        let oathMultiplier = 1;
        if (playData.activeOaths.length === 1) oathMultiplier = 2;
        else if (playData.activeOaths.length >= 2) oathMultiplier = 3;

        const mainCharaId = (gameState.equippedParty && gameState.equippedParty[0]) ? gameState.equippedParty[0] : (gameState.equipped || '1');
        const eqInv = gameState.charaInventory[mainCharaId];
        const cMaster = rawData.characters ? rawData.characters.find(c => String(c.id) == String(mainCharaId)) : null;
        
        let isMax = false;
        if (eqInv && cMaster) {
            if (typeof eqInv.level !== 'number' || eqInv.level < 1) eqInv.level = 1;
            const maxL = RARITY_CAPS[eqInv.currentRarity || cMaster.rarity] || 10;
            if (eqInv.level >= maxL) isMax = true;
        }

        let milestoneBonus = isMax ? 0 : Math.floor(correctCount / 50) * 50;
        const currentGrade = playData.questions && playData.questions.length > 0 ? playData.questions[0].grade : '';
        const gradeMultiplier = getGradeMultiplier(currentGrade);
        let earnedExp = Math.floor(((correctCount * oathMultiplier) + milestoneBonus) * gradeMultiplier);
        
        if (playData.activeReliefs && playData.activeReliefs.length > 0) {
            const rCount = playData.activeReliefs.length;
            const penalty = rCount >= 3 ? 0.5 : (rCount === 2 ? 0.7 : 0.9);
            earnedExp = Math.floor(earnedExp * penalty);
        }
        
        let growthResultText = "なし";
        
        if (eqInv && cMaster) {
            if (typeof eqInv.level !== 'number' || eqInv.level < 1) eqInv.level = 1;
            const maxL = RARITY_CAPS[eqInv.currentRarity || cMaster.rarity] || 10;
            let startLv = eqInv.level;
            let startExp = Number(eqInv.exp) || 0;
            let startStock = eqInv.count || 0;
            
            eqInv.exp = startExp + earnedExp;
            while (eqInv.exp >= EXP_REQ) {
                eqInv.exp -= EXP_REQ;
                if (eqInv.level < maxL) { eqInv.level++; } 
                else { eqInv.count = (eqInv.count || 0) + 1; }
            }
            
            if (eqInv.level >= maxL && (eqInv.count || 0) > startStock) {
                growthResultText = `<div style="font-size:0.4em; color:#7f8c8d;">Lv.MAX ストック ${startStock}</div><div style="color:#bdc3c7; font-size:0.4em; margin:5px 0;">↓</div><div style="font-size:0.5em; color:#e67e22;">Lv.MAX ストック ${eqInv.count}</div>`;
            } else {
                growthResultText = `<div style="font-size:0.45em; color:#7f8c8d; line-height:1.2;">Lv.${startLv} ${startExp}EXP</div><div style="color:#bdc3c7; font-size:0.4em; margin:2px 0;">↓</div><div style="font-size:0.5em; color:#e67e22; line-height:1.2;">Lv.${eqInv.level} ${eqInv.exp}EXP</div>`;
            }
        }
        
        gameState.stats.totalPlay = (gameState.stats.totalPlay || 0) + 1;
        if (typeof updateMissionProgress === 'function') updateMissionProgress('play', 1);
        saveGame();

        playSE('win');
        const resTitle = document.getElementById('res-title'); if(resTitle) { resTitle.innerText="SURVIVAL END"; resTitle.style.color="#e74c3c"; }
        const resIcon = document.getElementById('res-icon'); if(resIcon) resIcon.innerText="🔥"; 
        
        const resScoreSpan = document.getElementById('res-score');
        if (resScoreSpan && resScoreSpan.previousSibling && resScoreSpan.previousSibling.nodeType === 3) resScoreSpan.previousSibling.nodeValue = "到達WAVE: ";
        if(resScoreSpan) resScoreSpan.innerText = correctCount; 
        
        const resDetails = document.getElementById('res-details');
        if(resDetails) {
            resDetails.innerHTML = `<div style="font-size: 1.2em; font-weight: bold; color: #2c3e50;">特訓EXP +${earnedExp}</div>`;
            resDetails.style.display = 'block';
        }
        
        if (resDrop) resDrop.style.display = 'none';
        
        const resXpLabel = document.getElementById('res-xp-label');
        if (resXpLabel) resXpLabel.innerText = "成長結果";
        
        if(resXpSpan) {
            resXpSpan.style.lineHeight = "1.1";
            resXpSpan.innerHTML = growthResultText;
        }
        
        document.getElementById('game-screen')?.classList.add('hidden'); 
        document.getElementById('result-overlay')?.classList.remove('hidden'); 
        if (typeof checkTitles === 'function') checkTitles();
        return;
    } else if (playData.isCalculation) {
        playSE('win');
        const count = playData.calcCorrect;
        const total = playData.calcQIndex;
        const elapsed = playData.calcElapsed;
        const accuracy = total > 0 ? (count / total) : 0;
        
        if (playData.calcMode === '100q') {
            if (elapsed <= 120 && accuracy >= 0.95) calcRank = 'S';
            else if (elapsed <= 180 && accuracy >= 0.90) calcRank = 'A';
            else if (elapsed <= 240 && accuracy >= 0.80) calcRank = 'B';
            else if (elapsed <= 300) calcRank = 'C';
            else if (elapsed <= 360) calcRank = 'D';
            else calcRank = 'E';
        } else {
            if (count >= 100 && accuracy >= 0.95) calcRank = 'S';
            else if (count >= 80 && accuracy >= 0.90) calcRank = 'A';
            else if (count >= 60 && accuracy >= 0.80) calcRank = 'B';
            else if (count >= 40) calcRank = 'C';
            else if (count >= 20) calcRank = 'D';
            else calcRank = 'E';
        }

        const stats = getCharaStats();
        let rankExp = { S: 5000, A: 3000, B: 2000, C: 1000, D: 500, E: 200, F: 100 }[calcRank] || 100;
        let scoreExp = Math.floor(count * 50 * stats.exp);
        earned = rankExp + scoreExp;
        gameState.xp += earned;

        if (calcRank === 'S' || calcRank === 'A') {
            gameState.stats.achieved_calcA = true;
        }

        if (typeof addCalcRecord === 'function') {
            addCalcRecord({
                rank: calcRank,
                correct: count,
                total: total,
                time: playData.calcMode === '3min' ? (180 - playData.calcTimeLeft) : elapsed,
                date: new Date().toLocaleDateString('ja-JP')
            });
        }

        let redAdd = Math.floor(count / 10);
        let blueAdd = Math.floor(count / 10);
        if (calcRank === 'S') { redAdd += 5; blueAdd += 5; }
        else if (calcRank === 'A') { redAdd += 3; blueAdd += 3; }
        
        gameState.inventory.redPages += redAdd;
        gameState.inventory.bluePages += blueAdd;
        dropInfo = { count: redAdd, icon: '📕/📘' };

        gameState.stats.totalPlay = (gameState.stats.totalPlay || 0) + 1;
        if (typeof updateMissionProgress === 'function') {
            updateMissionProgress('calc', 1);
            updateMissionProgress('play', 1);
        }
    } else {
        if(isClear) {
            playSE('win');
            if (Math.random() < 0.3) {
                const dType = Math.random() < 0.5 ? "red" : "blue"; 
                const dCount = Math.floor(Math.random() * 4) + 2; 
                if (dType === "red") { gameState.inventory.redPages += dCount; dropInfo = { count: dCount, icon: '📕' }; }
                else { gameState.inventory.bluePages += dCount; dropInfo = { count: dCount, icon: '📘' }; }
            }
        } else playSE('lose');

        const stats = getCharaStats(); 
        let conditionRate = 1.0;
        const CAMPAIGN_RATE = 3.0;
        if (playData.context && rawData.config && !playData.isRevenge && !playData.isRandom && !playData.isTyping) {
            if (Array.isArray(rawData.config)) {
                isCampaign = rawData.config.some(c => c.message && c.message !== "" && isGradeMatch(c.grade, playData.context.grade) && String(c.subject) === String(playData.context.subject) && String(c.unit) === String(playData.context.unit));
            } else if (typeof rawData.config === 'object') {
                const cfg = rawData.config;
                isCampaign = Boolean((cfg.bannerMessage || cfg.message) && isGradeMatch(cfg.activeGrade, playData.context.grade) && String(cfg.activeSubject) === String(playData.context.subject) && String(cfg.activeUnit) === String(playData.context.unit));
            }
        }
        if (playData.activeOaths && playData.activeOaths.length > 0) {
            const count = playData.activeOaths.length;
            if (count >= 3) conditionRate = 2.0; else if (count === 2) conditionRate = 1.75; else conditionRate = 1.5;
            if (isCampaign) conditionRate = Math.max(conditionRate, CAMPAIGN_RATE);
        } else if (playData.isRevenge || playData.isRandom) {
            conditionRate = 1.5;
        } else if (isCampaign) {
            conditionRate = CAMPAIGN_RATE;
        }
        const partA = gameState.score * stats.exp; const partB = isClear ? (gameState.score * 0.2) : 0; const partC = gameState.score * (conditionRate - 1.0);
        const currentGrade = playData.context ? playData.context.grade : (playData.questions && playData.questions.length > 0 ? playData.questions[0].grade : '');
        const currentSubject = playData.context ? playData.context.subject : (playData.currentQ ? playData.currentQ.subject : '');
        const gradeMultiplier = getGradeMultiplier(currentGrade);
        const studyelXpMult = (typeof window !== 'undefined' && typeof window.StudyelEngine?.getXpMultiplier === 'function')
            ? window.StudyelEngine.getXpMultiplier(currentSubject)
            : 1.0;
        earned = Math.floor((partA + partB + partC) * gradeMultiplier * studyelXpMult);
        
        // 必殺技（アクティブスキル: ラッキーボーナス等）による蓄積XP合算
        const skillBonusExp = playData.bonusExp || 0;
        earned += skillBonusExp;
        
        if (playData.activeReliefs && playData.activeReliefs.length > 0) {
            const rCount = playData.activeReliefs.length;
            const penalty = rCount >= 3 ? 0.5 : (rCount === 2 ? 0.7 : 0.9);
            earned = Math.floor(earned * penalty);
        }
        
        gameState.xp += earned;
        if (playData.context && !playData.isRevenge && !playData.isRandom) {
            const key = `${playData.context.grade}_${playData.context.subject}_${playData.context.unit}`;
            if (!gameState.unitProgress) gameState.unitProgress = {};
            if (!gameState.unitProgress[key]) gameState.unitProgress[key] = { played: false, cleared: false };
            gameState.unitProgress[key].played = true; if (isClear) gameState.unitProgress[key].cleared = true;
        }
        gameState.stats.totalPlay = (gameState.stats.totalPlay || 0) + 1;
        if(isClear) {
            gameState.stats.totalKill = (gameState.stats.totalKill || 0) + 1;
            let requiredLives = 3;
            if (playData.activeReliefs && playData.activeReliefs.includes('life')) requiredLives = 5;
            else if (playData.activeOaths && playData.activeOaths.includes('backwater')) requiredLives = 1;
            if (gameState.lives >= requiredLives) { gameState.stats.achieved_perfect = true; }
            if (playData.isRevenge) gameState.revengeList = [];
            
            if (playData.isRandom) gameState.stats.achieved_random = true;
            if (playData.activeOaths && playData.activeOaths.length > 0) gameState.stats.achieved_oath = true;
        }

        if (typeof updateMissionProgress === 'function') {
            if (playData.isTyping) updateMissionProgress('typing', 1);
            else updateMissionProgress('play', 1);
            if (isClear && !playData.isTyping) updateMissionProgress('kill', 1); 
        }
    }

    saveGame(); 
    if (cloudSync) {
        cloudSync.requestSync();
    }
    
    const resTitle = document.getElementById('res-title'); if(resTitle) { resTitle.innerText=isClear?"QUEST CLEAR!":"GAME OVER"; resTitle.style.color=isClear?"#f1c40f":"#bdc3c7"; }
    const resIcon = document.getElementById('res-icon'); if(resIcon) resIcon.innerText=isClear?"🎉":"💔"; 
    
    const resScoreSpan = document.getElementById('res-score');
    if (resScoreSpan && resScoreSpan.previousSibling && resScoreSpan.previousSibling.nodeType === 3) {
        resScoreSpan.previousSibling.nodeValue = playData.isCalculation ? "総問題数: " : "獲得スコア: ";
    }
    if(resScoreSpan) resScoreSpan.innerText = playData.isCalculation ? playData.calcQIndex : gameState.score; 
    
    if (typeof rogueData !== 'undefined' && rogueData.active) {
        if (dropInfo.isRogueChar) {
            if (resDrop) resDrop.innerHTML = `仲間になった！: <span style="font-size:1.2em;">📦</span> [${dropInfo.rarity}] <b>${dropInfo.name}</b> (+1)`;
        } else {
            if (resDrop) resDrop.innerHTML = `入手アイテム: なし`;
        }
    } else {
        const dropHtml = dropInfo.count > 0 ? `<span>${dropInfo.icon}</span> ${dropInfo.count} 個` : 'なし';
        if (resDrop) resDrop.innerHTML = `入手アイテム: ${dropHtml}`;
    }
    
    const resDetails = document.getElementById('res-details');
    if (!playData.isSurvival) {
        if (typeof rogueData !== 'undefined' && rogueData.active) {
            if (resXpLabel) resXpLabel.innerText = "獲得一時XP";
            if (resXpSpan) resXpSpan.innerHTML = `+${earned}`;
            if (resDetails) {
                if (dropInfo.isRogueChar) {
                    resDetails.innerHTML = `<div style="font-size: 1.0em; font-weight: bold; color: #27ae60;">🎉 [${dropInfo.rarity}] ${dropInfo.name} を仲間にしました！</div>`;
                } else {
                    resDetails.innerHTML = `<div style="font-size: 0.9em; color: #7f8c8d;">ダンジョン攻略中...</div>`;
                }
            }
        } else if (playData.isCalculation) {
            const duration = playData.calcMode === '3min' ? (180 - playData.calcTimeLeft).toFixed(1) : playData.calcElapsed.toFixed(1);
            const totalQ = playData.calcQIndex;
            const accuracy = totalQ > 0 ? ((playData.calcCorrect / totalQ) * 100).toFixed(1) : 0;
            
            if(resXpSpan) resXpSpan.innerHTML = `ランク: <span class="rank-${calcRank}" style="font-size:1.2em;">${calcRank}</span>`;
            if(resDetails) resDetails.innerHTML = `
                <div style="font-size: 0.85em; line-height: 1.6; text-align: left; display: inline-block;">
                    <div>🎯 <b>正解数</b> : ${playData.calcCorrect} 問</div>
                    <div>📊 <b>正解率</b> : ${accuracy} %</div>
                    <div>⏱️ <b>タイム</b> : ${duration} 秒</div>
                </div>
            `;
            
            if (dropInfo.count > 0 && resDrop) {
                resDrop.innerHTML = `入手アイテム: <span style="font-size:1.2em;">📕</span> × ${dropInfo.count} ／ <span style="font-size:1.2em;">📘</span> × ${dropInfo.count}`; 
            }
        } else if (isCampaign && isClear) {
            if(resXpSpan) resXpSpan.innerHTML = `<span style="font-size:0.5em; color:#e74c3c;">CAMPAIGN x3.0</span><br>+${earned}`;
            if(resDetails) resDetails.innerHTML = dropInfo.count > 0 ? `入手アイテム: ${dropInfo.icon} × ${dropInfo.count}` : 'リザルトを確認してください。';
        } else {
            if(resXpSpan) resXpSpan.innerHTML = "+" + earned;
            if(resDetails) resDetails.innerHTML = dropInfo.count > 0 ? `入手アイテム: ${dropInfo.icon} × ${dropInfo.count}` : 'リザルトを確認してください。';
        }
    }
    
    document.getElementById('game-screen')?.classList.add('hidden'); 
    document.getElementById('result-overlay')?.classList.remove('hidden'); 
    if (typeof checkTitles === 'function') checkTitles();
}

export function handleResultClose() {
    if (typeof rogueData !== 'undefined' && rogueData.active) {
        document.getElementById('result-overlay')?.classList.add('hidden');
        document.getElementById('field-screen')?.classList.remove('hidden');
        
        if (rogueData.isBossBattle) {
            rogueData.floor++;
            if (typeof window.generateRogueFloor === 'function') window.generateRogueFloor();
            if (typeof window.startRogueLoop === 'function') window.startRogueLoop();
        } else {
            if (typeof window.onRogueBattleEnd === 'function') {
                window.onRogueBattleEnd(true);
            } else if (typeof window.drawRogueMap === 'function') {
                window.drawRogueMap();
            }
            if (rogueData.steps <= 0) {
                setTimeout(() => {
                    if (typeof showAppModal === 'function') {
                        showAppModal("歩数がゼロになりました。拠点に強制送還されます。", "alert").then(() => {
                            if (typeof window.exitRogueSystem === 'function') window.exitRogueSystem(false);
                        });
                    }
                }, 100);
            }
        }
        playBGM();
    } else {
        backToTitle();
    }
}

export function backToTitle() { 
    document.getElementById('result-overlay')?.classList.add('hidden'); 
    document.getElementById('game-screen')?.classList.add('hidden'); 
    document.getElementById('title-screen')?.classList.remove('hidden'); 
    document.getElementById('pause-overlay')?.classList.add('hidden'); 
    document.getElementById('field-screen')?.classList.add('hidden');
    document.getElementById('rogue-shop-overlay')?.classList.add('hidden');
    if (typeof rogueData !== 'undefined') rogueData.active = false;
    if (runtimeState.countdownTimer) clearInterval(runtimeState.countdownTimer);
    clearInterval(gameState.timer); 
    runtimeState.isGameActive = false; 
    runtimeState.isPaused = false; 
    
    if (typeof window.handleTypingInput === 'function') {
        document.removeEventListener('keydown', window.handleTypingInput);
    }
    
    document.getElementById('ui-choices')?.classList.remove('hidden'); 
    document.getElementById('ui-typing-area')?.classList.add('hidden'); 
    document.getElementById('ui-question')?.classList.remove('hidden');
    
    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';

    const qBox = document.getElementById('ui-question');
    if (qBox) {
        qBox.style.removeProperty('height');
        qBox.style.removeProperty('min-height');
    }

    const uiScoreSpan = document.getElementById('ui-score'); if(uiScoreSpan && uiScoreSpan.previousSibling && uiScoreSpan.previousSibling.nodeType === 3) uiScoreSpan.previousSibling.nodeValue = "SCORE ";
    const uiComboSpan = document.getElementById('ui-combo'); if(uiComboSpan && uiComboSpan.previousSibling && uiComboSpan.previousSibling.nodeType === 3) uiComboSpan.previousSibling.nodeValue = "COMBO ";
    const resScoreSpan = document.getElementById('res-score'); if(resScoreSpan && resScoreSpan.previousSibling && resScoreSpan.previousSibling.nodeType === 3) resScoreSpan.previousSibling.nodeValue = "獲得スコア: ";

    playData.isTyping = false; 
    playData.isCalculation = false; 
    playData.isSurvival = false;
    stopBGM(); 
    if (typeof updateTitleInfo === 'function') updateTitleInfo(); 
    if (typeof window.updateMissionBadge === 'function') window.updateMissionBadge(); 
    if (typeof checkTitles === 'function') checkTitles();
}

