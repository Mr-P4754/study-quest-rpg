// ==========================================
// js/quest-normal.js (通常・サバイバル・計算・タイピング・リベンジ進行)
// ==========================================

import {
    gameState,
    playData,
    rawData,
    rogueData,
    runtimeState,
    saveGame
} from './state.js?v=10.5.0';

import {
    generateCalcQuestion,
    playSE,
    isGradeMatch,
    renderSafeImg
} from './utils.js?v=10.5.0';

import {
    showCutIn,
    updateUI,
    startCountdown,
    startTimer,
    getCharaStats,
    finishGame,
    addSP,
    updateSpUI,
    applyBattleStartHeldItemBuffs
} from './battle-core.js?v=10.5.0';

import {
    updateMissionProgress
} from './gacha-shop.js?v=10.5.0';

import {
    updateTitleInfo,
    openOathMenu,
    openReliefMenu
} from './ui-manager.js?v=10.5.0';

import { addFarmExp } from './farm-engine.js?v=10.5.0';

// ==========================================
// 通常クエスト
// ==========================================
export function startNormalGameCheck() { 
    const g = document.getElementById('grade-select')?.value; 
    const s = document.getElementById('subject-select')?.value; 
    const u = document.getElementById('unit-select')?.value; 
    const hp = document.getElementById('boss-hp-select')?.value; 
    if(!g || !s || !u) return alert("全て選択してください"); 
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.subject == s && q.unit == u && q.choices && q.choices.length >= 2); 
    if(qList.length === 0) return alert("問題がありません"); 
    playData.selectedBossHp = hp ? Number(hp) : null; 
    runtimeState.oathOrigin = 'normal'; 
    startGame(); 
}

export function goToOathMenuCheck() {
    const g = document.getElementById('grade-select')?.value;
    const s = document.getElementById('subject-select')?.value;
    const u = document.getElementById('unit-select')?.value;
    const hp = document.getElementById('boss-hp-select')?.value;
    if(!g || !s || !u) return alert("全て選択してください");
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.subject == s && q.unit == u && q.choices && q.choices.length >= 2);
    if(qList.length === 0) return alert("問題がありません");
    
    playData.questions = qList;
    playData.isRevenge = false;
    playData.isRandom = false;
    playData.isTyping = false;
    playData.isCalculation = false;
    playData.isSurvival = false;
    playData.selectedBossHp = hp ? parseInt(hp, 10) : null;
    playData.context = { grade: g, subject: s, unit: u };
    
    document.getElementById('unit-select-overlay')?.classList.add('hidden');
    runtimeState.oathOrigin = 'normal';
    openOathMenu();
}

export function goToReliefMenuCheck() {
    const g = document.getElementById('grade-select')?.value;
    const s = document.getElementById('subject-select')?.value;
    const u = document.getElementById('unit-select')?.value;
    const hp = document.getElementById('boss-hp-select')?.value;
    if(!g || !s || !u) return alert("全て選択してください");
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.subject == s && q.unit == u && q.choices && q.choices.length >= 2);
    if(qList.length === 0) return alert("問題がありません");
    
    playData.questions = qList;
    playData.isRevenge = false;
    playData.isRandom = false;
    playData.isTyping = false;
    playData.isCalculation = false;
    playData.isSurvival = false;
    playData.selectedBossHp = hp ? parseInt(hp, 10) : null;
    playData.context = { grade: g, subject: s, unit: u };
    
    document.getElementById('unit-select-overlay')?.classList.add('hidden');
    runtimeState.oathOrigin = 'normal';
    openReliefMenu();
}

export function startGame() {
    const gSelect = document.getElementById('grade-select'); 
    const sSelect = document.getElementById('subject-select'); 
    const uSelect = document.getElementById('unit-select'); 
    if(!gSelect || !sSelect || !uSelect) return;
    
    const g = gSelect.value, s = sSelect.value, u = uSelect.value;
    if(!g || !s || !u) return alert("全て選択してください");
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.subject == s && q.unit == u && q.choices && q.choices.length >= 2);
    if(qList.length === 0) return alert("問題がありません");
    
    let boss = (rawData.bosses && rawData.bosses.length > 0) ? rawData.bosses.find(b => b.unit == u && isGradeMatch(b.grade, g)) : null;
    if(!boss) boss = { name: "テストの魔人", hp: 3000, icon: "😈" };
    if(playData.selectedBossHp) boss.hp = playData.selectedBossHp;
    
    playData.questions = qList.sort(() => Math.random() - 0.5); 
    playData.qIndex = 0; 
    playData.currentBoss = boss;
    playData.isRevenge = false; 
    if (runtimeState.oathOrigin === 'normal') {
        playData.activeOaths = [...runtimeState.tempOaths];
        playData.activeReliefs = [...runtimeState.tempReliefs];
    } else {
        playData.activeOaths = []; 
        playData.activeReliefs = []; 
    }
    playData.isRandom = false; 
    playData.isTyping = false; 
    playData.isCalculation = false; 
    playData.isSurvival = false; 
    playData.context = { grade: g, subject: s, unit: u };
    runtimeState.currentCategory = null;
    
    const charaStats = getCharaStats();
    let initialLives = 3;
    if (playData.activeOaths.includes('backwater')) initialLives = 1;
    else if (playData.activeReliefs.includes('life')) initialLives = 5;

    let baseTime = 10;
    if (playData.activeOaths.includes('rapid')) baseTime = 5;
    else if (playData.activeReliefs.includes('time')) baseTime = 20;

    gameState.score = 0; 
    gameState.combo = 0; 
    gameState.lives = initialLives; 
    gameState.enemyHP = Number(boss.hp) || 3000; 
    gameState.maxHP = gameState.enemyHP; 
    gameState.maxTime = baseTime * charaStats.time;
    runtimeState.isGameActive = false; 
    runtimeState.isPaused = false;
    applyBattleStartHeldItemBuffs();
    playData.bonusExp = 0;
    if (typeof window !== 'undefined' && typeof window.StudyelEngine?.resetBattleFlags === 'function') {
        window.StudyelEngine.resetBattleFlags();
    }
    
    document.getElementById('pause-overlay')?.classList.add('hidden'); 
    document.getElementById('title-screen')?.classList.add('hidden'); 
    document.getElementById('game-screen')?.classList.remove('hidden'); 
    document.getElementById('unit-select-overlay')?.classList.add('hidden');
    document.getElementById('cat-main-overlay')?.classList.add('hidden');
    document.getElementById('cat-special-overlay')?.classList.add('hidden');
    document.getElementById('cat-gacha-overlay')?.classList.add('hidden');
    document.getElementById('cat-achievement-overlay')?.classList.add('hidden');
    document.getElementById('cat-guide-overlay')?.classList.add('hidden');
    
    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';

    const enemyBox = document.querySelector('.enemy-visual-box'); 
    const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); 
    if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    const uienemyName = document.getElementById('ui-enemy-name'); 
    if(uienemyName) uienemyName.innerText = boss.name;
    if(enemyIcon) {
        if(boss.icon && boss.icon.startsWith('http')) { 
            enemyIcon.innerHTML = renderSafeImg(boss.icon, '👾'); 
        } else { 
            enemyIcon.innerHTML = boss.icon || '👾'; 
        }
    }
    const uiScoreSpan = document.getElementById('ui-score');
    if (uiScoreSpan && uiScoreSpan.previousSibling && uiScoreSpan.previousSibling.nodeType === 3) {
        uiScoreSpan.previousSibling.nodeValue = "SCORE ";
    }
    const uiComboSpan = document.getElementById('ui-combo');
    if (uiComboSpan && uiComboSpan.previousSibling && uiComboSpan.previousSibling.nodeType === 3) {
        uiComboSpan.previousSibling.nodeValue = "COMBO ";
    }

    const timerBar = document.getElementById('ui-timer'); 
    if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); 
    if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);
    
    updateUI(); 
    startCountdown();
}

