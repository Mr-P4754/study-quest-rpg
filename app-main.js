// ==========================================
// app-main.js (初期化・デイリー・称号管理)
// ==========================================

function initTitle() {
    if(!rawData.questions || rawData.questions.length === 0) return;
    const grades = [...new Set(rawData.questions.map(q => q.grade))].filter(g=>g);
    
    // 通常クエスト用
    const gSelect = document.getElementById('grade-select'); 
    if(gSelect) {
        gSelect.innerHTML = '<option value="">学年を選択</option>';
        grades.forEach(g => gSelect.innerHTML += `<option value="${g}">${g}</option>`);
    }
    
    // サバイバル用初期化
    const survSelect = document.getElementById('survival-grade-select');
    if(survSelect) {
        survSelect.innerHTML = '<option value="">学年を選択...</option>';
        grades.forEach(g => survSelect.innerHTML += `<option value="${g}">${g}</option>`);
    }

    filterSubjects(); 
    updateTitleInfo();
}

function filterSubjects() {
    const gSelect = document.getElementById('grade-select'); if(!gSelect) return;
    const gVal = gSelect.value;
    const sSelect = document.getElementById('subject-select'); if(!sSelect) return; sSelect.innerHTML = '<option value="">教科を選択</option>';
    const uSelect = document.getElementById('unit-select'); if(uSelect) uSelect.innerHTML = '<option value="">単元を選択</option>';
    if(!gVal) return;
    let targetList = rawData.questions.filter(q => q.grade == gVal);
    const subjects = [...new Set(targetList.map(q => q.subject))].filter(s=>s);
    subjects.forEach(s => sSelect.innerHTML += `<option value="${s}">${s}</option>`);
}

function filterUnits() {
    const gSelect = document.getElementById('grade-select'); const sSelect = document.getElementById('subject-select'); if(!gSelect || !sSelect) return;
    const gVal = gSelect.value; const sVal = sSelect.value;
    const uSelect = document.getElementById('unit-select'); if(!uSelect) return; uSelect.innerHTML = '<option value="">単元を選択</option>';
    if(!gVal || !sVal) return;
    let targetList = rawData.questions.filter(q => q.grade == gVal && q.subject == sVal);
    const units = [...new Set(targetList.map(q => q.unit))].filter(u=>u);
    const activeConfigs = rawData.config ? rawData.config.filter(c => c.message && c.message !== "") : [];
    units.forEach(u => {
        let label = u; const isTarget = activeConfigs.some(c => String(c.grade) === String(gVal) && String(c.subject) === String(sVal) && String(c.unit) === String(u));
        if (isTarget) label = "★ " + u;
        if (gameState.unitProgress) { const key = `${gVal}_${sVal}_${u}`; const prog = gameState.unitProgress[key]; if (prog) { if (prog.cleared) label += " ◎"; else if (prog.played) label += " ◯"; } }
        uSelect.innerHTML += `<option value="${u}">${label}</option>`;
    });
}

function updateTitleInfo() {
    const chara = (rawData.characters && rawData.characters.length > 0) ? rawData.characters.find(c => c.id == gameState.equipped) : null;
    let lv = (gameState.charaInventory[gameState.equipped] || {}).level || 0;
    const tEquippedName = document.getElementById('title-equipped-name'); if(tEquippedName) tEquippedName.innerText = (chara ? chara.name : "なし") + " Lv." + lv;
    const tXp = document.getElementById('title-xp'); if(tXp) tXp.innerText = gameState.xp;
    const imgContainer = document.getElementById('title-chara-img');
    if(imgContainer) {
        if(chara?.imageUrl && chara.imageUrl.startsWith('http')) imgContainer.innerHTML = `<img src="${chara.imageUrl}" style="width:100%;height:100%;object-fit:cover;">`;
        else imgContainer.innerHTML = `<div style="text-align:center;line-height:40px;">✏️</div>`;
    }
    const rBtn = document.getElementById('btn-revenge'); const rCount = (gameState.revengeList || []).length;
    if(rBtn) {
        if (rCount > 0) { rBtn.disabled = false; rBtn.innerHTML = `💀 リベンジ・ダンジョン <div class="badge">${rCount}</div>`; } else { rBtn.disabled = true; rBtn.innerHTML = `💀 リベンジ・ダンジョン <div class="badge hidden">0</div>`; }
    }
    const banner = document.getElementById('campaign-banner'); const bannerText = document.getElementById('campaign-text');
    let activeConfigs = []; if (rawData.config) activeConfigs = rawData.config.filter(c => c.message && c.message !== "");
    if(banner && bannerText) {
        if (activeConfigs.length > 0) { banner.classList.remove('hidden'); banner.style.display = 'block'; const combinedText = activeConfigs.map(c => `📢 ${c.message} （強化対象: ${c.grade} ${c.subject} ${c.unit}）`).join("   "); bannerText.innerText = combinedText; } else { banner.style.display = 'none'; }
    }
}

