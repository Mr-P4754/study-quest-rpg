// ==========================================
// js/api.js (GASバックエンド通信・クラウド同期)
// ==========================================

import { API_URL, rawData, gameState, dailyMissions, runtimeState, saveGame } from './state.js?v=10.1.1';
import { isGradeMatch, ALL_GRADES } from './utils.js?v=10.1.1';

// ==========================================
// IndexedDB スマートキャッシュマネージャー
// （マスター更新日時 updatedAt に完全連動・UI/ゲーム挙動への悪影響を完全遮断）
// ==========================================
const DB_NAME = 'SQ_QuestionDatabase';
const DB_VERSION = 1;
const STORE_NAME = 'question_cache';

/**
 * IndexedDB 接続オープンヘルパー（環境非対応やエラー時は安全に null を返却）
 */
function openQuestionDB() {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            resolve(null);
            return;
        }
        try {
            const req = window.indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'grade' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

/**
 * 指定学年の問題キャッシュを取得
 */
async function getCachedGradeData(gradeCode) {
    const db = await openQuestionDB();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(gradeCode);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

/**
 * 指定学年の問題キャッシュを保存（現在のマスター updatedAt に紐付け）
 */
async function saveCachedGradeData(gradeCode, masterUpdatedAt, data) {
    const db = await openQuestionDB();
    if (!db || !data) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({
                grade: gradeCode,
                masterUpdatedAt: masterUpdatedAt || '',
                data: data,
                timestamp: Date.now()
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        } catch (e) {
            resolve(false);
        }
    });
}

/**
 * 全問題キャッシュの完全消去（手動クリア・再同期安全弁）
 */
export async function clearQuestionCache() {
    const db = await openQuestionDB();
    if (!db) return false;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();
            req.onsuccess = () => {
                console.log('[SQ-Cache] 問題キャッシュを完全消去しました。');
                resolve(true);
            };
            req.onerror = () => resolve(false);
        } catch (e) {
            resolve(false);
        }
    });
}

if (typeof window !== 'undefined') {
    window.clearQuestionCache = clearQuestionCache;
}

export async function uploadData() {
    if (typeof window.showConfirm === 'function') {
        if (!(await window.showConfirm("現在のデータをクラウドに保存しますか？\n（同じIDの古いデータは上書きされます）"))) return;
    }
    saveGame();
    const backupData = {
        xp: gameState.xp,
        equipped: gameState.equipped,
        itemLevels: gameState.itemLevels,
        charaInventory: gameState.charaInventory,
        missions: dailyMissions,
        stats: gameState.stats,
        subjectStats: gameState.subjectStats,
        unlockedTitles: gameState.unlockedTitles,
        claimedGifts: gameState.claimedGifts,
        revengeList: gameState.revengeList,
        unitProgress: gameState.unitProgress,
        inventory: gameState.inventory,
        calcRecords: gameState.calcRecords,
        studyel: gameState.studyel
    };
    const btn = document.querySelector('#sync-overlay button');
    const originalText = btn ? btn.innerText : "送信";
    if (btn) { btn.innerText = "送信中..."; btn.disabled = true; }
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'save', userId: runtimeState.currentUserId, data: backupData })
        });
        const json = await res.json();
        if (json.status === 'success') {
            alert("クラウドへの保存が完了しました！");
        } else {
            alert("保存失敗: " + json.message);
        }
    } catch(e) {
        alert("通信エラー: " + e);
    } finally {
        if (btn) { btn.innerText = originalText; btn.disabled = false; }
    }
}

