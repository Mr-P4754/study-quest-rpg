// ==========================================
// app-game.js (ゲーム進行・バトルエンジン)
// ==========================================

function showCutIn(t) { 
    const d = document.createElement('div'); 
    d.className='cutin'; 
    d.innerText=t; 
    if(String(t).includes('MISS')) { 
        d.style.color='#bdc3c7'; 
        d.style.webkitTextStroke='2px #2c3e50'; 
    } 
    document.body.appendChild(d); 
    setTimeout(()=>d.remove(), 1500); 
}

function updateUI() { 
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

function togglePause() { 
    isPaused = !isPaused; 
    const overlay = document.getElementById('pause-overlay');
    if(overlay) overlay.classList.toggle('hidden', !isPaused);
    if(isPaused) {
        const infoBox = document.getElementById('pause-chara-info');
        if(!infoBox) return;
        const charaId = gameState.equipped;
        const chara = rawData.characters ? rawData.characters.find(c => c.id == charaId) : null;
        if(chara) {
            const inv = gameState.charaInventory[charaId] || { level: 1 };
            const baseVal = (inv.isEvolved && inv.customValue) ? inv.customValue : chara.value;
            const r = inv.currentRarity || chara.rarity;
            const name = getDisplayName(chara, inv);
            let val = Number(baseVal) + (inv.level * LV_BONUS_RATE);
            let visual = "";
            if(chara.imageUrl && chara.imageUrl.startsWith('http')) visual = `<img src="${chara.imageUrl}" style="width:60px;height:60px;object-fit:contain;background:#fff;border-radius:5px;">`; else visual = `<div style="font-size:40px;">✏️</div>`;
            infoBox.innerHTML = `<div style="display:flex; align-items:center; gap:10px; text-align:left;">${visual}<div><div style="font-weight:bold; color:#ecf0f1; font-size:0.9em;">${name}</div><div style="color:#f39c12; font-weight:bold; font-size:0.8em;">Lv.${inv.level}</div><div style="font-size:0.7em; color:#bdc3c7;"><span class="rarity-${r}" style="font-weight:bold; font-size:1.2em; margin-right:5px;">${r}</span>効果: x${val.toFixed(2)}</div></div></div>`;
        } else { infoBox.innerHTML = `<div style="color:#bdc3c7; font-size:0.8em;">装備なし</div>`; }
    }
}

function resumeGame() { isPaused = false; document.getElementById('pause-overlay')?.classList.add('hidden'); }
async function retryGame() { 
    if (!(await showConfirm("やり直しますか？"))) return; 
    isGameActive=false; clearInterval(gameState.timer); resumeGame(); 
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
    
    if (playData.isCalculation) { startCalcGame(); }
    else if (playData.isTyping) { startTypingGame(); }
    else if (playData.isSurvival) { startSurvivalGame(); }
    else if (playData.isRandom) { startRandomGame(); }
    else if (playData.activeOaths && playData.activeOaths.length > 0) { startOathGame(); }
    else if (playData.isRevenge) { startRevengeMode(); }
    else if (typeof rogueData !== 'undefined' && rogueData.active) { alert("探索モード中はリトライできません。"); resumeGame(); }
    else { startGame(); }
}
async function backToTitleFromPause() { if (!(await showConfirm("戻りますか？"))) return; isGameActive=false; clearInterval(gameState.timer); backToTitle(); }

function startCountdown() {
    const qBox = document.getElementById('ui-question'); const cGrid = document.getElementById('ui-choices');
    if(qBox) qBox.innerText = "READY..."; if(cGrid) cGrid.innerHTML = ""; 
    let count = 3; showCutIn(count); playSE('count'); 
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        if (document.getElementById('game-screen')?.classList.contains('hidden')) { clearInterval(countdownTimer); return; }
        count--;
        if(count > 0) { showCutIn(count); playSE('count'); } 
        else if(count === 0) { showCutIn("GO!"); playSE('start'); } 
        else {
            clearInterval(countdownTimer); isGameActive = true;
            if (playData.isCalculation) { nextCalcQuestion(); startCalcTimer(); } 
            else if(playData.isTyping) { nextTypingQuestion(); } 
            else { nextQuestion(); }
            playBGM();
        }
    }, 1000);
}

function startTimer() { 
    if(gameState.timer) clearInterval(gameState.timer); 
    if(!isGameActive) return; 
    
    if (!playData.isSurvival) {
        gameState.timeLeft = gameState.maxTime; 
    } else if (!gameState.timeLeft || gameState.timeLeft <= 0) {
        gameState.timeLeft = gameState.maxTime;
    }
    
    const bar = document.getElementById('ui-timer'); 
    gameState.timer = setInterval(() => { 
        if(isPaused || !isGameActive) return; 
        gameState.timeLeft -= 0.1; 
        if(bar) bar.style.width = (gameState.timeLeft / gameState.maxTime * 100) + '%'; 
        document.getElementById('ui-timer-text').innerText = Math.max(0, gameState.timeLeft).toFixed(1); 
        if(gameState.timeLeft <= 0) { clearInterval(gameState.timer); judge(false, null); } 
    }, 100); 
}

function startCalcTimer() {
    if (gameState.timer) clearInterval(gameState.timer);
    const bar = document.getElementById('ui-timer');
    gameState.timer = setInterval(() => {
        if (isPaused || !isGameActive) return;
        if (playData.calcMode === '3min') {
            playData.calcTimeLeft -= 0.1;
            if(bar) bar.style.width = Math.max(0, playData.calcTimeLeft / 180 * 100) + '%';
            document.getElementById('ui-timer-text').innerText = Math.max(0, playData.calcTimeLeft).toFixed(1);
            renderCalcProgress();
            if (playData.calcTimeLeft <= 0) { clearInterval(gameState.timer); finishGame(true); }
        } else {
            playData.calcElapsed += 0.1; document.getElementById('ui-timer-text').innerText = playData.calcElapsed.toFixed(1);
            if (playData.calcCountTarget > 0 && bar) { bar.style.width = Math.min(100, (playData.calcQIndex / playData.calcCountTarget) * 100) + '%'; }
            renderCalcProgress();
        }
    }, 100);
}

