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
try {
    const savedHigh = parseInt(localStorage.getItem('mathe_highscore'), 10);
    if (!Number.isNaN(savedHigh)) state.highScore = savedHigh;
} catch (e) {
    // ignore storage errors
}

// Unendlicher Highscore: nur in Browsern, in denen er aktiviert wurde.
// Aktivieren: Seite einmal mit ?unendlich=1 öffnen, deaktivieren mit ?unendlich=0
let infiniteHighScore = false;
try {
    const param = new URLSearchParams(window.location.search).get('unendlich');
    if (param === '1') localStorage.setItem('mathe_infinite', '1');
    if (param === '0') localStorage.removeItem('mathe_infinite');
    infiniteHighScore = localStorage.getItem('mathe_infinite') === '1';
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
    elements.highScore.textContent = infiniteHighScore ? '∞' : (state.highScore || 0);
}

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
            try {
                localStorage.setItem('mathe_highscore', state.highScore);
            } catch (e) {
                // ignore storage errors
            }
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
        try { localStorage.setItem('mathe_highscore', state.highScore); } catch (e) {}
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
