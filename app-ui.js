// ==========================================
// app-ui.js (UI制御・各種モード開始・図鑑・ガチャ管理)
// ==========================================

/* ------------------------------------------
 * 成績表・レーダーチャート
 * ------------------------------------------ */
function openRecord() { document.getElementById('record-overlay')?.classList.remove('hidden'); renderRecord(); }
function closeRecord() { document.getElementById('record-overlay')?.classList.add('hidden'); }

function drawRadarChart(labels, data) {
    const canvas = document.getElementById('radar-chart'); if (!canvas) return; const ctx = canvas.getContext('2d');
    const w = canvas.width; const h = canvas.height; const cx = w / 2; const cy = h / 2; const radius = w / 2 - 40;
    ctx.clearRect(0, 0, w, h); const sides = Math.max(5, labels.length); 
    ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) { const r = radius * (i / 5); ctx.beginPath(); for (let j = 0; j < sides; j++) { const angle = (Math.PI * 2 * j) / sides - Math.PI / 2; const x = cx + Math.cos(angle) * r; const y = cy + Math.sin(angle) * r; if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.stroke(); }
    ctx.fillStyle = '#333'; ctx.font = 'bold 12px "BIZ UDPGothic"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let j = 0; j < sides; j++) {
        const angle = (Math.PI * 2 * j) / sides - Math.PI / 2; const x = cx + Math.cos(angle) * radius; const y = cy + Math.sin(angle) * radius;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        if (j < labels.length) { const lx = cx + Math.cos(angle) * (radius + 20); const ly = cy + Math.sin(angle) * (radius + 20); ctx.fillText(labels[j], lx, ly); }
    }
    if (data.length === 0) return;
    ctx.beginPath();
    for (let j = 0; j < sides; j++) { if (j >= data.length) break; const val = Math.min(100, Math.max(0, data[j])); const r = radius * (val / 100); const angle = (Math.PI * 2 * j) / sides - Math.PI / 2; const x = cx + Math.cos(angle) * r; const y = cy + Math.sin(angle) * r; if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fillStyle = 'rgba(142, 68, 173, 0.5)'; ctx.fill(); ctx.strokeStyle = '#8e44ad'; ctx.lineWidth = 2; ctx.stroke();
}

function renderRecord() {
    const tbody = document.getElementById('grade-tbody'); if(!tbody) return; tbody.innerHTML = ''; const subjects = Object.keys(gameState.subjectStats).sort();
    if (subjects.length === 0) { tbody.innerHTML = '<tr><td colspan="3">データがありません。<br>クエストをプレイしてください。</td></tr>'; drawRadarChart([], []); }
    else {
        const labels = []; const dataPoints = [];
        subjects.forEach(subj => {
            const d = gameState.subjectStats[subj]; const rate = d.total > 0 ? (d.correct / d.total * 100) : 0;
            let rank = 'G'; if (rate >= 90) rank = 'S'; else if (rate >= 80) rank = 'A'; else if (rate >= 70) rank = 'B'; else if (rate >= 60) rank = 'C'; else if (rate >= 50) rank = 'D'; else if (rate >= 40) rank = 'E'; else if (rate >= 20) rank = 'F';
            labels.push(subj); dataPoints.push(rate);
            tbody.innerHTML += `<tr><td>${subj}</td><td>${rate.toFixed(1)}% <span style="font-size:0.8em; color:#7f8c8d;">(${d.correct}/${d.total})</span></td><td class="rank-${rank}">${rank}</td></tr>`;
        });
        drawRadarChart(labels, dataPoints);
    }
    const recordList = document.getElementById('calc-record-list'); if(!recordList) return; recordList.innerHTML = '';
    const keys = Object.keys(gameState.calcRecords || {});
    if (keys.length === 0) { recordList.innerHTML = '<div>計算クエストの記録はありません。</div>'; return; }
    keys.forEach(key => {
        const parts = key.split('_'); const mode = parts.pop(); const type = parts.join('_');
        const title = { addition: 'たし算', subtraction: 'ひき算', multiplication: 'かけ算', division: '割り算(あまりなし)', division_remainder: '割り算(あまりあり)', random: 'ランダム' }[type] || type;
        const modeLabel = mode === '100q' ? '100問' : '3分'; const list = gameState.calcRecords[key];
        let html = `<div style="margin-bottom:10px;"><strong>${title} / ${modeLabel}</strong><br>`;
        list.forEach((item, index) => { html += `<div style="font-size:0.85em; color:#34495e;">${index+1}. ${item.correct}正解 / ${item.time.toFixed(1)}秒</div>`; }); html += '</div>'; recordList.innerHTML += html;
    });
}

/* ------------------------------------------
 * クラウドセーブUI
 * ------------------------------------------ */
function openSyncMenu() { 
    document.getElementById('sync-overlay')?.classList.remove('hidden'); 
    document.getElementById('my-user-id').innerText = currentUserId || "エラー"; 
}
function closeSyncMenu() { document.getElementById('sync-overlay')?.classList.add('hidden'); }

/* ------------------------------------------
 * 各種モードのメニュー表示・切り替え
 * ------------------------------------------ */
let oathOrigin = 'normal';

function openUnitSelection() { const unitTitle = document.getElementById('unit-select-title'); if(unitTitle) { unitTitle.innerText = "クエスト出発"; unitTitle.style.color = "#2c3e50"; } document.getElementById('unit-select-overlay')?.classList.remove('hidden'); }
function closeUnitSelection() { document.getElementById('unit-select-overlay')?.classList.add('hidden'); }
function startNormalGameCheck() { 
    const g = document.getElementById('grade-select')?.value; 
    const s = document.getElementById('subject-select')?.value; 
    const u = document.getElementById('unit-select')?.value; 
    const hp = document.getElementById('boss-hp-select')?.value; 
    if(!g || !s || !u || !hp) return alert("全ての項目を選択してください"); 
    playData.selectedBossHp = Number(hp); closeUnitSelection(); oathOrigin = 'normal'; startGame(); 
}
function goToOathMenuCheck() { 
    const g = document.getElementById('grade-select')?.value; 
    const s = document.getElementById('subject-select')?.value; 
    const u = document.getElementById('unit-select')?.value; 
    const hp = document.getElementById('boss-hp-select')?.value; 
    if(!g || !s || !u || !hp) return alert("全ての項目を選択してください"); 
    playData.selectedBossHp = Number(hp); closeUnitSelection(); oathOrigin = 'normal'; openOathMenu(); 
}

function goToOathMenuSurvivalCheck() {
    const g = document.getElementById('survival-grade-select')?.value;
    if(!g) return alert("学年を選択してください");
    closeSurvivalMenu(); oathOrigin = 'survival'; openOathMenu();
}

