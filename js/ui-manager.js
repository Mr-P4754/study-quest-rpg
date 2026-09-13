// ==========================================
// js/ui-manager.js (カテゴリー遷移・モーダル・プレイガイド・成績表・ギフト)
// ==========================================

import {
    gameState,
    rawData,
    runtimeState,
    GUIDE_DATA,
    saveGame
} from './state.js?v=10.5.0';

import {
    getDisplayName,
    drawRadarChart,
    playSE,
    ALL_GRADES,
    isGradeMatch,
    renderSafeImg
} from './utils.js?v=10.5.0';

import { cloudSync } from './api.js?v=10.5.0';
import { generateAvatarSvg } from './avatar-engine.js?v=10.5.0';

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

    // クラウド同期状態の購読（二重登録防止）
    if (cloudSync && !initTitle.subscribedSync) {
        initTitle.subscribedSync = true;
        cloudSync.subscribe(updateCloudSyncIndicator);
    }
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
 * 現在のキャッシュ取得状況をバージョンモーダル内に描画
 */
/**
 * 現在のキャッシュ取得状況をバージョンモーダル内に描画
 */
export async function renderQuestionCacheStatus() {
    const container = document.getElementById('cache-status-container');
    if (!container) return;

    if (typeof window.getQuestionCacheStatus !== 'function') {
        container.innerHTML = '<div class="text-xs text-gray">キャッシュ情報を取得できません。</div>';
        return;
    }

    container.innerHTML = '<div class="text-xs text-gray" style="padding: 6px 0;">⏳ キャッシュ状態を確認中...</div>';
    const list = await window.getQuestionCacheStatus();

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-top: 12px; text-align: left;">
                <div style="font-weight: bold; font-size: 12px; color: #64748b; margin-bottom: 4px;">📦 問題キャッシュ（IndexedDB）状態</div>
                <div style="font-size: 11px; color: #f59e0b;">⚠️ キャッシュ未保存（「全学年を一括強制同期」を押すと全問即時保存されます）</div>
            </div>
        `;
        return;
    }

    // 重複キー（全角・半角）をマージして学年順にソート
    const gradeOrder = ['小1', '小2', '小3', '小4', '小5', '小6', '中1', '中2', '中3', '高1', '高2', '高3'];
    const mergedMap = new Map();

    list.forEach(item => {
        const halfG = (item.grade || '').toString().trim().replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        if (!mergedMap.has(halfG)) {
            mergedMap.set(halfG, item);
        } else {
            const existing = mergedMap.get(halfG);
            const countEx = (existing.questionCount || 0) + (existing.typingCount || 0);
            const countCur = (item.questionCount || 0) + (item.typingCount || 0);
            if (countCur > countEx) {
                mergedMap.set(halfG, item);
            }
        }
    });

    const sortedItems = Array.from(mergedMap.values()).sort((a, b) => {
        const hA = (a.grade || '').toString().trim().replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        const hB = (b.grade || '').toString().trim().replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        const idxA = gradeOrder.indexOf(hA);
        const idxB = gradeOrder.indexOf(hB);
        return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
    });

    let totalQ = 0;
    let totalT = 0;
    const rows = sortedItems.map(item => {
        const qCount = item.questionCount || 0;
        const tCount = item.typingCount || 0;
        totalQ += qCount;
        totalT += tCount;
        const timeStr = item.updatedAt ? item.updatedAt.slice(5) : '日時未記録';
        const displayGrade = item.grade.toString().trim().replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; font-size: 11px;">
            <span style="font-weight: bold; color: #1e293b; min-width: 45px;">【${displayGrade}】</span>
            <span style="color: #0284c7; flex: 1; text-align: left; padding-left: 8px;">通常 <b>${qCount}</b>問 / ⌨️ <b>${tCount}</b>問</span>
            <span style="color: #64748b; font-size: 10px;">${timeStr}</span>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-top: 12px; text-align: left;">
            <div style="font-weight: bold; font-size: 12px; color: #334155; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span>📦 保存済みキャッシュ一覧（合計 ${totalQ.toLocaleString()}問）</span>
                <span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: bold;">${sortedItems.length}学年 保存済</span>
            </div>
            <div style="max-height: 140px; overflow-y: auto; padding-right: 4px;">
                ${rows}
            </div>
        </div>
    `;
}

