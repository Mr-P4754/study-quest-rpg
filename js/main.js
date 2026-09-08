// ==========================================
// js/main.js (メインエントリーポイント・グローバル公開バインド)
// ==========================================

import {
    API_URL,
    RARITY_CAPS,
    EVO_COST_XP,
    EVO_STOCK_REQ,
    REBORN_COST_XP,
    RARITY_ORDER,
    SKILL_TYPES,
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
    ROGUE_TILES,
    GUIDE_DATA,
    rawData,
    playData,
    gameState,
    dailyMissions,
    rogueData,
    runtimeState,
    initUserId,
    loadSaveData,
    saveGame,
    getDefaultStudyelState
} from './state.js?v=10.1.2';

import * as StudyelEngine from './studyel-engine.js?v=10.1.2';
window.StudyelEngine = StudyelEngine;

import {
    getRarityIndex,
    getDisplayName,
    getGradeMultiplier,
    generateCalcQuestion,
    drawRadarChart,
    audioCtx,
    updateMuteButtonsUI,
    toggleMute,
    playSE,
    playBGM,
    stopBGM,
    playMmlBGM,
    BGM_MML
} from './utils.js?v=10.1.2';

import {
    uploadData,
    downloadData,
    fetchData
} from './api.js?v=10.1.2';

import {
    showCutIn,
    updateUI,
    togglePause,
    resumeGame,
    retryGame,
    backToTitleFromPause,
    startCountdown,
    startTimer,
    getCharaStats,
    finishGame,
    handleResultClose,
    backToTitle
} from './battle-core.js?v=10.1.2';

import {
    startNormalGameCheck,
    startGame,
    nextQuestion,
    judge,
    goToOathMenuCheck,
    goToReliefMenuCheck,
    goToOathMenuSurvivalCheck,
    goToReliefMenuSurvivalCheck,
    startSurvivalGame,
    startRandomGameCheck,
    goToOathMenuRandomCheck,
    goToReliefMenuRandomCheck,
    startRandomGame,
    startTypingGameCheck,
    goToOathMenuTypingCheck,
    goToReliefMenuTypingCheck,
    startTypingGame,
    nextTypingQuestion,
    renderTypingRomaji,
    handleTypingInput,
    startCalcGame,
    renderCalcInput,
    renderCalcProgress,
    handleCalcButton,
    submitCalcAnswer,
    nextCalcQuestion,
    startCalcTimer,
    startRevengeMode,
    toggleOath,
    toggleRelief,
    startOathGame,
    startReliefGame
} from './quest-normal.js?v=10.1.2';

import {
    addRogueLog,
    renderRogueLogs,
    startRogueMode,
    generateRogueFloor,
    drawRogueMap,
    moveRoguePlayer,
    triggerRogueRNGEvent,
    processRogueTile,
    triggerRogueShop,
    closeRogueShop,
    renderRogueShopContents,
    buyRogueHeal,
    buyRogueAtk,
    buyRogueSteps,
    getRogueEnemyChar,
    triggerRogueBattle,
    showRogueCutIn,
    updateRogueUI,
    escapeRogueConfirm,
    exitRogueSystem
} from './quest-explore.js?v=10.1.2';

import {
    openGacha,
    closeGacha,
    rollGacha,
    rollGuaranteedTenGacha,
    executeGacha,
    showGachaResult,
    closeGachaResult,
    renderZukan,
    changeZukanSort,
    openCharaDetail,
    closeCharaDetail,
    equipCurrentChara,
    useExpItem,
    executeEvolution,
    executeReincarnation,
    openEnhanceMenu,
    closeEnhanceMenu,
    renderEnhanceList,
    toggleMaterial,
    getNeededExpForMax,
    getSelectedTotalExp,
    updateEnhancePreview,
    executeBulkEnhance,
    sellCharaStock,
    openShop,
    closeShop,
    renderShop,
    switchShopTab,
    buyItem,
    exchangeBook,
    openMissions,
    closeMissions,
    renderMissions,
    claimMission,
    claimAllClear,
    updateMissionProgress,
    updateMissionBadge,
    openTitles,
    closeTitles,
    renderTitles,
    claimTitle,
    checkTitles,
    checkLoginBonus,
    closeLoginBonus,
    checkMissionDate
} from './gacha-shop.js?v=10.1.2';