function getCharaStats() {
    let stats = { atk: 1.0, time: 1.0, exp: 1.0 };
    if(rawData.characters && rawData.characters.length > 0) {
        const charaData = rawData.characters.find(c => c.id == gameState.equipped);
        if(charaData) {
            let userChara = gameState.charaInventory[gameState.equipped];
            let level = userChara ? userChara.level : 0;
            let baseVal = (userChara && userChara.isEvolved && userChara.customValue) ? userChara.customValue : Number(charaData.value);
            let finalVal = baseVal + (level * LV_BONUS_RATE);
            let skills = (userChara && userChara.skills && userChara.skills.length > 0) ? userChara.skills : [charaData.type];
            skills.forEach(type => { if(type === 'ALL') { stats.atk = finalVal; stats.time = finalVal; stats.exp = finalVal; } else { if(type === 'ATK') stats.atk = finalVal; if(type === 'TIME') stats.time = finalVal; if(type === 'EXP') stats.exp = finalVal; } });
        }
    }
    if(gameState.itemLevels && rawData.shopItems) {
        Object.keys(gameState.itemLevels).forEach(itemId => {
            const item = rawData.shopItems.find(i => i.id === itemId); const level = gameState.itemLevels[itemId];
            if(item && level > 0) { if(item.type === 'ATK') stats.atk += (Number(item.value) * level); if(item.type === 'TIME') stats.time += (Number(item.value) * level); if(item.type === 'EXP') stats.exp += (Number(item.value) * level); }
        });
    }
    if (playData.activeOaths && playData.activeOaths.includes('weak') && !playData.isSurvival) stats.atk *= 0.5;

    // ローグライクモードでのバフフック対応
    if (typeof rogueData !== 'undefined' && rogueData.active) {
        stats.atk *= rogueData.atkBuff;
        stats.atk *= (1.0 + (rogueData.exploreLevel - 1) * 0.005);
    }

    return stats;
}

function getDisplayName(char, inv) {
    if (!inv) return char.name; let name = char.name; const currentR = inv.currentRarity || char.rarity;
    if (getRarityIndex(currentR) > getRarityIndex(char.rarity)) name += '<span class="name-deco-evo">✨️</span>';
    if (inv.reincarnationCount && inv.reincarnationCount > 0) name += '<span class="name-deco-reborn">🪽</span>';
    return name;
}

function nextQuestion() {
    if(!isGameActive) return;
    if(playData.qIndex >= playData.questions.length) { 
        playData.questions.sort(()=>Math.random()-0.5); 
        playData.qIndex = 0; 
    }
    const q = playData.questions[playData.qIndex]; playData.currentQ = q;
    const qBox = document.getElementById('ui-question'); if(qBox) qBox.innerText = q.q;
    const choices = [...q.choices].sort(() => Math.random() - 0.5);
    const div = document.getElementById('ui-choices'); if(div) {
        div.innerHTML = '';
        choices.forEach(c => { const btn = document.createElement('button'); btn.className = 'choice-btn'; btn.innerText = c; btn.onclick = () => judge(String(c) === String(q.a), btn); div.appendChild(btn); });
    }
    startTimer();
}