/**
 * 全学年の一括強制同期（小1〜高3）
 */
export async function syncAllGradesNow() {
    if (typeof window.showConfirm === 'function') {
        const ok = await window.showConfirm("🚀 全学年（小1〜高3）の問題データを一括強制同期しますか？\n\n・Google ドライブ上の最新JSONをすべて直結取得\n・IndexedDBキャッシュを全学年一新\n・中1や小3の最新問題も一発で同期されます\n（※キャラクターやセーブデータには影響しません）");
        if (!ok) return;
    }

    const btnAll = document.getElementById('btn-sync-all-grades');
    const originalText = btnAll ? btnAll.innerHTML : '🚀 全学年を一括強制同期（小1〜高3）';
    if (btnAll) {
        btnAll.disabled = true;
        btnAll.style.opacity = '0.7';
    }

    try {
        if (typeof window.forceSyncAllGrades !== 'function') {
            throw new Error('同期エンジンが利用できません。');
        }

        let syncedCount = 0;
        let totalQuestions = 0;
        let totalTyping = 0;

        const results = await window.forceSyncAllGrades((grade, cur, total) => {
            if (btnAll) {
                btnAll.innerHTML = `⏳ (${cur}/${total}) 【${grade}】を取得中...`;
            }
        });

        results.forEach(r => {
            if (r.success) {
                syncedCount++;
                totalQuestions += (r.questionCount || 0);
                totalTyping += (r.typingCount || 0);
            }
        });

        await renderQuestionCacheStatus();

        // 教科一覧が現在開いていれば再描画
        if (typeof window.filterSubjects === 'function') {
            window.filterSubjects();
        }

        alert(`🎉 全学年の一括強制同期が完了しました！\n\n・同期成功: ${syncedCount}/${results.length} 学年\n・通常問題: 合計 ${totalQuestions.toLocaleString()} 問\n・タイピング: 合計 ${totalTyping.toLocaleString()} 問\n\n全学年が最新の状態で即座にプレイ可能です！`);
    } catch (e) {
        alert("一括同期エラー: " + (e.message || e));
    } finally {
        if (btnAll) {
            btnAll.innerHTML = originalText;
            btnAll.disabled = false;
            btnAll.style.opacity = '1';
        }
    }
}

/**
 * 手動キャッシュクリア＆最新再同期（単独学年または学年未選択時全学年同期）
 */
export async function manualReloadCache(targetGrade) {
    const selectedGrade = targetGrade || document.getElementById('grade-select')?.value;
    
    // 学年が選択されていない場合は全学年一括同期を案内
    if (!selectedGrade) {
        if (typeof window.showConfirm === 'function') {
            const doAll = await window.showConfirm("学年が未選択です。全学年（小1〜高3）を一括で強制同期しますか？\n（「キャンセル」を押すと特定の学年を選択してから同期できます）");
            if (doAll) {
                return syncAllGradesNow();
            }
            return;
        }
    }

    const currentGrade = selectedGrade || '小4';
    
    if (typeof window.showConfirm === 'function') {
        const ok = await window.showConfirm(`【${currentGrade}】の最新問題データをサーバーから今すぐ強制取得しますか？\n\n・リモートビルドされた最新のGoogleドライブJSONを直結取得\n・IndexedDBキャッシュを最新に即時上書き\n・画面の教科一覧もその場で最新化されます\n（※キャラクターやセーブデータには一切影響しません）`);
        if (!ok) return;
    }

    const btn = document.getElementById('btn-manual-sync');
    const originalText = btn ? btn.innerHTML : `🔄 【${currentGrade}】のみ強制同期`;
    if (btn) { btn.innerHTML = '⏳ 最新問題を取得中...'; btn.disabled = true; }

    try {
        if (typeof window.forceSyncGradeQuestions === 'function') {
            const res = await window.forceSyncGradeQuestions(currentGrade);
            await renderQuestionCacheStatus();
            alert(`🎉 【${res.grade}】の最新問題を同期しました！\n\n・通常問題: ${res.questionCount}問\n・タイピング: ${res.typingCount}問\n・更新日時: ${res.updatedAt}\n\nゲームに即座に反映されました！`);
        } else {
            if (typeof window.clearQuestionCache === 'function') {
                await window.clearQuestionCache();
            }
            alert("問題キャッシュをクリアしました。ページを再読み込みします。");
            location.href = window.location.pathname + '?refresh=true&t=' + Date.now();
        }
    } catch (e) {
        alert("同期エラー: " + (e.message || e));
    } finally {
        if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
    }
}

