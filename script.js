(function () {
'use strict';

// --- Manipulationsschutz für den Highscore ---
// Der Wert wird zusammen mit einer Prüfsumme gespeichert. Wer ihn im Browser
// (Untersuchen > Anwendung > Local Storage) ändert, macht die Prüfsumme ungültig.
const HS_KEY = 'mathe_highscore';
const HS_SALT = 'm4th3-s4lz-7Qx!';

function checksum(text) {
    // cyrb53-Hash
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function sign(value) {
    return value + '.' + checksum(HS_SALT + value + HS_SALT);
}

function unsign(stored) {
    if (typeof stored !== 'string') return null;
    const idx = stored.lastIndexOf('.');
    if (idx < 1) return null;
    const value = stored.slice(0, idx);
    return sign(value) === stored ? value : null;
}

let hacked = false;

// --- Sperre: 1 Woche bei Manipulation ---
const BAN_KEY = 'mathe_ban';
const BAN_MS = 7 * 24 * 60 * 60 * 1000;
let banUntil = 0;

function readCookie() {
    const m = document.cookie.match(new RegExp('(?:^|; )' + BAN_KEY + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
}

function writeBan(until) {
    const signed = sign(String(until));
    try { localStorage.setItem(BAN_KEY, signed); } catch (e) {}
    try {
        document.cookie = BAN_KEY + '=' + encodeURIComponent(signed) +
            '; expires=' + new Date(until).toUTCString() + '; path=/; SameSite=Lax';
    } catch (e) {}
}

// Liefert das Ende der Sperre (ms) oder 0. Ein kaputter Eintrag zählt als neue Manipulation.
function getBanUntil() {
    const raws = [];
    try { raws.push(localStorage.getItem(BAN_KEY)); } catch (e) {}
    raws.push(readCookie());
    let until = 0;
    let broken = false;
    raws.forEach(raw => {
        if (raw === null) return;
        const v = unsign(raw);
        const n = parseInt(v, 10);
        if (v === null || Number.isNaN(n)) broken = true;
        else until = Math.max(until, n);
    });
    if (broken) {
        until = Date.now() + BAN_MS;
        writeBan(until);
    } else if (until > Date.now()) {
        writeBan(until); // fehlende Kopie (localStorage/Cookie) wiederherstellen
    }
    return until > Date.now() ? until : 0;
}

function showBanScreen() {
    if (document.getElementById('banOverlay')) return;
    const days = Math.ceil((banUntil - Date.now()) / 86400000);
    const overlay = document.createElement('div');
    overlay.id = 'banOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;color:#fff;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'text-align:center;font-family:sans-serif;';
    overlay.innerHTML = '<div style="font-size:min(60vh,60vw);line-height:1">💀</div>' +
        '<div style="font-size:28px;margin-top:20px">Du hast geschummelt!</div>' +
        '<div style="font-size:18px;margin-top:10px">Gesperrt bis ' +
        new Date(banUntil).toLocaleString('de-DE') + ' (noch ' + days + ' Tag' + (days === 1 ? '' : 'e') + ')</div>';
    document.body.appendChild(overlay);
    if (elements && elements.answerInput) elements.answerInput.disabled = true;
}

function triggerBan() {
    banUntil = Date.now() + BAN_MS;
    writeBan(banUntil);
    showBanScreen();
}

// Sperre prüfen; Overlay wiederherstellen, falls es per "Untersuchen" entfernt wurde
function enforceBan() {
    if (!banUntil) banUntil = getBanUntil();
    else if (banUntil <= Date.now()) { banUntil = 0; return; }
    else getBanUntil();
    if (banUntil) showBanScreen();
}

function saveHighScore(score) {
    try { localStorage.setItem(HS_KEY, sign(String(score))); } catch (e) {}
}

function loadHighScore() {
    try {
        const raw = localStorage.getItem(HS_KEY);
        if (raw === null) return 0;
        const value = unsign(raw);
        const n = parseInt(value, 10);
        if (value === null || Number.isNaN(n) || n < 0) {
            // manipuliert -> zurücksetzen, Totenkopf anzeigen
            localStorage.removeItem(HS_KEY);
            hacked = true;
            triggerBan();
            return 0;
        }
        return n;
    } catch (e) {
        return 0;
    }
}

const state = {
    correct: 0,
    wrong: 0,
    streak: 0,
    currentAnswer: null,
    selectedOperations: [],
    maxNumber: 20,
    grade: 5,
    highScore: 0,
    is60Mode: false,
    timeLeft: 0,
    timerId: null
};

const elements = {
    operationToggles: document.querySelectorAll('.op-toggle input'),
    maxNumberInput: document.getElementById('maxNumber'),
    difficultySelect: document.getElementById('difficultySelect'),
    gradeSelect: document.getElementById('gradeSelect'),
    startBtn: document.getElementById('startBtn'),
    gameArea: document.getElementById('gameArea'),
    problemText: document.getElementById('problemText'),
    answerForm: document.getElementById('answerForm'),
    answerInput: document.getElementById('answerInput'),
    feedback: document.getElementById('feedback'),
    correctCount: document.getElementById('correctCount'),
    wrongCount: document.getElementById('wrongCount'),
    streakCount: document.getElementById('streakCount'),
    highScore: document.getElementById('highScore'),
    resetHighscoreBtn: document.getElementById('resetHighscoreBtn'),
    timerDisplay: document.getElementById('timerDisplay')
};

const GRADE_CONFIGS = {
    5: {
        maxNumber: 20,
        operations: ['addition', 'subtraction', 'multiplication', 'division'],
        addCap: 20,
        mulCap: 12,
        divCap: 12
    }
};

// load saved highscore from localStorage
state.highScore = loadHighScore();

// Unendlicher Highscore: nur in Browsern, in denen er aktiviert wurde.
// Aktivieren: Seite einmal mit ?unendlich=1 öffnen, deaktivieren mit ?unendlich=0
let infiniteHighScore = false;
try {
    const param = new URLSearchParams(window.location.search).get('unendlich');
    if (param === '1') localStorage.setItem('mathe_infinite', sign('1'));
    if (param === '0') localStorage.removeItem('mathe_infinite');
    infiniteHighScore = unsign(localStorage.getItem('mathe_infinite')) === '1';
} catch (e) {
    // ignore storage errors
}

const OPERATIONS = {
    addition: { symbol: '+', name: 'Addition' },
    subtraction: { symbol: '-', name: 'Subtraktion' },
    multiplication: { symbol: '×', name: 'Multiplikation' },
    division: { symbol: '÷', name: 'Division' }
};

function applyGradeSettings() {
    const grade = parseInt(elements.gradeSelect.value, 10) || 5;
    state.grade = grade;
    const cfg = GRADE_CONFIGS[grade] || GRADE_CONFIGS[5];
    elements.maxNumberInput.value = cfg.maxNumber;
    state.maxNumber = cfg.maxNumber;

    Array.from(elements.operationToggles).forEach(input => {
        const allowed = cfg.operations.includes(input.value);
        if (!allowed) input.checked = false;
        input.disabled = !allowed;
        const span = input.parentElement.querySelector('span');
        if (span) span.style.opacity = allowed ? '1' : '0.5';
    });
}

function getSelectedOperations() {
    const gradeConfig = GRADE_CONFIGS[state.grade] || GRADE_CONFIGS[5];
    const allowedOps = new Set(gradeConfig.operations || []);

    return Array.from(elements.operationToggles)
        .filter(input => input.checked && allowedOps.has(input.value))
        .map(input => input.value);
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem() {
    const ops = getSelectedOperations();
    if (ops.length === 0) {
        showFeedback('Wähle mindestens eine Rechenart aus.', 'wrong');
        return;
    }

    state.selectedOperations = ops;
    state.maxNumber = parseInt(elements.maxNumberInput.value, 10) || 20;
    const difficulty = elements.difficultySelect ? elements.difficultySelect.value : 'leicht';
    const hard = difficulty === 'schwer';

    const opKey = ops[getRandomInt(0, ops.length - 1)];
    let a, b, answer, symbol;

    switch (opKey) {
        case 'addition': {
            const max = hard ? 99 : 20;
            const min = hard ? 10 : 1;
            a = getRandomInt(min, max);
            b = getRandomInt(min, max);
            answer = a + b;
            symbol = '+';
            break;
        }
        case 'subtraction': {
            const max = hard ? 9999 : 999;
            const min = hard ? 1000 : 100;
            a = getRandomInt(min, max);
            b = getRandomInt(min, a);
            answer = a - b;
            symbol = '-';
            break;
        }
        case 'multiplication': {
            const max = hard ? 20 : 12;
            const min = hard ? 6 : 2;
            a = getRandomInt(min, max);
            b = getRandomInt(min, max);
            answer = a * b;
            symbol = '×';
            break;
        }
        case 'division': {
            const max = hard ? 25 : Math.min(Math.max(state.maxNumber, 12), 20);
            const min = hard ? 6 : 2;
            b = getRandomInt(min, max);
            answer = getRandomInt(min, max);
            a = b * answer;
            symbol = '÷';
            break;
        }
    }

    state.currentAnswer = answer;
    elements.problemText.textContent = `${a} ${symbol} ${b} = ?`;
    elements.answerInput.value = '';
    elements.answerInput.focus();
    elements.feedback.textContent = '';
}

function showFeedback(message, type) {
    elements.feedback.textContent = message;
    elements.feedback.className = `feedback ${type}`;
}

function updateScoreboard() {
    elements.correctCount.textContent = state.correct;
    elements.wrongCount.textContent = state.wrong;
    elements.streakCount.textContent = state.streak;
    elements.highScore.textContent = expectedHighScoreText();
}

function expectedHighScoreText() {
    if (hacked) return '💀';
    return infiniteHighScore ? '∞' : String(state.highScore || 0);
}

// Manipulationen im laufenden Betrieb erkennen (Local Storage oder Anzeige geändert)
function detectTampering() {
    if (hacked) return;
    let bad = false;
    try {
        const raw = localStorage.getItem(HS_KEY);
        if (raw !== null) {
            const v = unsign(raw);
            if (v === null || parseInt(v, 10) !== state.highScore) bad = true;
        } else if (state.highScore > 0) {
            bad = true;
        }
    } catch (e) {}
    if (elements.highScore && elements.highScore.textContent !== expectedHighScoreText()) bad = true;
    if (bad) {
        hacked = true;
        state.highScore = 0;
        try { localStorage.removeItem(HS_KEY); } catch (e) {}
        updateScoreboard();
        triggerBan();
    }
}
setInterval(() => { detectTampering(); enforceBan(); }, 500);
enforceBan();

function checkAnswer(event) {
    event.preventDefault();

    if (state.currentAnswer === null) {
        return;
    }

    const userAnswer = parseInt(elements.answerInput.value, 10);
    if (Number.isNaN(userAnswer)) {
        showFeedback('Gib eine Zahl ein.', 'wrong');
        return;
    }

    if (userAnswer === state.currentAnswer) {
        state.correct++;
        state.streak++;
        // update highscore if needed
        if (state.correct > (state.highScore || 0)) {
            state.highScore = state.correct;
            saveHighScore(state.highScore);
        }
        showFeedback('Richtig! Gut gemacht. 🎉', 'correct');
        setTimeout(generateProblem, 1200);
    } else {
        state.wrong++;
        state.streak = 0;
        showFeedback('Falsch.', 'wrong');
        // keep the current problem active so a later correct retry is still accepted
        elements.answerInput.value = '';
        elements.answerInput.focus();
    }

    updateScoreboard();
}

elements.startBtn.addEventListener('click', () => {
    const ops = getSelectedOperations();
    if (ops.length === 0) {
        showFeedback('Wähle mindestens eine Rechenart aus.', 'wrong');
        return;
    }
    start60Mode();
});

elements.answerForm.addEventListener('submit', checkAnswer);

function resetSessionScores() {
    state.correct = 0;
    state.wrong = 0;
    state.streak = 0;
    updateScoreboard();
}

function stop60ModeIfRunning() {
    if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
    }
    state.is60Mode = false;
    state.timeLeft = 0;
    if (elements.timerDisplay) elements.timerDisplay.style.display = 'none';
    // reset highscore display style if modified
    if (elements.highScore) {
        elements.highScore.style.fontSize = '';
        elements.highScore.style.fontWeight = '';
        elements.highScore.style.color = '';
    }
    elements.answerInput.disabled = false;
}

function start60Mode() {
    // prepare
    stop60ModeIfRunning();
    resetSessionScores();
    state.is60Mode = true;
    state.timeLeft = 60;
    elements.timerDisplay.style.display = 'block';
    elements.timerDisplay.textContent = `${state.timeLeft}s`;
    elements.gameArea.style.display = 'block';
    applyGradeSettings();
    elements.answerInput.disabled = false;
    generateProblem();
    // start countdown
    state.timerId = setInterval(() => {
        state.timeLeft -= 1;
        elements.timerDisplay.textContent = `${state.timeLeft}s`;
        if (state.timeLeft <= 0) {
            end60Mode();
        }
    }, 1000);
}

function end60Mode() {
    stop60ModeIfRunning();
    // compare session score to highscore and update if needed
    if (state.correct > (state.highScore || 0)) {
        state.highScore = state.correct;
        saveHighScore(state.highScore);
    }
    updateScoreboard();
    // prominently show highscore
    if (elements.highScore) {
        elements.highScore.style.fontSize = '48px';
        elements.highScore.style.fontWeight = '700';
        elements.highScore.style.color = '#d9534f';
    }
    // disable answering until user starts again
    elements.answerInput.disabled = true;
    showFeedback(`Zeit abgelaufen! Du hast ${state.correct} richtig. Dein Highscore wird angezeigt.`, 'info');
}

// initialize grade settings and lock to 5th grade only
if (elements.gradeSelect) {
    // force grade 5 and disable changing it
    elements.gradeSelect.value = '5';
    elements.gradeSelect.disabled = true;
    // hide the grade selector from the UI completely
    try {
        elements.gradeSelect.style.display = 'none';
        if (elements.gradeSelect.parentElement) elements.gradeSelect.parentElement.style.display = 'none';
    } catch (e) {
        // ignore if DOM structure differs
    }
    applyGradeSettings();
    showFeedback('Wähle deine Rechenarten und starte.', 'info');
}

// Reset highscore handler
if (elements.resetHighscoreBtn) {
    elements.resetHighscoreBtn.addEventListener('click', () => {
        const ok = confirm('Highscore wirklich zurücksetzen?');
        if (!ok) return;
        try {
            localStorage.removeItem('mathe_highscore');
        } catch (e) {
            // ignore
        }
        state.highScore = 0;
        updateScoreboard();
        showFeedback('Highscore wurde zurückgesetzt.', 'info');
        // kurz anzeigen und dann ausblenden (Toast-Verhalten)
        setTimeout(() => {
            elements.feedback.textContent = '';
            elements.feedback.className = 'feedback';
        }, 2000);
    });
}

updateScoreboard();
})();
