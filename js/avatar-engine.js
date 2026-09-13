// ==========================================
// js/avatar-engine.js (アバター描画エンジン & UI制御)
// ==========================================

import { gameState, saveGame } from './state.js?v=10.5.0';
import { closeAllCategoryModals, returnToCurrentCategory, showAlert, updateTitleInfo, updateCategoryBadges } from './ui-manager.js?v=10.5.0';
import { playSE } from './utils.js?v=10.5.0';

export const AVATAR_MESSAGES = [
    "よろしくお願いします！",
    "今日も楽しく勉強しよう！",
    "全力で勝負だ！",
    "負けないよ！",
    "目指せ全問正解！"
];

// アバターパーツ定義（基本パーツ＋ショップアンロックパーツ）
export const AVATAR_PARTS_DEF = {
    skinColors: ["#fef08a", "#fcd34d", "#f59e0b", "#fed7aa", "#e0e7ff"],
    hairColors: ["#1e293b", "#78350f", "#b45309", "#dc2626", "#2563eb", "#94a3b8", "#10b981", "#a855f7", "#ec4899"],
    hairColorNames: ["黒", "茶", "金", "赤", "青", "銀", "翠", "紫", "桃"],
    bases: ["丸型", "すっきり型", "キリッと顎"],
    eyes: ["標準", "きりっと", "にっこり", "クール", "星目", "ジト目"],
    mouths: ["にっこり", "おすまし", "わんぱく", "八重歯", "ぽかん"],
    hairs: ["ショート", "ミディアム", "ツーブロック", "ツインテール", "ポニーテール", "ボブ", "ウルフカット", "アフロ", "ロングストレート"],
    outfits: ["ブレザー", "セーラー服", "ローブ", "ジャージ", "ナイトアーマー", "サイバーコート"],
    accessories: ["なし", "メガネ", "キャップ", "リボン", "王冠", "ヘッドセット", "眼帯", "猫耳カチューシャ"]
};

// 各カテゴリごとのデフォルト初期解放数
const DEFAULT_UNLOCKED_LIMITS = {
    base: 2,       // 0, 1 は初期解放
    skinColor: 3,  // 0, 1, 2 は初期解放
    hairColor: 6,  // 0..5 は初期解放
    eyes: 4,       // 0..3 は初期解放
    mouth: 3,      // 0..2 は初期解放
    hair: 6,       // 0..5 は初期解放
    outfit: 4,     // 0..3 は初期解放
    accessory: 5   // 0..4 は初期解放
};

/**
 * 指定されたアバターパーツがアンロック（所持）されているかを判定
 * @param {string} category - パーツカテゴリ名
 * @param {number} index - パーツインデックス
 * @returns {boolean} 所持していれば true
 */
export function isAvatarPartUnlocked(category, index) {
    const limit = DEFAULT_UNLOCKED_LIMITS[category] ?? 999;
    if (index < limit) return true;
    const key = `${category}_${index}`;
    const unlockedList = gameState.unlockedAvatars || [];
    return unlockedList.includes(key);
}

let currentTab = 'base';
let editingAvatar = null;