function checkTitles() {
    let count = 0; let collectionCount = 0; 
    let hasSSR = false; let hasUR = false; let hasLvMax = false; let hasMastered = false;
    
    if(gameState.charaInventory && rawData.characters && rawData.characters.length > 0) {
        collectionCount = Object.keys(gameState.charaInventory).length;
        Object.keys(gameState.charaInventory).forEach(id => {
            const c = rawData.characters.find(x => x.id === id); const inv = gameState.charaInventory[id];
            if(c && c.rarity === 'SSR') hasSSR = true;
            if(c && c.rarity === 'UR') hasUR = true;
            if(inv && inv.level >= 20) hasLvMax = true;
            if(inv && inv.count >= MASTER_COUNT) hasMastered = true;
        });
    }
    let hasItemMax = false;
    if(gameState.itemLevels) Object.values(gameState.itemLevels).forEach(lv => { if(lv >= MAX_ITEM_LEVEL) hasItemMax = true; });

    TITLES.forEach(t => {
        if (gameState.unlockedTitles.includes(t.id)) return;
        let cleared = false;
        if (t.req === 'perfect' && gameState.stats.achieved_perfect) cleared = true;
        else if (t.req === 'speed' && gameState.stats.achieved_speed) cleared = true;
        else if (t.req === 'ssr' && hasSSR) cleared = true;
        else if (t.req === 'ur' && hasUR) cleared = true;
        else if (t.req === 'lvMax' && hasLvMax) cleared = true;
        else if (t.req === 'itemMax' && hasItemMax) cleared = true;
        else if (t.req === 'randomClear' && gameState.stats.achieved_random) cleared = true;
        else if (t.req === 'oathClear' && gameState.stats.achieved_oath) cleared = true;
        else if (t.req === 'evolved' && gameState.stats.achieved_evolve) cleared = true;
        else if (t.req === 'mastered' && hasMastered) cleared = true;
        else if (t.req === 'reborn' && gameState.stats.achieved_reborn) cleared = true;
        else if (t.req === 'calcA' && gameState.stats.achieved_calcA) cleared = true;
        else if (t.req.includes('collection')) { if (collectionCount >= t.val) cleared = true; }
        else if (t.req.includes('xp')) { if (gameState.xp >= t.val) cleared = true; }
        else { 
            try { 
                const match = t.req.match(/^[a-zA-Z]+/);
                if(match) {
                    const key = match[0];
                    const val = gameState.stats[key] || 0; 
                    if (val >= t.val) cleared = true; 
                }
            } catch(e){} 
        }
        if (cleared) count++;
    });
    const badge = document.getElementById('title-badge');
    if(badge) {
        if(count > 0) { badge.classList.remove('hidden'); badge.innerText = count > 9 ? '!' : count; } else { badge.classList.add('hidden'); }
    }
}

function openTitles() { document.getElementById('titles-overlay')?.classList.remove('hidden'); renderTitles(); }
function closeTitles() { document.getElementById('titles-overlay')?.classList.add('hidden'); }