function judge(isCorrect, btn) {
    if(isPaused || !isGameActive) return; clearInterval(gameState.timer);
    document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
    if(btn) btn.classList.add(isCorrect ? 'btn-correct' : 'btn-wrong');
    
    if(!isCorrect) {
        playSE('miss');
        if (playData.currentQ && playData.currentQ.id && !playData.isSurvival && !(typeof rogueData !== 'undefined' && rogueData.active)) { 
            if (!gameState.revengeList) gameState.revengeList = []; 
            if (!gameState.revengeList.includes(playData.currentQ.id)) { gameState.revengeList.push(playData.currentQ.id); saveGame(); } 
        }
        document.querySelectorAll('.choice-btn').forEach(b => { if(String(b.innerText) === String(playData.currentQ?.a)) b.classList.add('btn-miss-answer'); });
    }
    
    if (playData.currentQ && playData.currentQ.subject) { const subj = playData.currentQ.subject; if (!gameState.subjectStats[subj]) gameState.subjectStats[subj] = { correct: 0, total: 0 }; gameState.subjectStats[subj].total++; if (isCorrect) gameState.subjectStats[subj].correct++; }

    if(isCorrect) {
        playSE('hit');
        if (playData.isRevenge && playData.currentQ && playData.currentQ.id) { gameState.revengeList = gameState.revengeList.filter(id => String(id) !== String(playData.currentQ.id)); saveGame(); }
        document.querySelectorAll('.choice-btn').forEach(b => { if(String(b.innerText) === String(playData.currentQ?.a)) b.classList.add('btn-miss-answer'); });
        
        let damage = 0;
        if (playData.isSurvival) {
            gameState.score += 1; 
            gameState.timeLeft = Math.min(gameState.maxTime, gameState.timeLeft + 5.0); 
            const uienemyName = document.getElementById('ui-enemy-name'); 
            if(uienemyName) uienemyName.innerText = "WAVE: " + gameState.score;
            showCutIn("+5.0s");
        } else if (playData.isRevenge) { 
            damage = Math.ceil(gameState.maxHP / playData.questions.length); 
            gameState.enemyHP = Math.max(0, gameState.enemyHP - damage); gameState.score += damage; showCutIn("-" + damage);
        } else {
            const stats = getCharaStats(); const baseAtk = 100; const rawRatio = gameState.timeLeft / gameState.maxTime; const timeFactor = 0.2 + (rawRatio * 0.8);
            const statFactor = stats.atk + ((stats.time - 1) * 0.5); const comboAdd = Math.min(gameState.combo * 0.025, 1.0);
            damage = Math.floor(baseAtk * timeFactor * (statFactor + comboAdd));
            gameState.enemyHP = Math.max(0, gameState.enemyHP - damage); gameState.score += damage; showCutIn("-" + damage);
        }
        
        gameState.combo++; 
        gameState.stats.totalCorrect = (gameState.stats.totalCorrect || 0) + 1; gameState.stats.maxCombo = Math.max(gameState.stats.maxCombo || 0, gameState.combo);
        if ((gameState.maxTime - gameState.timeLeft) <= 1.0) { gameState.stats.achieved_speed = true; saveGame(); }
        
        const enemyIcon = document.getElementById('ui-enemy-icon'); if(enemyIcon) { enemyIcon.classList.remove('shake-anim'); void enemyIcon.offsetWidth; enemyIcon.classList.add('shake-anim'); }
        updateMissionProgress('correct', 1); updateMissionProgress('maxCombo', gameState.combo); updateUI();
        
        if(!playData.isSurvival && gameState.enemyHP <= 0) { 
            const enemyBox = document.querySelector('.enemy-visual-box'); if(enemyBox) { enemyBox.classList.add('anim-paused'); enemyBox.classList.add('fade-out'); } 
            setTimeout(() => isGameActive && finishGame(true), 1200); 
        } else { 
            playData.qIndex++; setTimeout(() => isGameActive && nextQuestion(), 1000); 
        }
    } else {
        gameState.lives--; gameState.combo = 0; showCutIn("MISS..."); updateUI();
        if(gameState.lives <= 0) { setTimeout(() => isGameActive && finishGame(false), 1500); } else { setTimeout(() => { if(!isGameActive) return; if(playData.isTyping) nextTypingQuestion(); else nextQuestion(); }, 1500); }
    }
}

function nextTypingQuestion() {
    if (!isGameActive) return;
    if (playData.qIndex >= playData.questions.length) { playData.questions.sort(() => Math.random() - 0.5); playData.qIndex = 0; }
    playData.typingTarget = playData.questions[playData.qIndex];
    playData.typingIndex = 0;
    playData.typingMissed = false;
    if (typeof renderTypingUI === 'function') renderTypingUI();
    startTimer();
}

function handleTypingInput(e) {
    if (!isGameActive || isPaused) return;
    if (playData.isCalculation && !playData.isTyping) {
        if (e.key >= '0' && e.key <= '9') { if (playData.calcInput.length < 5) playData.calcInput += e.key; renderCalcInput(); return; }
        if (e.key === 'Backspace') { playData.calcInput = playData.calcInput.slice(0, -1); renderCalcInput(); return; }
        if (e.key === 'Enter') { submitCalcAnswer(); return; }
        if (e.key.toLowerCase() === 'c') { playData.calcInput = ''; renderCalcInput(); return; } return;
    }
    if(!playData.isTyping || !playData.typingTarget) return; if(e.key.length > 1) return;
    const inputKey = e.key.toLowerCase(); let targetStr = playData.typingTarget.romaji; let idx = playData.typingIndex;
    let isMatch = (inputKey === targetStr[idx]);
    if (!isMatch) {
        const remainder = targetStr.substring(idx);
        const startPatterns = [ {t:'chi', r:'ti'}, {t:'tsu', r:'tu'}, {t:'fu', r:'hu'}, {t:'ji', r:'zi'}, {t:'ka', r:'ca'}, {t:'ku', r:'cu'}, {t:'ko', r:'co'}, {t:'se', r:'ce'}, {t:'ja', r:'zya'}, {t:'ju', r:'zyu'}, {t:'jo', r:'zyo'}, {t:'cha', r:'tya'}, {t:'chu', r:'tyu'}, {t:'cho', r:'tyo'} ];
        for (let p of startPatterns) { if (remainder.startsWith(p.t) && p.r.startsWith(inputKey)) { const newStr = targetStr.substring(0, idx) + p.r + targetStr.substring(idx + p.t.length); playData.typingTarget.romaji = newStr; targetStr = newStr; if (typeof renderTypingUI === 'function') renderTypingUI(); isMatch = true; break; } }
        if (!isMatch && idx > 0) {
            const context = targetStr.substring(idx - 1); 
            const skipPatterns = [ {t:'shi', r:'si'}, {t:'tsu', r:'tu'}, {t:'chi', r:'ti'}, {t:'sha', r:'sya'}, {t:'shu', r:'syu'}, {t:'sho', r:'syo'}, {t:'sya', r:'sha'}, {t:'syu', r:'shu'}, {t:'syo', r:'sho'}, {t:'cha', r:'cya'}, {t:'chu', r:'cyu'}, {t:'cho', r:'cyo'}, {t:'cya', r:'cha'}, {t:'cyu', r:'chu'}, {t:'cyo', r:'cho'}, {t:'ja', r:'jya'}, {t:'ju', r:'jyu'}, {t:'jo', r:'jyo'}, {t:'jya', r:'ja'}, {t:'jyu', r:'ju'}, {t:'jyo', r:'jo'} ];
            for (let s of skipPatterns) { if (context.startsWith(s.t) && s.r[1] === inputKey) { const pre = targetStr.substring(0, idx - 1); const post = targetStr.substring(idx - 1 + s.t.length); const newStr = pre + s.r + post; playData.typingTarget.romaji = newStr; targetStr = newStr; if (typeof renderTypingUI === 'function') renderTypingUI(); isMatch = true; break; } }
        }
        if (!isMatch && inputKey === 'n' && idx > 0) { if (targetStr[idx-1] === 'n') { const pre = targetStr.substring(0, idx); const post = targetStr.substring(idx); const newStr = pre + 'n' + post; playData.typingTarget.romaji = newStr; targetStr = newStr; if (typeof renderTypingUI === 'function') renderTypingUI(); isMatch = true; } }
    }
    if(isMatch) {
        playData.typingIndex++; playSE('type_hit'); if (typeof renderTypingUI === 'function') renderTypingUI();
        if(playData.typingIndex >= playData.typingTarget.romaji.length) {
            clearInterval(gameState.timer);
            const stats = getCharaStats(); const baseAtk = 100; const rawRatio = gameState.timeLeft / gameState.maxTime; const timeFactor = 0.2 + (rawRatio * 0.8);
            const statFactor = stats.atk + ((stats.time - 1) * 0.5); const comboAdd = Math.min(gameState.combo * 0.025, 1.0);
            let damage = Math.floor(baseAtk * timeFactor * (statFactor + comboAdd));
            gameState.enemyHP = Math.max(0, gameState.enemyHP - damage); gameState.score += damage; gameState.combo++; showCutIn("-" + damage);
            const enemyIcon = document.getElementById('ui-enemy-icon'); if(enemyIcon) { enemyIcon.classList.remove('shake-anim'); void enemyIcon.offsetWidth; enemyIcon.classList.add('shake-anim'); } updateUI();
            if(gameState.enemyHP <= 0) { setTimeout(() => isGameActive && finishGame(true), 500); } else { playData.qIndex++; setTimeout(() => { if(isGameActive) nextTypingQuestion(); }, 200); }
        }
    } else { playSE('type_miss'); if (!playData.typingMissed) { gameState.lives--; playData.typingMissed = true; } gameState.combo = 0; showCutIn("MISS"); updateUI(); const romeBox = document.getElementById('ui-typing-romaji'); if(romeBox) { romeBox.classList.add('shake-anim'); setTimeout(()=>romeBox.classList.remove('shake-anim'), 400); } if(gameState.lives <= 0) { finishGame(false); } }
}

