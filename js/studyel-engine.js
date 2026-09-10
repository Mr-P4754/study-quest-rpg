// ============================================================
// js/studyel-engine.js - スタディエル育成システム統合エンジン
// Ver 3.5 完全無欠・最終確定版
// ============================================================

import { gameState, rawData, saveGame, playData, rogueData } from './state.js?v=10.2.4';
import { playSE } from './utils.js?v=10.2.4';
import { showCutIn } from './battle-core.js?v=10.2.4';
import { GuideModule } from './ui-manager.js?v=10.2.4';

// ------------------------------------------------------------
// 定数・設定定義
// ------------------------------------------------------------
export const GRADE_DEPTH_MAP = {
    '小1': 0.65, '1年': 0.65,
    '小2': 0.65, '2年': 0.65,
    '小3': 1.00, '3年': 1.00,
    '小4': 1.00, '4年': 1.00,
    '小5': 1.25, '5年': 1.25,
    '小6': 1.25, '6年': 1.25,
    '中１': 1.55, '中1': 1.55,
    '中２': 1.55, '中2': 1.55,
    '中３': 1.55, '中3': 1.55,
    '高1': 1.85,
    '高2': 1.85,
    '高3': 1.85
};

export const GRADE_WEIGHTS = GRADE_DEPTH_MAP;

export const ADULT_FORMS = {
    science: {
        id: 'science',
        name: '剛理のスタディエル',
        type: 'ATK',
        skills: ['ATK'],
        displaySkill: 'ATK',
        cost: 6,
        color: '#e74c3c',
        glowColor: 'rgba(231, 76, 60, 0.45)',
        title: '理系特化',
        desc: '日々の理数探究の結晶。揺るぎなき論理の炎を纏い、敵を圧倒する剛理の妖精。'
    },
    humanities: {
        id: 'humanities',
        name: '叡文のスタディエル',
        type: 'EXP',
        skills: ['EXP'],
        displaySkill: 'EXP',
        cost: 6,
        color: '#f1c40f',
        glowColor: 'rgba(241, 196, 15, 0.45)',
        title: '文系特化',
        desc: '言葉と思索への探究から生まれた叡智の妖精。黄金の光で莫大な経験をもたらす。'
    },
    general: {
        id: 'general',
        name: '機技のスタディエル',
        type: 'TIME',
        skills: ['TIME'],
        displaySkill: 'TIME',
        cost: 6,
        color: '#3498db',
        glowColor: 'rgba(52, 152, 219, 0.45)',
        title: 'その他特化',
        desc: '正確無比なタイピングと実技の熟練が生み出した機動の妖精。時間の流れを自在に操る。'
    },
    sci_hum: {
        id: 'sci_hum',
        name: '理文融合のスタディエル',
        type: 'ATK,EXP',
        skills: ['ATK', 'EXP'],
        displaySkill: 'ATK・EXP',
        cost: 6,
        color: '#e67e22',
        glowColor: 'rgba(230, 126, 34, 0.45)',
        title: '理系 ✕ 文系',
        desc: '論理の刃と豊かな知性を併せ持つ調和の妖精。攻撃力と獲得EXPの双方を飛躍させる。'
    },
    sci_gen: {
        id: 'sci_gen',
        name: '理技錬成のスタディエル',
        type: 'ATK,TIME',
        skills: ['ATK', 'TIME'],
        displaySkill: 'ATK・TIME',
        cost: 6,
        color: '#8e44ad',
        glowColor: 'rgba(142, 68, 173, 0.45)',
        title: '理系 ✕ その他',
        desc: '緻密な計算と研ぎ澄まされた技巧を錬成した妖精。鋭き打撃と余裕の時間を生み出す。'
    },
    hum_gen: {
        id: 'hum_gen',
        name: '文技探究のスタディエル',
        type: 'EXP,TIME',
        skills: ['EXP', 'TIME'],
        displaySkill: 'EXP・TIME',
        cost: 6,
        color: '#2ecc71',
        glowColor: 'rgba(46, 204, 113, 0.45)',
        title: '文系 ✕ その他',
        desc: '言葉の探求と軽快な指先から誕生した妖精。快適な戦闘時間と豊かな実りをもたらす。'
    },
    all: {
        id: 'all',
        name: '万象のスタディエル',
        type: 'ALL',
        skills: ['ALL'],
        displaySkill: 'ALL',
        cost: 6,
        color: '#a855f7',
        glowColor: 'rgba(168, 85, 247, 0.5)',
        title: '万能 (ALL)',
        desc: '全科目を極めし者のみが辿り着く奇跡の姿。七色のオーラで万象の力を支配する。'
    }
};

// ------------------------------------------------------------
// ランタイム内部状態
// ------------------------------------------------------------
let questionStartTime = 0;
let currentQuestionGrade = '';
let currentQuestionSubject = '';
let pinchHealTriggeredInQuest = false;

// ------------------------------------------------------------
// 初期データファクトリ
// ------------------------------------------------------------
export function getDefaultStudyelState(generation = 1, history = []) {
    return {
        stage: 1,            // 1:タマゴ, 2:幼体, 3:若体, 4:成体, 5:超越
        totalCorrect: 0,     // 累計正解数 (0〜3000+)
        nextMilestone: 100,  // 次回節目ボーナス基準値
        generation: generation, // 世代数
        categories: {
            science: 0,      // 理系正解数
            humanities: 0,   // 文系正解数
            general: 0       // その他正解数
        },
        trainingStats: {
            totalAttempts: 0,    // 正誤問わず解答試行総数
            totalCorrect: 0,     // 幼体・若体期正解数
            totalTimeSpent: 0,   // 総解答秒数
            maxCombo: 0,         // 最大コンボ数
            totalGradeWeight: 0  // 学年係数累計
        },
        finalStats: {
            formId: null,        // 成体ID (例: studyel_science_gen1)
            name: '',            // 成体表示名
            baseValue: 1.50,     // 現在の補正値 (最大3.00)
            bonusTime: 0.0,      // 追加秒数
            bonusDamage: 0.0,    // コンボ追加ダメージ率
            level: 1             // 覚醒初期レベル
        },
        history: Array.isArray(history) ? history : [] // 歴代成体IDリスト
    };
}

// ------------------------------------------------------------
// 判定ヘルパー
// ------------------------------------------------------------
export function getGradeWeight(grade) {
    if (!grade) return 1.00;
    const str = String(grade).trim();
    for (const k in GRADE_WEIGHTS) {
        if (str.includes(k)) return GRADE_WEIGHTS[k];
    }
    return 1.00;
}

export function classifySubject(subject) {
    if (!subject) return 'general';
    const s = String(subject).trim();
    if (s.includes('算') || s.includes('数') || s.includes('理')) return 'science';
    if (s.includes('国') || s.includes('社') || s.includes('英')) return 'humanities';
    return 'general';
}

/**
 * 育成対象クエストか判定
 */
export function isEligibleQuest() {
    if (playData.isSurvival) return false;
    if (playData.isCalculation) return false;
    if (typeof rogueData !== 'undefined' && rogueData.active) return false;
    return true;
}

/**
 * 現在の優勢系統を取得（Stage 2〜3の幼体・若体時）
 */