export function nextQuestion() {
    if(!runtimeState.isGameActive) return;
    if(playData.qIndex >= playData.questions.length) { 
        playData.questions.sort(()=>Math.random()-0.5); 
        playData.qIndex = 0; 
    }
    const q = playData.questions[playData.qIndex]; 
    playData.currentQ = q;
    if (typeof window !== 'undefined' && typeof window.StudyelEngine?.onQuestionStart === 'function') {
        window.StudyelEngine.onQuestionStart(q);
    }
    const qBox = document.getElementById('ui-question'); 
    if(qBox) qBox.innerText = q.q;
    const choices = [...q.choices].sort(() => Math.random() - 0.5);
    const div = document.getElementById('ui-choices'); 
    if(div) {
        div.innerHTML = '';
        choices.forEach(c => { 
            const btn = document.createElement('button'); 
            btn.className = 'choice-btn'; 
            btn.innerText = c; 
            btn.onclick = () => judge(String(c) === String(q.a), btn); 
            div.appendChild(btn); 
        });
    }
    startTimer();
}

export function judge(isCorrect, btn) {
    if(runtimeState.isPaused || !runtimeState.isGameActive) return; 
    clearInterval(gameState.timer);
    document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
    if(btn) btn.classList.add(isCorrect ? 'btn-correct' : 'btn-wrong');

    // スタディエル育成通知（サバイバル・計算・探索モード時はスキップ）
    if (!playData.isSurvival && !playData.isCalculation && !(typeof rogueData !== 'undefined' && rogueData.active)) {
        const targetQ = playData.isTyping ? playData.typingTarget : playData.currentQ;
        if (typeof window !== 'undefined' && typeof window.StudyelEngine?.onAnswer === 'function') {
            window.StudyelEngine.onAnswer(isCorrect, targetQ);
        }
    }
    
    if(!isCorrect) {
        playSE('miss');
        if (playData.currentQ && playData.currentQ.id && !playData.isSurvival && !(typeof rogueData !== 'undefined' && rogueData.active)) { 
            if (!gameState.revengeList) gameState.revengeList = []; 
            if (!gameState.revengeList.includes(playData.currentQ.id)) { 
                gameState.revengeList.push(playData.currentQ.id); 
                saveGame(); 
            } 
        }
        document.querySelectorAll('.choice-btn').forEach(b => { 
            if(String(b.innerText) === String(playData.currentQ?.a)) b.classList.add('btn-miss-answer'); 
        });
    }
    
    if (playData.currentQ && playData.currentQ.subject) { 
        const subj = playData.currentQ.subject; 
        if (!gameState.subjectStats[subj]) gameState.subjectStats[subj] = { correct: 0, total: 0 }; 
        gameState.subjectStats[subj].total++; 
        if (isCorrect) gameState.subjectStats[subj].correct++; 
    }

    if(isCorrect) {
        playSE('hit');

        // ファーム（牧場）EXP分配（サバイバル・計算・探索モード時はスキップ）
        if (!playData.isSurvival && !playData.isCalculation && !(typeof rogueData !== 'undefined' && rogueData.active)) {
            const targetQ = playData.isTyping ? playData.typingTarget : playData.currentQ;
            addFarmExp(targetQ);
        }

        if (playData.isRevenge && playData.currentQ && playData.currentQ.id) { 
            gameState.revengeList = gameState.revengeList.filter(id => String(id) !== String(playData.currentQ.id)); 
            saveGame(); 
        }
        
        let damage = 0;
        if (playData.isSurvival) {
            gameState.score += 1; 
            gameState.timeLeft = Math.min(gameState.maxTime, gameState.timeLeft + 5.0); 
            const uienemyName = document.getElementById('ui-enemy-name'); 
            if(uienemyName) uienemyName.innerText = "WAVE: " + gameState.score;
            showCutIn("+5.0s");
        } else if (playData.isRevenge) { 
            damage = Math.ceil(gameState.maxHP / playData.questions.length); 
            gameState.enemyHP = Math.max(0, gameState.enemyHP - damage); 
            gameState.score += damage; 
            showCutIn("-" + damage);
        } else {
            const stats = getCharaStats(); 
            const baseAtk = 100; 
            const rawRatio = gameState.timeLeft / gameState.maxTime; 
            const timeFactor = 0.2 + (rawRatio * 0.8);
            const statFactor = stats.atk + ((stats.time - 1) * 0.5); 
            const studyelBonusD = (typeof window !== 'undefined' && typeof window.StudyelEngine?.getComboDamageBonus === 'function')
                ? window.StudyelEngine.getComboDamageBonus(gameState.combo)
                : 0.0;
            const comboAdd = Math.min(gameState.combo * 0.025, 1.0) + studyelBonusD;
            damage = Math.floor(baseAtk * timeFactor * (statFactor + comboAdd));
            gameState.enemyHP = Math.max(0, gameState.enemyHP - damage); 
            gameState.score += damage; 
            showCutIn("-" + damage);
        }
        
        gameState.combo++; 
        if (gameState.combo > 0 && gameState.combo % 5 === 0) {
            addSP(1);
        }
        gameState.stats.totalCorrect = (gameState.stats.totalCorrect || 0) + 1; 
        gameState.stats.maxCombo = Math.max(gameState.stats.maxCombo || 0, gameState.combo);
        if ((gameState.maxTime - gameState.timeLeft) <= 1.0) { 
            gameState.stats.achieved_speed = true; 
            saveGame(); 
        }
        
        const enemyIcon = document.getElementById('ui-enemy-icon'); 
        if(enemyIcon) { 
            enemyIcon.classList.remove('shake-anim'); 
            void enemyIcon.offsetWidth; 
            enemyIcon.classList.add('shake-anim'); 
        }
        if(typeof updateMissionProgress === 'function') { 
            updateMissionProgress('correct', 1); 
            updateMissionProgress('maxCombo', gameState.combo); 
        } 
        updateUI();
        
        if(!playData.isSurvival && gameState.enemyHP <= 0) { 
            const enemyBox = document.querySelector('.enemy-visual-box'); 
            if(enemyBox) { 
                enemyBox.classList.add('anim-paused'); 
                enemyBox.classList.add('fade-out'); 
            } 
            setTimeout(() => runtimeState.isGameActive && finishGame(true), 1200); 
        } else { 
            playData.qIndex++; 
            setTimeout(() => runtimeState.isGameActive && nextQuestion(), 1000); 
        }
    } else {
        gameState.lives--; 
        gameState.combo = 0; 
        showCutIn("✕"); 
        updateUI();
        if(gameState.lives <= 0) { 
            setTimeout(() => runtimeState.isGameActive && finishGame(false), 1500); 
        } else { 
            setTimeout(() => { 
                if(!runtimeState.isGameActive) return; 
                if(playData.isTyping && !(typeof rogueData !== 'undefined' && rogueData.active)) nextTypingQuestion(); 
                else nextQuestion(); 
            }, 1500); 
        }
    }
}

