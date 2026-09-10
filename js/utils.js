// ==========================================
// js/utils.js (計算ロジック・チャート描画・音響制御)
// ==========================================

import { RARITY_ORDER, runtimeState, rogueData } from './state.js?v=10.2.5';

export const getRarityIndex = (r) => RARITY_ORDER.indexOf(r);

/**
 * キャラクターの表示名を取得する（進化・転生装飾対応）
 * @param {Object} char キャラクターマスターデータ
 * @param {Object} inv ユーザーのキャラクター所持データ
 * @param {boolean} isHtml HTMLタグ付きで装飾を付与するかどうか（falseの場合はプレーンテキスト）
 * @returns {string} キャラクター表示名
 */
export function getDisplayName(char, inv, isHtml = true) {
    if (!char) return "";
    if (!inv) return char.name || "";
    let name = char.name || "";
    const currentR = inv.currentRarity || char.rarity;
    if (typeof getRarityIndex === 'function' && getRarityIndex(currentR) > getRarityIndex(char.rarity)) {
        name += isHtml ? '<span class="name-deco-evo">✨️</span>' : '✨️';
    }
    if (inv.reincarnationCount && inv.reincarnationCount > 0) {
        name += isHtml ? '<span class="name-deco-reborn">🪽</span>' : '🪽';
    }
    return name;
}

export const ALL_GRADES = [
    '小1', '小2', '小3', '小4', '小5', '小6',
    '中1', '中2', '中3',
    '高1', '高2', '高3'
];

/**
 * 2つの学年表記が一致するかを判定（全角・半角・「○年」表記ゆれを吸収）
 * 例: '中1' と '中１' -> true, '小4' と '4年' -> true
 */
export function isGradeMatch(g1, g2) {
    if (!g1 || !g2) return false;
    const norm = (s) => String(s).trim()
        .replace('小学校', '小').replace('中学校', '中').replace('高等学校', '高').replace('高校', '高')
        .replace(/[０-９]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0xFEE0))
        .replace(/^(\d+)年$/, '小$1');
    return norm(g1) === norm(g2);
}

export function getGradeMultiplier(gradeStr) {
    const g = String(gradeStr || '');
    if (isGradeMatch(g, '高3')) return 2.20;
    if (isGradeMatch(g, '高2')) return 2.10;
    if (isGradeMatch(g, '高1')) return 2.00;
    if (isGradeMatch(g, '中3')) return 1.90;
    if (isGradeMatch(g, '中2')) return 1.80;
    if (isGradeMatch(g, '中1')) return 1.70;
    if (isGradeMatch(g, '小6')) return 1.60;
    if (isGradeMatch(g, '小5')) return 1.50;
    if (isGradeMatch(g, '小4')) return 1.40;
    if (isGradeMatch(g, '小3')) return 1.30;
    if (isGradeMatch(g, '小2')) return 1.10;
    return 1.00; // 小1 or 学年不明
}

export function generateCalcQuestion(type) {
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    let a, b, q = '', answer = 0;
    const actualType = type === 'random' ? ['addition','subtraction','multiplication','division','division_remainder'][Math.floor(Math.random() * 5)] : type;
    if (actualType === 'addition') {
        a = rand(0, 9); b = rand(0, 9); answer = a + b; q = `${a} + ${b} = ?`;
    } else if (actualType === 'subtraction') {
        a = rand(10, 19); b = rand(0, 9); answer = a - b; q = `${a} - ${b} = ?`;
    } else if (actualType === 'multiplication') {
        a = rand(1, 9); b = rand(1, 9); answer = a * b; q = `${a} × ${b} = ?`;
    } else if (actualType === 'division') {
        b = rand(1, 9); answer = rand(1, 9); a = b * answer; q = `${a} ÷ ${b} = ?`;
    } else if (actualType === 'division_remainder') {
        b = rand(1, 9); const quotient = rand(0, 9); const remainder = rand(0, b - 1); a = b * quotient + remainder; answer = quotient; q = `${a} ÷ ${b} = ?  (余り${remainder})`;
    }
    return { q, answer, type: actualType };
}