export function getDominantCategory() {
    const st = gameState.studyel;
    if (!st || !st.categories) return 'science';
    const { science, humanities, general } = st.categories;
    if (science >= humanities && science >= general) return 'science';
    if (humanities >= science && humanities >= general) return 'humanities';
    return 'general';
}

/**
 * 成体の属性情報または優勢属性を取得
 */
export function getActiveCategory() {
    const st = gameState.studyel;
    if (!st) return 'science';
    if (st.stage >= 4 && st.finalStats && st.finalStats.formId) {
        const type = st.finalStats.formId.split('_')[1];
        return type || 'all';
    }
    return getDominantCategory();
}

/**
 * ステージに応じた名称を取得
 */
export function getStageName(stage) {
    switch (stage) {
        case 1: return 'なぞのタマゴ';
        case 2: return '幼体スタディエル';
        case 3: return '若体スタディエル';
        case 4: return gameState.studyel?.finalStats?.name || '成体スタディエル';
        case 5: return (gameState.studyel?.finalStats?.name || '成体スタディエル') + '【超越】';
        default: return 'なぞのタマゴ';
    }
}

// ------------------------------------------------------------
// SVG動的生成 & Data URI 変換
// ------------------------------------------------------------
export function generateStudyelSvg(stage, formType = 'general', isMini = false) {
    const st = gameState.studyel || {};
    const totalC = st.totalCorrect || 0;
    const formInfo = ADULT_FORMS[formType] || ADULT_FORMS.general;
    const themeColor = (stage >= 4) ? formInfo.color : (stage === 3 ? (ADULT_FORMS[getDominantCategory()]?.color || '#3498db') : '#f1c40f');

    // Stage 1: タマゴ
    if (stage === 1) {
        const isCracked = totalC >= 150;
        const crackOpacity = isCracked ? '1' : '0';
        const glowOpacity = isCracked ? '0.7' : '0.2';
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
                <defs>
                    <radialGradient id="egg-grad" cx="40%" cy="35%" r="65%">
                        <stop offset="0%" stop-color="#fffbeb" />
                        <stop offset="60%" stop-color="#fef08a" />
                        <stop offset="100%" stop-color="#f59e0b" />
                    </radialGradient>
                    <filter id="egg-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
                <circle cx="60" cy="65" r="42" fill="#fbbf24" opacity="${glowOpacity}" filter="url(#egg-glow)"/>
                <!-- タマゴ本体 -->
                <path d="M 60,18 C 35,18 24,50 24,74 C 24,96 40,108 60,108 C 80,108 96,96 96,74 C 96,50 85,18 60,18 Z" fill="url(#egg-grad)" stroke="#d97706" stroke-width="2.5"/>
                <!-- タマゴの斑点模様 -->
                <ellipse cx="44" cy="52" rx="5" ry="7" fill="#fde047" opacity="0.8" transform="rotate(-15 44 52)"/>
                <ellipse cx="76" cy="68" rx="6" ry="8" fill="#fde047" opacity="0.8" transform="rotate(20 76 68)"/>
                <ellipse cx="48" cy="88" rx="4" ry="5" fill="#fde047" opacity="0.8"/>
                <!-- ひび割れ (150問以上) -->
                <g opacity="${crackOpacity}" stroke="#78350f" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M 60,32 L 66,42 L 57,50 L 64,62 L 55,70"/>
                    <path d="M 66,42 L 75,46"/>
                    <path d="M 57,50 L 48,54"/>
                    <!-- 漏れ出る光粒子 -->
                    <circle cx="62" cy="46" r="3" fill="#ffffff" filter="url(#egg-glow)"/>
                    <circle cx="58" cy="58" r="2.5" fill="#ffffff" filter="url(#egg-glow)"/>
                </g>
                <!-- ハイライト -->
                <ellipse cx="45" cy="38" rx="8" ry="14" fill="#ffffff" opacity="0.45" transform="rotate(-25 45 38)"/>
            </svg>
        `;
    }

    // Stage 2〜Ex: スタディエルマスコット
    const isBaby = (stage === 2);
    const isYoung = (stage === 3);
    const isAdult = (stage === 4);
    const isEx = (stage >= 5);

    // 羽のサイズと形状
    const wingScale = isBaby ? 'scale(0.65)' : (isYoung ? 'scale(0.9)' : 'scale(1.15)');
    // オーラエフェクト
    const auraOpacity = isBaby ? '0.2' : (isYoung ? '0.4' : (isAdult ? '0.6' : '0.85'));

    // 系統固有の装飾パーツSVG
    let decorParts = '';
    if (stage >= 3) {
        const cat = (stage >= 4) ? formType : getDominantCategory();
        if (cat === 'science' || cat === 'sci_hum' || cat === 'sci_gen') {
            decorParts += `
                <!-- 理系：クリスタルホーン -->
                <polygon points="60,8 55,24 65,24" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
                <circle cx="60" cy="8" r="2.5" fill="#fecaca"/>
            `;
        }
        if (cat === 'humanities' || cat === 'sci_hum' || cat === 'hum_gen') {
            decorParts += `
                <!-- 文系：知性の羽ペンクラウン -->
                <path d="M 46,20 Q 42,6 50,4 Q 54,12 50,22 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1"/>
                <path d="M 74,20 Q 78,6 70,4 Q 66,12 70,22 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1"/>
                <circle cx="60" cy="16" r="3" fill="#f59e0b"/>
            `;
        }
        if (cat === 'general' || cat === 'sci_gen' || cat === 'hum_gen') {
            decorParts += `
                <!-- その他：機技のアンテナギア -->
                <line x1="60" y1="20" x2="60" y2="8" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="60" cy="7" r="4" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
                <circle cx="60" cy="7" r="1.5" fill="#ffffff"/>
            `;
        }
        if (cat === 'all') {
            decorParts += `
                <!-- 万能：極彩色の至高冠 -->
                <polygon points="46,18 42,6 52,14 60,3 68,14 78,6 74,18" fill="url(#studyel-rainbow-grad)" stroke="#ffffff" stroke-width="1.2"/>
                <circle cx="60" cy="3" r="3" fill="#ffffff"/>
            `;
        }
    } else {
        // 幼体：小さな鉛筆芯の芽
        decorParts = `
            <polygon points="60,16 57,24 63,24" fill="#f59e0b" stroke="#b45309" stroke-width="1"/>
            <polygon points="60,16 58.5,20 61.5,20" fill="#334155"/>
        `;
    }

    // 超越期 (Stage 5) の極限エフェクト
    let exAura = '';
    if (isEx) {
        exAura = `
            <g class="studyel-rainbow-fx">
                <circle cx="60" cy="62" r="54" fill="none" stroke="url(#studyel-rainbow-grad)" stroke-width="2.5" stroke-dasharray="6,4" opacity="0.8"/>
                <polygon points="60,4 62,12 70,12 64,17 66,25 60,20 54,25 56,17 50,12 58,12" fill="#fde047" opacity="0.9" transform="scale(0.6) translate(40, -10)"/>
                <polygon points="60,4 62,12 70,12 64,17 66,25 60,20 54,25 56,17 50,12 58,12" fill="#fde047" opacity="0.9" transform="scale(0.5) translate(145, 80)"/>
                <polygon points="60,4 62,12 70,12 64,17 66,25 60,20 54,25 56,17 50,12 58,12" fill="#fde047" opacity="0.9" transform="scale(0.5) translate(-15, 80)"/>
            </g>
        `;
    }

    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">
            <defs>
                <linearGradient id="studyel-rainbow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ef4444" />
                    <stop offset="25%" stop-color="#f59e0b" />
                    <stop offset="50%" stop-color="#10b981" />
                    <stop offset="75%" stop-color="#3b82f6" />
                    <stop offset="100%" stop-color="#8b5cf6" />
                </linearGradient>
                <radialGradient id="body-grad" cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stop-color="#ffffff" />
                    <stop offset="50%" stop-color="#fef08a" />
                    <stop offset="100%" stop-color="${themeColor}" />
                </radialGradient>
                <radialGradient id="aura-grad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="${themeColor}" stop-opacity="${auraOpacity}" />
                    <stop offset="100%" stop-color="${themeColor}" stop-opacity="0" />
                </radialGradient>
                <filter id="glow-fx" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur"/>
                    <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                </filter>
            </defs>
            
            <!-- 背後オーラ -->
            <circle cx="60" cy="64" r="48" fill="url(#aura-grad)" filter="url(#glow-fx)"/>
            ${exAura}

            <!-- 妖精の羽 (左) -->
            <g transform="translate(24, 52) ${wingScale}">
                <path d="M 0,0 C -22,-20 -30,10 -8,18 C -2,20 2,10 0,0 Z" fill="#e0f2fe" opacity="0.85" stroke="${themeColor}" stroke-width="1.5"/>
                <path d="M -4,2 C -16,-10 -22,8 -6,14" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.7"/>
            </g>

            <!-- 妖精の羽 (右) -->
            <g transform="translate(96, 52) ${wingScale}">
                <path d="M 0,0 C 22,-20 30,10 8,18 C 2,20 -2,10 0,0 Z" fill="#e0f2fe" opacity="0.85" stroke="${themeColor}" stroke-width="1.5"/>
                <path d="M 4,2 C 16,-10 22,8 6,14" fill="none" stroke="#ffffff" stroke-width="1.2" opacity="0.7"/>
            </g>

            <!-- ぽてっとボディ -->
            <ellipse cx="60" cy="68" rx="33" ry="31" fill="url(#body-grad)" stroke="#b45309" stroke-width="2"/>
            
            <!-- ほっぺのチーク -->
            <circle cx="43" cy="72" r="5.5" fill="#f43f5e" opacity="0.45" filter="url(#glow-fx)"/>
            <circle cx="77" cy="72" r="5.5" fill="#f43f5e" opacity="0.45" filter="url(#glow-fx)"/>

            <!-- 愛らしい瞳 (左) -->
            <ellipse cx="48" cy="64" rx="4.5" ry="6" fill="#1e293b"/>
            <circle cx="46.5" cy="62" r="2" fill="#ffffff"/>
            <circle cx="49.5" cy="66" r="1" fill="#ffffff"/>

            <!-- 愛らしい瞳 (右) -->
            <ellipse cx="72" cy="64" rx="4.5" ry="6" fill="#1e293b"/>
            <circle cx="70.5" cy="62" r="2" fill="#ffffff"/>
            <circle cx="73.5" cy="66" r="1" fill="#ffffff"/>

            <!-- にっこり口 -->
            <path d="M 57,72 Q 60,76 63,72" fill="none" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round"/>

            <!-- 頭部装飾パーツ -->
            ${decorParts}

            <!-- ぽてっと小さな手 -->
            <ellipse cx="38" cy="78" rx="4" ry="3.5" fill="#fef08a" stroke="#b45309" stroke-width="1.2"/>
            <ellipse cx="82" cy="78" rx="4" ry="3.5" fill="#fef08a" stroke="#b45309" stroke-width="1.2"/>
            
            <!-- ハイライト -->
            <ellipse cx="48" cy="48" rx="6" ry="10" fill="#ffffff" opacity="0.4" transform="rotate(-20 48 48)"/>
        </svg>
    `;
}

export function getStudyelSvgDataUri(stage, formType = 'general', isMini = false) {
    const svg = generateStudyelSvg(stage, formType, isMini);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ------------------------------------------------------------
// マスター配列（rawData.characters）自動復元
// ------------------------------------------------------------
export function restoreCharacters() {
    const st = gameState.studyel;
    if (!st) return;
    if (!rawData.characters) rawData.characters = [];
    if (!gameState.charaInventory) gameState.charaInventory = {};

    const targetFormIds = [];
    if (st.stage >= 4 && st.finalStats && st.finalStats.formId) {
        targetFormIds.push(st.finalStats.formId);
    }
    if (Array.isArray(st.history)) {
        st.history.forEach(id => {
            if (id && !targetFormIds.includes(id)) targetFormIds.push(id);
        });
    }

    targetFormIds.forEach(id => {
        if (!id || typeof id !== 'string') return;
        // 例: studyel_science_gen1
        const parts = id.split('_');
        const formKey = (parts && parts.length >= 2) ? parts[1] : 'general';
        const formInfo = ADULT_FORMS[formKey] || ADULT_FORMS.general || {
            id: 'general', name: '機技のスタディエル', type: 'TIME', skills: ['TIME'], cost: 6, color: '#3498db', desc: ''
        };
        const genMatch = id.match(/gen(\d+)/);
        const genNum = genMatch ? genMatch[1] : '1';

        // 1. rawData.characters に無ければ登録
        let cMaster = rawData.characters.find(c => String(c.id) === String(id));
        if (!cMaster) {
            cMaster = {
                id: id,
                name: (st.finalStats && st.finalStats.formId === id && st.finalStats.name)
                    ? st.finalStats.name
                    : `${formInfo.name || 'スタディエル'} (第${genNum}代)`,
                rarity: 'UR',
                type: formInfo.type || 'TIME',
                value: (st.finalStats && st.finalStats.formId === id) ? (st.finalStats.baseValue || 1.50) : 1.50,
                desc: formInfo.desc || '',
                imageUrl: getStudyelSvgDataUri(4, formKey),
                isStudyel: true,
                bonusTime: (st.finalStats && st.finalStats.formId === id) ? (st.finalStats.bonusTime || 0.0) : 0.0,
                bonusDamage: (st.finalStats && st.finalStats.formId === id) ? (st.finalStats.bonusDamage || 0.0) : 0.0
            };
            rawData.characters.push(cMaster);
        } else {
            // 既存にあっても常に画像やスタディエルフラグを保証
            cMaster.isStudyel = true;
            if (!cMaster.imageUrl || !cMaster.imageUrl.startsWith('data:image')) {
                cMaster.imageUrl = getStudyelSvgDataUri(4, formKey);
            }
        }

        const defaultSkills = (formInfo && Array.isArray(formInfo.skills) && formInfo.skills.length > 0) ? [...formInfo.skills] : ['TIME'];

        // 2. gameState.charaInventory に無ければ登録
        if (!gameState.charaInventory[id]) {
            gameState.charaInventory[id] = {
                level: (st.finalStats && st.finalStats.formId === id) ? (st.finalStats.level || 1) : 1,
                count: 1,
                exp: 0,
                currentRarity: 'UR',
                skills: defaultSkills,
                customValue: (st.finalStats && st.finalStats.formId === id) ? (st.finalStats.baseValue || 1.50) : 1.50,
                isEvolved: true,
                isStudyel: true
            };
        } else {
            gameState.charaInventory[id].isStudyel = true;
            if (!Array.isArray(gameState.charaInventory[id].skills) || gameState.charaInventory[id].skills.length === 0) {
                gameState.charaInventory[id].skills = defaultSkills;
            }
        }
    });
}

// ------------------------------------------------------------
// パッシブバフ提供 API
// ------------------------------------------------------------
/**
 * 制限時間延長秒数を取得 (startTimer & チームバトル用)
 */
export function getTimerBuff() {
    const st = gameState.studyel;
    if (!st) return 0;
    let buff = 0;
    if (st.stage === 2) buff = 0.5;
    else if (st.stage === 3) buff = 1.0;
    else if (st.stage === 4) buff = 1.5;
    else if (st.stage >= 5) buff = 2.0;

    // 成体スタディエル自身が出撃している場合、固有の解答速度ボーナスも加算
    if (st.stage >= 4 && st.finalStats && String(gameState.equipped) === String(st.finalStats.formId)) {
        buff += (st.finalStats.bonusTime || 0.0);
    }
    return buff;
}

/**
 * 確定/優勢系統の獲得XP乗算倍率を取得 (finishGame用)
 */
export function getXpMultiplier(subject) {
    const st = gameState.studyel;
    if (!st || st.stage < 2) return 1.0;
    const cat = classifySubject(subject);

    // Stage 2〜3: 優勢系統
    if (st.stage <= 3) {
        const dom = getDominantCategory();
        if (cat === dom) {
            return st.stage === 2 ? 1.02 : 1.04;
        }
        return 1.0;
    }

    // Stage 4〜Ex: 確定系統
    const formId = st.finalStats?.formId;
    if (!formId) return 1.0;
    const formKey = formId.split('_')[1];

    let matches = false;
    if (formKey === 'all') matches = true;
    else if (formKey === 'science' && cat === 'science') matches = true;
    else if (formKey === 'humanities' && cat === 'humanities') matches = true;
    else if (formKey === 'general' && cat === 'general') matches = true;
    else if (formKey === 'sci_hum' && (cat === 'science' || cat === 'humanities')) matches = true;
    else if (formKey === 'sci_gen' && (cat === 'science' || cat === 'general')) matches = true;
    else if (formKey === 'hum_gen' && (cat === 'humanities' || cat === 'general')) matches = true;

    if (matches) {
        return st.stage === 4 ? 1.06 : 1.10;
    }
    return 1.0;
}

/**
 * コンボ数に応じた基礎ダメージ加算率を取得
 */
export function getComboDamageBonus(combo) {
    const st = gameState.studyel;
    if (!st || st.stage < 4) return 0.0;
    let bonus = 0.0;

    const fiveCombos = Math.floor((combo || 0) / 5);
    if (st.stage === 4) {
        bonus += fiveCombos * 0.05; // 5コンボごとに+5%
    } else if (st.stage >= 5) {
        bonus += fiveCombos * 0.10; // 5コンボごとに+10%
    }

    // 成体スタディエルが出撃している場合、集中力ボーナスも常時上乗せ
    if (st.finalStats && String(gameState.equipped) === String(st.finalStats.formId)) {
        bonus += (st.finalStats.bonusDamage || 0.0);
    }
    return bonus;
}

/**
 * ピンチ時加護 (Ex限定: ライフ1＆残り2秒以下でタイマー全回復)
 */
export function canTriggerPinchHeal() {
    const st = gameState.studyel;
    if (!st || st.stage < 5) return false;
    return !pinchHealTriggeredInQuest;
}

export function triggerPinchHeal() {
    if (!canTriggerPinchHeal()) return;
    pinchHealTriggeredInQuest = true;
    gameState.timeLeft = gameState.maxTime;
    playSE('win');
    showCutIn("🛡️ 超越の加護！");
}

export function resetBattleFlags() {
    pinchHealTriggeredInQuest = false;
}

// ------------------------------------------------------------
// 出題・解答計測と成長集計
// ------------------------------------------------------------
export function onQuestionStart(q) {
    if (!isEligibleQuest()) return;
    questionStartTime = performance.now();
    currentQuestionGrade = (q && q.grade) ? q.grade : (document.getElementById('grade-select')?.value || document.getElementById('typing-grade-select')?.value || '');
    currentQuestionSubject = (q && q.subject) ? q.subject : (playData.isTyping ? 'タイピング' : '');
}

export function onAnswer(isCorrect, q) {
    if (!isEligibleQuest()) return;
    const st = gameState.studyel;
    if (!st) return;

    const elapsedSec = Math.min(10, Math.max(0.1, (performance.now() - questionStartTime) / 1000));
    const gradeWeight = getGradeWeight(currentQuestionGrade);
    const category = playData.isTyping ? 'general' : classifySubject(currentQuestionSubject || q?.subject);

    // 幼体・若体期（Stage 2〜3: 正解数301〜2,000問の区間）のスタッツ蓄積
    if (st.stage === 2 || st.stage === 3) {
        st.trainingStats.totalAttempts++;
        st.trainingStats.totalTimeSpent += elapsedSec;
        st.trainingStats.totalGradeWeight += gradeWeight;
        st.trainingStats.maxCombo = Math.max(st.trainingStats.maxCombo || 0, gameState.combo || 0);
    }

    if (isCorrect) {
        st.totalCorrect++;

        if (st.stage === 2 || st.stage === 3) {
            st.trainingStats.totalCorrect++;
            if (!st.categories[category]) st.categories[category] = 0;
            st.categories[category]++;
        }

        // 超越熟成 (Stage 5: 3,001問〜)
        if (st.stage >= 5) {
            const avgWeight = (st.trainingStats.totalAttempts > 0)
                ? (st.trainingStats.totalGradeWeight / st.trainingStats.totalAttempts)
                : 1.0;
            const stepReq = (avgWeight < 1.0) ? 200 : 100;
            if (st.totalCorrect % stepReq === 0) {
                if (st.finalStats.baseValue < 3.00) {
                    st.finalStats.baseValue = Math.min(3.00, Math.round((st.finalStats.baseValue + 0.01) * 100) / 100);
                    // マスタ配列とインベントリにも反映
                    if (st.finalStats.formId) {
                        const c = rawData.characters?.find(x => x.id === st.finalStats.formId);
                        if (c) c.value = st.finalStats.baseValue;
                        if (gameState.charaInventory[st.finalStats.formId]) {
                            gameState.charaInventory[st.finalStats.formId].customValue = st.finalStats.baseValue;
                        }
                    }
                }
            }
        }

        // 節目ボーナス & 進化判定
        checkMilestonesAndEvolution();

        // 変更を永続化
        saveGame();
        updateMiniView();
    }
}

// ------------------------------------------------------------
// 節目ボーナスと進化分岐判定
// ------------------------------------------------------------
function checkMilestonesAndEvolution() {
    const st = gameState.studyel;
    if (!st) return;
    const total = st.totalCorrect;

    // 1. 100問ごとボーナス
    if (total >= st.nextMilestone) {
        st.nextMilestone = Math.floor(total / 100) * 100 + 100;
        // 小の書×1 ＋ 10,000 XP
        if (!gameState.inventory) gameState.inventory = {};
        gameState.inventory.xpBookSmall = (gameState.inventory.xpBookSmall || 0) + 1;
        gameState.xp = (gameState.xp || 0) + 10000;
        showCutIn("📔 小の書 & 10,000XP 獲得！");
    }

    // 2. 500問ごとボーナス
    if (total > 0 && total % 500 === 0) {
        gameState.inventory.xpBookLarge = (gameState.inventory.xpBookLarge || 0) + 2;
        gameState.inventory.redPages = (gameState.inventory.redPages || 0) + 15;
        gameState.inventory.bluePages = (gameState.inventory.bluePages || 0) + 15;
        showCutIn("💖 成長の絆！大の書&ページ獲得！");
    }

    // 3. 進化判定
    // 300問達成: 【孵化】
    if (st.stage === 1 && total >= 300) {
        st.stage = 2;
        gameState.xp = (gameState.xp || 0) + 50000;
        playSE('win');
        showCutIn("🥚 孵化！幼体スタディエル解放！");
        alert("【祝・孵化！】\nタマゴが割れて「幼体スタディエル」が誕生しました！\n連れてるだけで発動する「おとも効果」が発動します！(+50,000 XP)");
    }
    // 1,000問達成: 【若体進化】
    else if (st.stage === 2 && total >= 1000) {
        st.stage = 3;
        gameState.xp = (gameState.xp || 0) + 100000;
        gameState.inventory.xpBookMedium = (gameState.inventory.xpBookMedium || 0) + 5;
        playSE('win');
        showCutIn("✨ 若体進化！属性オーラ覚醒！");
        alert("【祝・若体進化！】\nスタディエルが成長し、得意な教科のオーラを纏いました！\nおとも効果がさらにパワーアップしました！(+100,000 XP & 中の書×5)");
    }
    // 2,000問達成: 【成体覚醒】
    else if (st.stage === 3 && total >= 2000) {
        st.stage = 4;
        awakenAdultStudyel();
    }
    // 3,000問達成: 【超越到達】
    else if (st.stage === 4 && total >= 3000) {
        st.stage = 5;
        gameState.xp = (gameState.xp || 0) + 300000;
        gameState.inventory.xpBookLarge = (gameState.inventory.xpBookLarge || 0) + 10;
        playSE('win');
        showCutIn("🌟 超越到達！極限熟成突入！");
        alert("【祝・超越到達！】\nスタディエルが極限の高みへ到達しました！\n通常キャラの上限（3.00倍）を目指してさらに鍛えられます！(+300,000 XP & 大の書×10)");
    }
}

/**
 * 成体覚醒ロジック (2,000問達成時)
 */
function awakenAdultStudyel() {
    const st = gameState.studyel;
    if (!st) return;

    const { science, humanities, general } = st.categories;
    const trainingTotal = Math.max(1, science + humanities + general);
    const rSci = science / trainingTotal;
    const rHum = humanities / trainingTotal;
    const rGen = general / trainingTotal;

    // 3.2 分岐判定ルール
    let formKey = 'all';
    if (rSci >= 0.50) {
        formKey = 'science';
    } else if (rHum >= 0.50) {
        formKey = 'humanities';
    } else if (rGen >= 0.50) {
        formKey = 'general';
    } else if (rSci >= 0.30 && rSci <= 0.36 && rHum >= 0.30 && rHum <= 0.36 && rGen >= 0.30 && rGen <= 0.36) {
        formKey = 'all';
    } else {
        // 複合上位2系統
        const arr = [
            { k: 'science', val: rSci },
            { k: 'humanities', val: rHum },
            { k: 'general', val: rGen }
        ].sort((a, b) => b.val - a.val);

        const top2 = [arr[0].k, arr[1].k];
        if (top2.includes('science') && top2.includes('humanities')) formKey = 'sci_hum';
        else if (top2.includes('science') && top2.includes('general')) formKey = 'sci_gen';
        else formKey = 'hum_gen';
    }

    const formInfo = ADULT_FORMS[formKey];
    const formId = `studyel_${formKey}_gen${st.generation}`;

    // 4. 学年・プレイスタイルによる成体ステータス決定式
    const trStats = st.trainingStats;
    const avgWg = (trStats.totalAttempts > 0) ? (trStats.totalGradeWeight / trStats.totalAttempts) : 1.0;
    const acc = (trStats.totalAttempts > 0) ? Math.min(1.0, trStats.totalCorrect / trStats.totalAttempts) : 1.0;

    // 4.2 基礎補正値 (1.20 〜 1.80)
    const rawBase = 1.00 + (0.45 * acc * (avgWg / 1.50));
    const baseVal = Math.min(1.80, Math.max(1.20, Math.round(rawBase * 100) / 100));

    // 4.3 覚醒時初期レベル (Lv.1 〜 Lv.10)
    const rawLv = Math.floor(1 + (avgWg - 0.65) * 7.5);
    const initLv = Math.min(10, Math.max(1, rawLv));

    // 4.4 解答速度ボーナス (+0.0s 〜 +1.5s)
    const avgT = (trStats.totalAttempts > 0) ? (trStats.totalTimeSpent / trStats.totalAttempts) : 3.0;
    let bonusT = 0.0;
    if (avgT <= 2.5) bonusT = 1.5;
    else if (avgT <= 4.0) bonusT = 1.0;
    else if (avgT <= 6.0) bonusT = 0.5;

    // 4.5 集中力ボーナス (+0% 〜 +20%)
    const maxC = trStats.maxCombo || 0;
    let bonusD = 0.0;
    if (maxC >= 80) bonusD = 0.20;
    else if (maxC >= 50) bonusD = 0.10;
    else if (maxC >= 30) bonusD = 0.05;

    // finalStats への記録
    st.finalStats = {
        formId: formId,
        name: formInfo.name,
        baseValue: baseVal,
        bonusTime: bonusT,
        bonusDamage: bonusD,
        level: initLv
    };

    // マスター配列およびインベントリへの登録
    restoreCharacters();

    // 報酬付与
    gameState.xp = (gameState.xp || 0) + 200000;
    saveGame();

    playSE('win');
    showCutIn(`🎉 覚醒！${formInfo.name}`);
    alert(`【祝・成体覚醒！！】\n累計2,000問の学習を経て、スタディエルが『${formInfo.name}』へと覚醒しました！\n\n・二つ名: ${formInfo.title}\n・属性の効果: ×${baseVal}（最大×3.00）\n・初期Lv: ${initLv}\n・タイマー延長: +${bonusT}秒\n・5COMBOごとに攻撃力: +${Math.round(bonusD * 100)}% アップ\n・獲得EXP: +200,000 XP\n\n👑 出撃メンバーに選べるようになりました！（UR・コスト6）`);
}

// ------------------------------------------------------------
// 巣立ち（周回サイクル）
// ------------------------------------------------------------
export async function retireStudyel() {
    const st = gameState.studyel;
    if (!st || st.stage < 4) return;

    const ok = window.confirm(`【スタディエルの巣立ち】\n育て上げた成体『${st.finalStats.name}』はずっと仲間として残り、いつでもバトルに出撃できます。\n\n現在のスタディエルを巣立たせ、第${st.generation + 1}世代の「なぞのタマゴ」から新たな育成を開始しますか？`);
    if (!ok) return;

    // 歴代リストに現在のformIdを追加
    if (st.finalStats.formId && !st.history.includes(st.finalStats.formId)) {
        st.history.push(st.finalStats.formId);
    }

    const nextGen = st.generation + 1;
    const historyCopy = [...st.history];

    // 新たなタマゴステートで初期化
    gameState.studyel = getDefaultStudyelState(nextGen, historyCopy);

    saveGame();
    restoreCharacters();
    updateMiniView();
    renderStudyelRoom();

    playSE('win');
    alert(`スタディエルは元気に巣立っていきました！\n第${nextGen}世代の「なぞのタマゴ」から新たな育成が始まります！`);
}

// ------------------------------------------------------------
// UIレンダリング & 操作
// ------------------------------------------------------------
/**
 * タイトル画面フッターのミニスタディエル表示を更新
 */
export function updateMiniView() {
    const container = document.getElementById('studyel-mini-btn');
    if (!container) return;

    const st = gameState.studyel || getDefaultStudyelState();
    const stage = st.stage || 1;
    const total = st.totalCorrect || 0;

    // プログレスリング計算
    // Stage 1: 0〜300, Stage 2: 300〜1000, Stage 3: 1000〜2000, Stage 4: 2000〜3000, Ex: 3000〜
    let progressRatio = 0;
    if (stage === 1) progressRatio = Math.min(1, total / 300);
    else if (stage === 2) progressRatio = Math.min(1, (total - 300) / 700);
    else if (stage === 3) progressRatio = Math.min(1, (total - 1000) / 1000);
    else if (stage === 4) progressRatio = Math.min(1, (total - 2000) / 1000);
    else progressRatio = 1.0;

    const circumference = 113.1;
    const offset = circumference * (1 - progressRatio);

    const ring = container.querySelector('.studyel-mini-ring-progress');
    if (ring) {
        ring.style.strokeDashoffset = offset;
    }

    const avatar = container.querySelector('.studyel-mini-avatar');
    if (avatar) {
        const formKey = (stage >= 4 && st.finalStats?.formId) ? st.finalStats.formId.split('_')[1] : 'general';
        avatar.innerHTML = generateStudyelSvg(stage, formKey, true);
    }

    const badge = container.querySelector('.studyel-mini-badge');
    if (badge) {
        badge.innerText = `S${stage}`;
    }
}

/**
 * スタディエル部屋モーダルを開く
 */
export function openStudyelRoom() {
    renderStudyelRoom();
    const modal = document.getElementById('studyel-modal-overlay');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

/**
 * スタディエル部屋モーダルを閉じる
 */
export function closeStudyelRoom() {
    const modal = document.getElementById('studyel-modal-overlay');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

/**
 * スタディエル部屋からあそびかた（プレイガイド）へ遷移
 */
export function openStudyelGuide() {
    closeStudyelRoom();
    if (typeof GuideModule !== 'undefined' && GuideModule.open) {
        GuideModule.open('studyel');
    } else if (typeof window.GuideModule !== 'undefined' && window.GuideModule.open) {
        window.GuideModule.open('studyel');
    }
}

/**
 * スタディエル部屋の描画
 */
export function renderStudyelRoom() {
    const st = gameState.studyel || getDefaultStudyelState();
    const stage = st.stage || 1;
    const total = st.totalCorrect || 0;
    const formKey = (stage >= 4 && st.finalStats?.formId) ? st.finalStats.formId.split('_')[1] : getDominantCategory();

    // 1. ヘッダー
    const genBadge = document.getElementById('st-gen-badge');
    if (genBadge) genBadge.innerText = `第${stage}世代`;
    const stageTitle = document.getElementById('st-stage-title');
    if (stageTitle) stageTitle.innerText = getStageName(stage);

    // 2. 中央マスコット
    const mascotWrap = document.getElementById('st-mascot-wrap');
    if (mascotWrap) {
        mascotWrap.innerHTML = generateStudyelSvg(stage, formKey, false);
    }

    // 台詞
    const speechEl = document.getElementById('st-speech-bubble');
    if (speechEl) {
        speechEl.innerHTML = getStudyelSpeech(stage, total);
    }

    // 3. 進行度メーター
    let nextGoal = 300;
    let prevGoal = 0;
    let nextName = '孵化';
    if (stage === 1) { nextGoal = 300; prevGoal = 0; nextName = '孵化'; }
    else if (stage === 2) { nextGoal = 1000; prevGoal = 300; nextName = '若体進化'; }
    else if (stage === 3) { nextGoal = 2000; prevGoal = 1000; nextName = '成体覚醒'; }
    else if (stage === 4) { nextGoal = 3000; prevGoal = 2000; nextName = '超越到達'; }
    else { nextGoal = total + 100; prevGoal = total; nextName = '熟成極限強化'; }

    const curInStage = Math.max(0, total - prevGoal);
    const reqInStage = Math.max(1, nextGoal - prevGoal);
    const progressPct = Math.min(100, (curInStage / reqInStage) * 100);

    const goalLabel = document.getElementById('st-goal-label');
    if (goalLabel) {
        if (stage >= 5) {
            goalLabel.innerHTML = `累計正解数: <b>${total}</b> 問<br>（極限熟成中）`;
        } else {
            goalLabel.innerHTML = `${nextName}まで あと <b>${Math.max(0, nextGoal - total)}</b> 問<br>（${total} / ${nextGoal}）`;
        }
    }

    const barFill = document.getElementById('st-progress-fill');
    if (barFill) barFill.style.width = `${progressPct}%`;

    const nextMilestoneEl = document.getElementById('st-milestone-info');
    if (nextMilestoneEl) {
        const nextMs = st.nextMilestone || 100;
        nextMilestoneEl.innerText = `次回節目ボーナスまで あと ${Math.max(0, nextMs - total)} 問`;
    }

    // 4. 系統オーラバランス
    const { science, humanities, general } = st.categories || { science: 0, humanities: 0, general: 0 };
    const catTotal = Math.max(1, science + humanities + general);
    const pSci = Math.round((science / catTotal) * 100);
    const pHum = Math.round((humanities / catTotal) * 100);
    const pGen = Math.max(0, 100 - pSci - pHum);

    const barSci = document.getElementById('st-bar-sci');
    if (barSci) barSci.style.width = `${pSci}%`;
    const barHum = document.getElementById('st-bar-hum');
    if (barHum) barHum.style.width = `${pHum}%`;
    const barGen = document.getElementById('st-bar-gen');
    if (barGen) barGen.style.width = `${pGen}%`;

    const omenBadge = document.getElementById('st-omen-badge');
    if (omenBadge) {
        if (stage >= 4) {
            omenBadge.innerText = `確定属性: ${ADULT_FORMS[formKey]?.title || '万能'}`;
        } else {
            omenBadge.innerText = `現在：${getOmenText(pSci, pHum, pGen)}`;
        }
    }

    const legSci = document.getElementById('st-leg-sci');
    if (legSci) legSci.innerText = `理系 ${pSci}%`;
    const legHum = document.getElementById('st-leg-hum');
    if (legHum) legHum.innerText = `文系 ${pHum}%`;
    const legGen = document.getElementById('st-leg-gen');
    if (legGen) legGen.innerText = `その他 ${pGen}%`;

    // 5. 学力深度診断パネル
    const tr = st.trainingStats || {};
    const attempts = tr.totalAttempts || 0;
    const correctCount = tr.totalCorrect || 0;
    const accPct = attempts > 0 ? Math.round((correctCount / attempts) * 100) : 100;
    const avgT = attempts > 0 ? (tr.totalTimeSpent / attempts).toFixed(1) : '-';
    const maxCombo = tr.maxCombo || 0;
    const avgW = attempts > 0 ? (tr.totalGradeWeight / attempts).toFixed(2) : '1.00';

    const diagAcc = document.getElementById('st-diag-acc');
    if (diagAcc) diagAcc.innerText = `${accPct}%`;
    const diagSpeed = document.getElementById('st-diag-speed');
    if (diagSpeed) diagSpeed.innerText = `${avgT}s`;
    const diagCombo = document.getElementById('st-diag-combo');
    if (diagCombo) diagCombo.innerText = `${maxCombo} COMBO`;
    const diagGrade = document.getElementById('st-diag-grade');
    if (diagGrade) {
        diagGrade.innerText = `Lv.${avgW}`;
        diagGrade.title = '難しい問題ほど強く育つ！';
    }

    // 6. パッシブバフ情報
    const buffDesc = document.getElementById('st-buff-desc');
    if (buffDesc) {
        buffDesc.innerHTML = getBuffDescription(stage, formKey);
    }

    // 7. フッターアクションボタン制御
    const equipBtn = document.getElementById('st-btn-equip');
    const retireBtn = document.getElementById('st-btn-retire');
    if (stage >= 4) {
        if (equipBtn) equipBtn.classList.remove('hidden');
        if (retireBtn) retireBtn.classList.remove('hidden');
    } else {
        if (equipBtn) equipBtn.classList.add('hidden');
        if (retireBtn) retireBtn.classList.add('hidden');
    }
}

/**
 * タップ時のリアクション
 */
export function onStudyelTap() {
    const wrap = document.getElementById('st-mascot-wrap');
    if (!wrap) return;

    playSE('hit');
    wrap.classList.remove('studyel-bounce-anim');
    void wrap.offsetWidth;
    wrap.classList.add('studyel-bounce-anim');

    // ハートパーティクル生成
    const heart = document.createElement('div');
    heart.className = 'studyel-heart-particle';
    heart.innerText = '💖';
    heart.style.left = '50%';
    heart.style.top = '40%';
    wrap.appendChild(heart);
    setTimeout(() => heart.remove(), 800);

    // 台詞更新
    const speechEl = document.getElementById('st-speech-bubble');
    if (speechEl) {
        speechEl.innerHTML = getRandomTapSpeech(gameState.studyel?.stage || 1);
    }
}

/**
 * 成体スタディエルを通常クエスト装備にセット
 */
export function equipStudyel() {
    const st = gameState.studyel;
    if (!st || st.stage < 4 || !st.finalStats?.formId) return;

    gameState.equipped = String(st.finalStats.formId);
    saveGame();
    playSE('win');
    alert(`『${st.finalStats.name}』を出撃メンバーに選びました！`);
    closeStudyelRoom();
    if (typeof window.updateTitleInfo === 'function') window.updateTitleInfo();
}

// ------------------------------------------------------------
// テキスト生成ヘルパー
// ------------------------------------------------------------
function getStudyelSpeech(stage, total) {
    if (stage === 1) {
        if (total >= 150) return "殻の内側から、<br>確かな鼓動と光が漏れ出している……！";
        return "温かな光に包まれている。<br>学習を重ねることで孵化が近づくようだ。";
    }
    if (stage === 2) return "キュピ！<br>もっとたくさんの問題に挑戦して大きくなりたいな！";
    if (stage === 3) return "身体の奥からチカラが湧いてくる！<br>得意な分野のオーラが見えるよ！";
    if (stage === 4) return "あなたの努力が私をここまで導いてくれた。<br>いつでも共に出撃しよう！";
    return "知の極致へ到達した。<br>私たちの絆と学びは、無限の領域へと熟成されている！";
}

function getRandomTapSpeech(stage) {
    if (stage === 1) {
        const msgs = ["コトコト……<br>（嬉しそうに揺れた）", "ピキッ！<br>殻から微かな光が輝いた！", "温もりを感じているようだ。"];
        return msgs[Math.floor(Math.random() * msgs.length)];
    }
    const msgs = [
        "キュピ♪<br>いつも勉強がんばっててえらい！",
        "えへへ、一緒にいると安心するな！",
        "今日も新しい問題にどんどん挑もう！",
        "君の集中力、すごくカッコいいよ！"
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
}

function getOmenText(pSci, pHum, pGen) {
    if (pSci >= 50) return '剛理（理系特化）の兆し';
    if (pHum >= 50) return '叡文（文系特化）の兆し';
    if (pGen >= 50) return '機技（その他特化）の兆し';
    if (pSci >= 30 && pSci <= 36 && pHum >= 30 && pHum <= 36 && pGen >= 30 && pGen <= 36) {
        return '万象（ALL万能）の兆し';
    }
    return '複合属性（2系統融合）の兆し';
}

function getBuffDescription(stage, formKey) {
    const st = gameState.studyel;
    if (stage === 1) {
        return 'まだタマゴなので効果はありません。<br>（300問正解でタマゴから生まれたら発動します！）';
    }
    if (stage === 2) {
        return '✨ 得意教科の獲得EXP +2%<br>⏳ タイマー +0.5秒 延長';
    }
    if (stage === 3) {
        return '✨ 得意教科の獲得EXP +4%<br>⏳ タイマー +1.0秒 延長';
    }
    const baseVal = st?.finalStats?.baseValue ? Number(st.finalStats.baseValue).toFixed(2) : '1.50';
    const bonusT = st?.finalStats?.bonusTime ? Number(st.finalStats.bonusTime).toFixed(1) : '1.5';
    const bonusD = st?.finalStats?.bonusDamage ? Math.round(Number(st.finalStats.bonusDamage) * 100) : '10';

    if (stage === 4) {
        return `✨ 得意教科の獲得EXP +6%<br>⏳ タイマー +${bonusT}秒 延長<br>⚔️ 5COMBOごとに攻撃力 +${bonusD}% アップ<br>💪 属性の効果: ×${baseVal}（最大×3.00）`;
    }
    return `✨ 得意教科の獲得EXP +10%<br>⏳ タイマー +${bonusT}秒 延長<br>⚔️ 5COMBOごとに攻撃力 +${bonusD}% アップ<br>💪 属性の効果: ×${baseVal}（最大×3.00）<br>🛡️ 残りライフ1＆時間切れ直前で<br>時間が1度だけ全回復`;
}

// ------------------------------------------------------------
// 初期化
// ------------------------------------------------------------
export function init() {
    restoreCharacters();
    updateMiniView();
}

// ------------------------------------------------------------
// 本番前デバッグ・検証用ヘルパー (Console用)
// ------------------------------------------------------------
if (typeof window !== 'undefined') {
    window.debugStudyel = {
        // 1. 300問（孵化イベント）直前
        setHatchReady: () => {
            gameState.studyel.stage = 1;
            gameState.studyel.totalCorrect = 299;
            gameState.studyel.nextMilestone = 300;
            saveGame();
            updateMiniView();
            console.log("%c【スタディエル】孵化直前（299問 / Stage 1）に設定しました。クエストで1問正解してください。", "color: #f1c40f; font-weight: bold;");
        },
        // 2. 2,000問（成体覚醒）直前
        setAwakenReady: (formType = 'science') => {
            gameState.studyel.stage = 3;
            gameState.studyel.totalCorrect = 1999;
            gameState.studyel.nextMilestone = 2000;
            if (formType === 'science') {
                gameState.studyel.categories = { science: 1100, humanities: 600, general: 299 };
            } else if (formType === 'humanities') {
                gameState.studyel.categories = { science: 400, humanities: 1100, general: 499 };
            } else if (formType === 'all') {
                gameState.studyel.categories = { science: 660, humanities: 670, general: 669 };
            } else {
                gameState.studyel.categories = { science: 300, humanities: 300, general: 1100 };
            }
            gameState.studyel.trainingStats = { totalAttempts: 2100, totalCorrect: 1999, totalTimeSpent: 4200, totalGradeWeight: 3100, maxCombo: 65 };
            saveGame();
            updateMiniView();
            console.log(`%c【スタディエル】成体覚醒直前（1,999問 / Stage 3 / ${formType}優勢）に設定しました。クエストで1問正解してください。`, "color: #e67e22; font-weight: bold;");
        },
        // 3. Ex超越期
        setExStage: () => {
            gameState.studyel.stage = 5;
            gameState.studyel.totalCorrect = 3000;
            gameState.studyel.nextMilestone = 3100;
            if (!gameState.studyel.finalStats?.formId) {
                gameState.studyel.finalStats = {
                    formId: 'studyel_science_gen1',
                    name: '剛理のスタディエル',
                    baseValue: 1.50,
                    bonusTime: 1.0,
                    bonusDamage: 0.10,
                    level: 5
                };
            }
            saveGame();
            restoreCharacters();
            updateMiniView();
            console.log("%c【スタディエル】Ex超越期（Stage 5）に設定しました。クエスト出撃中にピンチ加護（ライフ1＆残り2秒以下でタイマー全回復）が発動します。", "color: #a855f7; font-weight: bold;");
        },
        // 状態ログ出力
        status: () => {
            const info = {
                stage: gameState.studyel?.stage,
                totalCorrect: gameState.studyel?.totalCorrect,
                generation: gameState.studyel?.generation,
                categories: JSON.stringify(gameState.studyel?.categories),
                finalStats: JSON.stringify(gameState.studyel?.finalStats)
            };
            console.table(info);
            return info;
        },
        // クイズ自動正解クリック
        answerCorrect: () => {
            if (!playData.currentQ) return console.warn("出題中の問題がありません");
            const btns = document.querySelectorAll('#ui-choices .choice-btn');
            for (const b of btns) {
                if (String(b.innerText).trim() === String(playData.currentQ.a).trim()) {
                    b.click();
                    return true;
                }
            }
            return false;
        },
        // ピンチ発動エミュレート
        triggerPinchState: () => {
            gameState.lives = 1;
            gameState.timeLeft = 2.0;
            console.log("【QA】ピンチ状態（ライフ1 & 残り2秒）に設定しました");
        }
    };

    // ?qa=true 時に画面上にQA検証用フローティングバーを展開
    function setupQaFloatingBar() {
        if (!window.location.search.includes('qa=true')) return;
        if (document.getElementById('studyel-qa-bar')) return;

        const bar = document.createElement('div');
        bar.id = 'studyel-qa-bar';
        bar.style.cssText = 'position:fixed;top:6px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);border:2px solid #38bdf8;border-radius:12px;padding:6px 12px;display:flex;gap:6px;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.6);font-size:12px;align-items:center;color:#fff;';

        bar.innerHTML = `
            <span style="font-weight:bold;color:#38bdf8;">🧪 QA Panel:</span>
            <button id="qa-btn-test1" style="background:#475569;color:#fff;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">[Test1: 初期確認]</button>
            <button id="qa-btn-test2" style="background:#eab308;color:#000;font-weight:bold;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">[Test2: 孵化セット(299問)]</button>
            <button id="qa-btn-test3" style="background:#f97316;color:#fff;font-weight:bold;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">[Test3: 覚醒セット(1999問)]</button>
            <button id="qa-btn-test4" style="background:#a855f7;color:#fff;font-weight:bold;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">[Test4: Ex超越セット]</button>
            <button id="qa-btn-pinch" style="background:#ef4444;color:#fff;font-weight:bold;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">[⚡ ピンチ発動(1機/2秒)]</button>
            <button id="qa-btn-correct" style="background:#10b981;color:#fff;font-weight:bold;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">[🎯 正解クリック]</button>
            <div id="qa-log-badge" style="background:#1e293b;padding:2px 8px;border-radius:6px;color:#cbd5e1;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Ready</div>
        `;
        document.body.appendChild(bar);

        const log = (msg, color = '#cbd5e1') => {
            const el = document.getElementById('qa-log-badge');
            if (el) { el.innerText = msg; el.style.color = color; }
            console.log(`[QA Runner] ${msg}`);
        };

        document.getElementById('qa-btn-test1')?.addEventListener('click', () => {
            const st = gameState.studyel;
            const ok = st && st.stage === 1 && st.totalCorrect === 0;
            log(ok ? "Test 1 PASS: Stage 1 / 0問" : "Test 1 FAIL", ok ? '#4ade80' : '#f87171');
            window.debugStudyel.status();
        });
        document.getElementById('qa-btn-test2')?.addEventListener('click', () => {
            window.debugStudyel.setHatchReady();
            log("Test 2 セット完了 (299問) ➔ クエストで1問正解", '#fde047');
        });
        document.getElementById('qa-btn-test3')?.addEventListener('click', () => {
            window.debugStudyel.setAwakenReady('science');
            log("Test 3 セット完了 (1999問) ➔ クエストで1問正解", '#fb923c');
        });
        document.getElementById('qa-btn-test4')?.addEventListener('click', () => {
            window.debugStudyel.setExStage();
            log("Test 4 セット完了 (Stage 5 超越)", '#c084fc');
        });
        document.getElementById('qa-btn-pinch')?.addEventListener('click', () => {
            window.debugStudyel.triggerPinchState();
            log("ピンチ状態セット(ライフ1 & 2秒)", '#f87171');
        });
        document.getElementById('qa-btn-correct')?.addEventListener('click', () => {
            const res = window.debugStudyel.answerCorrect();
            log(res ? "正解ボタンをクリックしました" : "問題が見つかりません", res ? '#4ade80' : '#f87171');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupQaFloatingBar);
    } else {
        setupQaFloatingBar();
    }
}

