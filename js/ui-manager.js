// ==========================================
// js/ui-manager.js (カテゴリー遷移・モーダル・プレイガイド・成績表・ギフト)
// ==========================================

import {
    gameState,
    rawData,
    dailyMissions,
    runtimeState,
    GUIDE_DATA,
    saveGame
} from './state.js?v=10.1.1';

import {
    getDisplayName,
    drawRadarChart,
    playSE,
    ALL_GRADES,
    isGradeMatch
} from './utils.js?v=10.1.1';

const SUBJECT_ORDER = [
    '国語', '算数', '数学', '理科', '社会', '英語', '情報',
    '音楽', '美術', '図画工作', '保健体育', '体育', '保健',
    '技術・家庭', '技術', '家庭科', '生活', '道徳'
];

// ==========================================
// タイトル初期化・カテゴリー制御
/**
 * 学年プルダウンの共通生成・先行ロードリスナー登録ヘルパー
 */
export function populateGradeSelect(sel, defaultText = '学年を選択...') {
    if (!sel) return;
    sel.innerHTML = `<option value="">${defaultText}</option>`;
    ALL_GRADES.forEach(g => {
        sel.innerHTML += `<option value="${g}">${g}</option>`;
    });
    sel.value = "";
    
    // 学年選択時のオンデマンド先行ロードリスナー（二重登録防止）
    if (!sel.dataset.listenerAttached) {
        sel.dataset.listenerAttached = "true";
        sel.addEventListener('change', (e) => {
            const g = e.target.value;
            if (g && typeof window.ensureGradeLoaded === 'function') {
                window.ensureGradeLoaded(g);
            }
        });
    }
}

// ==========================================
// タイトル初期化・カテゴリー制御
// ==========================================
export function initTitle() {
    // 全12学年（小1〜高3）の標準順序で選択肢を生成
    populateGradeSelect(document.getElementById('grade-select'), '学年を選択');
    populateGradeSelect(document.getElementById('survival-grade-select'), '学年を選択...');
    populateGradeSelect(document.getElementById('random-grade-select'), '学年を選択...');
    populateGradeSelect(document.getElementById('rogue-grade-select'), '学年を選択...');
    populateGradeSelect(document.getElementById('typing-grade-select'), '学年を選択...');

    const gSelect = document.getElementById('grade-select');
    if (gSelect) gSelect.value = "";

    const sSelect = document.getElementById('subject-select');
    if (sSelect) {
        sSelect.innerHTML = '<option value="">教科を選択</option>';
        sSelect.value = "";
    }

    const uSelect = document.getElementById('unit-select');
    if (uSelect) {
        uSelect.innerHTML = '<option value="">単元を選択</option>';
        uSelect.value = "";
    }

    const bHpSelect = document.getElementById('boss-hp-select');
    if (bHpSelect) bHpSelect.value = "";

    updateTitleInfo();
}

export async function filterSubjects() {
    const gSelect = document.getElementById('grade-select'); 
    if(!gSelect) return;
    const gVal = gSelect.value;
    const sSelect = document.getElementById('subject-select'); 
    if(!sSelect) return; 
    sSelect.innerHTML = '<option value="">教科を選択</option>';
    const uSelect = document.getElementById('unit-select'); 
    if(uSelect) uSelect.innerHTML = '<option value="">単元を選択</option>';
    if(!gVal) return;

    // 学年別問題データのオンデマンド取得
    const isLoaded = rawData.loadedGrades && (
        rawData.loadedGrades.has(gVal) ||
        rawData.loadedGrades.has(gVal.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)))
    );

    if (!isLoaded && typeof window.ensureGradeLoaded === 'function') {
        sSelect.innerHTML = '<option value="">読込中...</option>';
        const loadOk = await window.ensureGradeLoaded(gVal);
        sSelect.innerHTML = '<option value="">教科を選択</option>';
        if (!loadOk) {
            sSelect.innerHTML = '<option value="">（読込失敗・再選択）</option>';
            return;
        }
    }
    
    // isGradeMatch で表記ゆれを吸収して抽出
    let targetList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, gVal));
    const subjects = [...new Set(targetList.map(q => q.subject))].filter(s => s);
    
    // 標準教科順でソート
    subjects.sort((a, b) => {
        const idxA = SUBJECT_ORDER.indexOf(a);
        const idxB = SUBJECT_ORDER.indexOf(b);
        return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
    });

    if (subjects.length === 0) {
        sSelect.innerHTML = '<option value="">（問題準備中）</option>';
        return;
    }

    subjects.forEach(s => sSelect.innerHTML += `<option value="${s}">${s}</option>`);
    sSelect.value = ""; // デフォルトは「教科を選択」
}