// ==========================================
// サバイバルクエスト
// ==========================================
export async function goToOathMenuSurvivalCheck() {
    const g = document.getElementById('survival-grade-select')?.value;
    if(!g) return alert("学年を選択してください");
    if (typeof window.ensureGradeLoaded === 'function') await window.ensureGradeLoaded(g);
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.choices && q.choices.length >= 2);
    if(qList.length === 0) return alert("問題がありません");
    
    playData.questions = qList;
    playData.isRevenge = false;
    playData.isRandom = false;
    playData.isTyping = false;
    playData.isCalculation = false;
    playData.isSurvival = true;
    playData.context = null;
    
    document.getElementById('survival-overlay')?.classList.add('hidden');
    runtimeState.oathOrigin = 'survival';
    openOathMenu();
}

export async function goToReliefMenuSurvivalCheck() {
    const g = document.getElementById('survival-grade-select')?.value;
    if(!g) return alert("学年を選択してください");
    if (typeof window.ensureGradeLoaded === 'function') await window.ensureGradeLoaded(g);
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.choices && q.choices.length >= 2);
    if(qList.length === 0) return alert("問題がありません");
    
    playData.questions = qList;
    playData.isRevenge = false;
    playData.isRandom = false;
    playData.isTyping = false;
    playData.isCalculation = false;
    playData.isSurvival = true;
    playData.context = null;
    
    document.getElementById('survival-overlay')?.classList.add('hidden');
    runtimeState.oathOrigin = 'survival';
    openReliefMenu();
}

export async function startSurvivalGame() {
    const g = document.getElementById('survival-grade-select')?.value;
    if(!g) return alert("学年を選択してください");
    if (typeof window.ensureGradeLoaded === 'function') await window.ensureGradeLoaded(g);
    
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.choices && q.choices.length >= 2);
    if(qList.length === 0) return alert("問題がありません");
    
    let boss = { name: "エンドレス特訓", hp: 999999, icon: "🔥" };
    
    playData.questions = qList.sort(() => Math.random() - 0.5); 
    playData.qIndex = 0; 
    playData.currentBoss = boss;
    playData.isRevenge = false; 
    playData.activeOaths = runtimeState.oathOrigin === 'survival' ? [...runtimeState.tempOaths] : []; 
    playData.activeReliefs = runtimeState.oathOrigin === 'survival' ? [...runtimeState.tempReliefs] : [];
    playData.isRandom = false; 
    playData.isTyping = false; 
    playData.isCalculation = false; 
    playData.isSurvival = true; 
    playData.context = null;
    runtimeState.currentCategory = null;
    runtimeState.oathOrigin = 'normal';
    
    const charaStats = getCharaStats();
    gameState.score = 0; 
    gameState.combo = 0; 
    gameState.lives = playData.activeOaths.includes('backwater') ? 1 : (playData.activeReliefs.includes('life') ? 5 : 3); 
    gameState.enemyHP = boss.hp; 
    gameState.maxHP = boss.hp; 
    
    let timeMulti = playData.activeOaths.includes('rapid') ? 0.5 : (playData.activeReliefs.includes('time') ? 2.0 : 1.0); 
    gameState.maxTime = 10 * charaStats.time * timeMulti;
    gameState.timeLeft = gameState.maxTime;
    runtimeState.isGameActive = false; 
    runtimeState.isPaused = false;
    playData.currentSP = 0;
    playData.bonusExp = 0;
    updateSpUI();
    
    document.getElementById('survival-overlay')?.classList.add('hidden');
    document.getElementById('oath-overlay')?.classList.add('hidden'); 
    document.getElementById('relief-overlay')?.classList.add('hidden'); 
    document.getElementById('title-screen')?.classList.add('hidden'); 
    document.getElementById('game-screen')?.classList.remove('hidden'); 
    document.getElementById('cat-special-overlay')?.classList.add('hidden');
    
    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = 'none';

    const enemyBox = document.querySelector('.enemy-visual-box'); 
    const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); 
    if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    
    const uienemyName = document.getElementById('ui-enemy-name'); 
    if(uienemyName) uienemyName.innerText = "WAVE: 0";
    if(enemyIcon) enemyIcon.innerHTML = boss.icon; 
    
    const uiScoreSpan = document.getElementById('ui-score');
    if(uiScoreSpan && uiScoreSpan.previousSibling && uiScoreSpan.previousSibling.nodeType === 3) {
        uiScoreSpan.previousSibling.nodeValue = "WAVE ";
    }
    
    const timerBar = document.getElementById('ui-timer'); 
    if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); 
    if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);
    
    runtimeState.oathOrigin = 'normal';
    updateUI(); 
    startCountdown();
}

// ==========================================
// ランダムクエスト（未知の迷宮）
// ==========================================
export function startRandomGameCheck() {
    const g = document.getElementById('random-grade-select')?.value;
    const hp = document.getElementById('random-boss-hp-select')?.value;
    if(!g) return alert("学年を選択してください");
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.choices && q.choices.length >= 2);
    if(qList.length === 0) return alert("問題が見つかりません");
    playData.selectedBossHp = hp ? parseInt(hp, 10) : null;
    runtimeState.oathOrigin = 'random';
    startRandomGame();
}