/**
 * キャッシュの完全消去
 */
export async function clearAllCacheConfirm() {
    if (typeof window.showConfirm === 'function') {
        const ok = await window.showConfirm("⚠️ 保存されている問題キャッシュをすべて消去しますか？\n\n次回学年選択時にサーバーから自動再取得されます。\n（※所持キャラやXP、進行度は保持されます）");
        if (!ok) return;
    }
    if (typeof window.clearQuestionCache === 'function') {
        await window.clearQuestionCache();
        await renderQuestionCacheStatus();
        alert("問題キャッシュを消去しました。");
    }
}

if (typeof window !== 'undefined') {
    window.manualReloadCache = manualReloadCache;
    window.syncAllGradesNow = syncAllGradesNow;
    window.clearAllCacheConfirm = clearAllCacheConfirm;
    window.renderQuestionCacheStatus = renderQuestionCacheStatus;
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
    const party = Array.isArray(gameState.equippedParty) ? gameState.equippedParty : [(gameState.equipped || '1'), null, null];
    const mainId = party[0] || '1';
    const chara = (rawData.characters && rawData.characters.length > 0) ? rawData.characters.find(c => String(c.id) == String(mainId)) : null;
    const inv = (gameState.charaInventory && gameState.charaInventory[mainId]) || (chara ? gameState.charaInventory[chara.id] : null);
    let lv = (inv && typeof inv.level === 'number' && inv.level >= 1) ? inv.level : 1;
    const displayName = (chara && typeof getDisplayName === 'function') ? getDisplayName(chara, inv) : (chara ? chara.name : "なし");
    const tEquippedName = document.getElementById('title-equipped-name'); 
    if(tEquippedName) tEquippedName.innerHTML = displayName + (chara ? " Lv." + lv : "");
    const tXp = document.getElementById('title-xp'); 
    if(tXp) tXp.innerText = gameState.xp;
    const imgContainer = document.getElementById('title-chara-img');
    if(imgContainer) {
        // 最大3体のミニアイコン（30px）を並べて表示
        let iconsHtml = '<div class="title-slot-icons">';
        for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
            const isUnlocked = slotIdx < (Number(gameState.unlockedSlots) || 1);
            const cId = party[slotIdx];
            const c = cId && rawData.characters ? rawData.characters.find(x => String(x.id) === String(cId)) : null;
            if (!isUnlocked) {
                iconsHtml += '<div class="title-slot-mini-box locked" title="未解放スロット">🔒</div>';
            } else if (c) {
                const img = (c.imageUrl && (c.imageUrl.startsWith('http') || c.imageUrl.startsWith('data:image')))
                    ? renderSafeImg(c.imageUrl, '✏️', '', 'width:30px;height:30px;object-fit:cover;border-radius:6px;background:#fff;')
                    : '<div class="title-slot-mini-fallback">✏️</div>';
                iconsHtml += `<div class="title-slot-mini-box ${slotIdx === 0 ? 'main-slot' : 'sub-slot'}" title="${slotIdx === 0 ? 'メイン' : 'サブ' + slotIdx}: ${c.name}">${img}</div>`;
            } else {
                iconsHtml += '<div class="title-slot-mini-box empty" title="空きスロット">空</div>';
            }
        }
        iconsHtml += '</div>';
        imgContainer.innerHTML = iconsHtml;
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
    ['main', 'special', 'gacha', 'achievement', 'guide', 'sync'].forEach(c => {
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
    runtimeState.currentCategory = 'sync';
    
    // 【フェイルセーフ】ユーザーIDの確実な解決
    if (!runtimeState.currentUserId && typeof localStorage !== 'undefined') {
        const storedId = localStorage.getItem('sq_user_id');
        if (storedId) {
            runtimeState.currentUserId = storedId;
        } else {
            const newId = Math.random().toString(36).substring(2, 10);
            localStorage.setItem('sq_user_id', newId);
            runtimeState.currentUserId = newId;
        }
    }
    
    const validId = runtimeState.currentUserId || (typeof localStorage !== 'undefined' ? localStorage.getItem('sq_user_id') : '') || '--------';
    const idEl = document.getElementById('my-user-id');
    if (idEl) idEl.innerText = validId;

    if (cloudSync) {
        updateCloudSyncIndicator(cloudSync.status, cloudSync.getFormattedSyncTime());
    }
    document.getElementById('sync-overlay')?.classList.remove('hidden');
}
export function closeSyncMenu() {
    document.getElementById('sync-overlay')?.classList.add('hidden');
    returnToCurrentCategory();
}

/**
 * クラウド同期インジケーターのUI表示更新
 * @param {'synced'|'saving'|'retrying'|'error'|'idle'} status
 * @param {string} timeStr - 例: '14:30'
 */
export function updateCloudSyncIndicator(status, timeStr) {
    const titleInd = document.getElementById('cloud-sync-indicator');
    const modalInd = document.getElementById('sync-modal-status');

    let text = '';
    let badgeClass = '';

    switch(status) {
        case 'synced':
            text = `☁️ 同期完了 ${timeStr || ''}`;
            badgeClass = 'sync-badge-synced';
            break;
        case 'saving':
            text = `🔄 クラウド保存中...`;
            badgeClass = 'sync-badge-saving';
            break;
        case 'retrying':
            text = `⏳ 保存待機中`;
            badgeClass = 'sync-badge-retrying';
            break;
        case 'error':
            text = `⚠️ 未同期 (次回自動送信)`;
            badgeClass = 'sync-badge-error';
            break;
        default:
            text = `☁️ 自動保存: 有効`;
            badgeClass = 'sync-badge-idle';
            break;
    }

    if (titleInd) {
        titleInd.className = `cloud-sync-indicator ${badgeClass}`;
        titleInd.innerText = text;
        titleInd.title = `クラウド同期状態: ${text}（リザルト確定時・画面離脱時に自動バックアップ）`;
    }

    if (modalInd) {
        modalInd.className = `sync-modal-status ${badgeClass}`;
        modalInd.innerText = text;
    }
}

/**
 * HTML5 Canvasを用いた引き継ぎIDカード画像の動的生成・自動保存
 */
export async function generateAndDownloadIdCard() {
    const userId = String(runtimeState?.currentUserId || (typeof localStorage !== 'undefined' ? localStorage.getItem('sq_user_id') : '') || '--------').trim();
    if (!userId || userId === '--------') {
        showAlert("⚠️ ユーザーIDが見つかりません。ゲームを一度プレイしてからお試しください。");
        return;
    }

    const canvas = document.createElement('canvas');
    const width = 640;
    const height = 400;
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(2, 2);

    // 1. 背景グラデーション (RPG風ディープブルー)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0a1426');
    bgGrad.addColorStop(0.4, '#101d36');
    bgGrad.addColorStop(1, '#050a12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 装飾背景ライン (幾何学模様)
    ctx.strokeStyle = 'rgba(52, 152, 219, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y <= height; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // 2. 外枠ゴールドダブルボーダー
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    ctx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // コーナー装飾四角形
    const cornerSize = 14;
    const corners = [
        [12, 12], [width - 12 - cornerSize, 12],
        [12, height - 12 - cornerSize], [width - 12 - cornerSize, height - 12 - cornerSize]
    ];
    ctx.fillStyle = '#f1c40f';
    corners.forEach(([cx, cy]) => {
        ctx.fillRect(cx, cy, cornerSize, cornerSize);
    });

    // 3. ヘッダー部
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#f1c40f';
    ctx.fillText('⚔️ STUDY QUEST RPG ⚔️', width / 2, 42);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('引き継ぎIDカード (Data Transfer ID)', width / 2, 70);

    // 4. ID表示ボックス
    const boxX = 60;
    const boxY = 92;
    const boxW = width - 120;
    const boxH = 76;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.textAlign = 'center';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#bdc3c7';
    ctx.fillText('▼ あなたの固有引き継ぎID ▼', width / 2, boxY + 22);

    ctx.font = 'bold 34px "BIZ UDPGothic", "Courier New", monospace, sans-serif';
    ctx.fillStyle = '#2ecc71';
    ctx.fillText(userId, width / 2, boxY + 58);

    // ▼ アバター顔グラフィックの非同期合成描画 ▼
    const avSvg = generateAvatarSvg(gameState.avatar, 64);
    if (avSvg) {
        await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, boxX + boxW - 74, boxY + 6, 64, 64);
                resolve();
            };
            img.onerror = () => resolve();
            img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(avSvg);
        });
    }

    // 5. ステータス情報部（所持XP & 発行日時）
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${('0' + (now.getMonth() + 1)).slice(-2)}/${('0' + now.getDate()).slice(-2)} ${('0' + now.getHours()).slice(-2)}:${('0' + now.getMinutes()).slice(-2)}`;
    const xpStr = (Number(gameState.xp) || 0).toLocaleString() + ' XP';

    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f39c12';
    ctx.fillText(`💎 所持XP: ${xpStr}`, boxX + 10, boxY + boxH + 30);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#95a5a6';
    ctx.fillText(`📅 発行日: ${dateStr}`, boxX + boxW - 10, boxY + boxH + 30);

    // 6. 復旧手順ボックス
    const guideY = boxY + boxH + 46;
    const guideH = 110;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(boxX, guideY, boxW, guideH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, guideY, boxW, guideH);

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#e67e22';
    ctx.fillText('【データ復旧手順】', boxX + 16, guideY + 24);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ecf0f1';
    ctx.fillText('① ゲームのタイトル画面で「☁️ データ管理」を選択', boxX + 24, guideY + 48);
    ctx.fillText('② 「データを読み込む」欄に上記の固有IDを入力', boxX + 24, guideY + 70);
    ctx.fillText('③ 「📥 データをダウンロード」を押すと以前のデータが復元されます', boxX + 24, guideY + 92);

    // 7. 最下部注記
    ctx.textAlign = 'center';
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText('※端末故障・データ初期化・機種変更時の復元に必要です。写真として大切に保存してください。', width / 2, height - 22);

    // ダウンロードトリガー
    try {
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `STUDY_QUEST_ID_${userId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showAlert(`📷 引き継ぎIDカードを保存しました！\n\nファイル名: STUDY_QUEST_ID_${userId}.png\n端末の写真アプリやダウンロードフォルダをご確認ください。`);
    } catch (e) {
        console.error('[SQ-IDCard] 画像保存エラー:', e);
        showAlert("画像の保存に失敗しました。画面のスクリーンショットを撮影してIDを保管してください。");
    }
}

if (typeof window !== 'undefined') {
    window.generateAndDownloadIdCard = generateAndDownloadIdCard;
    window.updateCloudSyncIndicator = updateCloudSyncIndicator;
}


export function openVersionHistory() { 
    closeAllCategoryModals();
    document.getElementById('version-overlay')?.classList.remove('hidden'); 
    renderQuestionCacheStatus();
    const curG = document.getElementById('grade-select')?.value;
    const btnSync = document.getElementById('btn-manual-sync');
    if (btnSync) {
        btnSync.innerHTML = curG ? `🔄 選択中【${curG}】のみ強制同期` : '🔄 選択学年のみ強制同期';
    }
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