function generateCalcQuestion(type) {
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    let a, b, q = '', answer = 0;
    const actualType = type === 'random' ? ['addition','subtraction','multiplication','division','division_remainder'][Math.floor(Math.random() * 5)] : type;
    if (actualType === 'addition') { a = rand(0, 9); b = rand(0, 9); answer = a + b; q = `${a} + ${b} = ?`; } 
    else if (actualType === 'subtraction') { a = rand(10, 19); b = rand(0, 9); answer = a - b; q = `${a} - ${b} = ?`; } 
    else if (actualType === 'multiplication') { a = rand(1, 9); b = rand(1, 9); answer = a * b; q = `${a} × ${b} = ?`; } 
    else if (actualType === 'division') { b = rand(1, 9); answer = rand(1, 9); a = b * answer; q = `${a} ÷ ${b} = ?`; } 
    else if (actualType === 'division_remainder') { b = rand(1, 9); const quotient = rand(0, 9); const remainder = rand(0, b - 1); a = b * quotient + remainder; answer = quotient; q = `${a} ÷ ${b} = ?  (余り${remainder})`; }
    return { q, answer, type: actualType };
}

function renderCalcInput() { const ans = document.getElementById('ui-calc-answer'); if(ans) ans.innerText = playData.calcInput || '---'; }
function renderCalcProgress() {
    const progress = playData.calcMode === '100q' ? `${playData.calcQIndex}/${playData.calcCountTarget} 問` : `${playData.calcCorrect} 正解`; 
    const timeText = playData.calcMode === '3min' ? `${Math.max(0, playData.calcTimeLeft).toFixed(1)}秒` : `${playData.calcElapsed.toFixed(1)}秒`;
    const uiCalcProg = document.getElementById('ui-calc-progress'); if(uiCalcProg) uiCalcProg.innerText = `${progress} ／ ${timeText}`;
    const bar = document.getElementById('ui-timer');
    if (playData.calcMode === '100q' && playData.calcCountTarget > 0 && bar) { bar.style.width = Math.min(100, (playData.calcQIndex / playData.calcCountTarget) * 100) + '%'; } else if (playData.calcMode === '3min' && bar) { bar.style.width = Math.max(0, playData.calcTimeLeft / 180 * 100) + '%'; }
}

function handleCalcButton(value) {
    if (!playData.isCalculation || isPaused) return;
    if (value === 'C') { playData.calcInput = ''; } else if (value === 'OK') { submitCalcAnswer(); return; } else { if (playData.calcInput.length < 5) playData.calcInput += value; }
    renderCalcInput();
}

function submitCalcAnswer() {
    if (!playData.currentQ || playData.calcInput === '') return;
    const userValue = parseInt(playData.calcInput, 10); const isCorrect = userValue === playData.currentQ.answer;
    const answerBox = document.getElementById('ui-calc-answer'); if(answerBox) answerBox.classList.remove('correct', 'wrong');
    const enemyIcon = document.getElementById('ui-enemy-icon');
    if (isCorrect) {
        playSE('hit'); playData.calcCorrect += 1; gameState.score += 1; if(answerBox) answerBox.classList.add('correct');
        if (enemyIcon) { enemyIcon.classList.remove('shake-anim'); void enemyIcon.offsetWidth; enemyIcon.classList.add('shake-anim'); } showCutIn('GOOD!');
    } else { playSE('miss'); if(answerBox) answerBox.classList.add('wrong'); showCutIn('MISS'); }
    
    playData.calcQIndex += 1; 
    playData.calcInput = ''; 
    renderCalcInput(); 
    updateUI();
    if(answerBox) setTimeout(() => answerBox.classList.remove('correct', 'wrong'), 420);
    
    if (playData.calcMode === '100q' && playData.calcQIndex >= playData.calcCountTarget) { finishGame(true); return; }
    nextCalcQuestion();
}