export async function downloadData() {
    const inputId = document.getElementById('input-sync-id')?.value.trim();
    if (!inputId) return alert("IDを入力してください");
    if (typeof window.showConfirm === 'function') {
        if (!(await window.showConfirm("データを読み込みますか？\n現在のデータは上書きされます。"))) return;
    }
    const btns = document.querySelectorAll('#sync-overlay button');
    let btn = null;
    for (let i = 0; i < btns.length; i++) {
        if (btns[i].innerText.includes('ダウンロード')) btn = btns[i];
    }
    if (!btn && btns.length > 0) btn = btns[btns.length - 2]; 
    const originalText = btn ? btn.innerText : "ダウンロード";
    if (btn) { btn.innerText = "受信中..."; btn.disabled = true; }
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'load', userId: inputId })
        });
        const json = await res.json();
        if (json.questions || json.appVersion) return alert("【エラー】\nサーバー設定が反映されていません。");
        if (json.status === 'success') {
            let data = json.data;
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch(e) {}
            }
            if (!data) { alert("データの中身が空でした。"); return; }
            const forceObj = (v) => { if(!v)return{}; if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return{}}} return v; };
            const forceArr = (v) => { if(!v)return[]; if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return[]}} return Array.isArray(v)?v:[]; };
            
            gameState.xp = parseInt(data.xp || 0, 10);
            gameState.equipped = String(data.equipped || '1');
            gameState.itemLevels = forceObj(data.itemLevels);
            gameState.charaInventory = forceObj(data.charaInventory);
            Object.keys(gameState.charaInventory).forEach(id => {
                const item = gameState.charaInventory[id];
                if (item) {
                    if (typeof item.level !== 'number' || item.level < 1) item.level = 1;
                    if (typeof item.count !== 'number' || item.count < 1) item.count = 1;
                    if (typeof item.exp !== 'number' || item.exp < 0) item.exp = 0;
                }
            });
            
            const m = forceObj(data.missions);
            dailyMissions.date = m.date || "";
            dailyMissions.progress = m.progress || dailyMissions.progress;
            dailyMissions.claimed = m.claimed || dailyMissions.claimed;

            gameState.stats = forceObj(data.stats);
            gameState.subjectStats = forceObj(data.subjectStats);
            gameState.unlockedTitles = forceArr(data.unlockedTitles);
            gameState.claimedGifts = forceArr(data.claimedGifts);
            gameState.revengeList = forceArr(data.revengeList);
            gameState.unitProgress = forceObj(data.unitProgress);
            gameState.calcRecords = forceObj(data.calcRecords);
            const cInv = forceObj(data.inventory);
            gameState.inventory = {
                redPages: Number(cInv.redPages) || 0,
                bluePages: Number(cInv.bluePages) || 0,
                xpBookSmall: Number(cInv.xpBookSmall) || 0,
                xpBookMedium: Number(cInv.xpBookMedium) || 0,
                xpBookLarge: Number(cInv.xpBookLarge) || 0
            };
            if (data.studyel) {
                const sData = forceObj(data.studyel);
                Object.assign(gameState.studyel, sData);
            }
            runtimeState.currentUserId = inputId;
            localStorage.setItem('sq_user_id', inputId);
            saveGame();
            alert("データの読み込みに成功しました！\nリロードします。");
            location.reload();
        } else {
            alert("読み込み失敗: " + (json.message || "Unknown error"));
        }
    } catch(e) {
        alert("通信エラー: " + e);
    } finally {
        if (btn) { btn.innerText = originalText; btn.disabled = false; }
    }
}

// 全角・半角変換ヘルパー
function toHalfWidth(str) {
    if (!str) return '';
    return str.toString().replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
}