export async function goToOathMenuRandomCheck() {
    const g = document.getElementById('random-grade-select')?.value;
    const hp = document.getElementById('random-boss-hp-select')?.value;
    if(!g) return alert("学年を選択してください");
    if (typeof window.ensureGradeLoaded === 'function') await window.ensureGradeLoaded(g);
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.choices && q.choices.length >= 2);
    if(qList.length === 0) return alert("問題が見つかりません");
    playData.questions = qList;
    playData.selectedBossHp = hp ? parseInt(hp, 10) : null;
    document.getElementById('random-overlay')?.classList.add('hidden');
    runtimeState.oathOrigin = 'random';
    openOathMenu();
}

export async function goToReliefMenuRandomCheck() {
    const g = document.getElementById('random-grade-select')?.value;
    const hp = document.getElementById('random-boss-hp-select')?.value;
    if(!g) return alert("学年を選択してください");
    if (typeof window.ensureGradeLoaded === 'function') await window.ensureGradeLoaded(g);
    let qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.choices && q.choices.length >= 2);
    if(qList.length === 0) return alert("問題が見つかりません");
    playData.questions = qList;
    playData.selectedBossHp = hp ? parseInt(hp, 10) : null;
    document.getElementById('random-overlay')?.classList.add('hidden');
    runtimeState.oathOrigin = 'random';
    openReliefMenu();
}

export async function startRandomGame() {
    const g = document.getElementById('random-grade-select')?.value; 
    if(!g) return alert("学年を選択してください");
    if (typeof window.ensureGradeLoaded === 'function') await window.ensureGradeLoaded(g);
    const qList = (rawData.questions || []).filter(q => isGradeMatch(q.grade, g) && q.choices && q.choices.length >= 2); 
    if(qList.length === 0) return alert("問題が見つかりません");
    
    let possibleBosses = []; 
    if (rawData.randomBosses) { 
        possibleBosses = rawData.randomBosses.filter(b => isGradeMatch(b.grade, g) || b.grade == '全学年'); 
    }
    let boss; 
    if (possibleBosses.length > 0) { 
        const b = possibleBosses[Math.floor(Math.random() * possibleBosses.length)]; 
        boss = { name: b.name, hp: Number(b.hp) || 3000, icon: b.icon }; 
    } else { 
        boss = { name: "迷宮のヌシ", hp: 3000, icon: "🐲" }; 
    }
    if(playData.selectedBossHp) boss.hp = playData.selectedBossHp;
    
    playData.questions = qList.sort(() => Math.random() - 0.5); 
    playData.qIndex = 0; 
    playData.currentBoss = boss;
    playData.isRevenge = false; 
    if (runtimeState.oathOrigin === 'random') {
        playData.activeOaths = [...runtimeState.tempOaths];
        playData.activeReliefs = [...runtimeState.tempReliefs];
    } else {
        playData.activeOaths = []; 
        playData.activeReliefs = []; 
    }
    playData.isRandom = true; 
    playData.isTyping = false; 
    playData.isCalculation = false; 
    playData.isSurvival = false; 
    playData.context = null;
    runtimeState.currentCategory = null;
    
    const charaStats = getCharaStats();
    let initialLives = 3;
    if (playData.activeOaths.includes('backwater')) initialLives = 1;
    else if (playData.activeReliefs.includes('life')) initialLives = 5;

    let baseTime = 10;
    if (playData.activeOaths.includes('rapid')) baseTime = 5;
    else if (playData.activeReliefs.includes('time')) baseTime = 20;

    gameState.score = 0; 
    gameState.combo = 0; 
    gameState.lives = initialLives; 
    gameState.enemyHP = Number(boss.hp) || 3000; 
    gameState.maxHP = gameState.enemyHP; 
    gameState.maxTime = baseTime * charaStats.time;
    runtimeState.isGameActive = false; 
    runtimeState.isPaused = false;
    playData.currentSP = 0;
    playData.bonusExp = 0;
    updateSpUI();
    if (typeof window !== 'undefined' && typeof window.StudyelEngine?.resetBattleFlags === 'function') {
        window.StudyelEngine.resetBattleFlags();
    }
    
    document.getElementById('random-overlay')?.classList.add('hidden'); 
    document.getElementById('title-screen')?.classList.add('hidden'); 
    document.getElementById('game-screen')?.classList.remove('hidden');
    document.getElementById('cat-main-overlay')?.classList.add('hidden');
    
    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';

    const enemyBox = document.querySelector('.enemy-visual-box'); 
    const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); 
    if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    const uienemyName = document.getElementById('ui-enemy-name'); 
    if(uienemyName) uienemyName.innerText = "【迷宮】" + boss.name;
    if(enemyIcon) {
        if(boss.icon && boss.icon.startsWith('http')) { 
            enemyIcon.innerHTML = renderSafeImg(boss.icon, '👾'); 
        } else { 
            enemyIcon.innerHTML = boss.icon || "👾"; 
        }
    }
    const uiScoreSpan = document.getElementById('ui-score');
    if (uiScoreSpan && uiScoreSpan.previousSibling && uiScoreSpan.previousSibling.nodeType === 3) {
        uiScoreSpan.previousSibling.nodeValue = "SCORE ";
    }
    const uiComboSpan = document.getElementById('ui-combo');
    if (uiComboSpan && uiComboSpan.previousSibling && uiComboSpan.previousSibling.nodeType === 3) {
        uiComboSpan.previousSibling.nodeValue = "COMBO ";
    }

    const timerBar = document.getElementById('ui-timer'); 
    if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); 
    if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);
    updateUI(); 
    startCountdown();
}

// ==========================================
// タイピングクエスト
// ==========================================
export function startTypingGameCheck() {
    const g = document.getElementById('typing-grade-select')?.value;
    const hp = document.getElementById('typing-boss-hp-select')?.value;
    if(!g) return alert("学年を選択してください");
    if(!rawData.typing) return alert("タイピングデータが読み込めていません。リロードしてください。");
    const qList = rawData.typing.filter(t => isGradeMatch(t.grade, g));
    if(qList.length === 0) return alert("選択した学年の問題がありません");
    playData.selectedBossHp = hp ? parseInt(hp, 10) : null;
    runtimeState.oathOrigin = 'typing';
    startTypingGame();
}

export function goToOathMenuTypingCheck() {
    const g = document.getElementById('typing-grade-select')?.value;
    const hp = document.getElementById('typing-boss-hp-select')?.value;
    if(!g) return alert("学年を選択してください");
    if(!rawData.typing) return alert("タイピングデータが読み込めていません");
    const qList = rawData.typing.filter(t => isGradeMatch(t.grade, g));
    if(qList.length === 0) return alert("選択した学年の問題がありません");
    playData.questions = qList;
    playData.selectedBossHp = hp ? parseInt(hp, 10) : null;
    document.getElementById('typing-menu-overlay')?.classList.add('hidden');
    runtimeState.oathOrigin = 'typing';
    openOathMenu();
}