function nextCalcQuestion() {
    if (!playData.isCalculation) return;
    playData.currentQ = generateCalcQuestion(playData.calcType); 
    const uiQ = document.getElementById('ui-question'); if(uiQ) uiQ.innerText = playData.currentQ.q; 
    renderCalcInput(); renderCalcProgress();
}

function addCalcRecord(entry) {
    const key = `${playData.calcType}_${playData.calcMode}`;
    if (!gameState.calcRecords) gameState.calcRecords = {}; if (!gameState.calcRecords[key]) gameState.calcRecords[key] = [];
    gameState.calcRecords[key].push(entry); gameState.calcRecords[key].sort((a,b) => { if (a.correct !== b.correct) return b.correct - a.correct; return a.time - b.time; });
    gameState.calcRecords[key] = gameState.calcRecords[key].slice(0, 10);
}

function finishGame(isClear) { 
    // 【変更】ローグライク探索中なら専用の勝利/敗北処理へ分岐
    if (typeof rogueData !== 'undefined' && rogueData.active) {
        isGameActive = false; clearInterval(gameState.timer);
        document.removeEventListener('keydown', handleTypingInput);
        stopBGM();

        if (isClear) {
            playSE('win');
            const stats = getCharaStats();
            const baseReward = 500;
            const floorBonus = rogueData.floor * 100;
            const earned = Math.floor((baseReward + floorBonus) * stats.exp * (1.0 + rogueData.exploreLevel * 0.005));
            
            rogueData.earnedXp += earned;

            // 【追加】撃破したキャラをインベントリに追加
            const charId = playData.rogueEnemyCharId;
            let getMsgHtml = "";
            if (charId) {
                const c = rawData.characters.find(x => x.id == charId);
                const cName = c ? c.name : "キャラ";
                const cRarity = c ? c.rarity : "N";
                if (!gameState.charaInventory[charId]) {
                    gameState.charaInventory[charId] = { level: 1, count: 1, exp: 0, currentRarity: cRarity };
                } else {
                    gameState.charaInventory[charId].count++;
                }
                getMsgHtml = `<span class="rarity-${cRarity}" style="font-weight:bold;">[${cRarity}]</span> ${cName} × 1`;
            }

            if (typeof updateRogueUI === 'function') updateRogueUI();

            // 【修正】通常のリッチなリザルト画面へ置き換え
            const resTitle = document.getElementById('res-title');
            if (resTitle) { resTitle.innerText = rogueData.isBossBattle ? "BOSS BATTLE CLEAR!" : "BATTLE WIN!"; resTitle.style.color = "#f1c40f"; }
            const resIcon = document.getElementById('res-icon');
            if (resIcon) resIcon.innerText = "⚔️";

            const resScoreSpan = document.getElementById('res-score');
            if (resScoreSpan && resScoreSpan.previousSibling && resScoreSpan.previousSibling.nodeType === 3) resScoreSpan.previousSibling.nodeValue = "進行階層: ";
            if (resScoreSpan) resScoreSpan.innerText = rogueData.floor + "F";

            const resDetails = document.getElementById('res-details');
            if (resDetails) {
                let html = `<div style="font-size: 1.2em; font-weight: bold; color: #2c3e50;">獲得探索EXP <span style="color:#e67e22;">+${earned}</span></div>`;
                if (rogueData.isBossBattle) html += `<div style="margin-top:5px; font-weight:bold; color:#c0392b;">🎊 ${rogueData.floor}階層踏破！</div>`;
                resDetails.innerHTML = html; resDetails.style.display = 'block';
            }

            const resDrop = document.getElementById('res-drop');
            if (resDrop) { resDrop.style.display = 'block'; resDrop.innerHTML = getMsgHtml ? `ドロップ: ${getMsgHtml}` : 'ドロップ: なし'; }
            
            const resXpLabel = document.getElementById('res-xp-label');
            if (resXpLabel) resXpLabel.innerText = "現在の一時EXP";
            const resXpSpan = document.getElementById('res-xp');
            if (resXpSpan) { resXpSpan.style.lineHeight = "1.1"; resXpSpan.innerHTML = `<span style="color:#f1c40f;">${rogueData.earnedXp}</span>`; }

            document.getElementById('game-screen')?.classList.add('hidden');
            document.getElementById('result-overlay')?.classList.remove('hidden');
        } else {
            playSE('lose');
            showAppModal("戦闘敗北...\n全滅したため拠点へ強制送還されます。", 'alert').then(() => {
                if (typeof exitRogueSystem === 'function') exitRogueSystem(false);
            });
        }
        return;
    }

    isGameActive=false; clearInterval(gameState.timer); 
    document.removeEventListener('keydown', handleTypingInput);
    stopBGM();

    let dropInfo = { count: 0, icon: '' };
    let calcRank = null;
    let earned = 0;
    let isCampaign = false;

    const resXpLabel = document.getElementById('res-xp-label');
    const resXpSpan = document.getElementById('res-xp');
    const resDrop = document.getElementById('res-drop');
    if (resXpLabel) resXpLabel.innerText = "獲得XP";
    if (resDrop) resDrop.style.display = 'block';
    
    if (playData.isSurvival) {
        const correctCount = gameState.score; 
        let oathMultiplier = 1;
        if (playData.activeOaths.length === 1) oathMultiplier = 2;
        else if (playData.activeOaths.length >= 2) oathMultiplier = 3;

        const eqInv = gameState.charaInventory[gameState.equipped];
        const cMaster = rawData.characters ? rawData.characters.find(c => c.id == gameState.equipped) : null;
        
        let isMax = false;
        if (eqInv && cMaster) {
            const maxL = RARITY_CAPS[eqInv.currentRarity || cMaster.rarity] || 10;
            if (eqInv.level >= maxL) isMax = true;
        }

        let milestoneBonus = isMax ? 0 : Math.floor(correctCount / 50) * 50;
        let earnedExp = (correctCount * oathMultiplier) + milestoneBonus;
        
        let growthResultText = "なし";
        
        if (eqInv && cMaster) {
            const maxL = RARITY_CAPS[eqInv.currentRarity || cMaster.rarity] || 10;
            let startLv = eqInv.level;
            let startExp = Number(eqInv.exp) || 0;
            let startStock = eqInv.count;
            
            eqInv.exp = startExp + earnedExp;
            while (eqInv.exp >= EXP_REQ) {
                eqInv.exp -= EXP_REQ;
                if (eqInv.level < maxL) { eqInv.level++; } 
                else { eqInv.count++; }
            }
            
            if (eqInv.level >= maxL && eqInv.count > startStock) {
                growthResultText = `<div style="font-size:0.4em; color:#7f8c8d;">Lv.MAX ストック ${startStock}</div><div style="color:#bdc3c7; font-size:0.4em; margin:5px 0;">↓</div><div style="font-size:0.5em; color:#e67e22;">Lv.MAX ストック ${eqInv.count}</div>`;
            } else {
                growthResultText = `<div style="font-size:0.45em; color:#7f8c8d; line-height:1.2;">Lv.${startLv} ${startExp}EXP</div><div style="color:#bdc3c7; font-size:0.4em; margin:2px 0;">↓</div><div style="font-size:0.5em; color:#e67e22; line-height:1.2;">Lv.${eqInv.level} ${eqInv.exp}EXP</div>`;
            }
        }
        
        gameState.stats.totalPlay = (gameState.stats.totalPlay || 0) + 1;
        if (typeof updateMissionProgress === 'function') updateMissionProgress('play', 1);
        saveGame();

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
        if (resXpLabel) resXpLabel.innerText = "成長結果";
        
        if(resXpSpan) {
            resXpSpan.style.lineHeight = "1.1";
            resXpSpan.innerHTML = growthResultText;
        }
        
        document.getElementById('game-screen')?.classList.add('hidden'); document.getElementById('result-overlay')?.classList.remove('hidden'); 
        if (typeof checkTitles === 'function') checkTitles();
        return; 
    }

    if (playData.isCalculation) {
        playSE(isClear ? 'win' : 'lose');
        const duration = playData.calcMode === '3min' ? 180 - playData.calcTimeLeft : playData.calcElapsed;
        const correct = playData.calcCorrect;
        const totalQ = playData.calcQIndex;
        const accuracy = totalQ > 0 ? (correct / totalQ) * 100 : 0;

        if (playData.calcMode === '3min') {
            if (correct >= 90) calcRank = 'S'; else if (correct >= 75) calcRank = 'A'; else if (correct >= 60) calcRank = 'B'; else if (correct >= 45) calcRank = 'C'; else calcRank = 'D';
        } else {
            if (correct === playData.calcCountTarget) { 
                if (duration <= 90 && accuracy >= 95) calcRank = 'S'; 
                else if (duration <= 120 && accuracy >= 90) calcRank = 'A'; 
                else if (duration <= 150 && accuracy >= 80) calcRank = 'B'; 
                else calcRank = 'C'; 
            } else if (correct >= 90 && accuracy >= 90) calcRank = 'A'; 
            else if (correct >= 80 && accuracy >= 80) calcRank = 'B'; 
            else if (correct >= 70 && accuracy >= 70) calcRank = 'C'; 
            else calcRank = 'D';
        }
        
        if (calcRank === 'S' || calcRank === 'A') gameState.stats.achieved_calcA = true;

        addCalcRecord({ correct, time: duration, date: new Date().toLocaleString('ja-JP') });
        if (correct > 0) {
            const basePage = calcRank === 'S' ? 5 : calcRank === 'A' ? 4 : calcRank === 'B' ? 3 : calcRank === 'C' ? 2 : 1;
            const pageCount = basePage * 10; 
            
            if (!gameState.inventory) gameState.inventory = {};
            if (!gameState.inventory.bluePages) gameState.inventory.bluePages = 0;
            if (!gameState.inventory.redPages) gameState.inventory.redPages = 0;
            
            gameState.inventory.bluePages += pageCount;
            gameState.inventory.redPages += pageCount;
            dropInfo = { count: pageCount, icon: '📕📘', isCalc: true };
        }
        gameState.stats.totalPlay = (gameState.stats.totalPlay || 0) + 1;
        if (typeof updateMissionProgress === 'function') updateMissionProgress('calc', 1);
        
        if (resXpLabel) resXpLabel.innerText = "最終評価";

    } else {
        if(isClear) {
            playSE('win');
            const eqInv = gameState.charaInventory[gameState.equipped];
            if (eqInv) {
                eqInv.exp = (Number(eqInv.exp) || 0) + 1;
                const cMaster = rawData.characters ? rawData.characters.find(c => c.id == gameState.equipped) : null;
                const maxL = RARITY_CAPS[eqInv.currentRarity || (cMaster ? cMaster.rarity : 'N')] || 10;
                if (eqInv.exp >= EXP_REQ && eqInv.level < maxL) { eqInv.exp -= EXP_REQ; eqInv.level++; }
            }
            if (!playData.isRevenge) {
                const subj = (playData.context ? playData.context.subject : "") || "";
                let dType = "";
                if (["国語", "社会", "英語"].some(k => subj.includes(k))) dType = "red";
                else if (["算数", "数学", "理科"].some(k => subj.includes(k))) dType = "blue";
                else dType = Math.random() < 0.5 ? "red" : "blue";
                const dCount = Math.floor(Math.random() * 4) + 2; 
                if (dType === "red") { gameState.inventory.redPages += dCount; dropInfo = { count: dCount, icon: '📕' }; }
                else { gameState.inventory.bluePages += dCount; dropInfo = { count: dCount, icon: '📘' }; }
            }
        } else playSE('lose');

        const stats = getCharaStats(); 
        let conditionRate = 1.0;
        const CAMPAIGN_RATE = 3.0;
        if (playData.context && rawData.config && !playData.isRevenge && !playData.isRandom && !playData.isTyping) {
            isCampaign = rawData.config.some(c => c.message && c.message !== "" && String(c.grade) === String(playData.context.grade) && String(c.subject) === String(playData.context.subject) && String(c.unit) === String(playData.context.unit));
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
        earned = Math.floor(partA + partB + partC);
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
            if (playData.activeOaths && playData.activeOaths.includes('backwater')) requiredLives = 1;
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
    
    const resTitle = document.getElementById('res-title'); if(resTitle) { resTitle.innerText=isClear?"QUEST CLEAR!":"GAME OVER"; resTitle.style.color=isClear?"#f1c40f":"#bdc3c7"; }
    const resIcon = document.getElementById('res-icon'); if(resIcon) resIcon.innerText=isClear?"🎉":"💔"; 
    
    const resScoreSpan = document.getElementById('res-score');
    if (resScoreSpan && resScoreSpan.previousSibling && resScoreSpan.previousSibling.nodeType === 3) {
        resScoreSpan.previousSibling.nodeValue = playData.isCalculation ? "総問題数: " : "獲得スコア: ";
    }
    if(resScoreSpan) resScoreSpan.innerText = playData.isCalculation ? playData.calcQIndex : gameState.score; 
    
    const dropHtml = dropInfo.count > 0 ? `<span>${dropInfo.icon}</span> ${dropInfo.count} 個` : 'なし';
    if(resDrop) resDrop.innerHTML = `入手アイテム: ${dropHtml}`;
    
    const resDetails = document.getElementById('res-details');
    if (!playData.isSurvival) {
        if (playData.isCalculation) {
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
    
    document.getElementById('game-screen')?.classList.add('hidden'); document.getElementById('result-overlay')?.classList.remove('hidden'); 
    if (typeof checkTitles === 'function') checkTitles();
}

function handleResultClose() {
    if (typeof rogueData !== 'undefined' && rogueData.active) {
        document.getElementById('result-overlay')?.classList.add('hidden');
        document.getElementById('field-screen')?.classList.remove('hidden');
        
        // 【追加】ボス戦だった場合は、リザルトを閉じた後に階層を進める
        if (rogueData.isBossBattle) {
            rogueData.floor++;
            generateRogueFloor();
        } else {
            if (typeof drawRogueMap === 'function') drawRogueMap();
        }
        playBGM();
    } else {
        backToTitle();
    }
}

function backToTitle() { 
    document.getElementById('result-overlay')?.classList.add('hidden'); document.getElementById('game-screen')?.classList.add('hidden'); document.getElementById('title-screen')?.classList.remove('hidden'); document.getElementById('pause-overlay')?.classList.add('hidden'); 
    if (countdownTimer) clearInterval(countdownTimer);
    clearInterval(gameState.timer); 
    isGameActive = false; isPaused = false; 
    document.removeEventListener('keydown', handleTypingInput);
    document.getElementById('ui-choices')?.classList.remove('hidden'); document.getElementById('ui-typing-area')?.classList.add('hidden'); document.getElementById('ui-question')?.classList.remove('hidden');
    
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

    playData.isTyping = false; playData.isCalculation = false; playData.isSurvival = false;
    stopBGM(); 
    if (typeof updateTitleInfo === 'function') updateTitleInfo(); 
    if (typeof updateMissionBadge === 'function') updateMissionBadge(); 
    if (typeof checkTitles === 'function') checkTitles();
}

// 音響管理
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isMuted = true;
function toggleMute() { 
    isMuted = !isMuted; const btn = document.getElementById('btn-mute'); 
    if(isMuted) { 
        if(btn) { btn.innerText = "🔇 音量: OFF"; btn.style.background = "#95a5a6"; btn.style.borderColor = "#7f8c8d"; }
        stopBGM(); 
    } else { 
        if(btn) { btn.innerText = "🔊 音量: ON"; btn.style.background = "#34495e"; btn.style.borderColor = "#2c3e50"; }
        playSE('hit'); if(isGameActive) playBGM(); 
    } 
}
function playSE(type) {
    if(isMuted) return;
    if(audioCtx.state === 'suspended') { audioCtx.resume().catch(e => console.warn('AudioContext resume was blocked', e)); }
    try {
        const osc = audioCtx.createOscillator(); const gainNode = audioCtx.createGain(); osc.connect(gainNode); gainNode.connect(audioCtx.destination); const now = audioCtx.currentTime;
        if (type === 'type_hit') { osc.type = 'triangle'; osc.frequency.setValueAtTime(1500, now); gainNode.gain.setValueAtTime(0.15, now); gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08); osc.start(now); osc.stop(now + 0.08); }
        else if (type === 'type_miss') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(50, now + 0.15); gainNode.gain.setValueAtTime(0.2, now); gainNode.gain.linearRampToValueAtTime(0.001, now + 0.15); osc.start(now); osc.stop(now + 0.15); }
        else if (type === 'hit') { osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1); } 
        else if (type === 'miss') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(100, now + 0.3); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3); }
        else if (type === 'win') { osc.type = 'square'; gainNode.gain.value = 0.1; [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => { const t = now + i * 0.1; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = 'square'; o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.1); o.start(t); o.stop(t + 0.1); }); }
        else if (type === 'lose') { osc.type = 'triangle'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(50, now + 1.0); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0.01, now + 1.0); osc.start(now); osc.stop(now + 1.0); }
        else if (type === 'count') { osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now); gainNode.gain.setValueAtTime(0.1, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
        else if (type === 'start') { osc.type = 'square'; osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(1760, now + 0.3); gainNode.gain.setValueAtTime(0.1, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3); }
    } catch(e) {}
}