let tempOaths = [];
function openOathMenu() { 
    tempOaths = []; 
    document.querySelectorAll('.oath-option').forEach(el => el.classList.remove('selected')); 
    
    const title = document.querySelector('#oath-overlay h2');
    const desc = document.querySelector('#oath-overlay p');
    const weakOption = document.getElementById('oath-weak');
    
    if (oathOrigin === 'survival') {
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

function closeOathMenu() { document.getElementById('oath-overlay')?.classList.add('hidden'); }
function toggleOath(type) { const el = document.getElementById('oath-' + type); if (tempOaths.includes(type)) { tempOaths = tempOaths.filter(t => t !== type); if(el) el.classList.remove('selected'); } else { tempOaths.push(type); if(el) el.classList.add('selected'); } }

function openRandomMenu() {
    if(!rawData.questions) return;
    const grades = [...new Set(rawData.questions.map(q => q.grade))].filter(g=>g);
    const sel = document.getElementById('random-grade-select'); if(!sel) return; sel.innerHTML = '<option value="">学年を選択...</option>';
    grades.forEach(g => sel.innerHTML += `<option value="${g}">${g}</option>`);
    document.getElementById('random-overlay')?.classList.remove('hidden');
}
function closeRandomMenu() { document.getElementById('random-overlay')?.classList.add('hidden'); }

function openTypingMenu() {
    if(!rawData.typing || rawData.typing.length === 0) return alert("タイピング問題データが見つかりません");
    const grades = [...new Set(rawData.typing.map(t => t.grade))].filter(g=>g);
    const sel = document.getElementById('typing-grade-select'); if(!sel) return; sel.innerHTML = '<option value="">学年を選択...</option>';
    grades.forEach(g => sel.innerHTML += `<option value="${g}">${g}</option>`);
    document.getElementById('typing-menu-overlay')?.classList.remove('hidden');
}
function closeTypingMenu() { document.getElementById('typing-menu-overlay')?.classList.add('hidden'); }

function openCalcMenu() { document.getElementById('calc-overlay')?.classList.remove('hidden'); }
function closeCalcMenu() { document.getElementById('calc-overlay')?.classList.add('hidden'); }

function openSurvivalMenu() {
    if(!rawData.questions) return;
    const grades = [...new Set(rawData.questions.map(q => q.grade))].filter(g=>g);
    const sel = document.getElementById('survival-grade-select'); 
    if(sel) {
        sel.innerHTML = '<option value="">学年を選択...</option>';
        grades.forEach(g => sel.innerHTML += `<option value="${g}">${g}</option>`);
    }
    document.getElementById('survival-overlay')?.classList.remove('hidden');
}
function closeSurvivalMenu() { document.getElementById('survival-overlay')?.classList.add('hidden'); }


/* ------------------------------------------
 * 各種モードのゲーム開始 (Start Functions)
 * ------------------------------------------ */
function startSurvivalGame() {
    const g = document.getElementById('survival-grade-select')?.value;
    if(!g) return alert("学年を選択してください");
    
    let qList = rawData.questions.filter(q => q.grade == g);
    if(qList.length === 0) return alert("問題がありません");
    
    let boss = { name: "エンドレス特訓", hp: 999999, icon: "🔥" };
    
    playData.questions = qList.sort(() => Math.random() - 0.5); 
    playData.qIndex = 0; 
    playData.currentBoss = boss;
    playData.isRevenge = false; 
    playData.activeOaths = oathOrigin === 'survival' ? [...tempOaths] : []; 
    playData.isRandom = false; 
    playData.isTyping = false; 
    playData.isCalculation = false; 
    playData.isSurvival = true; 
    playData.context = null;
    
    const charaStats = getCharaStats();
    gameState.score = 0; 
    gameState.combo = 0; 
    gameState.lives = playData.activeOaths.includes('backwater') ? 1 : 3; 
    gameState.enemyHP = boss.hp; 
    gameState.maxHP = boss.hp; 
    
    let timeMulti = playData.activeOaths.includes('rapid') ? 0.5 : 1.0; 
    gameState.maxTime = 10 * charaStats.time * timeMulti;
    isGameActive = false; isPaused = false;
    
    document.getElementById('survival-overlay')?.classList.add('hidden');
    document.getElementById('oath-overlay')?.classList.add('hidden'); 
    document.getElementById('title-screen')?.classList.add('hidden'); 
    document.getElementById('game-screen')?.classList.remove('hidden'); 
    
    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = 'none';

    const enemyBox = document.querySelector('.enemy-visual-box'); const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    
    const uienemyName = document.getElementById('ui-enemy-name'); if(uienemyName) uienemyName.innerText = "WAVE: 0";
    if(enemyIcon) enemyIcon.innerHTML = boss.icon; 
    
    const timerBar = document.getElementById('ui-timer'); if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);
    
    oathOrigin = 'normal';
    updateUI(); startCountdown();
}

function startGame() {
    const gSelect = document.getElementById('grade-select'); const sSelect = document.getElementById('subject-select'); const uSelect = document.getElementById('unit-select'); if(!gSelect || !sSelect || !uSelect) return;
    const g = gSelect.value, s = sSelect.value, u = uSelect.value;
    if(!g || !s || !u) return alert("全て選択してください");
    let qList = rawData.questions.filter(q => q.grade == g && q.subject == s && q.unit == u);
    if(qList.length === 0) return alert("問題がありません");
    let boss = rawData.bosses ? rawData.bosses.find(b => b.unit == u && b.grade == g) : null;
    if(!boss) boss = { name: "テストの魔人", hp: 3000, icon: "😈" };
    if(playData.selectedBossHp) boss.hp = playData.selectedBossHp;
    playData.questions = qList.sort(() => Math.random() - 0.5); playData.qIndex = 0; playData.currentBoss = boss;
    playData.isRevenge = false; playData.activeOaths = []; playData.isRandom = false; playData.isTyping = false; playData.isCalculation = false; playData.isSurvival = false; playData.context = { grade: g, subject: s, unit: u };
    
    const charaStats = getCharaStats();
    gameState.score = 0; gameState.combo = 0; gameState.lives = 3; gameState.enemyHP = Number(boss.hp)||3000; gameState.maxHP = gameState.enemyHP; gameState.maxTime = 10 * charaStats.time;
    isGameActive = false; isPaused = false;
    
    document.getElementById('pause-overlay')?.classList.add('hidden'); document.getElementById('title-screen')?.classList.add('hidden'); document.getElementById('game-screen')?.classList.remove('hidden'); 
    
    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';

    const enemyBox = document.querySelector('.enemy-visual-box'); const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    const uienemyName = document.getElementById('ui-enemy-name'); if(uienemyName) uienemyName.innerText = boss.name;
    if(enemyIcon) {
        if(boss.icon.startsWith('http')) { enemyIcon.innerHTML = `<img src="${boss.icon}">`; } else { enemyIcon.innerHTML = boss.icon; }
    }
    const timerBar = document.getElementById('ui-timer'); if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);
    updateUI(); startCountdown();
}