export function goToReliefMenuTypingCheck() {
    const g = document.getElementById('typing-grade-select')?.value;
    const hp = document.getElementById('typing-boss-hp-select')?.value;
    if(!g) return alert("学年を選択してください");
    if(!rawData.typing) return alert("タイピングデータが読み込めていません");
    const qList = rawData.typing.filter(t => isGradeMatch(t.grade, g));
    if(qList.length === 0) return alert("選択した学年の問題がありません");
    playData.questions = qList;
    playData.selectedBossHp = hp ? parseInt(hp, 10) : null;
    document.getElementById('typing-menu-overlay')?.classList.add('hidden');
    runtimeState.oathOrigin = 'typing';
    openReliefMenu();
}

export function startTypingGame() {
    const g = document.getElementById('typing-grade-select')?.value; 
    if(!g) return alert("学年を選択してください");
    if (!rawData.typing) return alert("タイピングデータが読み込めていません。リロードしてください。");
    const qList = rawData.typing.filter(t => isGradeMatch(t.grade, g)); 
    if(qList.length === 0) return alert("選択した学年の問題がありません");
    
    let boss = { name: "キーボードの魔人", hp: qList.length * 50, icon: "⌨️" };
    try { 
        if(rawData.bosses) { 
            const specificBoss = rawData.bosses.find(b => isGradeMatch(b.grade, g) && b.unit == 'タイピング'); 
            if(specificBoss) { 
                boss = { ...specificBoss }; 
                if(!boss.hp) boss.hp = qList.length * 50; 
            } else { 
                const gradeBoss = rawData.bosses.find(b => isGradeMatch(b.grade, g)); 
                if(gradeBoss) { 
                    boss = { ...gradeBoss }; 
                    boss.hp = qList.length * 50; 
                    boss.name = "【打鍵】" + boss.name; 
                } 
            } 
        } 
    } catch(e) {}
    if(playData.selectedBossHp) boss.hp = playData.selectedBossHp;
    
    playData.questions = qList.sort(() => Math.random() - 0.5); 
    playData.qIndex = 0; 
    playData.currentBoss = boss;
    playData.isRevenge = false; 
    if (runtimeState.oathOrigin === 'typing') {
        playData.activeOaths = [...runtimeState.tempOaths];
        playData.activeReliefs = [...runtimeState.tempReliefs];
    } else {
        playData.activeOaths = []; 
        playData.activeReliefs = []; 
    }
    playData.isRandom = false; 
    playData.isTyping = true; 
    playData.isCalculation = false; 
    playData.isSurvival = false; 
    playData.context = null;
    runtimeState.currentCategory = null;
    
    const charaStats = getCharaStats();
    let initialLives = 5;
    if (playData.activeOaths.includes('backwater')) initialLives = 1;
    else if (playData.activeReliefs.includes('life')) initialLives = 7;

    let baseTime = 10;
    if (playData.activeOaths.includes('rapid')) baseTime = 5;
    else if (playData.activeReliefs.includes('time')) baseTime = 20;

    gameState.score = 0; 
    gameState.combo = 0; 
    gameState.lives = initialLives; 
    gameState.enemyHP = Number(boss.hp) || 3000; 
    gameState.maxHP = gameState.enemyHP; 
    gameState.maxTime = baseTime * charaStats.time; 
    runtimeState.isGameActive = false; 
    runtimeState.isPaused = false;
    playData.currentSP = 0;
    playData.bonusExp = 0;
    updateSpUI();
    
    document.getElementById('typing-menu-overlay')?.classList.add('hidden'); 
    document.getElementById('title-screen')?.classList.add('hidden'); 
    document.getElementById('game-screen')?.classList.remove('hidden');
    document.getElementById('cat-main-overlay')?.classList.add('hidden');
    
    document.getElementById('ui-choices')?.classList.add('hidden'); 
    document.getElementById('ui-typing-area')?.classList.remove('hidden'); 
    document.getElementById('ui-question')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden'); 
    document.getElementById('calc-keypad')?.classList.add('hidden'); 
    document.getElementById('calc-layout')?.classList.add('hidden'); 
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';

    const enemyBox = document.querySelector('.enemy-visual-box'); 
    const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); 
    if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    
    const uiEnemyName = document.getElementById('ui-enemy-name'); 
    if(uiEnemyName) uiEnemyName.innerText = boss.name;
    if(enemyIcon) {
        if(boss.icon && boss.icon.startsWith('http')) { 
            enemyIcon.innerHTML = renderSafeImg(boss.icon, '👾'); 
        } else { 
            enemyIcon.innerHTML = boss.icon || "👾"; 
        }
    }

    const uiScoreSpan = document.getElementById('ui-score');
    if (uiScoreSpan && uiScoreSpan.previousSibling && uiScoreSpan.previousSibling.nodeType === 3) {
        uiScoreSpan.previousSibling.nodeValue = "SCORE ";
    }
    const uiComboSpan = document.getElementById('ui-combo');
    if (uiComboSpan && uiComboSpan.previousSibling && uiComboSpan.previousSibling.nodeType === 3) {
        uiComboSpan.previousSibling.nodeValue = "COMBO ";
    }

    if (typeof window !== 'undefined') {
        document.removeEventListener('keydown', handleTypingInput); 
        document.addEventListener('keydown', handleTypingInput);
    }
    const timerBar = document.getElementById('ui-timer'); 
    if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); 
    if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);
    
    const uiTypingJp = document.getElementById('ui-typing-jp'); 
    if(uiTypingJp) uiTypingJp.innerText = "READY..."; 
    const uiTypingRomaji = document.getElementById('ui-typing-romaji'); 
    if(uiTypingRomaji) uiTypingRomaji.innerHTML = "";

    updateUI(); 
    startCountdown();
}

export function nextTypingQuestion() {
    if (!runtimeState.isGameActive) return;
    if (playData.qIndex >= playData.questions.length) { 
        playData.questions.sort(() => Math.random() - 0.5); 
        playData.qIndex = 0; 
    }
    playData.typingTarget = { ...playData.questions[playData.qIndex] };
    playData.typingIndex = 0;
    playData.typingMissed = false;
    if (typeof window !== 'undefined' && typeof window.StudyelEngine?.onQuestionStart === 'function') {
        window.StudyelEngine.onQuestionStart(playData.typingTarget);
    }
    renderTypingRomaji();
    startTimer();
}