const BGM_MML = "T150 L8 O3 G G > C C D C E F G G A G F E D C < B > C4 R4";
let bgmOscillators = []; let bgmTimeout = null;
let currentBgmAudio = null;

function playBGM() {
    if (isMuted) return; stopBGM(); 
    if (audioCtx.state === 'suspended') { audioCtx.resume().catch(e => console.warn('BGM resume blocked', e)); }
    
    let bgmUrl = null;
    const config = (rawData.config && rawData.config.length > 0) ? rawData.config[0] : {};

    if (typeof rogueData !== 'undefined' && rogueData.active && document.getElementById('game-screen')?.classList.contains('hidden')) {
        bgmUrl = config.exploreBgm;
    } else if (isGameActive) {
        if (playData.currentBoss && playData.currentBoss.bgmUrl) { bgmUrl = playData.currentBoss.bgmUrl; }
        else if (playData.isSurvival && config.survivalBgm) { bgmUrl = config.survivalBgm; }
        else if (playData.isTyping && config.typingBgm) { bgmUrl = config.typingBgm; }
        else if (playData.isCalculation && config.calcBgm) { bgmUrl = config.calcBgm; }
        else if (playData.isRandom && config.randomBgm) { bgmUrl = config.randomBgm; }
        else if (playData.isRevenge && config.revengeBgm) { bgmUrl = config.revengeBgm; }
        else { bgmUrl = config.defaultBattleBgm; }
    }

    if (bgmUrl) {
        currentBgmAudio = new Audio(bgmUrl);
        currentBgmAudio.loop = true;
        currentBgmAudio.volume = 0.3;
        currentBgmAudio.play().catch(e => { playMmlBGM(); });
    } else {
        playMmlBGM();
    }
}