function startRevengeMode() {
    if (!gameState.revengeList || gameState.revengeList.length === 0) return;
    const targetQuestions = rawData.questions.filter(q => gameState.revengeList.includes(q.id));
    if (targetQuestions.length !== gameState.revengeList.length) { gameState.revengeList = targetQuestions.map(q => q.id); saveGame(); updateTitleInfo(); }
    if (targetQuestions.length === 0) { alert("復習すべき問題データが見つかりませんでした。"); gameState.revengeList = []; saveGame(); updateTitleInfo(); return; }
    const boss = { name: "忘却の亡霊", hp: targetQuestions.length * 100, icon: "👻" };
    playData.questions = targetQuestions.sort(() => Math.random() - 0.5); playData.qIndex = 0; playData.currentBoss = boss;
    playData.isRevenge = true; playData.activeOaths = []; playData.isRandom = false; playData.isTyping = false; playData.isCalculation = false; playData.isSurvival = false; playData.context = null;
    
    const charaStats = getCharaStats();
    gameState.score = 0; gameState.combo = 0; gameState.lives = 3; gameState.enemyHP = boss.hp; gameState.maxHP = boss.hp; gameState.maxTime = 10 * charaStats.time;
    isGameActive = false; isPaused = false;
    
    document.getElementById('pause-overlay')?.classList.add('hidden'); document.getElementById('title-screen')?.classList.add('hidden'); document.getElementById('game-screen')?.classList.remove('hidden');
    
    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';

    const enemyBox = document.querySelector('.enemy-visual-box'); const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    const uienemyName = document.getElementById('ui-enemy-name'); if(uienemyName) uienemyName.innerText = boss.name; 
    if(enemyIcon) enemyIcon.innerHTML = boss.icon; 
    const timerBar = document.getElementById('ui-timer'); if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);
    updateUI(); startCountdown();
}

function startOathGame() {
    if (tempOaths.length === 0) return alert("誓約を1つ以上選択してください");
    if (oathOrigin === 'survival') return startSurvivalGame();
    
    const g = document.getElementById('grade-select')?.value; const s = document.getElementById('subject-select')?.value; const u = document.getElementById('unit-select')?.value;
    let qList = rawData.questions ? rawData.questions.filter(q => q.grade == g && q.subject == s && q.unit == u) : [];
    if(qList.length === 0) return alert("問題がありません");
    let boss = rawData.bosses ? rawData.bosses.find(b => b.unit == u && b.grade == g) : null;
    if(!boss) boss = { name: "試練の魔人", hp: 1500, icon: "👿" };
    
    if(playData.selectedBossHp) boss.hp = playData.selectedBossHp;
    
    playData.questions = qList.sort(() => Math.random() - 0.5); playData.qIndex = 0; playData.currentBoss = boss;
    playData.isRevenge = false; playData.activeOaths = [...tempOaths]; playData.isRandom = false; playData.isTyping = false; playData.isCalculation = false; playData.isSurvival = false; playData.context = { grade: g, subject: s, unit: u };
    
    const charaStats = getCharaStats();
    gameState.score = 0; gameState.combo = 0; gameState.lives = playData.activeOaths.includes('backwater') ? 1 : 3;
    gameState.enemyHP = Number(boss.hp)||3000; gameState.maxHP = gameState.enemyHP; 
    let timeMulti = playData.activeOaths.includes('rapid') ? 0.5 : 1.0; gameState.maxTime = 10 * charaStats.time * timeMulti;
    isGameActive = false; isPaused = false;
    document.getElementById('oath-overlay')?.classList.add('hidden'); document.getElementById('title-screen')?.classList.add('hidden'); document.getElementById('game-screen')?.classList.remove('hidden');
    
    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';

    const enemyBox = document.querySelector('.enemy-visual-box'); const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    const uienemyName = document.getElementById('ui-enemy-name'); if(uienemyName) uienemyName.innerText = "【誓約】" + boss.name;
    if(enemyIcon) {
        if(boss.icon.startsWith('http')) { enemyIcon.innerHTML = `<img src="${boss.icon}">`; } else { enemyIcon.innerHTML = boss.icon; }
    }
    const timerBar = document.getElementById('ui-timer'); if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);
    updateUI(); startCountdown();
}

function startRandomGame() {
    const g = document.getElementById('random-grade-select')?.value; if(!g) return alert("学年を選択してください");
    const qList = rawData.questions ? rawData.questions.filter(q => q.grade == g) : []; if(qList.length === 0) return alert("問題が見つかりません");
    let possibleBosses = []; if (rawData.randomBosses) { possibleBosses = rawData.randomBosses.filter(b => b.grade == g || b.grade == '全学年'); }
    let boss; if (possibleBosses.length > 0) { const b = possibleBosses[Math.floor(Math.random() * possibleBosses.length)]; boss = { name: b.name, hp: Number(b.hp) || 3000, icon: b.icon }; } else { boss = { name: "迷宮のヌシ", hp: 3000, icon: "🐲" }; }
    playData.questions = qList.sort(() => Math.random() - 0.5); playData.qIndex = 0; playData.currentBoss = boss;
    playData.isRevenge = false; playData.activeOaths = []; playData.isRandom = true; playData.isTyping = false; playData.isCalculation = false; playData.isSurvival = false; playData.context = null;
    
    const charaStats = getCharaStats();
    gameState.score = 0; gameState.combo = 0; gameState.lives = 3; gameState.enemyHP = boss.hp; gameState.maxHP = boss.hp; gameState.maxTime = 10 * charaStats.time;
    isGameActive = false; isPaused = false;
    document.getElementById('random-overlay')?.classList.add('hidden'); document.getElementById('title-screen')?.classList.add('hidden'); document.getElementById('game-screen')?.classList.remove('hidden');
    
    document.getElementById('calc-layout')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden');
    document.getElementById('calc-keypad')?.classList.add('hidden');
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    document.getElementById('ui-choices')?.classList.remove('hidden');
    document.getElementById('ui-typing-area')?.classList.add('hidden');
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';

    const enemyBox = document.querySelector('.enemy-visual-box'); const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    const uienemyName = document.getElementById('ui-enemy-name'); if(uienemyName) uienemyName.innerText = "【迷宮】" + boss.name;
    if(enemyIcon) {
        if(boss.icon && boss.icon.startsWith('http')) { enemyIcon.innerHTML = `<img src="${boss.icon}">`; } else { enemyIcon.innerHTML = boss.icon || "👾"; }
    }
    const timerBar = document.getElementById('ui-timer'); if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);
    updateUI(); startCountdown();
}