function toFullWidth(str) {
    if (!str) return '';
    return str.toString().replace(/[!-~]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
}

// 学年別ロード管理
if (!rawData.loadedGrades) {
    rawData.loadedGrades = new Set();
}
const gradeLoadPromises = new Map();

function getVal(obj, keys) {
    if (!obj) return "";
    for (const k of keys) {
        const v = obj[k];
        if (v !== undefined && v !== null && v !== "") return String(v);
    }
    return "";
}

/**
 * 学年別問題・タイピングデータをパースして rawData にマージ
 */
export function parseAndMergeGradeData(data, targetGrade) {
    if (!data) return;

    if (!Array.isArray(rawData.questions)) rawData.questions = [];
    if (!Array.isArray(rawData.typing)) rawData.typing = [];

    const effectiveGrade = targetGrade || data.grade || data.gradeCode || '';

    // 1. 通常問題 (questions)
    if (Array.isArray(data.questions) && data.questions.length > 0) {
        // targetGrade が明示されている場合、該当学年の既存データを一旦除去して最新ファイルでクリーンに置換
        if (effectiveGrade) {
            rawData.questions = rawData.questions.filter(q => !isGradeMatch(q.grade, effectiveGrade));
        }
        const existingIds = new Set(rawData.questions.map(q => String(q.id)));
        const newQuestions = data.questions.map(q => {
            const qText = q.question || q.q || getVal(q, ['問題', '問題文']);
            const aText = q.answer || q.a || getVal(q, ['正解']);
            const choices = (Array.isArray(q.choices) && q.choices.length > 0)
                ? q.choices
                : [
                    aText,
                    q.wrong1 !== undefined ? q.wrong1 : getVal(q, ['誤答1']),
                    q.wrong2 !== undefined ? q.wrong2 : getVal(q, ['誤答2']),
                    q.wrong3 !== undefined ? q.wrong3 : getVal(q, ['誤答3'])
                ].filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(String);

            return {
                ...q,
                id: String(q.id || `q_${Math.abs(generateStringHash(qText + aText))}`),
                grade: String(q.grade || getVal(q, ['学年']) || effectiveGrade || ''),
                unit: String(q.unit || getVal(q, ['単元']) || ''),
                subject: String(q.subject || getVal(q, ['教科']) || ''),
                question: qText,
                q: qText,
                answer: aText,
                a: aText,
                choices: choices,
                explain: String(q.explain !== undefined ? q.explain : (getVal(q, ['解説']) || ''))
            };
        });

        newQuestions.forEach(q => {
            if (!existingIds.has(q.id)) {
                existingIds.add(q.id);
                rawData.questions.push(q);
            }
        });
    }

    // 2. タイピング (typing)
    if (Array.isArray(data.typing) && data.typing.length > 0) {
        if (effectiveGrade) {
            rawData.typing = rawData.typing.filter(t => !isGradeMatch(t.grade, effectiveGrade));
        }
        const existingTypingIds = new Set(rawData.typing.map(t => String(t.id)));
        const newTyping = data.typing.map(t => {
            const jp = String(t.japanese || t.display || getVal(t, ['日本語']) || '');
            const rm = String(t.romaji || t.input || getVal(t, ['ローマ字']) || '').toLowerCase().replace(/\s+/g, '');
            return {
                ...t,
                id: String(t.id || `t_${Math.abs(generateStringHash(jp))}`),
                grade: String(t.grade || getVal(t, ['学年']) || effectiveGrade || ''),
                unit: String(t.unit || getVal(t, ['単元', '単元/ジャンル']) || '全般'),
                subject: 'タイピング',
                japanese: jp,
                romaji: rm
            };
        }).filter(t => t.japanese && t.romaji);

        newTyping.forEach(t => {
            if (!existingTypingIds.has(t.id)) {
                existingTypingIds.add(t.id);
                rawData.typing.push(t);
            }
        });
    }

    if (effectiveGrade) {
        const gStr = effectiveGrade.toString().trim();
        rawData.loadedGrades.add(gStr);
        rawData.loadedGrades.add(toHalfWidth(gStr));
        rawData.loadedGrades.add(toFullWidth(gStr));
    }
}

/**
 * 指定学年の問題データをオンデマンド非同期ロード
 * 1. メモリキャッシュ（即時 0ms）
 * 2. IndexedDBスマートキャッシュ（マスターupdatedAtと一致時: 即時 1〜5ms）
 * 3. リモートGASフェッチ（未キャッシュまたはマスター更新時: タイムアウト制御付き）
 */
export async function ensureGradeLoaded(gradeCode) {
    if (!gradeCode) return true;
    const cleanGrade = gradeCode.toString().trim();
    if (!cleanGrade) return true;

    const halfG = toHalfWidth(cleanGrade);
    const fullG = toFullWidth(cleanGrade);

    if (!rawData.loadedGrades) rawData.loadedGrades = new Set();
    // 1. メモリ内にすでに展開済みなら即座に完了（0ms）
    if (rawData.loadedGrades.has(cleanGrade) || rawData.loadedGrades.has(halfG) || rawData.loadedGrades.has(fullG)) {
        return true;
    }

    // 同一学年への同時リクエストがある場合は合流
    if (gradeLoadPromises.has(cleanGrade)) {
        return gradeLoadPromises.get(cleanGrade);
    }

    const loadPromise = (async () => {
        try {
            const currentMasterVersion = rawData.masterUpdatedAt || '';

            // 2. IndexedDB スマートキャッシュの検証
            // スプレッドシート側の更新日時（updatedAt）と完全に一致している場合のみ即時復元
            if (currentMasterVersion) {
                const cached = await getCachedGradeData(cleanGrade);
                if (cached && cached.masterUpdatedAt === currentMasterVersion && cached.data) {
                    parseAndMergeGradeData(cached.data, cleanGrade);
                    rawData.loadedGrades.add(cleanGrade);
                    rawData.loadedGrades.add(halfG);
                    rawData.loadedGrades.add(fullG);
                    console.log(`[SQ-Cache] 学年【${cleanGrade}】IndexedDBキャッシュから即時展開 (Master: ${currentMasterVersion}): 通常${(cached.data.questions || []).length}問 / タイピング${(cached.data.typing || []).length}問`);
                    return true;
                }
            }

            // 3. キャッシュなし、またはスプレッドシート更新によるキャッシュ失効時はGASから取得
            const isDebug = window.location.search.includes('debug=true');
            const candidateGrades = [...new Set([cleanGrade, fullG, halfG])];
            let data = null;
            let successGrade = cleanGrade;

            for (const tryGrade of candidateGrades) {
                const url = isDebug
                    ? ('http://localhost:8000/sample_api.json?grade=' + encodeURIComponent(tryGrade) + '&t=' + Date.now())
                    : (API_URL + '?grade=' + encodeURIComponent(tryGrade) + '&t=' + Date.now());

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25秒タイムアウト制御
                    const res = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (res.ok) {
                        const json = await res.json();
                        if (json && !json.error && (Array.isArray(json.questions) || Array.isArray(json.typing))) {
                            data = json;
                            successGrade = tryGrade;
                            break;
                        }
                    }
                } catch (fetchErr) {
                    console.warn(`[SQ-Data] 候補【${tryGrade}】の取得失敗またはタイムアウト:`, fetchErr.message);
                }
            }

            if (!data) throw new Error(`学年データの取得に失敗しました (候補: ${candidateGrades.join(', ')})`);

            // メモリ展開
            parseAndMergeGradeData(data, cleanGrade);
            rawData.loadedGrades.add(cleanGrade);
            rawData.loadedGrades.add(halfG);
            rawData.loadedGrades.add(fullG);

            // IndexedDB にキャッシュ保存（現在のマスター更新日時に紐付け）
            if (currentMasterVersion) {
                saveCachedGradeData(cleanGrade, currentMasterVersion, data).catch(e => console.warn('[SQ-Cache] キャッシュ保存エラー:', e));
            }

            console.log(`[SQ-Data] 学年【${cleanGrade}】リモート読込完了 (取得学年: ${successGrade}): 通常${(data.questions || []).length}問 / タイピング${(data.typing || []).length}問`);
            return true;
        } catch (e) {
            console.warn(`[SQ-Data] 学年【${cleanGrade}】読込失敗:`, e);
            return false;
        } finally {
            gradeLoadPromises.delete(cleanGrade);
        }
    })();

    gradeLoadPromises.set(cleanGrade, loadPromise);
    return loadPromise;
}

