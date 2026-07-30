/**
 * QI METRIX 2026 - Contrôleur Principal de l'Application Web Standalone
 *
 * Cycle de vie d'un item : PRÉSENTATION puis RÉPONSE.
 *  - Présentation : énoncé oral (Web Speech) ou défilement des stimuli un par un.
 *    Le chronomètre ne tourne PAS pendant cette phase — auparavant le temps de
 *    mémorisation était décompté du temps de réflexion, ce qui pénalisait les
 *    séquences longues.
 *  - Réponse : QCM ou saisie libre, chronométrée.
 */

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

const App = {
    MODES: {
        express: { items: 25, label: 'Express' },
        full: { items: 50, label: 'Complet' }
    },

    state: {
        currentScreen: 'welcome-screen',
        mode: 'express',
        age: 25,
        items: [],
        currentIndex: 0,
        userAnswers: {},
        startTime: 0,
        totalTimeSpent: 0,
        itemTimer: null,
        itemSecondsLeft: 0,
        presentationTimers: [],
        phase: 'idle',
        answerStartedAt: 0,
        results: null
    },

    init() {
        this.bindEvents();
        this.renderHistory();
        // Le chargement des voix est asynchrone : on l'amorce dès l'accueil pour
        // qu'une voix française soit prête au premier problème oral.
        SpeechEngine.init().then(ok => {
            const notice = document.getElementById('speech-availability-note');
            if (!notice) return;
            notice.textContent = ok
                ? '🔊 Voix française détectée : certains problèmes de logique seront énoncés à l’oral, une seule fois.'
                : '🔇 Aucune voix française détectée sur cet appareil : les problèmes de logique seront affichés en texte.';
        });
    },

    bindEvents() {
        document.getElementById('btn-start-test')?.addEventListener('click', () => {
            SoundEngine.playClick();
            this.showScreen('calibration-screen');
        });

        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                SoundEngine.playSelect();
                document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.state.mode = card.dataset.mode;
            });
        });

        document.getElementById('btn-launch-quiz')?.addEventListener('click', () => {
            SoundEngine.playClick();
            const ageInput = document.getElementById('user-age');
            if (ageInput) this.state.age = parseInt(ageInput.value, 10) || 25;
            this.startQuiz();
        });

        document.getElementById('btn-home-nav')?.addEventListener('click', () => {
            SoundEngine.playClick();
            this.abortItem();
            this.showScreen('welcome-screen');
        });

        document.getElementById('btn-print-report')?.addEventListener('click', () => {
            SoundEngine.playClick();
            window.print();
        });

        document.getElementById('btn-restart')?.addEventListener('click', () => {
            SoundEngine.playClick();
            this.resetQuiz();
            this.showScreen('welcome-screen');
        });

        document.getElementById('btn-references')?.addEventListener('click', () => {
            SoundEngine.playClick();
            this.abortItem();
            this.showScreen('references-screen');
        });

        document.getElementById('btn-close-references')?.addEventListener('click', () => {
            SoundEngine.playClick();
            this.showScreen('welcome-screen');
        });

        // Coupe uniquement les effets sonores : les énoncés oraux restent audibles,
        // sans quoi les problèmes de logique deviendraient impossibles.
        document.getElementById('btn-mute')?.addEventListener('click', (e) => {
            const muted = SoundEngine.toggleMute();
            e.currentTarget.textContent = muted ? '🔇' : '🔊';
            e.currentTarget.setAttribute('aria-label', muted ? 'Réactiver les effets sonores' : 'Couper les effets sonores');
            if (!muted) SoundEngine.playClick();
        });

        // Saisie libre (empan de chiffres, séquences lettres-chiffres)
        document.getElementById('btn-submit-text')?.addEventListener('click', () => this.submitTextAnswer());
        document.getElementById('quiz-text-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.submitTextAnswer(); }
        });
    },

    /** Convertit les marqueurs **gras** des énoncés en balises HTML. */
    formatText(text) {
        const escaped = String(text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    },

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
            this.state.currentScreen = screenId;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    startQuiz() {
        const mode = this.MODES[this.state.mode] || this.MODES.express;
        this.state.items = QuestionBank.generateTestBattery(mode.items);
        this.state.currentIndex = 0;
        this.state.userAnswers = {};
        this.state.startTime = Date.now();
        this.showScreen('quiz-screen');
        this.renderCurrentQuestion();
    },

    /** Arrête tout ce qui pourrait continuer à tourner en arrière-plan. */
    abortItem() {
        clearInterval(this.state.itemTimer);
        this.state.itemTimer = null;
        this.state.presentationTimers.forEach(t => clearTimeout(t));
        this.state.presentationTimers = [];
        SpeechEngine.cancel();
        this.state.phase = 'idle';
    },

    renderCurrentQuestion() {
        this.abortItem();

        const item = this.state.items[this.state.currentIndex];
        if (!item) { this.finishQuiz(); return; }

        this.state.phase = 'presenting';

        const total = this.state.items.length;
        const currentNum = this.state.currentIndex + 1;
        document.getElementById('quiz-progress-fill').style.width = `${(currentNum / total) * 100}%`;
        document.getElementById('quiz-progress-text').innerText = `Question ${currentNum} sur ${total}`;

        const domainInfo = PsychometricsEngine.DOMAINS[item.domain] || { name: item.domain, color: '#0ea5e9', icon: '🧠' };
        const badgeEl = document.getElementById('quiz-domain-badge');
        if (badgeEl) {
            badgeEl.innerHTML = `${domainInfo.icon} ${domainInfo.name}`;
            badgeEl.style.borderColor = domainInfo.color;
            badgeEl.style.color = domainInfo.color;
        }

        const titleEl = document.getElementById('quiz-question-title');
        const visualEl = document.getElementById('quiz-visual-container');
        const optionsGrid = document.getElementById('quiz-options-grid');
        const textBox = document.getElementById('quiz-text-answer');
        const oralEl = document.getElementById('quiz-oral-indicator');
        const timerEl = document.getElementById('quiz-timer-display');

        optionsGrid.innerHTML = '';
        optionsGrid.style.display = 'none';
        textBox.style.display = 'none';
        oralEl.style.display = 'none';
        oralEl.classList.remove('done');
        visualEl.innerHTML = '';
        visualEl.style.display = 'none';
        if (timerEl) { timerEl.innerText = '—'; timerEl.classList.remove('urgent'); }

        const useSpeech = !!item.oral && SpeechEngine.available && !SpeechEngine.blocked;

        titleEl.innerHTML = useSpeech
            ? 'Écoutez attentivement : l’énoncé n’est dit qu’une seule fois.'
            : this.formatText(item.questionText);

        if (item.renderMatrix && !item.presentation) {
            visualEl.innerHTML = item.renderMatrix();
            visualEl.style.display = 'flex';
        }

        if (useSpeech) {
            oralEl.style.display = 'flex';
            oralEl.innerHTML = '<span class="oral-pulse">🔊</span><span>Énoncé en cours…</span>';
            SpeechEngine.speak(item.spokenText || item.questionText, {
                onend: (spoken) => {
                    if (spoken) {
                        oralEl.classList.add('done');
                        oralEl.innerHTML = '<span>✅</span><span>Énoncé terminé — à vous de répondre</span>';
                    } else {
                        // Le navigateur a refusé de lire (politique d'autoplay).
                        // Sans ce repli, l'énoncé serait définitivement perdu.
                        this.revealOralFallback(item);
                    }
                    this.beginAnswerPhase(item);
                }
            });
        } else if (item.oral) {
            this.revealOralFallback(item);
            this.beginAnswerPhase(item);
        } else if (item.presentation) {
            this.runSequencePresentation(item, () => this.beginAnswerPhase(item));
        } else {
            this.beginAnswerPhase(item);
        }
    },

    /**
     * Repli lorsque la lecture vocale est impossible : on réaffiche l'énoncé.
     * Le problème devient plus facile (relecture possible), mais il reste
     * traitable — c'est toujours préférable à une question muette et vide.
     */
    revealOralFallback(item) {
        const titleEl = document.getElementById('quiz-question-title');
        const oralEl = document.getElementById('quiz-oral-indicator');
        if (titleEl) titleEl.innerHTML = this.formatText(item.questionText);
        if (oralEl) {
            oralEl.style.display = 'flex';
            oralEl.classList.add('done');
            oralEl.innerHTML = '<span>📄</span><span>Lecture vocale indisponible sur cet appareil — énoncé affiché</span>';
        }
    },

    /** Affiche les stimuli un par un, puis rend la main. */
    runSequencePresentation(item, done) {
        const visualEl = document.getElementById('quiz-visual-container');
        visualEl.style.display = 'flex';

        const { steps, stepMs, gapMs, hideLength } = item.presentation;
        let i = 0;

        const frame = (label, content, extraClass = '') => {
            visualEl.innerHTML = `
                <div class="span-box">
                    <span class="span-label">${label}</span>
                    <div class="span-stage"><span class="span-card ${extraClass}">${content}</span></div>
                </div>`;
        };

        const showNext = () => {
            if (i >= steps.length) {
                frame('Séquence terminée', '✔', 'span-done');
                done();
                return;
            }
            const label = hideLength ? 'Mémorisation en cours…' : `Mémorisation — ${i + 1} / ${steps.length}`;
            frame(label, steps[i], 'span-live');
            i++;
            this.state.presentationTimers.push(setTimeout(() => {
                frame(label, '', 'span-blank');
                this.state.presentationTimers.push(setTimeout(showNext, gapMs));
            }, stepMs));
        };

        showNext();
    },

    beginAnswerPhase(item) {
        if (this.state.phase === 'idle') return; // écran quitté entre-temps
        this.state.phase = 'answering';
        this.state.answerStartedAt = Date.now();

        if (item.inputMode === 'text') {
            this.renderTextInput(item);
        } else {
            this.renderOptions(item);
        }

        this.startItemTimer(item.timeLimitSeconds || 45);
    },

    renderOptions(item) {
        const optionsGrid = document.getElementById('quiz-options-grid');
        optionsGrid.innerHTML = '';
        optionsGrid.style.display = '';

        item.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-card';
            btn.dataset.optionId = opt.id;

            if (opt.render) {
                btn.innerHTML = `
                    <span class="option-index">${String.fromCharCode(65 + idx)}</span>
                    <div class="option-svg-wrapper">${QuestionBank.SVGGenerators.renderOptionSvg(opt.render)}</div>`;
            } else {
                btn.innerHTML = `
                    <span class="option-index">${String.fromCharCode(65 + idx)}</span>
                    <span class="option-text">${this.formatText(opt.text)}</span>`;
            }

            btn.addEventListener('click', () => {
                if (this.state.phase !== 'answering') return;
                SoundEngine.playSelect();
                this.recordAnswer(item, !!opt.isCorrect, opt.id);
            });

            optionsGrid.appendChild(btn);
        });
    },

    renderTextInput(item) {
        const textBox = document.getElementById('quiz-text-answer');
        const input = document.getElementById('quiz-text-input');
        const hint = document.getElementById('quiz-text-hint');

        textBox.style.display = 'flex';
        if (hint) hint.textContent = item.inputHint || '';
        if (input) {
            input.value = '';
            input.removeAttribute('disabled');
            // Clavier numérique sur mobile pour les empans de chiffres
            input.setAttribute('inputmode', item.type === 'gwm_letterNumber' ? 'text' : 'numeric');
            input.focus();
        }
    },

    submitTextAnswer() {
        if (this.state.phase !== 'answering') return;
        const item = this.state.items[this.state.currentIndex];
        if (!item || item.inputMode !== 'text') return;

        const input = document.getElementById('quiz-text-input');
        const value = input ? input.value : '';
        if (!QuestionBank.normalizeAnswer(value)) return; // ignore une validation à vide

        SoundEngine.playSelect();
        const isCorrect = item.acceptedAnswers.includes(QuestionBank.normalizeAnswer(value));
        this.recordAnswer(item, isCorrect, value);
    },

    startItemTimer(seconds) {
        this.state.itemSecondsLeft = seconds;
        const timerEl = document.getElementById('quiz-timer-display');

        const updateDisplay = () => {
            if (!timerEl) return;
            timerEl.innerText = `${this.state.itemSecondsLeft}s`;
            timerEl.classList.toggle('urgent', this.state.itemSecondsLeft <= 10);
            // Bip aux paliers seulement : un bip par seconde était insoutenable.
            if ([10, 5, 3, 2, 1].includes(this.state.itemSecondsLeft)) SoundEngine.playTimerBeep();
        };

        updateDisplay();

        this.state.itemTimer = setInterval(() => {
            this.state.itemSecondsLeft--;
            if (this.state.itemSecondsLeft <= 0) {
                clearInterval(this.state.itemTimer);
                const item = this.state.items[this.state.currentIndex];
                if (item) this.recordAnswer(item, false, null, true);
            } else {
                updateDisplay();
            }
        }, 1000);
    },

    recordAnswer(item, isCorrect, payload, timedOut = false) {
        if (this.state.phase !== 'answering') return;
        this.state.phase = 'answered';
        clearInterval(this.state.itemTimer);

        this.state.userAnswers[item.id] = {
            isCorrect,
            response: payload,
            timedOut,
            timeSpentSeconds: Math.max(0.1, (Date.now() - this.state.answerStartedAt) / 1000)
        };

        this.nextQuestion();
    },

    nextQuestion() {
        this.state.currentIndex++;
        if (this.state.currentIndex >= this.state.items.length) {
            this.finishQuiz();
        } else {
            this.renderCurrentQuestion();
        }
    },

    finishQuiz() {
        this.abortItem();
        this.state.totalTimeSpent = Math.round((Date.now() - this.state.startTime) / 1000);
        SoundEngine.playFinish();
        this.showScreen('computing-screen');
        setTimeout(() => this.calculateAndShowResults(), 2200);
    },

    calculateAndShowResults() {
        const rawScores = { Gf: 0, Gvis: 0, Gwm: 0, Gs: 0, GcQ: 0 };
        const maxScores = { Gf: 0, Gvis: 0, Gwm: 0, Gs: 0, GcQ: 0 };
        const reactionTimes = { Gf: [], Gvis: [], Gwm: [], Gs: [], GcQ: [] };

        this.state.items.forEach(item => {
            const d = item.domain;
            maxScores[d] = (maxScores[d] || 0) + 1;
            const ans = this.state.userAnswers[item.id];
            if (ans && ans.isCorrect) rawScores[d] = (rawScores[d] || 0) + 1;
            if (ans && ans.timeSpentSeconds) reactionTimes[d].push(ans.timeSpentSeconds);
        });

        const avgRT = {};
        for (const [d, times] of Object.entries(reactionTimes)) {
            avgRT[d] = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 999;
        }

        const report = PsychometricsEngine.computeFullReport(
            rawScores, maxScores, this.state.age, this.state.totalTimeSpent, avgRT
        );

        this.state.results = report;
        this.saveToHistory(report);
        this.renderResultsDashboard(report);
        this.showScreen('results-screen');
    },

    renderResultsDashboard(report) {
        document.getElementById('res-fsiq-score').innerText = report.fsiq;
        const topPercent = Math.round((100 - report.percentile) * 10) / 10;
        document.getElementById('res-percentile').innerText = `Top ${topPercent}% (Percentile ${report.percentile}e)`;
        document.getElementById('res-ci95').innerText = `[${report.ci95[0]} - ${report.ci95[1]}]`;

        const classEl = document.getElementById('res-classification');
        if (classEl) {
            classEl.innerText = report.classification.badge;
            classEl.className = `classification-badge level-${report.classification.level}`;
        }

        // Traçabilité du QIT : le calcul doit être refaisable de tête.
        const formulaEl = document.getElementById('res-fsiq-formula');
        if (formulaEl) {
            const r = report.reliabilityReport;
            let html = `<span class="formula-line">${this.formatText(r.fsiqFormula)}</span>`;
            html += `<span class="formula-line">Fidélité de la batterie : ${r.compositeReliability} sur ${r.totalItems} items — erreur-type ± ${r.sem} points.</span>`;
            if (r.shortBatteryWarning) html += `<span class="formula-line warn">${r.shortBatteryWarning}</span>`;
            formulaEl.innerHTML = html;
        }

        this.renderGaussCurve(report.fsiq, report.percentile);
        this.renderCHCBreakdown(report.indices);

        const noteEl = document.getElementById('res-heterogeneity-note');
        if (noteEl) noteEl.innerHTML = this.formatText(report.profileAnalysis.heterogeneityNote);

        const neuroContainer = document.getElementById('res-neuro-paragraphs');
        if (neuroContainer) {
            neuroContainer.innerHTML = report.neuroInterpretation
                .map(p => `<p class="neuro-p">${this.formatText(p)}</p>`)
                .join('');
        }

        document.getElementById('res-date').innerText = report.testMetadata.date;
        document.getElementById('res-duration').innerText = report.testMetadata.formattedTime;
    },

    /** Courbe de Gauss (distribution normale M=100, SD=15) en SVG */
    renderGaussCurve(iq, percentile) {
        const svgContainer = document.getElementById('gauss-curve-container');
        if (!svgContainer) return;

        const w = 600, h = 220;
        const margin = { top: 30, right: 30, bottom: 40, left: 30 };
        const graphW = w - margin.left - margin.right;
        const graphH = h - margin.top - margin.bottom;

        const gauss = (x) => Math.exp(-0.5 * Math.pow((x - 100) / 15, 2));
        const minIQ = 55, maxIQ = 145;

        const points = [];
        const fillAreaPoints = [];
        for (let xIQ = minIQ; xIQ <= maxIQ; xIQ += 0.5) {
            const x = margin.left + ((xIQ - minIQ) / (maxIQ - minIQ)) * graphW;
            const y = margin.top + graphH - (gauss(xIQ) * (graphH - 10));
            points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
            if (xIQ <= iq) fillAreaPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }

        const userX = margin.left + Math.max(0, Math.min(1, (iq - minIQ) / (maxIQ - minIQ))) * graphW;
        const userY = margin.top + graphH - (gauss(iq) * (graphH - 10));
        const labelX = Math.max(10, Math.min(w - 110, userX - 50));

        svgContainer.innerHTML = `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="gaussGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#6366f1" stop-opacity="0.2"/>
                    <stop offset="50%" stop-color="#0ea5e9" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#ec4899" stop-opacity="0.6"/>
                </linearGradient>
            </defs>
            <polygon points="${margin.left},${margin.top + graphH} ${fillAreaPoints.join(' ')} ${userX.toFixed(1)},${margin.top + graphH}" fill="url(#gaussGrad)"/>
            <polyline points="${points.join(' ')}" fill="none" stroke="#0ea5e9" stroke-width="3"/>
            ${[70, 85, 100, 115, 130].map(sdVal => {
                const sx = margin.left + ((sdVal - minIQ) / (maxIQ - minIQ)) * graphW;
                return `<line x1="${sx.toFixed(1)}" y1="${margin.top}" x2="${sx.toFixed(1)}" y2="${margin.top + graphH}" stroke="#cbd5e1" stroke-dasharray="3,3"/>
                    <text x="${sx.toFixed(1)}" y="${margin.top + graphH + 20}" font-size="11" fill="#6366f1" text-anchor="middle">${sdVal}</text>`;
            }).join('')}
            <line x1="${userX.toFixed(1)}" y1="${margin.top - 10}" x2="${userX.toFixed(1)}" y2="${margin.top + graphH}" stroke="#ec4899" stroke-width="2.5"/>
            <circle cx="${userX.toFixed(1)}" cy="${userY.toFixed(1)}" r="7" fill="#ec4899" stroke="#ffffff" stroke-width="2"/>
            <rect x="${labelX.toFixed(1)}" y="${margin.top - 25}" width="100" height="22" rx="4" fill="#ec4899"/>
            <text x="${(labelX + 50).toFixed(1)}" y="${margin.top - 10}" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">QI ${iq} (${percentile}e %)</text>
        </svg>`;
    },

    renderCHCBreakdown(indices) {
        const container = document.getElementById('chc-indices-grid');
        if (!container) return;

        container.innerHTML = Object.values(indices).map(idx => `
            <div class="chc-card">
                <div class="chc-card-header">
                    <span class="chc-icon">${idx.icon}</span>
                    <div class="chc-titles">
                        <span class="chc-name">${idx.name}</span>
                        <span class="chc-acronym">${idx.acronym}</span>
                    </div>
                    <span class="chc-score-badge" style="background:${idx.color}">${idx.score}</span>
                </div>
                <div class="chc-progress-bar">
                    <div class="chc-progress-fill" style="width: ${Math.min(100, (idx.score / 150) * 100)}%; background:${idx.color}"></div>
                </div>
                <div class="chc-card-footer">
                    <span>Percentile : ${idx.percentile}e</span>
                    <span class="chc-level">${idx.classification.label}</span>
                </div>
                <div class="chc-card-detail">${idx.rawScore} / ${idx.maxScore} items réussis</div>
            </div>
        `).join('');
    },

    saveToHistory(report) {
        try {
            const history = JSON.parse(localStorage.getItem('qimetrix_history') || '[]');
            history.unshift({
                date: report.testMetadata.date,
                fsiq: report.fsiq,
                classification: report.classification.label,
                mode: this.state.mode
            });
            localStorage.setItem('qimetrix_history', JSON.stringify(history.slice(0, 5)));
            this.renderHistory();
        } catch (e) {
            console.warn('LocalStorage unavailable:', e);
        }
    },

    renderHistory() {
        const historyContainer = document.getElementById('history-list');
        if (!historyContainer) return;

        try {
            const history = JSON.parse(localStorage.getItem('qimetrix_history') || '[]');
            if (!history.length) {
                historyContainer.innerHTML = `<p class="empty-history">Aucun test enregistré pour l'instant.</p>`;
                return;
            }
            historyContainer.innerHTML = history.map(item => `
                <div class="history-item">
                    <span class="history-date">${item.date} (${(this.MODES[item.mode] || {}).label || item.mode})</span>
                    <span class="history-score">QI ${item.fsiq}</span>
                    <span class="history-badge">${item.classification}</span>
                </div>
            `).join('');
        } catch (e) {
            historyContainer.innerHTML = '';
        }
    },

    resetQuiz() {
        this.abortItem();
        this.state.currentIndex = 0;
        this.state.userAnswers = {};
        this.state.items = [];
    }
};