function startTypingGame() {
    const g = document.getElementById('typing-grade-select')?.value; 
    if(!g) return alert("学年を選択してください");
    if (!rawData.typing) return alert("タイピングデータが読み込めていません。リロードしてください。");
    const qList = rawData.typing.filter(t => t.grade == g); 
    if(qList.length === 0) return alert("選択した学年の問題がありません");
    
    let boss = { name: "キーボードの魔人", hp: qList.length * 50, icon: "⌨️" };
    try { 
        if(rawData.bosses) { 
            const specificBoss = rawData.bosses.find(b => b.grade == g && b.unit == 'タイピング'); 
            if(specificBoss) { boss = { ...specificBoss }; if(!boss.hp) boss.hp = qList.length * 50; } 
            else { const gradeBoss = rawData.bosses.find(b => b.grade == g); if(gradeBoss) { boss = { ...gradeBoss }; boss.hp = qList.length * 50; boss.name = "【打鍵】" + boss.name; } } 
        } 
    } catch(e) {}
    
    playData.questions = qList.sort(() => Math.random() - 0.5); playData.qIndex = 0; playData.currentBoss = boss;
    playData.isRevenge = false; playData.activeOaths = []; playData.isRandom = false; playData.isTyping = true; playData.isCalculation = false; playData.isSurvival = false; playData.context = null;
    
    const charaStats = getCharaStats();
    gameState.score = 0; gameState.combo = 0; gameState.lives = 5; gameState.enemyHP = Number(boss.hp) || 3000; gameState.maxHP = gameState.enemyHP; gameState.maxTime = 10 * charaStats.time; 
    isGameActive = false; isPaused = false;
    
    document.getElementById('typing-menu-overlay')?.classList.add('hidden'); document.getElementById('title-screen')?.classList.add('hidden'); document.getElementById('game-screen')?.classList.remove('hidden');
    
    document.getElementById('ui-choices')?.classList.add('hidden'); 
    document.getElementById('ui-typing-area')?.classList.remove('hidden'); 
    document.getElementById('ui-question')?.classList.add('hidden');
    document.getElementById('ui-calc-answer')?.classList.add('hidden'); 
    document.getElementById('calc-keypad')?.classList.add('hidden'); 
    document.getElementById('calc-layout')?.classList.add('hidden'); 
    document.getElementById('ui-calc-progress')?.classList.add('hidden');
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = '';
    const hpFrame = document.querySelector('.enemy-hp-frame'); if(hpFrame) hpFrame.style.display = '';

    const enemyBox = document.querySelector('.enemy-visual-box'); const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    
    const uiEnemyName = document.getElementById('ui-enemy-name'); if(uiEnemyName) uiEnemyName.innerText = boss.name;
    if(enemyIcon) {
        if(boss.icon && boss.icon.startsWith('http')) { enemyIcon.innerHTML = `<img src="${boss.icon}">`; } else { enemyIcon.innerHTML = boss.icon || "👾"; }
    }

    document.removeEventListener('keydown', handleTypingInput); document.addEventListener('keydown', handleTypingInput);
    const timerBar = document.getElementById('ui-timer'); if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); if(timerText) timerText.innerText = gameState.maxTime.toFixed(1);
    
    const uiTypingJp = document.getElementById('ui-typing-jp'); if(uiTypingJp) uiTypingJp.innerText = "READY..."; 
    const uiTypingRomaji = document.getElementById('ui-typing-romaji'); if(uiTypingRomaji) uiTypingRomaji.innerHTML = "";

    updateUI(); startCountdown();
}

function startCalcGame() {
    const type = document.getElementById('calc-type-select')?.value; const mode = document.getElementById('calc-mode-select')?.value;
    if (!type || !mode) return alert("問題形式とモードを選択してください");
    const hand = document.querySelector('input[name="calc-hand"]:checked')?.value || 'right';
    playData.isCalculation = true; playData.isTyping = false; playData.isSurvival = false; playData.calcType = type; playData.calcMode = mode; playData.calcQIndex = 0; playData.calcCorrect = 0; playData.calcInput = ''; playData.calcElapsed = 0; playData.calcTimeLeft = mode === '3min' ? 180 : 0; playData.calcCountTarget = mode === '100q' ? 100 : 0; playData.calcQuestions = []; playData.currentQ = null; playData.isRevenge = false; playData.activeOaths = []; playData.isRandom = false; playData.context = null; playData.handPreference = hand;

    gameState.score = 0; gameState.combo = 0; gameState.lives = 0; gameState.enemyHP = 0; gameState.maxHP = 1; gameState.maxTime = playData.calcTimeLeft || 1;
    isGameActive = false; isPaused = false;

    document.getElementById('calc-overlay')?.classList.add('hidden'); document.getElementById('title-screen')?.classList.add('hidden'); document.getElementById('game-screen')?.classList.remove('hidden'); document.getElementById('ui-choices')?.classList.add('hidden'); document.getElementById('ui-typing-area')?.classList.add('hidden'); document.getElementById('ui-question')?.classList.remove('hidden'); document.getElementById('ui-calc-answer')?.classList.remove('hidden'); document.getElementById('calc-keypad')?.classList.remove('hidden'); document.getElementById('calc-layout')?.classList.remove('hidden'); document.getElementById('ui-calc-progress')?.classList.remove('hidden'); 
    const enemyRow = document.querySelector('.enemy-stats-row'); if(enemyRow) enemyRow.style.display = 'none';

    const calcLayout = document.getElementById('calc-layout'); if (calcLayout) { calcLayout.classList.remove('left-hand', 'right-hand'); calcLayout.classList.add(hand === 'left' ? 'left-hand' : 'right-hand'); }
    const enemyBox = document.querySelector('.enemy-visual-box'); const enemyIcon = document.getElementById('ui-enemy-icon');
    if(enemyBox) enemyBox.classList.remove('anim-paused', 'fade-out'); if(enemyIcon) enemyIcon.classList.remove('shake-anim');
    const uienemyName = document.getElementById('ui-enemy-name'); if(uienemyName) uienemyName.innerText = '計算クエスト'; 
    if(enemyIcon) enemyIcon.innerHTML = '🧮';
    
    const timerBar = document.getElementById('ui-timer'); if(timerBar) timerBar.style.width = '100%'; 
    const timerText = document.getElementById('ui-timer-text'); if(timerText) timerText.innerText = playData.calcMode === '3min' ? '180.0' : '0.0';
    
    const uiScoreSpan = document.getElementById('ui-score'); if(uiScoreSpan && uiScoreSpan.previousSibling && uiScoreSpan.previousSibling.nodeType === 3) uiScoreSpan.previousSibling.nodeValue = "問題数 ";
    const uiComboSpan = document.getElementById('ui-combo'); if(uiComboSpan && uiComboSpan.previousSibling && uiComboSpan.previousSibling.nodeType === 3) uiComboSpan.previousSibling.nodeValue = "正解数 ";

    const qBox = document.getElementById('ui-question');
    if (qBox) {
        qBox.style.setProperty('height', '50px', 'important');
        qBox.style.setProperty('min-height', '50px', 'important');
    }

    document.removeEventListener('keydown', handleTypingInput); document.addEventListener('keydown', handleTypingInput);
    updateUI(); startCountdown();
}