function stopBGM() { 
    if (currentBgmAudio) { currentBgmAudio.pause(); currentBgmAudio.currentTime = 0; currentBgmAudio = null; }
    if (bgmTimeout) clearTimeout(bgmTimeout); bgmOscillators.forEach(osc => { try { osc.stop(); } catch(e){} }); bgmOscillators = []; 
}

function playMmlBGM() {
    const mml = BGM_MML.replace(/\s+/g, '').toUpperCase(); let index = 0; let nextTime = audioCtx.currentTime + 0.1; let octave = 4; let defaultLen = 4; let tempo = 120;
    const scheduleNote = () => {
        if (!isGameActive) return;
        try {
            while (nextTime < audioCtx.currentTime + 2.0 && index < mml.length) {
                let char = mml[index++];
                if (char === 'T') { let num = parseInt(mml.slice(index)); if (!isNaN(num)) { tempo = num; index += String(num).length; } } 
                else if (char === 'L') { let num = parseInt(mml.slice(index)); if (!isNaN(num)) { defaultLen = num; index += String(num).length; } } 
                else if (char === 'O') { let num = parseInt(mml.slice(index)); if (!isNaN(num)) { octave = num; index += String(num).length; } } 
                else if (char === '>') octave++; else if (char === '<') octave--;
                else if (char === 'R') { let len = defaultLen; let num = parseInt(mml.slice(index)); if (!isNaN(num)) { len = num; index += String(num).length; } nextTime += (60 / tempo) * (4 / len); } 
                else if ("CDEFGAB".includes(char)) {
                    let note = char; if (mml[index] === '#' || mml[index] === '+') { note += '#'; index++; } else if (mml[index] === '-') { note += '-'; index++; }
                    let len = defaultLen; let num = parseInt(mml.slice(index)); if (!isNaN(num)) { len = num; index += String(num).length; }
                    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]; let keyIndex = notes.indexOf(note.replace('-', '')); if (keyIndex === -1) keyIndex = 0;
                    const freq = 440 * Math.pow(2, (octave - 4) + (keyIndex - 9) / 12);
                    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type = 'square'; osc.frequency.value = freq; osc.connect(gain); gain.connect(audioCtx.destination);
                    const duration = (60 / tempo) * (4 / len); osc.start(nextTime); osc.stop(nextTime + duration - 0.05); gain.gain.setValueAtTime(0.05, nextTime); gain.gain.linearRampToValueAtTime(0.02, nextTime + duration - 0.05); gain.gain.setValueAtTime(0, nextTime + duration);
                    bgmOscillators.push(osc); nextTime += duration;
                }
            }
        } catch(e) {}
        if (index >= mml.length) index = 0; if (isGameActive && !isMuted) bgmTimeout = setTimeout(scheduleNote, 500);
    };
    scheduleNote();
}
function stopBGM() { if (bgmTimeout) clearTimeout(bgmTimeout); bgmOscillators.forEach(osc => { try { osc.stop(); } catch(e){} }); bgmOscillators = []; }