if (typeof window !== 'undefined') {
    window.ensureGradeLoaded = ensureGradeLoaded;
}

/**
 * タイトル画面待機中に全学年データをバックグラウンドで先読み（アイドル時間を活用して0秒選択を実現）
 */
let isPrefetching = false;
export function startIdleGradePrefetch() {
    if (isPrefetching) return;
    isPrefetching = true;

    // まだメモリにない学年を抽出
    const remainingGrades = ALL_GRADES.filter(g => {
        const clean = g.toString().trim();
        return !rawData.loadedGrades.has(clean) && !rawData.loadedGrades.has(toHalfWidth(clean)) && !rawData.loadedGrades.has(toFullWidth(clean));
    });

    if (remainingGrades.length === 0) return;

    let index = 0;
    function fetchNext() {
        if (index >= remainingGrades.length) {
            console.log('[SQ-Prefetch] 全学年の先行ロードが完了しました。どの学年を選択しても即座に開始できます。');
            return;
        }
        const target = remainingGrades[index++];

        const scheduleNext = () => {
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(fetchNext, { timeout: 3000 });
            } else {
                setTimeout(fetchNext, 600);
            }
        };

        // キャッシュがあれば0ミリ秒、なければ裏で静かに1つずつフェッチ
        ensureGradeLoaded(target)
            .catch(() => {})
            .finally(scheduleNext);
    }

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(fetchNext, { timeout: 2000 });
    } else {
        setTimeout(fetchNext, 800);
    }
}