export function generateAvatarSvg(avData, size = 120) {
    const defaultAv = {
        base: 0, skinColor: "#fcd34d", eyes: 0, mouth: 0, hair: 0, hairColor: "#1e293b", outfit: 0, accessory: 0
    };
    const av = Object.assign({}, defaultAv, avData || gameState.avatar || {});

    const skin = av.skinColor || "#fcd34d";
    const hairCol = av.hairColor || "#1e293b";

    // 輪郭（0: 丸型, 1: すっきり型, 2: キリッと顎）
    let facePath = '';
    if (av.base === 1) {
        facePath = `<path d="M 34,52 C 34,32 44,22 60,22 C 76,22 86,32 86,52 C 86,72 74,84 60,90 C 46,84 34,72 34,52 Z" fill="${skin}" stroke="#b45309" stroke-width="1.8"/>`;
    } else if (av.base === 2) {
        facePath = `<path d="M 34,50 C 34,28 44,20 60,20 C 76,20 86,28 86,50 C 86,70 70,88 60,94 C 50,88 34,70 34,50 Z" fill="${skin}" stroke="#b45309" stroke-width="1.8"/>`;
    } else {
        facePath = `<path d="M 34,54 C 34,32 44,22 60,22 C 76,22 86,32 86,54 C 86,74 76,86 60,86 C 44,86 34,74 34,54 Z" fill="${skin}" stroke="#b45309" stroke-width="1.8"/>`;
    }

    // 服装
    let outfitSvg = '';
    switch (av.outfit) {
        case 1:
            outfitSvg = `
                <path d="M 32,84 L 88,84 L 92,120 L 28,120 Z" fill="#1e3a8a"/>
                <polygon points="60,94 48,84 72,84" fill="#ffffff"/>
                <polygon points="60,102 54,94 66,94" fill="#ef4444"/>
            `;
            break;
        case 2:
            outfitSvg = `
                <path d="M 30,84 L 90,84 L 95,120 L 25,120 Z" fill="#6d28d9"/>
                <line x1="60" y1="84" x2="60" y2="120" stroke="#f59e0b" stroke-width="2.5"/>
                <circle cx="60" cy="92" r="3.5" fill="#f59e0b"/>
            `;
            break;
        case 3:
            outfitSvg = `
                <path d="M 32,84 L 88,84 L 92,120 L 28,120 Z" fill="#15803d"/>
                <line x1="42" y1="84" x2="42" y2="120" stroke="#ffffff" stroke-width="2"/>
                <line x1="78" y1="84" x2="78" y2="120" stroke="#ffffff" stroke-width="2"/>
            `;
            break;
        case 4: // ナイトアーマー
            outfitSvg = `
                <path d="M 30,84 L 90,84 L 95,120 L 25,120 Z" fill="#64748b"/>
                <path d="M 24,84 L 38,84 L 35,98 L 20,95 Z" fill="#94a3b8" stroke="#cbd5e1" stroke-width="1"/>
                <path d="M 96,84 L 82,84 L 85,98 L 100,95 Z" fill="#94a3b8" stroke="#cbd5e1" stroke-width="1"/>
                <polygon points="60,86 70,96 60,112 50,96" fill="#f59e0b"/>
                <line x1="60" y1="84" x2="60" y2="120" stroke="#475569" stroke-width="1.5"/>
            `;
            break;
        case 5: // サイバーコート
            outfitSvg = `
                <path d="M 30,84 L 90,84 L 94,120 L 26,120 Z" fill="#0f172a"/>
                <line x1="42" y1="84" x2="38" y2="120" stroke="#06b6d4" stroke-width="2"/>
                <line x1="78" y1="84" x2="82" y2="120" stroke="#06b6d4" stroke-width="2"/>
                <polygon points="60,94 52,84 68,84" fill="#06b6d4"/>
                <circle cx="60" cy="104" r="3" fill="#a855f7"/>
            `;
            break;
        default:
            outfitSvg = `
                <path d="M 32,84 L 88,84 L 92,120 L 28,120 Z" fill="#334155"/>
                <polygon points="60,98 50,84 70,84" fill="#ffffff"/>
                <polygon points="60,104 56,92 64,92" fill="#dc2626"/>
            `;
            break;
    }

    // 目
    let eyesSvg = '';
    switch (av.eyes) {
        case 1:
            eyesSvg = `
                <line x1="44" y1="52" x2="52" y2="55" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round"/>
                <line x1="76" y1="52" x2="68" y2="55" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round"/>
                <ellipse cx="49" cy="58" rx="3.5" ry="4.5" fill="#1e293b"/>
                <ellipse cx="71" cy="58" rx="3.5" ry="4.5" fill="#1e293b"/>
                <circle cx="50" cy="56" r="1.2" fill="#fff"/>
                <circle cx="72" cy="56" r="1.2" fill="#fff"/>
            `;
            break;
        case 2:
            eyesSvg = `
                <path d="M 44,57 Q 49,52 54,57" fill="none" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M 66,57 Q 71,52 76,57" fill="none" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
            `;
            break;
        case 3:
            eyesSvg = `
                <line x1="43" y1="53" x2="54" y2="53" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
                <line x1="66" y1="53" x2="77" y2="53" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>
                <ellipse cx="48" cy="58" rx="3.5" ry="3.5" fill="#1e293b"/>
                <ellipse cx="72" cy="58" rx="3.5" ry="3.5" fill="#1e293b"/>
                <circle cx="49" cy="57" r="1" fill="#fff"/>
                <circle cx="73" cy="57" r="1" fill="#fff"/>
            `;
            break;
        case 4: // 星目
            eyesSvg = `
                <ellipse cx="48" cy="56" rx="4.5" ry="6" fill="#1e293b"/>
                <ellipse cx="72" cy="56" rx="4.5" ry="6" fill="#1e293b"/>
                <polygon points="48,52 49,55 52,56 49,57 48,60 47,57 44,56 47,55" fill="#fef08a"/>
                <polygon points="72,52 73,55 76,56 73,57 72,60 71,57 68,56 71,55" fill="#fef08a"/>
                <circle cx="50" cy="58" r="1.2" fill="#fff"/>
                <circle cx="74" cy="58" r="1.2" fill="#fff"/>
            `;
            break;
        case 5: // ジト目
            eyesSvg = `
                <line x1="42" y1="53" x2="54" y2="53" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
                <line x1="66" y1="53" x2="78" y2="53" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M 44,54 C 44,60 52,60 52,54 Z" fill="#1e293b"/>
                <path d="M 68,54 C 68,60 76,60 76,54 Z" fill="#1e293b"/>
                <circle cx="48" cy="55" r="1" fill="#fff"/>
                <circle cx="72" cy="55" r="1" fill="#fff"/>
            `;
            break;
        default:
            eyesSvg = `
                <ellipse cx="48" cy="56" rx="4" ry="5.5" fill="#1e293b"/>
                <ellipse cx="72" cy="56" rx="4" ry="5.5" fill="#1e293b"/>
                <circle cx="46.5" cy="54" r="1.5" fill="#ffffff"/>
                <circle cx="70.5" cy="54" r="1.5" fill="#ffffff"/>
            `;
            break;
    }

    // 口
    let mouthSvg = '';
    switch (av.mouth) {
        case 1:
            mouthSvg = `<line x1="56" y1="72" x2="64" y2="72" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round"/>`;
            break;
        case 2:
            mouthSvg = `<path d="M 55,70 Q 60,78 65,70 Z" fill="#e11d48"/>`;
            break;
        case 3: // 八重歯
            mouthSvg = `
                <path d="M 55,69 Q 60,76 65,69 Z" fill="#e11d48"/>
                <polygon points="56,69 58,69 57,72" fill="#ffffff"/>
            `;
            break;
        case 4: // ぽかん
            mouthSvg = `<ellipse cx="60" cy="72" rx="3" ry="4" fill="#881337"/>`;
            break;
        default:
            mouthSvg = `<path d="M 56,70 Q 60,75 64,70" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>`;
            break;
    }

    // 装飾A: 顔面パーツ装飾（メガネ、眼帯）
    let faceAccSvg = '';
    if (av.accessory === 1) { // メガネ
        faceAccSvg = `
            <circle cx="48" cy="57" r="7.5" fill="none" stroke="#0284c7" stroke-width="1.8"/>
            <circle cx="72" cy="57" r="7.5" fill="none" stroke="#0284c7" stroke-width="1.8"/>
            <line x1="55.5" y1="57" x2="64.5" y2="57" stroke="#0284c7" stroke-width="1.8"/>
        `;
    } else if (av.accessory === 6) { // 眼帯
        faceAccSvg = `
            <line x1="32" y1="46" x2="88" y2="68" stroke="#0f172a" stroke-width="1.8"/>
            <polygon points="64,52 78,54 74,65 62,62" fill="#0f172a"/>
        `;
    }

    // 髪型（頭頂部を包み込み、前髪が目元まで届く自然なプロポーション）
    let hairSvg = '';
    switch (av.hair) {
        case 1: // ミディアム
            hairSvg = `
                <path d="M 28,54 C 24,30 36,17 60,17 C 84,17 96,30 92,54 C 98,68 94,82 88,84 C 84,62 82,44 76,38 C 66,32 54,32 44,38 C 38,44 36,62 32,84 C 26,82 22,68 28,54 Z" fill="${hairCol}"/>
                <path d="M 34,44 C 42,52 54,51 60,45 C 68,52 78,50 84,43 L 86,34 C 74,22 46,22 34,34 Z" fill="${hairCol}"/>
                <path d="M 40,40 Q 52,49 64,43" fill="none" stroke="${hairCol}" stroke-width="2.5" stroke-linecap="round"/>
            `;
            break;
        case 2: // ツーブロック
            hairSvg = `
                <path d="M 30,50 C 28,26 40,16 60,16 C 80,16 92,26 90,50 C 86,38 78,34 60,34 C 42,34 34,38 30,50 Z" fill="${hairCol}"/>
                <path d="M 32,44 Q 40,51 48,43 Q 56,52 66,45 Q 74,53 82,47 L 88,38 C 76,22 44,22 32,36 Z" fill="${hairCol}"/>
                <path d="M 46,24 Q 60,19 72,25" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-linecap="round"/>
            `;
            break;
        case 3: // ツインテール
            hairSvg = `
                <path d="M 24,50 C 14,54 12,74 22,82 C 26,74 26,60 28,52 Z" fill="${hairCol}"/>
                <path d="M 96,50 C 106,54 108,74 98,82 C 94,74 94,60 92,52 Z" fill="${hairCol}"/>
                <circle cx="25" cy="53" r="3.5" fill="#f43f5e"/>
                <circle cx="95" cy="53" r="3.5" fill="#f43f5e"/>
                <path d="M 28,52 C 26,28 38,17 60,17 C 82,17 94,28 92,52 C 86,36 78,34 60,34 C 42,34 34,36 28,52 Z" fill="${hairCol}"/>
                <path d="M 32,46 Q 39,52 46,46 Q 53,52 60,46 Q 67,52 74,46 Q 81,52 88,46 L 88,34 C 76,22 44,22 32,34 Z" fill="${hairCol}"/>
            `;
            break;
        case 4: // ポニーテール
            hairSvg = `
                <path d="M 72,26 C 96,16 104,36 96,56 C 88,46 84,36 76,32 Z" fill="${hairCol}"/>
                <circle cx="74" cy="28" r="4" fill="#f43f5e"/>
                <path d="M 28,54 C 26,28 38,17 60,17 C 82,17 94,28 92,54 C 88,40 80,34 60,34 C 40,34 32,40 28,54 Z" fill="${hairCol}"/>
                <path d="M 32,46 Q 40,52 48,45 Q 56,53 64,46 Q 72,52 82,45 L 86,34 C 74,22 46,22 34,34 Z" fill="${hairCol}"/>
            `;
            break;
        case 5: // ボブ
            hairSvg = `
                <path d="M 26,52 C 24,30 36,17 60,17 C 84,17 96,30 94,52 C 96,72 88,78 82,78 C 82,60 80,38 60,38 C 40,38 38,60 38,78 C 32,78 24,72 26,52 Z" fill="${hairCol}"/>
                <path d="M 34,46 Q 42,51 50,45 Q 60,52 70,45 Q 78,51 86,46 L 86,34 C 74,22 46,22 34,34 Z" fill="${hairCol}"/>
            `;
            break;
        case 6: // ウルフカット
            hairSvg = `
                <path d="M 22,64 C 18,74 12,84 20,88 C 24,84 26,74 28,68 Z" fill="${hairCol}"/>
                <path d="M 98,64 C 102,74 108,84 100,88 C 96,84 94,74 92,68 Z" fill="${hairCol}"/>
                <path d="M 28,52 C 26,26 38,16 60,16 C 82,16 94,26 92,52 C 86,40 80,36 60,36 C 40,36 34,40 28,52 Z" fill="${hairCol}"/>
                <path d="M 30,46 Q 38,54 44,45 Q 52,56 60,44 Q 68,55 76,45 Q 82,53 90,44 L 88,34 C 76,22 44,22 30,34 Z" fill="${hairCol}"/>
            `;
            break;
        case 7: // アフロ
            hairSvg = `
                <circle cx="60" cy="46" r="38" fill="${hairCol}"/>
                <path d="M 36,46 Q 48,50 60,46 Q 72,50 84,46 L 84,36 C 70,28 50,28 36,36 Z" fill="${hairCol}"/>
            `;
            break;
        case 8: // ロングストレート
            hairSvg = `
                <path d="M 24,52 L 20,105 L 34,105 L 34,70 Z" fill="${hairCol}"/>
                <path d="M 96,52 L 100,105 L 86,105 L 86,70 Z" fill="${hairCol}"/>
                <path d="M 28,52 C 26,26 38,16 60,16 C 82,16 94,26 92,52 C 86,40 80,36 60,36 C 40,36 34,40 28,52 Z" fill="${hairCol}"/>
                <path d="M 32,45 L 88,45 L 88,34 C 76,22 44,22 32,34 Z" fill="${hairCol}"/>
            `;
            break;
        default: // ショート
            hairSvg = `
                <path d="M 28,56 C 26,32 38,17 60,17 C 82,17 94,32 92,56 C 88,42 80,36 60,36 C 40,36 32,42 28,56 Z" fill="${hairCol}"/>
                <path d="M 32,46 Q 38,51 44,44 Q 50,52 56,43 Q 63,52 70,44 Q 76,51 82,45 L 86,36 C 76,24 44,24 34,36 Z" fill="${hairCol}"/>
            `;
            break;
    }

    // 装飾B: 頭部装飾（キャップ帽子、リボン、王冠、ヘッドセット、猫耳）
    let headAccSvg = '';
    switch (av.accessory) {
        case 2: // キャップ
            headAccSvg = `
                <path d="M 25,32 C 25,12 40,8 60,8 C 80,8 95,12 95,32 Z" fill="#ea580c"/>
                <path d="M 20,32 Q 60,42 100,32 Q 60,36 20,32 Z" fill="#c2410c"/>
                <circle cx="60" cy="8" r="2.5" fill="#f59e0b"/>
            `;
            break;
        case 3: // リボン
            headAccSvg = `
                <polygon points="32,20 42,24 32,28" fill="#ec4899"/>
                <polygon points="52,20 42,24 52,28" fill="#ec4899"/>
                <circle cx="42" cy="24" r="3" fill="#f43f5e"/>
            `;
            break;
        case 4: // 王冠
            headAccSvg = `
                <polygon points="42,22 38,10 48,16 60,6 72,16 82,10 78,22" fill="#f59e0b" stroke="#b45309" stroke-width="1.2"/>
                <circle cx="60" cy="6" r="2.2" fill="#ef4444"/>
            `;
            break;
        case 5: // ヘッドセット
            headAccSvg = `
                <path d="M 30,50 C 30,22 42,16 60,16 C 78,16 90,22 90,50" fill="none" stroke="#334155" stroke-width="3"/>
                <rect x="25" y="46" width="7" height="14" rx="2" fill="#0284c7"/>
                <rect x="88" y="46" width="7" height="14" rx="2" fill="#0284c7"/>
                <path d="M 28,58 Q 36,70 48,68" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round"/>
                <circle cx="48" cy="68" r="2" fill="#ef4444"/>
            `;
            break;
        case 7: // 猫耳カチューシャ
            headAccSvg = `
                <path d="M 36,36 C 36,22 44,18 60,18 C 76,18 84,22 84,36" fill="none" stroke="#1e293b" stroke-width="2.5"/>
                <polygon points="34,26 40,8 50,22" fill="#f43f5e" stroke="#1e293b" stroke-width="1.5"/>
                <polygon points="37,24 41,13 47,22" fill="#fed7aa"/>
                <polygon points="86,26 80,8 70,22" fill="#f43f5e" stroke="#1e293b" stroke-width="1.5"/>
                <polygon points="83,24 79,13 73,22" fill="#fed7aa"/>
            `;
            break;
        default:
            headAccSvg = '';
            break;
    }

    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}">
            ${outfitSvg}
            ${facePath}
            <circle cx="43" cy="65" r="4.5" fill="#f43f5e" opacity="0.35"/>
            <circle cx="77" cy="65" r="4.5" fill="#f43f5e" opacity="0.35"/>
            ${mouthSvg}
            ${eyesSvg}
            ${faceAccSvg}
            ${hairSvg}
            ${headAccSvg}
        </svg>
    `;
}

export function openAvatarEditor() {
    closeAllCategoryModals();
    editingAvatar = JSON.parse(JSON.stringify(gameState.avatar || {
        base: 0, skinColor: "#fcd34d", eyes: 0, mouth: 0, hair: 0, hairColor: "#1e293b", outfit: 0, accessory: 0, msgId: 0
    }));

    const sel = document.getElementById('avatar-msg-select');
    if (sel) sel.value = String(editingAvatar.msgId || 0);

    currentTab = 'base';
    renderAvatarPreview();
    renderAvatarPalette();
    document.getElementById('avatar-modal-overlay')?.classList.remove('hidden');
}

export function closeAvatarEditor() {
    document.getElementById('avatar-modal-overlay')?.classList.add('hidden');
    returnToCurrentCategory();
}

export function switchAvatarTab(tab) {
    currentTab = tab;
    document.querySelectorAll('#avatar-modal-overlay .item-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`av-tab-${tab}`)?.classList.add('active');
    renderAvatarPalette();
}

export function renderAvatarPreview() {
    const box = document.getElementById('avatar-preview-box');
    if (box && editingAvatar) {
        box.innerHTML = generateAvatarSvg(editingAvatar, 120);
    }
}

export function renderAvatarPalette() {
    const grid = document.getElementById('avatar-palette-grid');
    if (!grid || !editingAvatar) return;
    grid.innerHTML = '';

    const def = AVATAR_PARTS_DEF;

    if (currentTab === 'base') {
        def.bases.forEach((name, i) => {
            const isUnlocked = isAvatarPartUnlocked('base', i);
            const isSel = editingAvatar.base === i;
            const lockIcon = !isUnlocked ? ' 🔒' : '';
            const btnClass = isSel ? 'btn-orange' : (isUnlocked ? 'btn-navy' : 'btn-gray');
            grid.innerHTML += `<button type="button" class="menu-btn ${btnClass}" style="height:44px; font-size:0.85em; ${!isUnlocked ? 'opacity:0.75;' : ''}" onclick="selectAvatarPart('base', ${i})">${name}${lockIcon}</button>`;
        });
        def.skinColors.forEach((col, i) => {
            const isUnlocked = isAvatarPartUnlocked('skinColor', i);
            const isSel = editingAvatar.skinColor === col;
            const borderCol = isSel ? '#3b82f6' : (isUnlocked ? '#cbd5e1' : '#64748b');
            const lockIcon = !isUnlocked ? '<span style="color:#fff; font-size:14px; text-shadow:0 1px 2px #000;">🔒</span>' : '';
            grid.innerHTML += `<button type="button" class="menu-btn" style="height:44px; background:${col}; border: 3px solid ${borderCol}; display:flex; align-items:center; justify-content:center; ${!isUnlocked ? 'opacity:0.75;' : ''}" onclick="selectAvatarPart('skinColor', '${col}')">${lockIcon}</button>`;
        });
    } else if (currentTab === 'eyes') {
        def.eyes.forEach((name, i) => {
            const isUnlocked = isAvatarPartUnlocked('eyes', i);
            const isSel = editingAvatar.eyes === i;
            const lockIcon = !isUnlocked ? ' 🔒' : '';
            const btnClass = isSel ? 'btn-orange' : (isUnlocked ? 'btn-navy' : 'btn-gray');
            grid.innerHTML += `<button type="button" class="menu-btn ${btnClass}" style="height:44px; font-size:0.85em; ${!isUnlocked ? 'opacity:0.75;' : ''}" onclick="selectAvatarPart('eyes', ${i})">${name}${lockIcon}</button>`;
        });
        def.mouths.forEach((name, i) => {
            const isUnlocked = isAvatarPartUnlocked('mouth', i);
            const isSel = editingAvatar.mouth === i;
            const lockIcon = !isUnlocked ? ' 🔒' : '';
            const btnClass = isSel ? 'btn-orange' : (isUnlocked ? 'btn-gray' : 'btn-gray');
            grid.innerHTML += `<button type="button" class="menu-btn ${btnClass}" style="height:44px; font-size:0.85em; ${!isUnlocked ? 'opacity:0.75;' : ''}" onclick="selectAvatarPart('mouth', ${i})">口: ${name}${lockIcon}</button>`;
        });
    } else if (currentTab === 'hair') {
        def.hairs.forEach((name, i) => {
            const isUnlocked = isAvatarPartUnlocked('hair', i);
            const isSel = editingAvatar.hair === i;
            const lockIcon = !isUnlocked ? ' 🔒' : '';
            const btnClass = isSel ? 'btn-orange' : (isUnlocked ? 'btn-navy' : 'btn-gray');
            grid.innerHTML += `<button type="button" class="menu-btn ${btnClass}" style="height:44px; font-size:0.8em; ${!isUnlocked ? 'opacity:0.75;' : ''}" onclick="selectAvatarPart('hair', ${i})">${name}${lockIcon}</button>`;
        });
    } else if (currentTab === 'hairColor') {
        def.hairColors.forEach((col, i) => {
            const isUnlocked = isAvatarPartUnlocked('hairColor', i);
            const isSel = editingAvatar.hairColor === col;
            const borderCol = isSel ? '#3b82f6' : (isUnlocked ? '#cbd5e1' : '#64748b');
            const lockIcon = !isUnlocked ? ' 🔒' : '';
            grid.innerHTML += `<button type="button" class="menu-btn" style="height:44px; background:${col}; color:#fff; font-size:0.8em; border: 3px solid ${borderCol}; ${!isUnlocked ? 'opacity:0.75;' : ''}" onclick="selectAvatarPart('hairColor', '${col}')">${def.hairColorNames[i]}${lockIcon}</button>`;
        });
    } else if (currentTab === 'outfit') {
        def.outfits.forEach((name, i) => {
            const isUnlocked = isAvatarPartUnlocked('outfit', i);
            const isSel = editingAvatar.outfit === i;
            const lockIcon = !isUnlocked ? ' 🔒' : '';
            const btnClass = isSel ? 'btn-orange' : (isUnlocked ? 'btn-navy' : 'btn-gray');
            grid.innerHTML += `<button type="button" class="menu-btn ${btnClass}" style="height:44px; font-size:0.85em; ${!isUnlocked ? 'opacity:0.75;' : ''}" onclick="selectAvatarPart('outfit', ${i})">${name}${lockIcon}</button>`;
        });
    } else if (currentTab === 'acc') {
        def.accessories.forEach((name, i) => {
            const isUnlocked = isAvatarPartUnlocked('accessory', i);
            const isSel = editingAvatar.accessory === i;
            const lockIcon = !isUnlocked ? ' 🔒' : '';
            const btnClass = isSel ? 'btn-orange' : (isUnlocked ? 'btn-navy' : 'btn-gray');
            grid.innerHTML += `<button type="button" class="menu-btn ${btnClass}" style="height:44px; font-size:0.85em; ${!isUnlocked ? 'opacity:0.75;' : ''}" onclick="selectAvatarPart('accessory', ${i})">${name}${lockIcon}</button>`;
        });
    }
}

export function selectAvatarPart(key, val) {
    if (!editingAvatar) return;

    // アンロック状態の判定
    let index = val;
    if (key === 'skinColor') {
        index = AVATAR_PARTS_DEF.skinColors.indexOf(val);
    } else if (key === 'hairColor') {
        index = AVATAR_PARTS_DEF.hairColors.indexOf(val);
    }

    if (!isAvatarPartUnlocked(key, index)) {
        playSE('miss');
        showAlert("🔒 このパーツは未解放です。\nショップのアバタータブで購入できます！");
        return;
    }

    editingAvatar[key] = val;
    playSE('hit');
    renderAvatarPreview();
    renderAvatarPalette();
}

export function updateAvatarMsg(val) {
    if (!editingAvatar) return;
    editingAvatar.msgId = parseInt(val, 10) || 0;
}

export function randomizeAvatar() {
    if (!editingAvatar) return;
    const def = AVATAR_PARTS_DEF;

    // 解放済みパーツのみをフィルタリング
    const availableBases = def.bases.map((_, i) => i).filter(i => isAvatarPartUnlocked('base', i));
    const availableSkins = def.skinColors.filter((_, i) => isAvatarPartUnlocked('skinColor', i));
    const availableEyes = def.eyes.map((_, i) => i).filter(i => isAvatarPartUnlocked('eyes', i));
    const availableMouths = def.mouths.map((_, i) => i).filter(i => isAvatarPartUnlocked('mouth', i));
    const availableHairs = def.hairs.map((_, i) => i).filter(i => isAvatarPartUnlocked('hair', i));
    const availableHairColors = def.hairColors.filter((_, i) => isAvatarPartUnlocked('hairColor', i));
    const availableOutfits = def.outfits.map((_, i) => i).filter(i => isAvatarPartUnlocked('outfit', i));
    const availableAccessories = def.accessories.map((_, i) => i).filter(i => isAvatarPartUnlocked('accessory', i));

    editingAvatar.base = availableBases[Math.floor(Math.random() * availableBases.length)];
    editingAvatar.skinColor = availableSkins[Math.floor(Math.random() * availableSkins.length)];
    editingAvatar.eyes = availableEyes[Math.floor(Math.random() * availableEyes.length)];
    editingAvatar.mouth = availableMouths[Math.floor(Math.random() * availableMouths.length)];
    editingAvatar.hair = availableHairs[Math.floor(Math.random() * availableHairs.length)];
    editingAvatar.hairColor = availableHairColors[Math.floor(Math.random() * availableHairColors.length)];
    editingAvatar.outfit = availableOutfits[Math.floor(Math.random() * availableOutfits.length)];
    editingAvatar.accessory = availableAccessories[Math.floor(Math.random() * availableAccessories.length)];
    editingAvatar.msgId = Math.floor(Math.random() * AVATAR_MESSAGES.length);

    const sel = document.getElementById('avatar-msg-select');
    if (sel) sel.value = String(editingAvatar.msgId);

    playSE('start');
    renderAvatarPreview();
    renderAvatarPalette();
}

export function saveAvatarSettings() {
    if (!editingAvatar) return;
    gameState.avatar = JSON.parse(JSON.stringify(editingAvatar));
    saveGame();
    playSE('win');
    updateTitleInfo();
    updateCategoryBadges();
    showAlert("🎨 アバター設定を保存しました！");
    closeAvatarEditor();
}