export function renderTypingRomaji() {
    const jpBox = document.getElementById('ui-typing-jp');
    const romeBox = document.getElementById('ui-typing-romaji');
    if (!jpBox || !romeBox || !playData.typingTarget) return;
    
    jpBox.innerText = playData.typingTarget.japanese;
    const str = playData.typingTarget.romaji;
    const idx = playData.typingIndex;
    
    const done = str.substring(0, idx);
    const curr = str.substring(idx, idx + 1);
    const rest = str.substring(idx + 1);
    
    romeBox.innerHTML = `<span class="typing-char-done">${done}</span><span class="typing-char-current">${curr}</span><span class="typing-char-rest">${rest}</span>`;
}

export function handleTypingInput(e) {
    if (!runtimeState.isGameActive || runtimeState.isPaused) return;
    if (playData.isCalculation && !playData.isTyping) {
        if (e.key >= '0' && e.key <= '9') { 
            if (playData.calcInput.length < 5) playData.calcInput += e.key; 
            renderCalcInput(); 
            return; 
        }
        if (e.key === 'Backspace') { 
            playData.calcInput = playData.calcInput.slice(0, -1); 
            renderCalcInput(); 
            return; 
        }
        if (e.key === 'Enter') { 
            submitCalcAnswer(); 
            return; 
        }
        if (e.key.toLowerCase() === 'c') { 
            playData.calcInput = ''; 
            renderCalcInput(); 
            return; 
        } 
        return;
    }
    if(!playData.isTyping || !playData.typingTarget) return; 
    if(e.key.length > 1) return;
    
    const inputKey = e.key.toLowerCase(); 
    let targetStr = playData.typingTarget.romaji; 
    let idx = playData.typingIndex;
    let isMatch = (inputKey === targetStr[idx]);
    
    if (!isMatch) {
        const remainder = targetStr.substring(idx);
        const startPatterns = [ 
            {t:'chi', r:'ti'}, {t:'tsu', r:'tu'}, {t:'fu', r:'hu'}, {t:'ji', r:'zi'}, 
            {t:'ka', r:'ca'}, {t:'ku', r:'cu'}, {t:'ko', r:'co'}, {t:'se', r:'ce'}, 
            {t:'ja', r:'zya'}, {t:'ju', r:'zyu'}, {t:'jo', r:'zyo'}, {t:'cha', r:'tya'}, 
            {t:'chu', r:'tyu'}, {t:'cho', r:'tyo'} 
        ];
        for (let p of startPatterns) { 
            if (remainder.startsWith(p.t) && p.r.startsWith(inputKey)) { 
                const newStr = targetStr.substring(0, idx) + p.r + targetStr.substring(idx + p.t.length); 
                playData.typingTarget.romaji = newStr; 
                targetStr = newStr; 
                renderTypingRomaji(); 
                isMatch = true; 
                break; 
            } 
        }
        if (!isMatch && idx > 0) {
            const context = targetStr.substring(idx - 1); 
            const skipPatterns = [ 
                {t:'shi', r:'si'}, {t:'tsu', r:'tu'}, {t:'chi', r:'ti'}, {t:'sha', r:'sya'}, 
                {t:'shu', r:'syu'}, {t:'sho', r:'syo'}, {t:'sya', r:'sha'}, {t:'syu', r:'shu'}, 
                {t:'syo', r:'sho'}, {t:'cha', r:'cya'}, {t:'chu', r:'cyu'}, {t:'cho', r:'cyo'}, 
                {t:'cya', r:'cha'}, {t:'cyu', r:'chu'}, {t:'cyo', r:'cho'}, {t:'ja', r:'jya'}, 
                {t:'ju', r:'jyu'}, {t:'jo', r:'jyo'}, {t:'jya', r:'ja'}, {t:'jyu', r:'ju'}, {t:'jyo', r:'jo'} 
            ];
            for (let s of skipPatterns) { 
                if (context.startsWith(s.t) && s.r[1] === inputKey) { 
                    const pre = targetStr.substring(0, idx - 1); 
                    const post = targetStr.substring(idx - 1 + s.t.length); 
                    const newStr = pre + s.r + post; 
                    playData.typingTarget.romaji = newStr; 
                    targetStr = newStr; 
                    renderTypingRomaji(); 
                    isMatch = true; 
                    break; 
                } 
            }
        }
        if (!isMatch && inputKey === 'n' && idx > 0) { 
            const prevChar = targetStr[idx - 1];
            const prevPrevChar = idx >= 2 ? targetStr[idx - 2] : null;
            const currentChar = targetStr[idx];
            if (prevChar === 'n' && prevPrevChar !== 'n' && currentChar !== 'n' && !['a','i','u','e','o','y'].includes(currentChar)) { 
                const pre = targetStr.substring(0, idx); 
                const post = targetStr.substring(idx); 
                const newStr = pre + 'n' + post; 
                playData.typingTarget.romaji = newStr; 
                targetStr = newStr; 
                renderTypingRomaji(); 
                isMatch = true; 
            } 
        }
    }
    if(isMatch) {
        playData.typingIndex++; 
        playSE('type_hit'); 
        renderTypingRomaji();
        if(playData.typingIndex >= playData.typingTarget.romaji.length) {
            clearInterval(gameState.timer);
            // スタディエルへの単語正解通知
            if (typeof window !== 'undefined' && typeof window.StudyelEngine?.onAnswer === 'function') {
                window.StudyelEngine.onAnswer(true, playData.typingTarget);
            }
            // ファーム（牧場）EXP分配
            addFarmExp(playData.typingTarget);
            const stats = getCharaStats(); 
            const baseAtk = 100; 
            const rawRatio = gameState.timeLeft / gameState.maxTime; 
            const timeFactor = 0.2 + (rawRatio * 0.8);
            const statFactor = stats.atk + ((stats.time - 1) * 0.5); 
            const studyelBonusD = (typeof window !== 'undefined' && typeof window.StudyelEngine?.getComboDamageBonus === 'function')
                ? window.StudyelEngine.getComboDamageBonus(gameState.combo)
                : 0.0;
            const comboAdd = Math.min(gameState.combo * 0.025, 1.0) + studyelBonusD;
            let damage = Math.floor(baseAtk * timeFactor * (statFactor + comboAdd));
            gameState.enemyHP = Math.max(0, gameState.enemyHP - damage); 
            gameState.score += damage; 
            gameState.combo++; 
            if (gameState.combo > 0 && gameState.combo % 5 === 0) {
                addSP(1);
            }
            showCutIn("-" + damage);
            gameState.stats.totalCorrect = (gameState.stats.totalCorrect || 0) + 1;
            gameState.stats.maxCombo = Math.max(gameState.stats.maxCombo || 0, gameState.combo);
            if (typeof updateMissionProgress === 'function') {
                updateMissionProgress('correct', 1);
                updateMissionProgress('maxCombo', gameState.combo);
            }
            const enemyIcon = document.getElementById('ui-enemy-icon'); 
            if(enemyIcon) { 
                enemyIcon.classList.remove('shake-anim'); 
                void enemyIcon.offsetWidth; 
                enemyIcon.classList.add('shake-anim'); 
            } 
            updateUI();
            if(gameState.enemyHP <= 0) { 
                setTimeout(() => runtimeState.isGameActive && finishGame(true), 500); 
            } else { 
                playData.qIndex++; 
                setTimeout(() => { if(runtimeState.isGameActive) nextTypingQuestion(); }, 200); 
            }
        }
    } else { 
        playSE('type_miss'); 
        if (!playData.typingMissed) { 
            gameState.lives--; 
            playData.typingMissed = true; 
        } 
        gameState.combo = 0; 
        showCutIn("✕"); 
        updateUI(); 
        const romeBox = document.getElementById('ui-typing-romaji'); 
        if(romeBox) { 
            romeBox.classList.add('shake-anim'); 
            setTimeout(()=>romeBox.classList.remove('shake-anim'), 400); 
        } 
        if(gameState.lives <= 0) { 
            finishGame(false); 
        } 
    }
}