/**
 * 手動キャッシュクリア＆最新再同期（セーブデータには一切影響を与えない安全設計）
 */
export async function manualReloadCache() {
    if (typeof window.showConfirm === 'function') {
        const ok = await window.showConfirm("問題データのローカルキャッシュをクリアして再取得しますか？\n（キャラクターや所持アイテムなどのセーブデータには一切影響しません）");
        if (!ok) return;
    }
    if (typeof window.clearQuestionCache === 'function') {
        await window.clearQuestionCache();
    }
    alert("問題キャッシュをクリアしました。ページを再読み込みします。");
    location.reload();
}

if (typeof window !== 'undefined') {
    window.manualReloadCache = manualReloadCache;
}

export function filterUnits() {
    const gSelect = document.getElementById('grade-select'); 
    const sSelect = document.getElementById('subject-select'); 
    if(!gSelect || !sSelect) return;
    const gVal = gSelect.value; 
    const sVal = sSelect.value;
    const uSelect = document.getElementById('unit-select'); 
    if(!uSelect) return; 
    uSelect.innerHTML = '<option value="">単元を選択</option>';
    if(!gVal || !sVal) return;
    
    // isGradeMatch で学年と教科に合致する単元を抽出
    let targetList = rawData.questions.filter(q => isGradeMatch(q.grade, gVal) && q.subject == sVal);
    const units = [...new Set(targetList.map(q => q.unit))].filter(u => u);
    
    // キャンペーン設定の安全な取得（配列・オブジェクト両対応）
    const isTargetCampaign = (u) => {
        if (!rawData.config) return false;
        if (Array.isArray(rawData.config)) {
            return rawData.config.some(c => (
                c.message &&
                isGradeMatch(c.grade, gVal) &&
                String(c.subject) === String(sVal) &&
                String(c.unit) === String(u)
            ));
        }
        if (typeof rawData.config === 'object') {
            const cfg = rawData.config;
            return Boolean(
                (cfg.bannerMessage || cfg.message) &&
                isGradeMatch(cfg.activeGrade, gVal) &&
                String(cfg.activeSubject) === String(sVal) &&
                String(cfg.activeUnit) === String(u)
            );
        }
        return false;
    };
    
    if (units.length === 0) {
        uSelect.innerHTML = '<option value="">（単元準備中）</option>';
        return;
    }

    units.forEach(u => {
        let label = u; 
        if (isTargetCampaign(u)) label = "★ " + u;
        if (gameState.unitProgress) { 
            const key = `${gVal}_${sVal}_${u}`; 
            const prog = gameState.unitProgress[key]; 
            if (prog) { 
                if (prog.cleared) label += " ◎"; 
                else if (prog.played) label += " ◯"; 
            } 
        }
        uSelect.innerHTML += `<option value="${u}">${label}</option>`;
    });

    uSelect.value = ""; // デフォルトは「単元を選択」
}