export function drawRadarChart(labels, data) {
    const canvas = document.getElementById('radar-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 高DPIディスプレイ対応
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 260;
    const displayHeight = 260;
    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';
    }
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    const cx = displayWidth / 2;
    const cy = displayHeight / 2;
    const radius = 72; // 外側ラベルの文字切れを防ぐための適正半径
    
    const count = labels ? labels.length : 0;
    const sides = Math.max(3, count);
    
    // 背景グリッド描画（5段階: 20%, 40%, 60%, 80%, 100%）
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
        const r = radius * (i / 5);
        ctx.beginPath();
        for (let j = 0; j < sides; j++) {
            const angle = (Math.PI * 2 * j) / sides - Math.PI / 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }
    
    // 軸線およびラベル描画
    ctx.font = 'bold 11px "BIZ UDPGothic", sans-serif';
    for (let j = 0; j < sides; j++) {
        const angle = (Math.PI * 2 * j) / sides - Math.PI / 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();
        
        if (j < count) {
            const labelDist = radius + 18;
            const lx = cx + Math.cos(angle) * labelDist;
            const ly = cy + Math.sin(angle) * labelDist;
            
            const cos = Math.cos(angle);
            if (Math.abs(cos) < 0.25) {
                ctx.textAlign = 'center';
            } else if (cos > 0) {
                ctx.textAlign = 'left';
            } else {
                ctx.textAlign = 'right';
            }
            
            const sin = Math.sin(angle);
            if (Math.abs(sin) < 0.25) {
                ctx.textBaseline = 'middle';
            } else if (sin > 0) {
                ctx.textBaseline = 'top';
            } else {
                ctx.textBaseline = 'bottom';
            }
            
            ctx.fillStyle = '#2c3e50';
            ctx.fillText(labels[j], lx, ly);
        }
    }
    
    // データポリゴンの描画
    if (count >= 3 && data && data.length >= 3) {
        ctx.beginPath();
        for (let j = 0; j < count; j++) {
            const val = Math.min(100, Math.max(0, Number(data[j]) || 0));
            const r = radius * (val / 100);
            const angle = (Math.PI * 2 * j) / count - Math.PI / 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(142, 68, 173, 0.35)';
        ctx.fill();
        ctx.strokeStyle = '#8e44ad';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        // 頂点ドット描画
        for (let j = 0; j < count; j++) {
            const val = Math.min(100, Math.max(0, Number(data[j]) || 0));
            const r = radius * (val / 100);
            const angle = (Math.PI * 2 * j) / count - Math.PI / 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#8e44ad';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    } else if (count > 0) {
        ctx.fillStyle = '#7f8c8d';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px "BIZ UDPGothic", sans-serif';
        ctx.fillText('※3教科以上プレイで', cx, cy - 8);
        ctx.fillText('チャートが描画されます', cx, cy + 10);
    } else {
        ctx.fillStyle = '#95a5a6';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px "BIZ UDPGothic", sans-serif';
        ctx.fillText('データなし', cx, cy);
    }
    
    ctx.restore();
}

// ==========================================
// 音響管理 (Web Audio API)
// ==========================================
export const audioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
let bgmOscillators = []; 
let bgmTimeout = null;

export const BGM_MML = "T150 L8 O3 G G > C C D C E F G G A G F E D C < B > C4 R4";

/**
 * 音量ボタン（通常・チームバトル両対応）のUIを最新状態に更新
 */
export function updateMuteButtonsUI() {
    const btns = [document.getElementById('btn-mute'), document.getElementById('tb-btn-mute')];
    btns.forEach(btn => {
        if (!btn) return;
        if (runtimeState.isMuted) {
            btn.innerText = "🔇 音量: OFF";
            btn.style.background = "#95a5a6";
            btn.style.borderColor = "#7f8c8d";
        } else {
            btn.innerText = "🔊 音量: ON";
            btn.style.background = "#34495e";
            btn.style.borderColor = "#2c3e50";
        }
    });
}

export function toggleMute() { 
    runtimeState.isMuted = !runtimeState.isMuted;
    updateMuteButtonsUI();
    if(runtimeState.isMuted) { 
        stopBGM(); 
    } else { 
        playSE('hit'); playBGM(); 
    } 
}

export function playSE(type) {
    if (runtimeState.isMuted) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.warn('AudioContext resume was blocked', e));
    }
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        if (type === 'type_hit') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(1500, now); gainNode.gain.setValueAtTime(0.15, now); gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08); osc.start(now); osc.stop(now + 0.08);
        } else if (type === 'type_miss') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(50, now + 0.15); gainNode.gain.setValueAtTime(0.2, now); gainNode.gain.linearRampToValueAtTime(0.001, now + 0.15); osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'hit') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'miss') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(100, now + 0.3); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'win') {
            osc.type = 'square'; gainNode.gain.value = 0.1;
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                const t = now + i * 0.1; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = 'square'; o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.1); o.start(t); o.stop(t + 0.1);
            });
        } else if (type === 'lose') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(50, now + 1.0); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0.01, now + 1.0); osc.start(now); osc.stop(now + 1.0);
        } else if (type === 'count') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now); gainNode.gain.setValueAtTime(0.1, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'start') {
            osc.type = 'square'; osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(1760, now + 0.3); gainNode.gain.setValueAtTime(0.1, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3);
        }
    } catch(e) {}
}

export function playBGM() {
    if (runtimeState.isMuted) return; 
    if (audioCtx.state === 'suspended') { 
        audioCtx.resume().catch(e => console.warn('BGM resume blocked', e)); 
    }
    stopBGM();
    playMmlBGM();
}

export function stopBGM() { 
    if (bgmTimeout) clearTimeout(bgmTimeout); 
    bgmOscillators.forEach(osc => { 
        try { osc.stop(); } catch(e){} 
    }); 
    bgmOscillators = []; 
}