/* ------------------------------------------
 * キャラクター・図鑑・進化・育成
 * ------------------------------------------ */
function checkAdminGifts() { 
    if (!rawData.gifts || rawData.gifts.length === 0) { updateGiftButtonState(); return; }
    const unclaimed = rawData.gifts.filter(g => { const id = g.id || g['ID']; return id && !gameState.claimedGifts.includes(id); });
    updateGiftButtonState(); if (unclaimed.length > 0) openGiftMenu(unclaimed);
}
function openGiftMenu(giftsToShow = null) {
    if (!giftsToShow) { if (!rawData.gifts) return; giftsToShow = rawData.gifts.filter(g => { const id = g.id || g['ID']; return id && !gameState.claimedGifts.includes(id); }); }
    if (giftsToShow.length === 0) { alert("受け取るプレゼントはありません。"); updateGiftButtonState(); return; }
    const list = document.getElementById('gift-list'); if(!list) return; list.innerHTML = '';
    giftsToShow.forEach(g => { const id = g.id || g['ID'] || 'unknown'; const title = g.title || g['タイトル'] || 'No Title'; const msg = g.message || g['メッセージ'] || 'No Message'; const exp = g.exp || g['EXP'] || 0; list.innerHTML += `<div class="gift-item" data-id="${id}" data-exp="${exp}"><div class="gift-header"><span class="gift-title">${title}</span><span class="gift-exp">+${exp} XP</span></div><div class="gift-msg">${msg}</div></div>`; });
    document.getElementById('gift-overlay')?.classList.remove('hidden');
}
function closeGiftMenu() { document.getElementById('gift-overlay')?.classList.add('hidden'); }
function receiveAllGifts() {
    const items = document.querySelectorAll('.gift-item'); if (items.length === 0) return; let totalExp = 0; let count = 0;
    items.forEach(item => { const id = item.getAttribute('data-id'); const expVal = item.getAttribute('data-exp'); const exp = parseInt(expVal, 10); if (id && id !== 'undefined' && id !== 'unknown' && !gameState.claimedGifts.includes(id)) { gameState.claimedGifts.push(id); if (!isNaN(exp)) totalExp += exp; count++; } });
    if (count > 0) { gameState.xp += totalExp; saveGame(); updateTitleInfo(); playSE('win'); alert(`🎁 ギフトを${count}件受け取りました！\n合計: +${totalExp} XP`); closeGiftMenu(); checkTitles(); updateGiftButtonState(); } else { closeGiftMenu(); }
}
function updateGiftButtonState() { if (!rawData.gifts) return; const unclaimed = rawData.gifts.filter(g => { const id = g.id || g['ID']; return id && !gameState.claimedGifts.includes(id); }); const btn = document.getElementById('btn-gift'); const badge = document.getElementById('gift-badge'); if (unclaimed.length > 0 && btn && badge) { btn.disabled = false; btn.style.opacity = "1.0"; btn.style.filter = "none"; badge.innerText = unclaimed.length; badge.classList.remove('hidden'); } else if(btn && badge) { btn.disabled = true; btn.style.opacity = "0.7"; badge.classList.add('hidden'); } }