// ==========================================
// 計算クエスト
// ==========================================
export function startCalcGame() {
    const calcType = document.getElementById('calc-type-select')?.value;
    const calcMode = document.getElementById('calc-mode-select')?.value;
    if (!calcType || !calcMode) return alert("問題形式とタイムアタックモードを選択してください");

    const hand = document.querySelector('input[name="calc-hand"]:checked')?.value || 'right';
    playData.handPreference = hand;
    playData.calcType = calcType;
    playData.calcMode = calcMode;
    playData.isCalculation = true;
    playData.isTyping = false;
    playData.isRandom = false;
    playData.isRevenge = false;
    playData.isSurvival = false;
    playData.activeOaths = [];
    playData.activeReliefs = [];

    playData.calcQIndex = 0;
    playData.calcCorrect = 0;
    playData.calcInput = '';
    playData.calcElapsed = 0;
    playData.calcTimeLeft = 180;
    playData.calcCountTarget = calcMode === '100q' ? 100 : 0;

    document.getElementById('calc-overlay')?.classList.add('hidden');
    document.getElementById('title-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');
    document.getElementById('cat-special-overlay')?.classList.add('hidden');

    document.getElementById('ui-choices')?.classList.add('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.remove('hidden');
    document.getElementById('calc-layout')?.classList.remove('hidden');
    document.getElementById('ui-calc-answer')?.classList.remove('hidden');
    document.getElementById('calc-keypad')?.classList.remove('hidden');

    const layout = document.getElementById('calc-layout');
    if (layout) {
        layout.classList.remove('right-hand', 'left-hand');
        layout.classList.add(hand === 'left' ? 'left-hand' : 'right-hand');
    }

    const enemyRow = document.querySelector('.enemy-stats-row');
    if (enemyRow) enemyRow.style.display = 'none';

    const uiScoreSpan = document.getElementById('ui-score');
    if (uiScoreSpan && uiScoreSpan.previousSibling && uiScoreSpan.previousSibling.nodeType === 3) {
        uiScoreSpan.previousSibling.nodeValue = "問題 ";
    }
    const uiComboSpan = document.getElementById('ui-combo');
    if (uiComboSpan && uiComboSpan.previousSibling && uiComboSpan.previousSibling.nodeType === 3) {
        uiComboSpan.previousSibling.nodeValue = "正解 ";
    }

    runtimeState.isGameActive = false;
    runtimeState.isPaused = false;
    gameState.lives = 3;
    gameState.score = 0;
    gameState.combo = 0;

    const uienemyName = document.getElementById('ui-enemy-name');
    if (uienemyName) uienemyName.innerText = "CALC TRIAL";
    const enemyIcon = document.getElementById('ui-enemy-icon');
    if (enemyIcon) enemyIcon.innerText = "🧮";

    if (typeof window !== 'undefined') {
        document.removeEventListener('keydown', handleTypingInput);
        document.addEventListener('keydown', handleTypingInput);
    }

    updateUI();
    renderCalcInput();
    renderCalcProgress();
    startCountdown();
}

export function renderCalcInput() { 
    const ans = document.getElementById('ui-calc-answer'); 
    if(ans) ans.innerText = playData.calcInput || '---'; 
}

export function renderCalcProgress() {
    const progress = playData.calcMode === '100q' ? `${playData.calcQIndex}/${playData.calcCountTarget} 問` : `${playData.calcCorrect} 正解`; 
    const timeText = playData.calcMode === '3min' ? `${Math.max(0, playData.calcTimeLeft).toFixed(1)}秒` : `${playData.calcElapsed.toFixed(1)}秒`;
    const uiCalcProg = document.getElementById('ui-calc-progress'); 
    if(uiCalcProg) uiCalcProg.innerText = `${progress} ／ ${timeText}`;
    const bar = document.getElementById('ui-timer');
    if (playData.calcMode === '100q' && playData.calcCountTarget > 0 && bar) { 
        bar.style.width = Math.min(100, (playData.calcQIndex / playData.calcCountTarget) * 100) + '%'; 
    } else if (playData.calcMode === '3min' && bar) { 
        bar.style.width = Math.max(0, playData.calcTimeLeft / 180 * 100) + '%'; 
    }
}

export function handleCalcButton(value) {
    if (!playData.isCalculation || runtimeState.isPaused) return;
    if (value === 'C') { 
        playData.calcInput = ''; 
    } else if (value === 'OK') { 
        submitCalcAnswer(); 
        return; 
    } else { 
        if (playData.calcInput.length < 5) playData.calcInput += value; 
    }
    renderCalcInput();
}

export function submitCalcAnswer() {
    if (!playData.currentQ || playData.calcInput === '') return;
    const userValue = parseInt(playData.calcInput, 10); 
    const isCorrect = userValue === playData.currentQ.answer;
    const answerBox = document.getElementById('ui-calc-answer'); 
    if(answerBox) answerBox.classList.remove('correct', 'wrong');
    const enemyIcon = document.getElementById('ui-enemy-icon');
    if (isCorrect) {
        playSE('hit'); 
        playData.calcCorrect += 1; 
        gameState.score += 1; 
        if(answerBox) answerBox.classList.add('correct');
        gameState.stats.totalCorrect = (gameState.stats.totalCorrect || 0) + 1;
        if (typeof updateMissionProgress === 'function') {
            updateMissionProgress('correct', 1);
        }
        if (enemyIcon) { 
            enemyIcon.classList.remove('shake-anim'); 
            void enemyIcon.offsetWidth; 
            enemyIcon.classList.add('shake-anim'); 
        } 
        showCutIn('GOOD!');
    } else { 
        playSE('miss'); 
        if(answerBox) answerBox.classList.add('wrong'); 
        showCutIn('✕'); 
    }
    
    playData.calcQIndex += 1; 
    playData.calcInput = ''; 
    renderCalcInput(); 
    updateUI();
    if(answerBox) setTimeout(() => answerBox.classList.remove('correct', 'wrong'), 420);
    
    if (playData.calcMode === '100q' && playData.calcQIndex >= playData.calcCountTarget) { 
        finishGame(true); 
        return; 
    }
    nextCalcQuestion();
}

export function nextCalcQuestion() {
    if (!playData.isCalculation) return;
    playData.currentQ = generateCalcQuestion(playData.calcType); 
    const uiQ = document.getElementById('ui-question'); 
    if(uiQ) uiQ.innerText = playData.currentQ.q; 
    renderCalcInput(); 
    renderCalcProgress();
}

export function startCalcTimer() {
    if (gameState.timer) clearInterval(gameState.timer);
    const bar = document.getElementById('ui-timer');
    gameState.timer = setInterval(() => {
        if (runtimeState.isPaused || !runtimeState.isGameActive) return;
        if (playData.calcMode === '3min') {
            playData.calcTimeLeft -= 0.1;
            if(bar) bar.style.width = Math.max(0, playData.calcTimeLeft / 180 * 100) + '%';
            const timerText = document.getElementById('ui-timer-text');
            if(timerText) timerText.innerText = Math.max(0, playData.calcTimeLeft).toFixed(1);
            renderCalcProgress();
            if (playData.calcTimeLeft <= 0) { 
                clearInterval(gameState.timer); 
                finishGame(true); 
            }
        } else {
            playData.calcElapsed += 0.1; 
            const timerText = document.getElementById('ui-timer-text');
            if(timerText) timerText.innerText = playData.calcElapsed.toFixed(1);
            if (playData.calcCountTarget > 0 && bar) { 
                bar.style.width = Math.min(100, (playData.calcQIndex / playData.calcCountTarget) * 100) + '%'; 
            }
            renderCalcProgress();
        }
    }, 100);
}

// ==========================================
// リベンジモード
// ==========================================
export function startRevengeMode() {
    const list = gameState.revengeList || [];
    if (list.length === 0) return alert("リベンジ対象の問題はありません！");
    let qList = (rawData.questions || []).filter(q => list.includes(q.id) && q.choices && q.choices.length >= 2);
    if (qList.length === 0) { 
        gameState.revengeList = []; 
        saveGame(); 
        if (typeof updateTitleInfo === 'function') updateTitleInfo(); 
        return alert("対象の問題が見つかりませんでした。リストをクリアしました。"); 
    }
    
    qList.sort(() => Math.random() - 0.5);
    playData.questions = qList;
    playData.isRevenge = true;
    playData.isRandom = false;
    playData.isTyping = false;
    playData.isCalculation = false;
    playData.isSurvival = false;
    playData.context = null;
    playData.activeOaths = [];
    playData.activeReliefs = [];
    runtimeState.currentCategory = null;
    
    const charaStats = getCharaStats();
    runtimeState.isGameActive = false; 
    runtimeState.isPaused = false; 
    gameState.lives = 3; 
    gameState.score = 0; 
    gameState.combo = 0; 
    playData.qIndex = 0;
    gameState.maxTime = 10 * charaStats.time;
    gameState.timeLeft = gameState.maxTime;
    gameState.maxHP = playData.questions.length * 100;
    gameState.enemyHP = gameState.maxHP;

    document.getElementById('pause-overlay')?.classList.add('hidden');
    document.getElementById('title-screen')?.classList.add('hidden'); 
    document.getElementById('game-screen')?.classList.remove('hidden'); 
    document.getElementById('cat-main-overlay')?.classList.add('hidden');
    document.getElementById('cat-special-overlay')?.classList.add('hidden');
    document.getElementById('cat-gacha-overlay')?.classList.add('hidden');
    document.getElementById('cat-achievement-overlay')?.classList.add('hidden');
    document.getElementById('cat-guide-overlay')?.classList.add('hidden');

    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';

    const enemyBox = document.querySelector('.enemy-visual-box'); 
    const enemyIcon = document.getElementById('ui-enemy-icon'); 
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); 
    if(enemyIcon) enemyIcon.classList.remove('shake-anim');

    const uienemyName = document.getElementById('ui-enemy-name'); 
    if(uienemyName) uienemyName.innerText = "リベンジ・シャドウ"; 
    if(enemyIcon) enemyIcon.innerText = "💀"; 

    const timerBar = document.getElementById('ui-timer'); 
    if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); 
    if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);

    updateUI(); 
    startCountdown();
}