import {
    initTitle,
    filterSubjects,
    filterUnits,
    updateTitleInfo,
    updateCategoryBadges,
    openCategory,
    closeCategory,
    closeAllCategoryModals,
    hideCurrentCategoryOverlay,
    returnToCurrentCategory,
    openUnitSelection,
    closeUnitSelection,
    openRandomMenu,
    closeRandomMenu,
    openTypingMenu,
    closeTypingMenu,
    openSurvivalMenu,
    closeSurvivalMenu,
    openCalcMenu,
    closeCalcMenu,
    openRogueMenu,
    closeRogueMenu,
    openOathMenu,
    closeOathMenu,
    openReliefMenu,
    closeReliefMenu,
    openSyncMenu,
    closeSyncMenu,
    openVersionHistory,
    closeVersionHistory,
    openGiftMenu,
    closeGiftMenu,
    renderGiftList,
    receiveAllGifts,
    checkAdminGifts,
    openRecord,
    closeRecord,
    renderRecord,
    addCalcRecord,
    showAppModal,
    showAlert,
    showConfirm,
    GuideModule
} from './ui-manager.js?v=10.1.2';

import {
    openTeamBattleSetup,
    closeTeamBattleSetup,
    openPartyFormation,
    closePartyFormation,
    savePartyFormation,
    changePartySort,
    selectPartySlot,
    setPartyMember,
    removePartyMember,
    renderPartyFormation,
    updateTeamBattleSetupPreview,
    initTbGradeSelect,
    filterTbSubjects,
    filterTbUnits,
    tbState,
    TB_MAX_COST,
    TB_RARITY_COST,
    TB_STAGE_ENEMY_PROBS,
    getTbCharaCost,
    calcTbPartyTotalCost,
    updatePartyCostMeter,
    generateTbEnemyTeam,
    calcTbEnemyDynamicLevel,
    getTbCharaStats,
    calcTbMaxHp,
    calcTbEnemyAtk,
    getTbAffinityMultiplier,
    getTbAffinityInfo,
    calcTbTickDamage,
    showTbCountdownCutIn,
    startTeamBattle,
    tbGameLoop,
    nextTbQuestion,
    judgeTbAnswer,
    switchTbActiveChar,
    updateTbBattleUI,
    escapeTeamBattle,
    finishTeamBattle,
    toggleTbPause,
    resumeTbGame,
    escapeTeamBattleFromPause,
    generatePartyPassword,
    openQrScanner,
    closeQrScanner,
    startTbQrScanner,
    stopTbQrScanner,
    setScannedData,
    clearScannedData
} from './special-quest-engine.js?v=10.1.2';