export function updateTitleInfo() {
    const chara = (rawData.characters && rawData.characters.length > 0) ? rawData.characters.find(c => String(c.id) == String(gameState.equipped)) : null;
    const inv = gameState.charaInventory[gameState.equipped] || (chara ? gameState.charaInventory[chara.id] : null);
    let lv = (inv && typeof inv.level === 'number' && inv.level >= 1) ? inv.level : 1;
    const displayName = (chara && typeof getDisplayName === 'function') ? getDisplayName(chara, inv) : (chara ? chara.name : "なし");
    const tEquippedName = document.getElementById('title-equipped-name'); 
    if(tEquippedName) tEquippedName.innerHTML = displayName + (chara ? " Lv." + lv : "");
    const tXp = document.getElementById('title-xp'); 
    if(tXp) tXp.innerText = gameState.xp;
    const imgContainer = document.getElementById('title-chara-img');
    if(imgContainer) {
        if(chara?.imageUrl && (chara.imageUrl.startsWith('http') || chara.imageUrl.startsWith('data:image'))) {
            imgContainer.innerHTML = `<img src="${chara.imageUrl}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            imgContainer.innerHTML = `<div style="text-align:center;line-height:40px;">✏️</div>`;
        }
    }
    
    const rBadge = document.getElementById('revenge-badge'); 
    const rCount = (gameState.revengeList || []).length;
    if(rBadge) {
        if (rCount > 0) { 
            rBadge.innerText = rCount; 
            rBadge.classList.remove('hidden'); 
        } else { 
            rBadge.innerText = '0'; 
            rBadge.classList.add('hidden'); 
        }
        const rBtn = rBadge.closest('button');
        if (rBtn) rBtn.disabled = (rCount === 0);
    }

    // 1. 最上部のライナー型キャンペーンマーキーバナー (#campaign-banner)
    const banner = document.getElementById('campaign-banner'); 
    const bannerText = document.getElementById('campaign-text');
    let campaignBannerMsg = "";
    let rawBannerMsg = "";

    if (rawData.config) {
        if (Array.isArray(rawData.config)) {
            const activeConfigs = rawData.config.filter(c => (c.message || c.bannerMessage));
            if (activeConfigs.length > 0) {
                const first = activeConfigs[0];
                rawBannerMsg = first.bannerMessage || first.message || '';
                campaignBannerMsg = activeConfigs.map(c => {
                    const m = c.bannerMessage || c.message || '';
                    const target = (c.grade && c.subject && c.unit) ? ` （強化対象: ${c.grade} ${c.subject} ${c.unit}）` : '';
                    return `📢 ${m}${target}`;
                }).join("   ");
            }
        } else if (typeof rawData.config === 'object') {
            const cfg = rawData.config;
            const msg = cfg.bannerMessage || cfg.message || '';
            rawBannerMsg = msg;
            if (msg) {
                const targetInfo = (cfg.activeGrade && cfg.activeSubject && cfg.activeUnit)
                    ? ` （強化対象: ${cfg.activeGrade} ${cfg.activeSubject} ${cfg.activeUnit}）`
                    : '';
                campaignBannerMsg = `📢 ${msg}${targetInfo}`;
            }
        }
    }

    if (banner && bannerText) {
        if (campaignBannerMsg) {
            banner.classList.remove('hidden');
            banner.style.display = 'block';
            bannerText.innerText = campaignBannerMsg;
        } else {
            banner.classList.add('hidden');
            banner.style.display = 'none';
            bannerText.innerText = '';
        }
    }

    // 2. タイトル画面の告知ライナーバナー (#title-news-banner)
    const titleNewsBanner = document.getElementById('title-news-banner');
    const titleNewsText = document.getElementById('title-news-text');
    if (titleNewsBanner) {
        if (rawBannerMsg && rawBannerMsg.trim() !== '') {
            titleNewsBanner.classList.remove('hidden');
            if (titleNewsText) titleNewsText.innerText = rawBannerMsg.trim();
        } else {
            titleNewsBanner.classList.add('hidden');
            if (titleNewsText) titleNewsText.innerText = '';
        }
    }
    
    updateCategoryBadges();
}

export function updateCategoryBadges() {
    const revenge = document.getElementById('revenge-badge');
    const badgeSpecial = document.getElementById('badge-special');
    if (badgeSpecial) {
        if (revenge && !revenge.classList.contains('hidden')) badgeSpecial.classList.remove('hidden');
        else badgeSpecial.classList.add('hidden');
    }

    const mission = document.getElementById('mission-badge');
    const title = document.getElementById('title-badge');
    const gift = document.getElementById('gift-badge');
    const badgeAchievement = document.getElementById('badge-achievement');
    if (badgeAchievement) {
        const hasMission = mission && !mission.classList.contains('hidden');
        const hasTitle = title && !title.classList.contains('hidden');
        const hasGift = gift && !gift.classList.contains('hidden');
        if (hasMission || hasTitle || hasGift) badgeAchievement.classList.remove('hidden');
        else badgeAchievement.classList.add('hidden');
    }

    if (typeof window !== 'undefined' && typeof window.StudyelEngine?.updateMiniView === 'function') {
        window.StudyelEngine.updateMiniView();
    }
}

export function openCategory(categoryId) {
    closeAllCategoryModals();
    runtimeState.currentCategory = categoryId;
    document.getElementById('cat-' + categoryId + '-overlay')?.classList.remove('hidden');
}

export function closeCategory(categoryId) {
    runtimeState.currentCategory = null;
    document.getElementById('cat-' + categoryId + '-overlay')?.classList.add('hidden');
    updateTitleInfo();
}

export function closeAllCategoryModals() {
    ['main', 'special', 'gacha', 'achievement', 'guide'].forEach(c => {
        document.getElementById(`cat-${c}-overlay`)?.classList.add('hidden');
    });
}

export function hideCurrentCategoryOverlay() {
    if (runtimeState.currentCategory) {
        document.getElementById(`cat-${runtimeState.currentCategory}-overlay`)?.classList.add('hidden');
    }
}

export function returnToCurrentCategory() {
    if (runtimeState.currentCategory) {
        document.getElementById(`cat-${runtimeState.currentCategory}-overlay`)?.classList.remove('hidden');
    }
}

// ==========================================
// モード選択モーダル開閉制御
// ==========================================
export function openUnitSelection() { 
    closeAllCategoryModals();
    const unitTitle = document.getElementById('unit-select-title'); 
    if(unitTitle) { unitTitle.innerText = "クエスト出発"; unitTitle.style.color = "#2c3e50"; } 
    
    // 開いたときに学年・教科・単元・ボスHPをデフォルト（未選択）状態にリセット
    const gSelect = document.getElementById('grade-select');
    if (gSelect) {
        if (gSelect.options.length <= 1) {
            initTitle();
        }
        gSelect.value = "";
    }
    const sSelect = document.getElementById('subject-select');
    if (sSelect) {
        sSelect.innerHTML = '<option value="">教科を選択</option>';
        sSelect.value = "";
    }
    const uSelect = document.getElementById('unit-select');
    if (uSelect) {
        uSelect.innerHTML = '<option value="">単元を選択</option>';
        uSelect.value = "";
    }
    const hpSelect = document.getElementById('boss-hp-select');
    if (hpSelect) {
        hpSelect.value = "";
    }

    document.getElementById('unit-select-overlay')?.classList.remove('hidden'); 
}

export function closeUnitSelection() { 
    document.getElementById('unit-select-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

export function openRandomMenu() { 
    closeAllCategoryModals();
    populateGradeSelect(document.getElementById('random-grade-select'), '学年を選択...');
    const hpSelect = document.getElementById('random-boss-hp-select');
    if (hpSelect) hpSelect.value = "";

    document.getElementById('random-overlay')?.classList.remove('hidden'); 
}

export function closeRandomMenu() { 
    document.getElementById('random-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

export function openTypingMenu() { 
    closeAllCategoryModals();
    populateGradeSelect(document.getElementById('typing-grade-select'), '学年を選択...');
    const hpSelect = document.getElementById('typing-boss-hp-select');
    if (hpSelect) hpSelect.value = "";

    document.getElementById('typing-menu-overlay')?.classList.remove('hidden'); 
}

export function closeTypingMenu() { 
    document.getElementById('typing-menu-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

export function openSurvivalMenu() { 
    closeAllCategoryModals();
    runtimeState.oathOrigin = 'normal';
    runtimeState.tempOaths = [];
    runtimeState.tempReliefs = [];
    populateGradeSelect(document.getElementById('survival-grade-select'), '学年を選択...');
    document.getElementById('survival-overlay')?.classList.remove('hidden'); 
}

export function closeSurvivalMenu() { 
    document.getElementById('survival-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

export function openCalcMenu() { 
    closeAllCategoryModals();
    document.getElementById('calc-overlay')?.classList.remove('hidden'); 
}

export function closeCalcMenu() { 
    document.getElementById('calc-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

export function openRogueMenu() { 
    closeAllCategoryModals();
    populateGradeSelect(document.getElementById('rogue-grade-select'), '学年を選択...');
    document.getElementById('rogue-menu-overlay')?.classList.remove('hidden'); 
}
export function closeRogueMenu() { 
    document.getElementById('rogue-menu-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

export function openOathMenu() {
    runtimeState.tempOaths = [];
    document.querySelectorAll('.oath-option').forEach(el => el.classList.remove('selected'));
    
    const title = document.querySelector('#oath-overlay h2');
    const desc = document.querySelector('#oath-overlay p');
    const weakOption = document.getElementById('oath-weak');
    
    if (runtimeState.oathOrigin === 'survival') {
        if (title) title.innerText = "😈 特訓の誓約";
        if (desc) desc.innerHTML = 'より過酷な特訓に挑む。<br>（獲得特訓EXP <span style="color:#e67e22; font-weight:bold;">2倍/3倍</span>）';
        if (weakOption) weakOption.style.display = 'none';
    } else {
        if (title) title.innerText = "😈 誓約の儀";
        if (desc) desc.innerHTML = '自らにハンデを課し、高みを目指せ。<br>（報酬EXP <span style="color:#e67e22; font-weight:bold;">1.5〜2.0倍</span>）';
        if (weakOption) weakOption.style.display = 'flex';
    }
    
    document.getElementById('oath-overlay')?.classList.remove('hidden');
}

export function closeOathMenu() {
    document.getElementById('oath-overlay')?.classList.add('hidden');
    if (runtimeState.oathOrigin === 'survival') {
        document.getElementById('survival-overlay')?.classList.remove('hidden');
    } else if (runtimeState.oathOrigin === 'random') {
        document.getElementById('random-overlay')?.classList.remove('hidden');
    } else if (runtimeState.oathOrigin === 'typing') {
        document.getElementById('typing-menu-overlay')?.classList.remove('hidden');
    } else {
        document.getElementById('unit-select-overlay')?.classList.remove('hidden');
    }
}

export function openReliefMenu() {
    runtimeState.tempReliefs = [];
    document.querySelectorAll('#relief-overlay .oath-option').forEach(el => el.classList.remove('selected'));
    
    const title = document.getElementById('relief-title');
    const desc = document.getElementById('relief-desc');
    const powerOption = document.getElementById('relief-power');
    
    if (runtimeState.oathOrigin === 'survival') {
        if (title) title.innerText = "🕊️ 特訓の救済";
        if (desc) desc.innerHTML = '加護を受け、特訓を継続しやすくする。<br>（獲得特訓EXP <span class="text-red font-bold">×0.9 ～ ×0.5</span>）';
        if (powerOption) powerOption.style.display = 'none';
    } else {
        if (title) title.innerText = "🕊️ 救済の儀";
        if (desc) desc.innerHTML = '加護を受け、確実に試練を乗り越える。<br>（報酬EXP <span class="text-red font-bold">×0.9 ～ ×0.5</span>）';
        if (powerOption) powerOption.style.display = 'flex';
    }
    
    document.getElementById('relief-overlay')?.classList.remove('hidden');
}

export function closeReliefMenu() {
    document.getElementById('relief-overlay')?.classList.add('hidden');
    if (runtimeState.oathOrigin === 'survival') {
        document.getElementById('survival-overlay')?.classList.remove('hidden');
    } else if (runtimeState.oathOrigin === 'random') {
        document.getElementById('random-overlay')?.classList.remove('hidden');
    } else if (runtimeState.oathOrigin === 'typing') {
        document.getElementById('typing-menu-overlay')?.classList.remove('hidden');
    } else {
        document.getElementById('unit-select-overlay')?.classList.remove('hidden');
    }
}

export function openSyncMenu() {
    closeAllCategoryModals();
    const idEl = document.getElementById('my-user-id');
    if (idEl) idEl.innerText = runtimeState.currentUserId || '--------';
    document.getElementById('sync-overlay')?.classList.remove('hidden');
}
export function closeSyncMenu() {
    document.getElementById('sync-overlay')?.classList.add('hidden');
    returnToCurrentCategory();
}

export function openVersionHistory() { 
    closeAllCategoryModals();
    document.getElementById('version-overlay')?.classList.remove('hidden'); 
}
export function closeVersionHistory() { 
    document.getElementById('version-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

// ==========================================
// ギフトシステム
// ==========================================
export function openGiftMenu() { 
    closeAllCategoryModals();
    document.getElementById('gift-overlay')?.classList.remove('hidden'); 
    renderGiftList(); 
}
export function closeGiftMenu() { 
    document.getElementById('gift-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

export function renderGiftList() {
    const list = document.getElementById('gift-list');
    const receiveAllBtn = document.getElementById('btn-receive-all-gifts');
    if (!list) return;
    list.innerHTML = '';
    
    let gifts = rawData.gifts || [];
    let unclaimed = gifts.filter(g => g.id && !gameState.claimedGifts.includes(g.id));
    
    if (receiveAllBtn) {
        if (unclaimed.length > 0) {
            receiveAllBtn.disabled = false;
            receiveAllBtn.style.opacity = '1';
            receiveAllBtn.style.cursor = 'pointer';
        } else {
            receiveAllBtn.disabled = true;
            receiveAllBtn.style.opacity = '0.5';
            receiveAllBtn.style.cursor = 'not-allowed';
        }
    }
    
    if (unclaimed.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#7f8c8d; padding:20px;">受け取れるギフトはありません</div>';
        return;
    }
    
    unclaimed.forEach(g => {
        list.innerHTML += `
            <div class="gift-item">
                <div class="gift-header">
                    <span class="gift-title">${g.title || 'プレゼント'}</span>
                    <span class="gift-exp">+${g.exp || 0} XP</span>
                </div>
                <div class="gift-msg">${g.message || ''}</div>
            </div>
        `;
    });
}

export function receiveAllGifts() {
    let gifts = rawData.gifts || [];
    let unclaimed = gifts.filter(g => g.id && !gameState.claimedGifts.includes(g.id));
    if (unclaimed.length === 0) return alert("受け取れるギフトがありません。");
    
    let totalExp = 0;
    unclaimed.forEach(g => {
        gameState.claimedGifts.push(g.id);
        totalExp += Number(g.exp || 0);
    });
    
    gameState.xp += totalExp;
    saveGame();
    playSE('win');
    renderGiftList();
    updateTitleInfo();
    checkAdminGifts();
    alert(`合計 ${totalExp} XP のギフトを受け取りました！`);
}

export function checkAdminGifts() {
    let gifts = rawData.gifts || [];
    let unclaimed = gifts.filter(g => g.id && !gameState.claimedGifts.includes(g.id));
    let count = unclaimed.length;
    const badge = document.getElementById('gift-badge');
    const giftBtn = document.getElementById('btn-gift');
    const receiveAllBtn = document.getElementById('btn-receive-all-gifts');
    
    if (badge) {
        if (count > 0) {
            badge.innerText = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    
    if (giftBtn) {
        if (count > 0) {
            giftBtn.style.opacity = '1';
        } else {
            giftBtn.style.opacity = '0.7';
        }
    }
    
    updateCategoryBadges();
}

// ==========================================
// 成績表・学力レポート
// ==========================================
export function openRecord() { 
    closeAllCategoryModals();
    document.getElementById('record-overlay')?.classList.remove('hidden'); 
    renderRecord(); 
}
export function closeRecord() { 
    document.getElementById('record-overlay')?.classList.add('hidden'); 
    returnToCurrentCategory();
}

export function renderRecord() {
    const summaryBox = document.getElementById('record-summary');
    const tbody = document.getElementById('grade-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const statsObj = gameState.subjectStats || {};
    const subjects = Object.keys(statsObj).sort();
    
    let grandTotal = 0;
    let grandCorrect = 0;
    
    if (subjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="p-10 text-gray">データがありません。<br>クエストをプレイしてください。</td></tr>';
        drawRadarChart([], []);
    } else {
        const labels = [];
        const dataPoints = [];
        subjects.forEach(subj => {
            const d = statsObj[subj] || { correct: 0, total: 0 };
            const total = Number(d.total) || 0;
            const correct = Number(d.correct) || 0;
            grandTotal += total;
            grandCorrect += correct;
            const rate = total > 0 ? (correct / total * 100) : 0;
            
            let rank = 'G';
            if (rate >= 90) rank = 'S';
            else if (rate >= 80) rank = 'A';
            else if (rate >= 70) rank = 'B';
            else if (rate >= 60) rank = 'C';
            else if (rate >= 50) rank = 'D';
            else if (rate >= 40) rank = 'E';
            else if (rate >= 20) rank = 'F';
            
            labels.push(subj);
            dataPoints.push(rate);
            tbody.innerHTML += `<tr><td class="font-bold">${subj}</td><td>${rate.toFixed(1)}% <span class="record-sub-stat">(${correct}/${total})</span></td><td class="rank-${rank}">${rank}</td></tr>`;
        });
        drawRadarChart(labels, dataPoints);
    }
    
    if (summaryBox) {
        const grandRate = grandTotal > 0 ? (grandCorrect / grandTotal * 100) : 0;
        let grandRank = 'G';
        if (grandRate >= 90) grandRank = 'S';
        else if (grandRate >= 80) grandRank = 'A';
        else if (grandRate >= 70) grandRank = 'B';
        else if (grandRate >= 60) grandRank = 'C';
        else if (grandRate >= 50) grandRank = 'D';
        else if (grandRate >= 40) grandRank = 'E';
        else if (grandRate >= 20) grandRank = 'F';
        
        summaryBox.innerHTML = `
            <div class="record-summary-row">
                <div class="record-summary-card">
                    <div class="record-summary-label">総合正答率</div>
                    <div class="record-summary-val text-purple">${grandRate.toFixed(1)}% <span class="rank-${grandRank} text-lg">(${grandRank})</span></div>
                </div>
                <div class="record-summary-card">
                    <div class="record-summary-label">総解答数</div>
                    <div class="record-summary-val text-dark">${grandCorrect} / ${grandTotal}</div>
                </div>
            </div>
        `;
    }
    
    const recordList = document.getElementById('calc-record-list');
    if (!recordList) return;
    recordList.innerHTML = '';
    
    const calcObj = gameState.calcRecords || {};
    const keys = Object.keys(calcObj);
    if (keys.length === 0) {
        recordList.innerHTML = '<div class="text-gray p-5">計算クエストの記録はありません。</div>';
        return;
    }
    
    keys.forEach(key => {
        const parts = key.split('_');
        const mode = parts.pop();
        const type = parts.join('_');
        const title = {
            addition: 'たし算',
            subtraction: 'ひき算',
            multiplication: 'かけ算',
            division: '割り算(あまりなし)',
            division_remainder: '割り算(あまりあり)',
            random: 'ランダム'
        }[type] || type;
        const modeLabel = mode === '100q' ? '100問' : '3分';
        const list = calcObj[key];
        if (!Array.isArray(list) || list.length === 0) return;
        
        let html = `<div class="calc-record-group"><div class="calc-record-title">⚡ ${title} / ${modeLabel}</div>`;
        list.forEach((item, index) => {
            const timeNum = Number(item.time) || 0;
            const correctNum = Number(item.correct) || 0;
            const dateStr = item.date ? `<span class="calc-record-date">${item.date}</span>` : '';
            html += `<div class="calc-record-item"><span class="calc-record-rank">${index + 1}.</span> <span>${correctNum}正解 / ${timeNum.toFixed(1)}秒</span> ${dateStr}</div>`;
        });
        html += '</div>';
        recordList.innerHTML += html;
    });
}

export function addCalcRecord(entry) {
    const key = `${playData.calcType}_${playData.calcMode}`;
    if (!gameState.calcRecords) gameState.calcRecords = {}; 
    if (!gameState.calcRecords[key]) gameState.calcRecords[key] = [];
    gameState.calcRecords[key].push(entry); 
    gameState.calcRecords[key].sort((a,b) => { 
        if (a.correct !== b.correct) return b.correct - a.correct; 
        return a.time - b.time; 
    });
    gameState.calcRecords[key] = gameState.calcRecords[key].slice(0, 10);
    saveGame();
}

// ==========================================
// 汎用アプリモーダルダイアログ
// ==========================================
export function showAppModal(message, type = 'alert') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('app-modal-overlay');
        const msgBox = document.getElementById('app-modal-message');
        const okBtn = document.getElementById('app-modal-ok');
        const cancelBtn = document.getElementById('app-modal-cancel');
        if (!overlay || !msgBox || !okBtn || !cancelBtn) {
            if (type === 'confirm') resolve(window.confirm(message));
            else { window.alert(message); resolve(true); }
            return;
        }
        msgBox.innerText = message;
        if (type === 'alert') {
            cancelBtn.style.display = 'none';
            okBtn.style.width = '100%';
            okBtn.innerText = 'OK';
        } else {
            cancelBtn.style.display = 'block';
            okBtn.style.width = '';
            okBtn.innerText = 'はい';
            cancelBtn.innerText = 'いいえ';
        }
        runtimeState.appModalResolve = resolve;
        overlay.classList.remove('hidden');
        
        okBtn.onclick = () => {
            overlay.classList.add('hidden');
            if (runtimeState.appModalResolve) runtimeState.appModalResolve(true);
        };
        cancelBtn.onclick = () => {
            overlay.classList.add('hidden');
            if (runtimeState.appModalResolve) runtimeState.appModalResolve(false);
        };
    });
}

export function showAlert(msg) { return showAppModal(msg, 'alert'); }
export function showConfirm(msg) { return showAppModal(msg, 'confirm'); }

// ==========================================
// プレイガイドモジュール
// ==========================================
export const GuideModule = {
    open: function(topicId = null) {
        const existing = document.getElementById('guide-overlay');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'guide-overlay';
        overlay.className = 'overlay overlay-z800';
        
        const modal = document.createElement('div');
        modal.className = 'modal modal-w500';
        
        if (topicId && GUIDE_DATA.topics[topicId]) {
            modal.innerHTML = this.getTopicDetailHtml(topicId);
        } else {
            modal.innerHTML = this.getCategoryListHtml();
        }
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    },
    
    close: function() {
        const overlay = document.getElementById('guide-overlay');
        if (overlay) overlay.remove();
    },
    
    showCategoryList: function() {
        const modal = document.querySelector('#guide-overlay .modal');
        if (modal) modal.innerHTML = this.getCategoryListHtml();
    },
    
    showTopicDetail: function(topicId) {
        const modal = document.querySelector('#guide-overlay .modal');
        if (modal) modal.innerHTML = this.getTopicDetailHtml(topicId);
    },
    
    getCategoryListHtml: function() {
        let html = `
            <div class="guide-header">
                <h2 class="m-0 text-cyan">📖 プレイガイド</h2>
                <button class="guide-close-x" onclick="GuideModule.close()">✕</button>
            </div>
            <div class="modal-scroll-area text-left">
        `;
        
        GUIDE_DATA.categories.forEach(cat => {
            html += `
                <div class="guide-category-section">
                    <div class="guide-category-title font-bold">${cat.icon} ${cat.name}</div>
                    <div class="guide-card-grid">
            `;
            
            Object.keys(GUIDE_DATA.topics).forEach(tid => {
                const t = GUIDE_DATA.topics[tid];
                if (t.categoryId === cat.id) {
                    html += `
                        <div class="guide-card-item" onclick="GuideModule.showTopicDetail('${tid}')">
                            <div class="guide-card-icon">${t.icon}</div>
                            <div class="guide-card-text">
                                <div class="guide-card-title">${t.title}</div>
                                <div class="guide-card-sub">${t.summary}</div>
                            </div>
                        </div>
                    `;
                }
            });
            
            html += `</div></div>`;
        });
        
        html += `
            </div>
            <button class="menu-btn mt-15 btn-gray" onclick="GuideModule.close()">閉じる</button>
        `;
        return html;
    },
    
    getTopicDetailHtml: function(topicId) {
        const t = GUIDE_DATA.topics[topicId];
        if (!t) return this.getCategoryListHtml();
        
        return `
            <div class="guide-header">
                <h3 class="m-0 text-cyan">${t.icon} ${t.title}</h3>
                <button class="guide-close-x" onclick="GuideModule.close()">✕</button>
            </div>
            <div class="guide-detail-body">
                ${t.contentHtml}
            </div>
            <div class="modal-btn-grid mt-15">
                <button class="menu-btn btn-navy" onclick="GuideModule.showCategoryList()">◀ 一覧に戻る</button>
                <button class="menu-btn btn-gray" onclick="GuideModule.close()">閉じる</button>
            </div>
        `;
    }
};