export async function fetchData() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('refresh') === 'true' || params.get('clear_cache') === 'true') {
            console.log('[SQ-Cache] URLパラメータ指定による問題キャッシュクリアを実行');
            await clearQuestionCache();
        }

        const isDebug = window.location.search.includes('debug=true');
        // 初回起動時は共通マスター（キャラ・ボス・ショップ等）のみを高速取得
        const url = isDebug ? ('http://localhost:8000/sample_api.json?action=master&t=' + Date.now()) : (API_URL + '?action=master&t=' + Date.now());
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP通信エラー: ${res.status}`);
        const data = await res.json();

        // マスターの更新日時・バージョンを保存（IndexedDBキャッシュの有効性判定に使用）
        rawData.masterUpdatedAt = String(data.updatedAt || data.version || '');

        const convertDriveUrl = (url) => {
            if (!url || typeof url !== 'string' || !url.startsWith('http')) return url || '';
            if (url.includes('lh3.googleusercontent.com')) return url;
            if (url.includes('drive.google.com')) {
                let id = "";
                const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (match1) id = match1[1];
                else {
                    const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                    if (match2) id = match2[1];
                }
                if (id) return `https://lh3.googleusercontent.com/d/${id}`;
            }
            return url;
        };

        // 1. 問題データ・タイピングデータ（含まれている場合はマージ）
        rawData.questions = rawData.questions || [];
        rawData.typing = rawData.typing || [];
        parseAndMergeGradeData(data, data.grade);

        // 3. キャラクター (characters)
        rawData.characters = [];
        const rawChars = Array.isArray(data.characters) ? data.characters : [];
        rawData.characters = rawChars.map(c => {
            const strId = String(c.ID !== undefined ? c.ID : (c.id !== undefined ? c.id : ''));
            const name = String(c['名前'] || c.name || 'Unknown');
            const rarity = String(c['レア'] || c.rarity || 'N');
            const type = String(c['タイプ'] || c.type || 'ATK');
            const val = Number(c['補正値'] !== undefined ? c['補正値'] : (c.value !== undefined ? c.value : 1.0));
            const desc = String(c['解説'] || c.desc || '');
            const category = String(c['カテゴリ'] || c.category || '');
            const imgUrl = convertDriveUrl(c['画像URL'] || c.imageUrl || c.image || '');

            return {
                ...c,
                id: strId,
                ID: strId,
                name: name,
                '名前': name,
                rarity: rarity,
                'レア': rarity,
                type: type,
                'タイプ': type,
                value: val,
                '補正値': val,
                desc: desc,
                '解説': desc,
                category: category,
                'カテゴリ': category,
                imageUrl: imgUrl,
                '画像URL': imgUrl
            };
        });

        // 4. ボス (bosses)
        const rawBosses = Array.isArray(data.bosses) ? data.bosses : [];
        rawData.bosses = rawBosses.map(b => ({
            ...b,
            grade: String(b['学年'] || b.grade || ''),
            unit: String(b['単元'] || b.unit || ''),
            name: String(b['ボス名'] || b.name || b.bossName || 'Boss'),
            hp: Number(b['ボスHP'] !== undefined ? b['ボスHP'] : (b.hp !== undefined ? b.hp : (b.bossHP !== undefined ? b.bossHP : 3000))),
            icon: convertDriveUrl(b['ボス画像（絵文字等）'] || b['ボス画像'] || b.icon || '👾'),
            bgmUrl: String(b.bgmUrl || b['bgmUrl'] || '')
        }));

        // 5. ランダムボス (randomBoss / randomBosses)
        const rawRBoss = Array.isArray(data.randomBoss) ? data.randomBoss : (Array.isArray(data.randomBosses) ? data.randomBosses : []);
        rawData.randomBosses = rawRBoss.map(b => ({
            ...b,
            grade: String(b.grade || b['学年'] || ''),
            name: String(b.name || b['名前'] || ''),
            hp: Number(b.hp !== undefined ? b.hp : (b['HP'] !== undefined ? b['HP'] : 3000)),
            icon: convertDriveUrl(b.icon || b['アイコン'] || '👾'),
            bgmUrl: String(b.bgmUrl || b['bgmUrl'] || '')
        }));
        rawData.randomBoss = rawData.randomBosses;

        // 6. ショップ (shop / shopItems)
        const rawShop = Array.isArray(data.shop) ? data.shop : (Array.isArray(data.shopItems) ? data.shopItems : []);
        rawData.shopItems = rawShop.map(i => ({
            ...i,
            id: String(i.ID !== undefined ? i.ID : (i.id !== undefined ? i.id : '')),
            ID: String(i.ID !== undefined ? i.ID : (i.id !== undefined ? i.id : '')),
            name: String(i['アイテム名'] || i.name || 'Item'),
            price: Number(i['価格'] !== undefined ? i['価格'] : (i.price !== undefined ? i.price : 1000)),
            type: String(i['タイプ'] || i.type || 'ATK'),
            value: Number(i['効果値'] !== undefined ? i['効果値'] : (i.value !== undefined ? i.value : 0.1)),
            desc: String(i['説明'] || i.desc || ''),
            icon: String(i['アイコン'] || i.icon || '🎁')
        }));
        rawData.shop = rawData.shopItems;

        // 7. ギフト (gift / gifts)
        const rawGifts = Array.isArray(data.gift) ? data.gift : (Array.isArray(data.gifts) ? data.gifts : []);
        rawData.gifts = rawGifts.map(g => ({
            ...g,
            id: String(g.ID !== undefined ? g.ID : (g.id !== undefined ? g.id : '')),
            title: String(g['タイトル'] || g.title || ''),
            message: String(g['メッセージ'] || g.message || ''),
            exp: Number(g.EXP !== undefined ? g.EXP : (g.exp !== undefined ? g.exp : 0))
        }));
        rawData.gift = rawData.gifts;

        // 8. コンフィグ (config)
        const cfgObj = data.config || {};
        rawData.config = cfgObj;
        // 後方互換エミュレーション: 配列メソッド（filter, some 等）の呼び出しを安全に処理
        if (typeof cfgObj === 'object' && !Array.isArray(cfgObj)) {
            const virtualList = (cfgObj.bannerMessage || cfgObj.message) ? [{
                message: cfgObj.bannerMessage || cfgObj.message || '',
                grade: cfgObj.activeGrade || '',
                subject: cfgObj.activeSubject || '',
                unit: cfgObj.activeUnit || ''
            }] : [];
            Object.defineProperties(rawData.config, {
                filter: { value: (fn) => virtualList.filter(fn), writable: true, configurable: true },
                some: { value: (fn) => virtualList.some(fn), writable: true, configurable: true },
                forEach: { value: (fn) => virtualList.forEach(fn), writable: true, configurable: true },
                find: { value: (fn) => virtualList.find(fn), writable: true, configurable: true },
                length: { value: virtualList.length, writable: true, configurable: true }
            });
        }

        // 9. ボス討伐魔人キャラ枠（未登録の場合の自動補完）
        if (rawData.bosses && rawData.characters) {
            rawData.bosses.forEach(b => {
                const bossCharId = "boss_" + b.name;
                if (!rawData.characters.find(c => String(c.id) === bossCharId)) {
                    rawData.characters.push({
                        id: bossCharId,
                        ID: bossCharId,
                        name: "【魔人】" + b.name,
                        '名前': "【魔人】" + b.name,
                        rarity: "UR",
                        'レア': "UR",
                        type: "ALL",
                        'タイプ': "ALL",
                        value: 1.3,
                        '補正値': 1.3,
                        desc: "かつて立ちはだかった強敵。今は頼もしい味方だ。",
                        '解説': "かつて立ちはだかった強敵。今は頼もしい味方だ。",
                        imageUrl: b.icon,
                        '画像URL': b.icon
                    });
                }
            });
        }

        // ゼロ埋めエイリアス（"001" -> "1"）の解決マップを生成
        normalizeCharacterDictionary();

        // スタディエル復元（UR成体および動的ID chara_... の冪等登録）
        if (typeof window !== 'undefined' && typeof window.StudyelEngine?.restoreCharacters === 'function') {
            window.StudyelEngine.restoreCharacters();
        }

        // 復習リスト（revengeList）のクリーンアップ（存在しない過去問IDによる停止を防止）
        cleanupMissingRevengeIds();

        // 旧形式統合データで全学年問題が入っている場合はその学年を登録
        if (rawData.questions && rawData.questions.length > 0) {
            rawData.questions.forEach(q => {
                if (q.grade) rawData.loadedGrades.add(q.grade.toString().trim());
            });
        }

        document.getElementById('loading-screen')?.classList.add('hidden');
        document.getElementById('title-screen')?.classList.remove('hidden');

        if (typeof window.checkTitles === 'function') window.checkTitles();
        if (typeof window.checkAdminGifts === 'function') window.checkAdminGifts();

        // 初期学年のバックグラウンド先行ロード（前回学年、ConfigのactiveGrade、または小4）
        const defaultGrade = (rawData.config && rawData.config.activeGrade) || (gameState && gameState.lastGrade) || '小4';
        ensureGradeLoaded(defaultGrade)
            .then(() => {
                // 初期学年ロード完了後、残りの全学年をバックグラウンドで先読み開始
                startIdleGradePrefetch();
            })
            .catch(err => {
                console.warn('[SQ-Data] 初期学年先読みエラー:', err);
                startIdleGradePrefetch();
            });

        console.log(`[SQ-Data] マスター読込完了: キャラ${rawData.characters.length}体 / ボス${rawData.bosses.length}体 (更新: ${data.updatedAt || 'N/A'})`);
    } catch(e) {
        console.error('[SQ-Data] データフェッチ失敗:', e);
        const errBox = document.getElementById('error-message');
        if (errBox) {
            errBox.innerText = e.message;
            errBox.style.display = 'block';
        }
    }
}

/**
 * キャラクターIDのゼロ埋め解決辞書を生成
 */
function normalizeCharacterDictionary() {
    if (!Array.isArray(rawData.characters)) return;
    const aliasMap = {};
    rawData.characters.forEach(c => {
        const strId = (c.id || c.ID || '').toString();
        if (strId) {
            aliasMap[strId] = c;
            const numId = parseInt(strId, 10);
            if (!isNaN(numId)) {
                aliasMap[('000' + numId).slice(-3)] = c; // "001", "002"...
            }
        }
    });
    rawData.characterMap = aliasMap;
}

/**
 * 存在しない問題IDを復習リストから除外
 */
function cleanupMissingRevengeIds() {
    if (!gameState || !Array.isArray(gameState.revengeList)) return;
    const validIds = new Set((rawData.questions || []).map(q => q.id));
    gameState.revengeList = gameState.revengeList.filter(id => validIds.has(id));
}

function generateStringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i) | 0;
    return hash;
}