// ==========================================
// インライン onclick / 動的UI互換用 window 一括バインド
// ==========================================
const globalScope = typeof window !== 'undefined' ? window : globalThis;
Object.assign(globalScope, {
    // 状態・定数
    API_URL,
    RARITY_CAPS,
    EVO_COST_XP,
    EVO_STOCK_REQ,
    REBORN_COST_XP,
    RARITY_ORDER,
    SKILL_TYPES,
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
    ROGUE_TILES,
    GUIDE_DATA,
    rawData,
    playData,
    gameState,
    dailyMissions,
    rogueData,
    runtimeState,
    initUserId,
    loadSaveData,
    saveGame,

    // ユーティリティ・音響
    getRarityIndex,
    getDisplayName,
    getGradeMultiplier,
    generateCalcQuestion,
    drawRadarChart,
    audioCtx,
    updateMuteButtonsUI,
    toggleMute,
    playSE,
    playBGM,
    stopBGM,
    playMmlBGM,
    BGM_MML,

    // 通信
    uploadData,
    downloadData,
    fetchData,

    // バトルコア
    showCutIn,
    updateUI,
    togglePause,
    resumeGame,
    retryGame,
    backToTitleFromPause,
    startCountdown,
    startTimer,
    getCharaStats,
    finishGame,
    handleResultClose,
    backToTitle,

    // 通常・サバイバル・計算・タイピング・誓約・救済
    startNormalGameCheck,
    startGame,
    nextQuestion,
    judge,
    goToOathMenuCheck,
    goToReliefMenuCheck,
    goToOathMenuSurvivalCheck,
    goToReliefMenuSurvivalCheck,
    startSurvivalGame,
    startRandomGameCheck,
    goToOathMenuRandomCheck,
    goToReliefMenuRandomCheck,
    startRandomGame,
    startTypingGameCheck,
    goToOathMenuTypingCheck,
    goToReliefMenuTypingCheck,
    startTypingGame,
    nextTypingQuestion,
    renderTypingRomaji,
    handleTypingInput,
    startCalcGame,
    renderCalcInput,
    renderCalcProgress,
    handleCalcButton,
    submitCalcAnswer,
    nextCalcQuestion,
    startCalcTimer,
    startRevengeMode,
    toggleOath,
    toggleRelief,
    startOathGame,
    startReliefGame,

    // 探索
    addRogueLog,
    renderRogueLogs,
    startRogueMode,
    generateRogueFloor,
    drawRogueMap,
    moveRoguePlayer,
    triggerRogueRNGEvent,
    processRogueTile,
    triggerRogueShop,
    closeRogueShop,
    renderRogueShopContents,
    buyRogueHeal,
    buyRogueAtk,
    buyRogueSteps,
    getRogueEnemyChar,
    triggerRogueBattle,
    showRogueCutIn,
    updateRogueUI,
    escapeRogueConfirm,
    exitRogueSystem,

    // ガチャ・図鑑・育成・ショップ・実績
    openGacha,
    closeGacha,
    rollGacha,
    rollGuaranteedTenGacha,
    executeGacha,
    showGachaResult,
    closeGachaResult,
    renderZukan,
    changeZukanSort,
    openCharaDetail,
    closeCharaDetail,
    equipCurrentChara,
    useExpItem,
    executeEvolution,
    executeReincarnation,
    openEnhanceMenu,
    closeEnhanceMenu,
    renderEnhanceList,
    toggleMaterial,
    getNeededExpForMax,
    getSelectedTotalExp,
    updateEnhancePreview,
    executeBulkEnhance,
    sellCharaStock,
    openShop,
    closeShop,
    renderShop,
    switchShopTab,
    buyItem,
    buyShopItem: buyItem,
    exchangeBook,
    openMissions,
    closeMissions,
    renderMissions,
    claimMission,
    claimAllClear,
    updateMissionProgress,
    updateMissionBadge,
    openTitles,
    closeTitles,
    renderTitles,
    claimTitle,
    checkTitles,
    checkLoginBonus,
    closeLoginBonus,
    checkMissionDate,

    // UIマネージャー・モーダル・ガイド
    initTitle,
    filterSubjects,
    filterUnits,
    updateTitleInfo,
    updateCategoryBadges,
    openCategory,
    closeCategory,
    closeAllCategoryModals,
    hideCurrentCategoryOverlay,
    returnToCurrentCategory,
    openUnitSelection,
    closeUnitSelection,
    openRandomMenu,
    closeRandomMenu,
    openTypingMenu,
    closeTypingMenu,
    openSurvivalMenu,
    closeSurvivalMenu,
    openCalcMenu,
    closeCalcMenu,
    openRogueMenu,
    closeRogueMenu,
    openOathMenu,
    closeOathMenu,
    openReliefMenu,
    closeReliefMenu,
    openSyncMenu,
    closeSyncMenu,
    openVersionHistory,
    closeVersionHistory,
    openGiftMenu,
    closeGiftMenu,
    renderGiftList,
    receiveAllGifts,
    checkAdminGifts,
    openRecord,
    closeRecord,
    renderRecord,
    addCalcRecord,
    showAppModal,
    showAlert,
    showConfirm,
    GuideModule,
    
    // チームバトルクエスト関連
    openTeamBattleSetup,
    closeTeamBattleSetup,
    openPartyFormation,
    closePartyFormation,
    savePartyFormation,
    changePartySort,
    selectPartySlot,
    setPartyMember,
    removePartyMember,
    renderPartyFormation,
    updateTeamBattleSetupPreview,
    initTbGradeSelect,
    filterTbSubjects,
    filterTbUnits,
    tbState,
    TB_MAX_COST,
    TB_RARITY_COST,
    TB_STAGE_ENEMY_PROBS,
    getTbCharaCost,
    calcTbPartyTotalCost,
    updatePartyCostMeter,
    generateTbEnemyTeam,
    calcTbEnemyDynamicLevel,
    getTbCharaStats,
    calcTbMaxHp,
    calcTbEnemyAtk,
    getTbAffinityMultiplier,
    getTbAffinityInfo,
    calcTbTickDamage,
    showTbCountdownCutIn,
    startTeamBattle,
    tbGameLoop,
    nextTbQuestion,
    judgeTbAnswer,
    switchTbActiveChar,
    updateTbBattleUI,
    escapeTeamBattle,
    finishTeamBattle,
    toggleTbPause,
    resumeTbGame,
    escapeTeamBattleFromPause,
    generatePartyPassword,
    openQrScanner,
    closeQrScanner,
    startTbQrScanner,
    stopTbQrScanner,
    setScannedData,
    clearScannedData,

    // スタディエル育成エンジン
    StudyelEngine
});