function renderTitles() {
    const list = document.getElementById('titles-list'); if(!list) return; list.innerHTML = '';
    let collectionCount = 0; 
    let hasSSR = false; let hasUR = false; let hasLvMax = false; let hasMastered = false;
    
    if(gameState.charaInventory) {
        collectionCount = Object.keys(gameState.charaInventory).length;
        Object.keys(gameState.charaInventory).forEach(id => {
            const c = rawData.characters ? rawData.characters.find(x => x.id === id) : null;
            const inv = gameState.charaInventory[id];
            if(c && c.rarity === 'SSR') hasSSR = true;
            if(c && c.rarity === 'UR') hasUR = true;
            if(inv && inv.level >= 20) hasLvMax = true;
            if(inv && inv.count >= MASTER_COUNT) hasMastered = true;
        });
    }

    TITLES.forEach(t => {
        const isClaimed = gameState.unlockedTitles.includes(t.id); let isUnlocked = false;
        if (isClaimed) isUnlocked = true;
        else {
            if (t.req.includes('collection') && collectionCount >= t.val) isUnlocked = true;
            else if (t.req.includes('xp') && gameState.xp >= t.val) isUnlocked = true;
            else if (t.req === 'ssr' && hasSSR) isUnlocked = true;
            else if (t.req === 'ur' && hasUR) isUnlocked = true;
            else if (t.req === 'lvMax' && hasLvMax) isUnlocked = true;
            else if (t.req === 'itemMax' && Object.values(gameState.itemLevels).some(lv => lv >= MAX_ITEM_LEVEL)) isUnlocked = true;
            else if (t.req === 'perfect' && gameState.stats.achieved_perfect) isUnlocked = true;
            else if (t.req === 'speed' && gameState.stats.achieved_speed) isUnlocked = true;
            else if (t.req === 'randomClear' && gameState.stats.achieved_random) isUnlocked = true;
            else if (t.req === 'oathClear' && gameState.stats.achieved_oath) isUnlocked = true;
            else if (t.req === 'evolved' && gameState.stats.achieved_evolve) isUnlocked = true;
            else if (t.req === 'mastered' && hasMastered) isUnlocked = true;
            else if (t.req === 'reborn' && gameState.stats.achieved_reborn) isUnlocked = true;
            else if (t.req === 'calcA' && gameState.stats.achieved_calcA) isUnlocked = true;
            else { 
                const match = t.req.match(/^[a-zA-Z]+/);
                if(match) {
                    const key = match[0]; 
                    if ((gameState.stats[key] || 0) >= t.val) isUnlocked = true; 
                }
            }
        }
        let statusClass = isClaimed ? 'claimed' : (isUnlocked ? 'unlocked' : '');
        let btnText = isClaimed ? '受取済' : (isUnlocked ? `受取: ${t.reward}XP` : '未達成');
        let btnAction = (isUnlocked && !isClaimed) ? `onclick="claimTitle('${t.id}', ${t.reward})"` : '';
        list.innerHTML += `<div class="title-item ${statusClass}"><div class="title-header"><span class="title-name">${t.name}</span><button class="title-reward-btn" ${btnAction}>${btnText}</button></div><div class="title-req">${t.desc}</div></div>`;
    });
}

function claimTitle(id, reward) {
    if(gameState.unlockedTitles.includes(id)) return;
    gameState.unlockedTitles.push(id); gameState.xp += reward; saveGame(); renderTitles(); updateTitleInfo(); checkTitles();
    alert(`称号を獲得しました！\n報酬: ${reward} XP`);
}

function checkLoginBonus() { 
    const d=new Date().toLocaleDateString('ja-JP'); 
    if(localStorage.getItem('sq_last_login')!==d){ 
        gameState.xp+=LOGIN_BONUS_EXP; localStorage.setItem('sq_last_login',d); 
        gameState.stats.loginDays = (gameState.stats.loginDays || 0) + 1;
        saveGame(); document.getElementById('login-bonus-overlay')?.classList.remove('hidden'); updateTitleInfo(); checkTitles();
    } 
}
function closeLoginBonus() { document.getElementById('login-bonus-overlay')?.classList.add('hidden'); }