async function executeEvolution() {
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

async function executeReincarnation() {
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

let zukanSortMode = 'default';
function changeZukanSort() { const sel = document.getElementById('zukan-sort-select'); if(sel) zukanSortMode = sel.value; renderZukan(); }

function renderZukan() { 
    const g=document.getElementById('zukan-grid'); if(!g) return; g.innerHTML=''; 
    if(!rawData.characters) return;
    let list = [...rawData.characters];
    list.sort((a, b) => {
        const invA = gameState.charaInventory[a.id]; const invB = gameState.charaInventory[b.id];
        if (zukanSortMode === 'rarity_desc' || zukanSortMode === 'rarity_asc') { const rOrder = { 'UR':5, 'SSR':4, 'SR':3, 'R':2, 'N':1 }; const valA = rOrder[a.rarity] || 0; const valB = rOrder[b.rarity] || 0; return zukanSortMode === 'rarity_desc' ? valB - valA : valA - valB; }
        if (zukanSortMode === 'type') { return (a.type || "").localeCompare(b.type || ""); }
        if (zukanSortMode === 'level') { const lvA = invA ? invA.level : -1; const lvB = invB ? invB.level : -1; if (lvA !== lvB) return lvB - lvA; }
        if (zukanSortMode === 'stock') { const cntA = invA ? invA.count : -1; const cntB = invB ? invB.count : -1; if (cntA !== cntB) return cntB - cntA; }
        return 0;
    });
    list.forEach(c=>{ 
        const data = gameState.charaInventory[c.id]; const isOwned = !!data; const div = document.createElement('div');
        let masterClass = ''; if (isOwned && data.count >= MASTER_COUNT) masterClass = 'mastered';
        div.className = `char-card ${isOwned?'owned':''} ${gameState.equipped==c.id?'active':''} ${masterClass}`;
        let visual, nameText, lvlBadge = '', stockBadge = ''; let decoName = "???"; 
        if(isOwned) {
            visual = (c.imageUrl && c.imageUrl.startsWith('http')) ? `<img src="${c.imageUrl}" class="char-img">` : `<div style="font-size:2em;line-height:50px">📦</div>`;
            const currentRarity = data.currentRarity || c.rarity; decoName = getDisplayName(c, data); nameText = `<span class="rarity-${currentRarity}">${currentRarity}</span> / ${c.type}`;
            lvlBadge = `<div class="char-lvl-badge">Lv.${data.level}</div>`; if(data.count > 0) stockBadge = `<div class="char-stock-badge">+${data.count}</div>`;
            div.onclick = () => openCharaDetail(c.id);
        } else { visual = `<div style="font-size:2em;line-height:50px;color:#bdc3c7;">?</div>`; nameText = "???"; }
        div.innerHTML = `${lvlBadge}${stockBadge}${visual}<div style="font-weight:bold;font-size:0.8em;">${nameText}</div><div style="font-size:0.7em; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${decoName}</div>`;
        g.appendChild(div);
    });
}

function openCharaDetail(id) { 
    viewingCharaId=id; const c = rawData.characters ? rawData.characters.find(x=>x.id==id) : null; const o=gameState.charaInventory[id]; if(!c||!o)return; 
    const currentR = o.currentRarity || c.rarity; const currentSkills = (o.skills && o.skills.length > 0) ? o.skills : [c.type];
    const baseVal = (o.isEvolved && o.customValue) ? o.customValue : Number(c.value);
    
    const cdName = document.getElementById('cd-name'); if(cdName) cdName.innerHTML = getDisplayName(c, o);
    const cdRarity = document.getElementById('cd-rarity'); if(cdRarity) { cdRarity.innerText = currentR; cdRarity.className = "rarity-" + currentR; }
    const maxLv = RARITY_CAPS[currentR] || 10;
    const cdLv = document.getElementById('cd-lv'); if(cdLv) cdLv.innerText = 'Lv.' + o.level + ' / ' + maxLv;
    
    let skillHtml = ''; currentSkills.forEach(s => { skillHtml += `<span class="skill-tag ${s}">${s}</span>`; });
    const cdType = document.getElementById('cd-type'); if(cdType) cdType.innerHTML = `<div class="skill-tag-container">${skillHtml}</div>`;
    
    let val = baseVal + (o.level * LV_BONUS_RATE); const cdVal = document.getElementById('cd-val'); if(cdVal) cdVal.innerText='x'+val.toFixed(2); 
    const cdStock = document.getElementById('cd-stock'); if(cdStock) cdStock.innerText=o.count + "個"; 
    const cdDesc = document.getElementById('cd-desc'); if(cdDesc) cdDesc.innerText = c.desc || "";
    
    const detailBtnRow = document.querySelector('.detail-btn-row');
    if(detailBtnRow) {
        if (document.querySelector('.item-use-area')) document.querySelector('.item-use-area').remove();
        detailBtnRow.insertAdjacentHTML('beforebegin', `<div class="item-use-area"><div style="font-weight:bold; font-size:0.8em; color:#2c3e50; margin-bottom:5px;">育成アイテム</div><div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px;"><button class="book-use-btn" onclick="useExpItem('xpBookSmall', 200)" ${(gameState.inventory.xpBookSmall||0)>0?'':'disabled'}>小(${gameState.inventory.xpBookSmall||0})</button><button class="book-use-btn" onclick="useExpItem('xpBookMedium', 500)" ${(gameState.inventory.xpBookMedium||0)>0?'':'disabled'}>中(${gameState.inventory.xpBookMedium||0})</button><button class="book-use-btn" onclick="useExpItem('xpBookLarge', 1000)" ${(gameState.inventory.xpBookLarge||0)>0?'':'disabled'}>大(${gameState.inventory.xpBookLarge||0})</button></div></div>`);
    }
    
    const cdExpText = document.getElementById('cd-exp-text'); if(cdExpText) cdExpText.innerText = o.exp + ' / ' + EXP_REQ; 
    const cdExpBar = document.getElementById('cd-exp-bar'); if(cdExpBar) cdExpBar.style.width = (o.exp / EXP_REQ * 100) + '%';
    const cdImg = document.getElementById('cd-img');
    if(cdImg) { if(c.imageUrl && c.imageUrl.startsWith('http')) cdImg.src=c.imageUrl; else cdImg.src=''; }
    document.getElementById('chara-detail-overlay')?.classList.remove('hidden'); 
    
    const evoContainer = document.getElementById('evo-container'); 
    if(evoContainer) {
        evoContainer.innerHTML = ''; evoContainer.classList.add('hidden');
        if (o.level >= maxLv && o.count >= EVO_STOCK_REQ && currentR !== 'UR') {
            const cost = EVO_COST_XP[currentR]; const btn = document.createElement('button'); btn.className = 'detail-btn'; btn.style.background = 'linear-gradient(to bottom, #f1c40f, #e67e22)'; btn.style.borderBottom = '5px solid #d35400'; btn.style.marginBottom = '10px'; btn.style.height = 'auto'; btn.style.minHeight = '60px'; btn.style.flexDirection = 'column'; btn.style.padding = '8px'; 
            btn.innerHTML = `<div style="font-weight:bold; font-size:1.1em; margin-bottom:4px;">🌟 限界突破・進化！</div><div style="font-size:0.75em; font-weight:normal;">消費: ${cost.toLocaleString()} XP ／ 素材 ${EVO_STOCK_REQ}個</div>`; btn.onclick = executeEvolution; evoContainer.appendChild(btn); evoContainer.classList.remove('hidden');
        }
        if (currentR === 'UR' && o.level >= maxLv && o.count >= EVO_STOCK_REQ) {
            const btn = document.createElement('button'); btn.className = 'detail-btn'; btn.style.background = 'linear-gradient(to right, #3498db, #8e44ad)'; btn.style.borderBottom = '5px solid #5b2c6f'; btn.style.marginBottom = '10px'; btn.style.height = 'auto'; btn.style.minHeight = '60px'; btn.style.flexDirection = 'column'; btn.style.padding = '8px';
            btn.innerHTML = `<div style="font-weight:bold; font-size:1.1em; margin-bottom:4px;">🪽 転生する</div><div style="font-size:0.75em; font-weight:normal;">消費: ${REBORN_COST_XP.toLocaleString()} XP ／ 素材 ${EVO_STOCK_REQ}個</div>`; btn.onclick = executeReincarnation; evoContainer.appendChild(btn); evoContainer.classList.remove('hidden');
        }
    }
}

function closeCharaDetail() { document.getElementById('chara-detail-overlay')?.classList.add('hidden'); renderZukan(); }
function equipCurrentChara() { gameState.equipped=viewingCharaId; saveGame(); alert("装備しました"); closeCharaDetail(); renderZukan(); updateTitleInfo(); }
async function sellCharaStock() { const o=gameState.charaInventory[viewingCharaId]; if (o && o.count > 0 && !(await showConfirm("売却しますか？"))) return; if(o && o.count>0){ o.count--; gameState.xp+=200; saveGame(); openCharaDetail(viewingCharaId); } }

async function useExpItem(itemId, gain) {
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
    
    saveGame(); playSE('start'); 
    if (lvUp > 0) alert(`レベルアップ！ Lv.${inv.level}`);
    openCharaDetail(viewingCharaId);
}

let selectedMaterials = {};
function openEnhanceMenu() { selectedMaterials = {}; document.getElementById('material-select-overlay')?.classList.remove('hidden'); document.getElementById('chara-detail-overlay')?.classList.add('hidden'); renderEnhanceList(); }
function closeEnhanceMenu() { document.getElementById('material-select-overlay')?.classList.add('hidden'); openCharaDetail(viewingCharaId); }

function renderEnhanceList() {
    const list = document.getElementById('material-list'); if(!list) return; list.innerHTML = ''; let totalGain = 0;
    if(!rawData.characters) return;
    rawData.characters.forEach(c => {
        if (c.id === viewingCharaId) return; const inv = gameState.charaInventory[c.id]; if (!inv || inv.count <= 0) return;
        const selectCount = selectedMaterials[c.id] || 0; const expVal = MAT_EXP[c.rarity] || 25; if(selectCount > 0) totalGain += (expVal * selectCount);
        let visual = (c.imageUrl && c.imageUrl.startsWith('http')) ? `<img src="${c.imageUrl}" style="width:40px;height:40px;">` : `<span>📦</span>`;
        let activeClass = selectCount > 0 ? 'selected' : ''; let badge = selectCount > 0 ? `<div class="mat-select-badge">${selectCount}</div>` : '';
        list.innerHTML += `<div class="mat-card ${activeClass}" onclick="toggleMaterial('${c.id}', ${inv.count})">${badge}<div class="rarity-${c.rarity}">${c.rarity}</div>${visual}<div style="font-weight:bold; font-size:0.8em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.name}</div><div style="font-size:0.7em;">所持: ${inv.count}</div><div class="mat-exp-val">+${expVal}</div></div>`;
    });
    updateEnhancePreview(totalGain);
}

function toggleMaterial(id, maxCount) { if (!selectedMaterials[id]) selectedMaterials[id] = 0; selectedMaterials[id]++; if (selectedMaterials[id] > maxCount) { selectedMaterials[id] = 0; } renderEnhanceList(); }

function updateEnhancePreview(gainExp) {
    const enhanceTotal = document.getElementById('enhance-total-exp'); if(enhanceTotal) enhanceTotal.innerText = gainExp;
    const t = gameState.charaInventory[viewingCharaId]; const chara = rawData.characters ? rawData.characters.find(x => x.id === viewingCharaId) : null; if (!t || !chara) return;
    const currentR = t.currentRarity || chara.rarity; const maxLv = RARITY_CAPS[currentR] || 10;
    let simExp = t.exp + gainExp; let simLv = t.level;
    while (simExp >= EXP_REQ) { if (simLv >= maxLv) { simExp = 0; break; } simExp -= EXP_REQ; simLv++; }
    const preview = document.getElementById('enhance-lv-preview');
    if(!preview) return;
    if (simLv > t.level) { preview.innerHTML = `Lv.${t.level} <span style="font-weight:bold;">➞ ${simLv}</span>`; preview.style.color = '#e67e22'; } else { preview.innerText = `Lv.${t.level} (あと${EXP_REQ - simExp})`; preview.style.color = '#7f8c8d'; }
}

async function executeBulkEnhance() {
    const totalSelected = Object.values(selectedMaterials).reduce((a, b) => a + b, 0); if (totalSelected === 0) return alert("素材を選択してください");
    let totalGain = 0; Object.keys(selectedMaterials).forEach(id => { const count = selectedMaterials[id]; if (count > 0 && rawData.characters) { const matChar = rawData.characters.find(c => c.id === id); if(matChar) { const expVal = MAT_EXP[matChar.rarity] || 25; totalGain += (expVal * count); } } });
    if (!(await showConfirm(`選択した${totalSelected}体を消費して強化しますか？\n獲得EXP: ${totalGain}`))) return;
    Object.keys(selectedMaterials).forEach(id => { const count = selectedMaterials[id]; if (gameState.charaInventory[id]) { gameState.charaInventory[id].count -= count; if (gameState.charaInventory[id].count < 0) gameState.charaInventory[id].count = 0; } });
    const t = gameState.charaInventory[viewingCharaId]; const chara = rawData.characters ? rawData.characters.find(x => x.id === viewingCharaId) : null;
    const currentR = t.currentRarity || (chara ? chara.rarity : 'N'); const maxLv = RARITY_CAPS[currentR] || 10;
    t.exp = (Number(t.exp) || 0) + totalGain; let lvUpCount = 0;
    while (t.exp >= EXP_REQ) { if (t.level >= maxLv) { t.exp = 0; break; } t.exp -= EXP_REQ; t.level++; lvUpCount++; }
    updateMissionProgress('enhance', 1); checkTitles(); saveGame();
    alert(`強化完了！\n経験値 +${totalGain} を獲得しました。${lvUpCount > 0 ? '\nレベルアップしました！' : ''}`);
    selectedMaterials = {}; renderEnhanceList(); updateEnhancePreview(0);
    if(chara) {
        const cdLv = document.getElementById('cd-lv'); if(cdLv) cdLv.innerText = 'Lv.' + t.level + ' / ' + maxLv; 
        const cdExpText = document.getElementById('cd-exp-text'); if(cdExpText) cdExpText.innerText = t.exp + ' / ' + EXP_REQ; 
        const cdExpBar = document.getElementById('cd-exp-bar'); if(cdExpBar) cdExpBar.style.width = (t.exp / EXP_REQ * 100) + '%';
        const baseVal = (t.isEvolved && t.customValue) ? t.customValue : Number(chara.value); 
        const cdVal = document.getElementById('cd-val'); if(cdVal) cdVal.innerText='x'+(baseVal+(t.level*LV_BONUS_RATE)).toFixed(2);
    }
}

/* ------------------------------------------
 * ショップ・アイテム
 * ------------------------------------------ */
let currentShopTab = 'buy'; 
function openShop() { document.getElementById('shop-overlay')?.classList.remove('hidden'); renderShop(); }
function closeShop() { document.getElementById('shop-overlay')?.classList.add('hidden'); }
function renderShop() {
    const shopXp = document.getElementById('shop-xp'); if(shopXp) shopXp.innerText = gameState.xp;
    const l=document.getElementById('shop-list'); if(!l) return;
    l.innerHTML=`<div class="page-counter-container"><div class="page-item">📕 <span>${gameState.inventory.redPages||0}</span></div><div class="page-item">📘 <span>${gameState.inventory.bluePages||0}</span></div></div><div class="item-tab-container"><div class="item-tab ${currentShopTab==='buy'?'active':''}" onclick="currentShopTab='buy'; renderShop();">学習アイテム</div><div class="item-tab ${currentShopTab==='exchange'?'active':''}" onclick="currentShopTab='exchange'; renderShop();">アイテム交換</div></div>`; 
    if(currentShopTab === 'buy') {
        if(rawData.shopItems) rawData.shopItems.forEach(i=>{ 
            const lv = (gameState.itemLevels && gameState.itemLevels[i.id]) ? gameState.itemLevels[i.id] : 0; const p=i.price*(lv+1); 
            l.innerHTML+=`<div class="shop-item"><div class="shop-icon">${i.icon}</div><div class="shop-info"><div class="shop-name">${i.name}</div><div class="shop-desc">${i.desc}</div></div><div class="shop-right"><div class="shop-level-tag">Lv.${lv} / ${MAX_ITEM_LEVEL}</div><button class="shop-buy-btn" onclick="buyItem('${i.id}',${p})">${lv>=10?'MAX':'⬆ '+p+'XP'}</button></div></div>`; 
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
function exchangeBook(bookId, cost) { if (gameState.inventory.redPages < cost || gameState.inventory.bluePages < cost) return; gameState.inventory.redPages -= cost; gameState.inventory.bluePages -= cost; gameState.inventory[bookId]++; updateMissionProgress('shop', 1); saveGame(); renderShop(); playSE('win'); }
function buyItem(id,p) { if (!gameState.itemLevels) gameState.itemLevels = {}; if((gameState.itemLevels[id]||0)>=10)return; if(gameState.xp<p)return alert("XP不足"); gameState.xp-=p; gameState.itemLevels[id]=(gameState.itemLevels[id]||0)+1; updateMissionProgress('shop', 1); saveGame(); openShop(); updateTitleInfo(); checkTitles(); }

function openVersionHistory() { document.getElementById('version-overlay')?.classList.remove('hidden'); }
function closeVersionHistory() { document.getElementById('version-overlay')?.classList.add('hidden'); }
function openHowToPlay() { document.getElementById('howto-overlay')?.classList.remove('hidden'); }
function closeHowToPlay() { document.getElementById('howto-overlay')?.classList.add('hidden'); }

/* ------------------------------------------
 * ガチャシステム
 * ------------------------------------------ */
function openGacha() { 
    document.getElementById('gacha-overlay')?.classList.remove('hidden'); 
    const gXp = document.getElementById('gacha-xp');
    if(gXp) gXp.innerText = gameState.xp;
    renderZukan(); 
}

function closeGacha() { 
    document.getElementById('gacha-overlay')?.classList.add('hidden'); 
}

async function rollGacha(times) {
    const cost = times === 10 ? 30000 : 3000;
    if (gameState.xp < cost) return alert("XPが足りません！");
    if (!(await showConfirm(`${cost} XPを消費してガチャを${times}回引きますか？`))) return;
    gameState.xp -= cost;
    executeGacha(times, null);
}

async function rollGuaranteedTenGacha(rarity, cost) {
    if (gameState.xp < cost) return alert("XPが足りません！");
    if (!(await showConfirm(`${cost} XPを消費して${rarity}確定10連ガチャを引きますか？`))) return;
    gameState.xp -= cost;
    executeGacha(10, rarity);
}

function executeGacha(times, guaranteedRarity) {
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
        if (rand < 0.01) return getRandChar('UR');
        if (rand < 0.05) return getRandChar('SSR');
        if (rand < 0.20) return getRandChar('SR');
        if (rand < 0.50) return getRandChar('R');
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
            gameState.charaInventory[c.id].count++;
        }
    }
    
    playSE('win');
    if(typeof updateMissionProgress === 'function') updateMissionProgress('gacha', 1);
    saveGame();
    showGachaResult(results);
}

function showGachaResult(results) {
    const container = document.getElementById('gr-container');
    if (!container) return;
    container.innerHTML = `<h3 style="color:#8e44ad; margin-top:0;">ガチャ結果</h3><div class="gr-grid"></div>`;
    const grid = container.querySelector('.gr-grid');
    
    results.forEach(c => {
        let visual = (c.imageUrl && c.imageUrl.startsWith('http')) ? `<img src="${c.imageUrl}" class="gr-mini-img">` : `<div style="font-size:2em;margin:10px 0;">📦</div>`;
        grid.innerHTML += `<div class="gr-mini-card"><div class="rarity-${c.rarity}" style="font-weight:bold;">${c.rarity}</div>${visual}<div style="font-size:0.7em;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;">${c.name}</div></div>`;
    });
    
    const xpSpan = document.getElementById('gacha-xp');
    if(xpSpan) xpSpan.innerText = gameState.xp;
    
    document.getElementById('gacha-result-overlay')?.classList.remove('hidden');
    if(typeof updateTitleInfo === 'function') updateTitleInfo();
    renderZukan();
    if(typeof checkTitles === 'function') checkTitles();
}

function closeGachaResult() {
    document.getElementById('gacha-result-overlay')?.classList.add('hidden');
}

/* ------------------------------------------
 * タイピングUI更新
 * ------------------------------------------ */
function renderTypingUI() {
    if (!playData.typingTarget) return;
    const jpBox = document.getElementById('ui-typing-jp');
    const romajiBox = document.getElementById('ui-typing-romaji');
    if(jpBox) jpBox.innerText = playData.typingTarget.japanese;
    if(romajiBox) {
        const targetStr = playData.typingTarget.romaji;
        const idx = playData.typingIndex;
        const done = targetStr.substring(0, idx);
        const cur = targetStr.substring(idx, idx + 1);
        const rest = targetStr.substring(idx + 1);
        romajiBox.innerHTML = `<span class="typing-char-done">${done}</span><span class="typing-char-current">${cur || ''}</span><span class="typing-char-rest">${rest}</span>`;
    }
}

// =====================================
// 追加: ローグライクメニュー開閉
// =====================================
function openRogueMenu() {
    if(!rawData.questions) return;
    const grades = [...new Set(rawData.questions.map(q => q.grade))].filter(g=>g);
    const sel = document.getElementById('rogue-grade-select'); 
    if(sel) {
        sel.innerHTML = '<option value="">学年を選択...</option>';
        grades.forEach(g => sel.innerHTML += `<option value="${g}">${g}</option>`);
    }
    document.getElementById('rogue-menu-overlay')?.classList.remove('hidden');
}
function closeRogueMenu() { document.getElementById('rogue-menu-overlay')?.classList.add('hidden'); }