// ==========================================
// 誓約・救済
// ==========================================
export function toggleOath(type) {
    const opt = document.getElementById(`oath-${type}`);
    if (!opt) return;
    if (runtimeState.tempOaths.includes(type)) {
        runtimeState.tempOaths = runtimeState.tempOaths.filter(t => t !== type);
        opt.classList.remove('selected');
    } else {
        runtimeState.tempOaths.push(type);
        opt.classList.add('selected');
    }
}

export function toggleRelief(type) {
    const opt = document.getElementById(`relief-${type}`);
    if (!opt) return;
    if (runtimeState.tempReliefs.includes(type)) {
        runtimeState.tempReliefs = runtimeState.tempReliefs.filter(t => t !== type);
        opt.classList.remove('selected');
    } else {
        runtimeState.tempReliefs.push(type);
        opt.classList.add('selected');
    }
}

export function startOathGame() {
    if (runtimeState.tempOaths.length === 0) return alert("誓約を1つ以上選択してください。");
    runtimeState.tempReliefs = [];
    playData.activeOaths = [...runtimeState.tempOaths];
    playData.activeReliefs = [];
    document.getElementById('oath-overlay')?.classList.add('hidden');
    if (runtimeState.oathOrigin === 'survival') {
        startSurvivalGame();
    } else if (runtimeState.oathOrigin === 'random') {
        startRandomGame();
    } else if (runtimeState.oathOrigin === 'typing') {
        startTypingGame();
    } else {
        startGame();
    }
}

export function startReliefGame() {
    if (runtimeState.tempReliefs.length === 0) return alert("救済を1つ以上選択してください。");
    runtimeState.tempOaths = [];
    playData.activeReliefs = [...runtimeState.tempReliefs];
    playData.activeOaths = [];
    document.getElementById('relief-overlay')?.classList.add('hidden');
    if (runtimeState.oathOrigin === 'survival') {
        startSurvivalGame();
    } else if (runtimeState.oathOrigin === 'random') {
        startRandomGame();
    } else if (runtimeState.oathOrigin === 'typing') {
        startTypingGame();
    } else {
        startGame();
    }
}