export function playMmlBGM() {
    const mml = BGM_MML.replace(/\s+/g, '').toUpperCase();
    let index = 0;
    let nextTime = audioCtx.currentTime + 0.1;
    let octave = 4;
    let defaultLen = 4;
    let tempo = 120;

    const scheduleNote = () => {
        const isTbActive = (typeof tbState !== 'undefined' && tbState.isActive) ||
                           (typeof window !== 'undefined' && window.tbState && window.tbState.isActive);
        const canPlay = runtimeState.isGameActive || (typeof rogueData !== 'undefined' && rogueData.active) || isTbActive;
        if (!canPlay) return;
        try {
            while (nextTime < audioCtx.currentTime + 2.0 && index < mml.length) {
                let char = mml[index++];
                if (char === 'T') {
                    let num = parseInt(mml.slice(index)); if (!isNaN(num)) { tempo = num; index += String(num).length; }
                } else if (char === 'L') {
                    let num = parseInt(mml.slice(index)); if (!isNaN(num)) { defaultLen = num; index += String(num).length; }
                } else if (char === 'O') {
                    let num = parseInt(mml.slice(index)); if (!isNaN(num)) { octave = num; index += String(num).length; }
                } else if (char === '>') {
                    octave++;
                } else if (char === '<') {
                    octave--;
                } else if (char === 'R') {
                    let len = defaultLen; let num = parseInt(mml.slice(index)); if (!isNaN(num)) { len = num; index += String(num).length; }
                    nextTime += (60 / tempo) * (4 / len);
                } else if ("CDEFGAB".includes(char)) {
                    let note = char;
                    if (mml[index] === '#' || mml[index] === '+') { note += '#'; index++; }
                    else if (mml[index] === '-') { note += '-'; index++; }
                    let len = defaultLen;
                    let num = parseInt(mml.slice(index));
                    if (!isNaN(num)) { len = num; index += String(num).length; }
                    
                    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
                    let keyIndex = notes.indexOf(note.replace('-', ''));
                    if (keyIndex === -1) keyIndex = 0;
                    
                    const freq = 440 * Math.pow(2, (octave - 4) + (keyIndex - 9) / 12);
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.type = 'square';
                    osc.frequency.value = freq;
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    
                    const duration = (60 / tempo) * (4 / len);
                    osc.start(nextTime);
                    osc.stop(nextTime + duration - 0.05);
                    gain.gain.setValueAtTime(0.05, nextTime);
                    gain.gain.linearRampToValueAtTime(0.02, nextTime + duration - 0.05);
                    gain.gain.setValueAtTime(0, nextTime + duration);
                    bgmOscillators.push(osc);
                    nextTime += duration;
                }
            }
        } catch(e) {}
        if (index >= mml.length) index = 0; 
        if (canPlay && !runtimeState.isMuted) bgmTimeout = setTimeout(scheduleNote, 500);
    };
    scheduleNote();
}

/**
 * 安全な <img> HTML タグを生成（referrerpolicy="no-referrer" と onerror フォールバックを完備）
 * Google Drive等のCDNがRefererヘッダーによるアクセス過多（HTTP 429/403）でブロックするのを物理遮断し、
 * 通信失敗時も破れた画像アイコンにならず代替絵文字へ自動フォールバックする。
 * 
 * @param {string} url 画像URL
 * @param {string} [altEmoji='👾'] 読み込み失敗時またはURL未指定時の代替絵文字
 * @param {string} [className=''] class属性
 * @param {string} [style=''] style属性
 * @returns {string} HTML文字列
 */
export function renderSafeImg(url, altEmoji = '👾', className = '', style = '') {
    if (!url || typeof url !== 'string' || (!url.startsWith('http') && !url.startsWith('data:image'))) {
        const spanStyle = style ? `${style}; display:inline-flex; align-items:center; justify-content:center;` : 'display:inline-flex; align-items:center; justify-content:center;';
        return `<span class="${className}" style="${spanStyle}">${altEmoji}</span>`;
    }
    const classAttr = className ? ` class="${className}"` : '';
    const styleAttr = style ? ` style="${style}"` : '';
    const safeAlt = (altEmoji || '👾').replace(/'/g, "\\'");
    const safeClass = className.replace(/'/g, "\\'");
    const safeStyle = (style ? `${style}; display:inline-flex; align-items:center; justify-content:center;` : 'display:inline-flex; align-items:center; justify-content:center;').replace(/'/g, "\\'");
    const fallbackJs = `this.onerror=null; const s=document.createElement('span'); s.textContent='${safeAlt}'; ${safeClass ? `s.className='${safeClass}';` : ''} s.style.cssText='${safeStyle}'; this.replaceWith(s);`;
    return `<img src="${url}" referrerpolicy="no-referrer"${classAttr}${styleAttr} onerror="${fallbackJs}">`;
}