// ==========================================
// 初期化エントリーポイント
// ==========================================
let isAppInitialized = false;
async function initApp() {
    if (isAppInitialized) return;
    isAppInitialized = true;
    initUserId();
    loadSaveData();
    checkMissionDate();
    await fetchData();
    initTitle();
    checkLoginBonus();
    
    // スタディエル育成エンジンの初期化とイベントリスナーバインド
    StudyelEngine.init();
    const miniBtn = document.getElementById('studyel-mini-btn');
    if (miniBtn) miniBtn.addEventListener('click', StudyelEngine.openStudyelRoom);

    const closeBtn = document.getElementById('st-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', StudyelEngine.closeStudyelRoom);

    const helpBtn = document.getElementById('btn-studyel-help');
    if (helpBtn) helpBtn.addEventListener('click', StudyelEngine.openStudyelGuide);

    const questBtn = document.getElementById('st-btn-quest');
    if (questBtn) questBtn.addEventListener('click', StudyelEngine.closeStudyelRoom);

    const equipBtn = document.getElementById('st-btn-equip');
    if (equipBtn) equipBtn.addEventListener('click', StudyelEngine.equipStudyel);

    const retireBtn = document.getElementById('st-btn-retire');
    if (retireBtn) retireBtn.addEventListener('click', StudyelEngine.retireStudyel);

    const mascotWrap = document.getElementById('st-mascot-wrap');
    if (mascotWrap) mascotWrap.addEventListener('click', StudyelEngine.onStudyelTap);

    const modalOverlay = document.getElementById('studyel-modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) StudyelEngine.closeStudyelRoom();
        });
    }
    
    // URLから対戦パスワードを読み取って自動展開する処理
    const urlParams = new URLSearchParams(window.location.search);
    const tbPass = urlParams.get('tb_pass');
    if (tbPass) {
        if (typeof setScannedData === 'function') {
            setScannedData(tbPass);
        } else {
            const inputEl = document.getElementById('tb-password-input');
            if (inputEl) inputEl.value = tbPass;
        }
        
        setTimeout(() => {
            if (typeof openTeamBattleSetup === 'function') {
                openTeamBattleSetup();
            }
        }, 500);
        
        window.history.replaceState(null, '', window.location.pathname);
    }
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initApp();
    } else {
        document.addEventListener('DOMContentLoaded', initApp);
        window.addEventListener('load', initApp, { once: true });
    }
}