function checkMissionDate() { 
    const d=new Date().toLocaleDateString('ja-JP'); 
    dailyMissions=JSON.parse(localStorage.getItem('sq_missions')||'{"date":"","progress":{},"claimed":{}}'); 
    if(dailyMissions.date!==d){ 
        dailyMissions={date:d,progress:{play:0,kill:0,correct:0,maxCombo:0,enhance:0,typing:0,calc:0,gacha:0,shop:0},claimed:{play:false,kill:false,correct:false,maxCombo:false,enhance:false,typing:false,calc:false,gacha:false,shop:false,allClear:false}}; 
        saveGame(); 
    } 
    updateMissionBadge(); 
}

function updateMissionProgress(t,v) { 
    if(t==='maxCombo') dailyMissions.progress[t]=Math.max(dailyMissions.progress[t]||0,v); 
    else dailyMissions.progress[t]=(dailyMissions.progress[t]||0)+v; 
    saveGame(); updateMissionBadge(); 
}

function updateMissionBadge() { 
    let c=0; 
    MISSIONS.forEach(m=>{ if((dailyMissions.progress[m.id]||0)>=m.target && !dailyMissions.claimed[m.id]) c++; }); 
    document.getElementById('mission-badge')?.classList.toggle('hidden', c===0); 
}

function openMissions() { document.getElementById('mission-overlay')?.classList.remove('hidden'); renderMissions(); }
function closeMissions() { document.getElementById('mission-overlay')?.classList.add('hidden'); }

function renderMissions() { 
    const l=document.getElementById('mission-list'); if(!l) return; l.innerHTML=''; let all=true; 
    MISSIONS.forEach(m=>{ 
        const p=dailyMissions.progress[m.id]||0; 
        const fin=p>=m.target; const clm=dailyMissions.claimed[m.id]; 
        if(!fin)all=false; 
        l.innerHTML+=`<div class="mission-item"><b>${m.title}</b> (${p}/${m.target})<br><small>${m.desc}</small><button class="mission-btn ${fin&&!clm?'active':'disabled'}" onclick="claimMission('${m.id}',${m.reward})">${clm?'受取済':'受取'}</button></div>`; 
    }); 
    const ac=document.getElementById('mission-all-clear'); 
    if(all){ 
        const isClaimed = dailyMissions.claimed.allClear;
        let btnStyle = isClaimed ? '' : 'background:#f1c40f; border-color:#d35400;'; 
        let btnClass = isClaimed ? 'disabled' : ''; 
        let btnText = isClaimed ? '受取済' : `${MISSION_ALL_CLEAR} EXPを受け取る`;
        let btnAction = isClaimed ? '' : 'onclick="claimAllClear()"';
        l.innerHTML += `<div style="margin-top:10px; padding:10px; background:#fef5e7; border:2px solid #e67e22; border-radius:10px;"><div style="font-weight:bold; color:#e67e22;">コンプリート報酬</div><button class="mission-btn ${btnClass}" style="width:100%; margin-top:5px; ${btnStyle}" ${btnAction}>${btnText}</button></div>`; 
    } 
}

function claimMission(id,r) { 
    if(dailyMissions.claimed[id])return; 
    dailyMissions.claimed[id]=true; 
    gameState.xp+=r; saveGame(); renderMissions(); updateTitleInfo(); updateMissionBadge(); 
    alert(r+"EXP獲得"); 
}

function claimAllClear() { 
    if(dailyMissions.claimed.allClear)return; 
    dailyMissions.claimed.allClear=true; 
    gameState.xp+=MISSION_ALL_CLEAR; saveGame(); renderMissions(); updateTitleInfo(); updateMissionBadge(); 
    alert(MISSION_ALL_CLEAR+"EXP獲得"); 
}

// ==========================================
// 初期化エントリーポイント
// ==========================================
window.onload = async () => {
    initUserId();
    loadSaveData();
    checkMissionDate();
    await fetchData();
    initTitle();
    checkLoginBonus();
};
