/**
 * QI METRIX 2026 - Contrôleur Principal de l'Application Web Standalone
 * Gestion de la passation, minuteurs, animations & rendu des résultats
 */

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

const App = {
    // État de l'application
    state: {
        currentScreen: 'welcome-screen',
        mode: 'express', // 'express' (10 items) ou 'full' (15 items)
        age: 25,
        items: [],
        currentIndex: 0,
        userAnswers: {},
        startTime: 0,
        totalTimeSpent: 0,
        itemTimer: null,
        itemSecondsLeft: 0,
        results: null
    },

    init() {
        this.bindEvents();
        this.renderHistory();
    },

    bindEvents() {
        // Navigation Accueil -> Étalonnage
        document.getElementById('btn-start-test')?.addEventListener('click', () => {
            SoundEngine.playClick();
            this.showScreen('calibration-screen');
        });

        // Choix du mode
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', (e) => {
                SoundEngine.playSelect();
                document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.state.mode = card.dataset.mode;
            });
        });

        // Lancement effectif du test
        document.getElementById('btn-launch-quiz')?.addEventListener('click', () => {
            SoundEngine.playClick();
            const ageInput = document.getElementById('user-age');
            if (ageInput) this.state.age = parseInt(ageInput.value, 10) || 25;
            this.startQuiz();
        });

        // Bouton Mute Audio
        document.getElementById('btn-audio-toggle')?.addEventListener('click', (e) => {
            const muted = SoundEngine.toggleMute();
            e.currentTarget.innerHTML = muted ? '🔇' : '🔊';
        });

        // Bouton Imprimer / PDF
        document.getElementById('btn-print-report')?.addEventListener('click', () => {
            SoundEngine.playClick();
            window.print();
        });

        // Bouton Recommencer
        document.getElementById('btn-restart')?.addEventListener('click', () => {
            SoundEngine.playClick();
            this.resetQuiz();
            this.showScreen('welcome-screen');
        });
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
        let allItems = QuestionBank.getItems();
        if (this.state.mode === 'express') {
            // Sélection équilibrée de 8 items pour la batterie rapide
            this.state.items = allItems.slice(0, 8);
        } else {
            this.state.items = allItems;
        }

        this.state.currentIndex = 0;
        this.state.userAnswers = {};
        this.state.startTime = Date.now();
        this.showScreen('quiz-screen');
        this.renderCurrentQuestion();
    },

    renderCurrentQuestion() {
        clearInterval(this.state.itemTimer);
        const item = this.state.items[this.state.currentIndex];
        if (!item) {
            this.finishQuiz();
            return;
        }

        // Mise à jour de la barre de progression
        const total = this.state.items.length;
        const currentNum = this.state.currentIndex + 1;
        const progressPct = (currentNum / total) * 100;
        
        document.getElementById('quiz-progress-fill').style.width = `${progressPct}%`;
        document.getElementById('quiz-progress-text').innerText = `Question ${currentNum} sur ${total}`;

        // Badge du domaine CHC
        const domainInfo = PsychometricsEngine.DOMAINS[item.domain] || { name: item.domain, color: '#00f2fe', icon: '🧠' };
        const badgeEl = document.getElementById('quiz-domain-badge');
        if (badgeEl) {
            badgeEl.innerHTML = `${domainInfo.icon} ${domainInfo.name}`;
            badgeEl.style.borderColor = domainInfo.color;
            badgeEl.style.color = domainInfo.color;
        }

        // Intitulé de la question
        document.getElementById('quiz-question-title').innerText = item.questionText;

        // Container visuel (Matrice SVG ou Illustration)
        const visualContainer = document.getElementById('quiz-visual-container');
        if (visualContainer) {
            if (item.renderMatrix) {
                visualContainer.innerHTML = item.renderMatrix();
                visualContainer.style.display = 'flex';
            } else if (item.sequence) {
                // Rendu pour Mémoire de travail (Chiffres)
                visualContainer.innerHTML = `
                    <div class="digit-sequence-box">
                        <span class="digit-label">Séquence à retenir :</span>
                        <div class="digits-row">${item.sequence.map(n => `<span class="digit-card">${n}</span>`).join('')}</div>
                    </div>
                `;
                visualContainer.style.display = 'flex';
            } else {
                visualContainer.style.display = 'none';
            }
        }

        // Grille des options de réponse
        const optionsGrid = document.getElementById('quiz-options-grid');
        optionsGrid.innerHTML = '';

        item.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-card';
            btn.dataset.optionId = opt.id;

            if (opt.render) {
                btn.innerHTML = `
                    <span class="option-index">${String.fromCharCode(65 + idx)}</span>
                    <div class="option-svg-wrapper">${QuestionBank.SVGGenerators.renderOptionSvg(opt.render)}</div>
                `;
            } else {
                btn.innerHTML = `
                    <span class="option-index">${String.fromCharCode(65 + idx)}</span>
                    <span class="option-text">${opt.text}</span>
                `;
            }

            btn.addEventListener('click', () => {
                SoundEngine.playSelect();
                this.selectAnswer(item.id, opt);
            });

            optionsGrid.appendChild(btn);
        });

        // Minuteur d'item
        this.startItemTimer(item.timeLimitSeconds || 45);
    },

    startItemTimer(seconds) {
        this.state.itemSecondsLeft = seconds;
        const timerEl = document.getElementById('quiz-timer-display');
        
        const updateDisplay = () => {
            if (timerEl) {
                timerEl.innerText = `${this.state.itemSecondsLeft}s`;
                if (this.state.itemSecondsLeft <= 10) {
                    timerEl.classList.add('urgent');
                    SoundEngine.playTimerBeep();
                } else {
                    timerEl.classList.remove('urgent');
                }
            }
        };

        updateDisplay();

        this.state.itemTimer = setInterval(() => {
            this.state.itemSecondsLeft--;
            if (this.state.itemSecondsLeft <= 0) {
                clearInterval(this.state.itemTimer);
                // Temps écoulé -> Passe automatiquement à la question suivante
                this.nextQuestion();
            } else {
                updateDisplay();
            }
        }, 1000);
    },

    selectAnswer(itemId, option) {
        clearInterval(this.state.itemTimer);
        this.state.userAnswers[itemId] = {
            isCorrect: !!option.isCorrect,
            optionId: option.id,
            timeSpentSeconds: (this.state.items[this.state.currentIndex].timeLimitSeconds || 45) - this.state.itemSecondsLeft
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
        clearInterval(this.state.itemTimer);
        this.state.totalTimeSpent = Math.round((Date.now() - this.state.startTime) / 1000);
        SoundEngine.playFinish();

        this.showScreen('computing-screen');

        // Animation du loader psychométrique
        setTimeout(() => {
            this.calculateAndShowResults();
        }, 2200);
    },

    calculateAndShowResults() {
        // Agrégation des scores bruts et max par domaine CHC
        const rawScores = { Gf: 0, Gvis: 0, Gwm: 0, Gs: 0, GcQ: 0 };
        const maxScores = { Gf: 0, Gvis: 0, Gwm: 0, Gs: 0, GcQ: 0 };

        this.state.items.forEach(item => {
            const d = item.domain;
            maxScores[d] = (maxScores[d] || 0) + 1;
            const ans = this.state.userAnswers[item.id];
            if (ans && ans.isCorrect) {
                rawScores[d] = (rawScores[d] || 0) + 1;
            }
        });

        const report = PsychometricsEngine.computeFullReport(
            rawScores,
            maxScores,
            this.state.age,
            this.state.totalTimeSpent
        );

        this.state.results = report;
        this.saveToHistory(report);
        this.renderResultsDashboard(report);
        this.showScreen('results-screen');
    },

    renderResultsDashboard(report) {
        // Score QIT Hero
        document.getElementById('res-fsiq-score').innerText = report.fsiq;
        document.getElementById('res-percentile').innerText = `Top ${100 - report.percentile}% (Percentile ${report.percentile}e)`;
        document.getElementById('res-ci95').innerText = `[${report.ci95[0]} - ${report.ci95[1]}]`;

        // Classification clinique
        const classEl = document.getElementById('res-classification');
        if (classEl) {
            classEl.innerText = report.classification.badge;
            classEl.className = `classification-badge level-${report.classification.level}`;
        }

        // Rendu de la Courbe de Gauss SVG
        this.renderGaussCurve(report.fsiq, report.percentile);

        // Rendu du tableau des domaines CHC
        this.renderCHCBreakdown(report.indices);

        // Analyse d'hétérogénéité et interprétation neuropsychologique
        const noteEl = document.getElementById('res-heterogeneity-note');
        if (noteEl) noteEl.innerText = report.profileAnalysis.heterogeneityNote;

        const neuroContainer = document.getElementById('res-neuro-paragraphs');
        if (neuroContainer) {
            neuroContainer.innerHTML = report.neuroInterpretation
                .map(p => `<p class="neuro-p">${p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`)
                .join('');
        }

        // Date & Métadonnées
        document.getElementById('res-date').innerText = report.testMetadata.date;
        document.getElementById('res-duration').innerText = report.testMetadata.formattedTime;
    },

    /**
     * Génère la Courbe de Gauss (Gaussian Bell Curve) en SVG interactif
     */
    renderGaussCurve(iq, percentile) {
        const svgContainer = document.getElementById('gauss-curve-container');
        if (!svgContainer) return;

        const w = 600;
        const h = 220;
        const margin = { top: 30, right: 30, bottom: 40, left: 30 };
        const graphW = w - margin.left - margin.right;
        const graphH = h - margin.top - margin.bottom;

        // Fonction Gaussienne f(x)
        const mean = 100;
        const sd = 15;
        const gauss = (x) => Math.exp(-0.5 * Math.pow((x - mean) / sd, 2));

        // Points de la courbe (de IQ=55 à IQ=145)
        let points = [];
        let fillAreaPoints = [];
        const minIQ = 55;
        const maxIQ = 145;

        for (let xIQ = minIQ; xIQ <= maxIQ; xIQ += 0.5) {
            const x = margin.left + ((xIQ - minIQ) / (maxIQ - minIQ)) * graphW;
            const y = margin.top + graphH - (gauss(xIQ) * (graphH - 10));
            points.push(`${x},${y}`);

            if (xIQ <= iq) {
                fillAreaPoints.push(`${x},${y}`);
            }
        }

        // Coordonnée X exacte du candidat
        const userX = margin.left + Math.max(0, Math.min(1, (iq - minIQ) / (maxIQ - minIQ))) * graphW;
        const userY = margin.top + graphH - (gauss(iq) * (graphH - 10));

        // SVG HTML
        let svg = `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="gaussGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#7f00ff" stop-opacity="0.2"/>
                    <stop offset="50%" stop-color="#00f2fe" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#f72585" stop-opacity="0.6"/>
                </linearGradient>
            </defs>

            <!-- Zone remplie sous la courbe jusqu'au QI du candidat -->
            <polygon points="${margin.left},${margin.top + graphH} ${fillAreaPoints.join(' ')} ${userX},${margin.top + graphH}" fill="url(#gaussGrad)"/>

            <!-- Ligne de la Courbe -->
            <polyline points="${points.join(' ')}" fill="none" stroke="#00f2fe" stroke-width="3"/>

            <!-- Lignes de Dév. Standard (-2SD, -1SD, Mean, +1SD, +2SD) -->
            ${[70, 85, 100, 115, 130].map(sdVal => {
                const sx = margin.left + ((sdVal - minIQ) / (maxIQ - minIQ)) * graphW;
                return `
                    <line x1="${sx}" y1="${margin.top}" x2="${sx}" y2="${margin.top + graphH}" stroke="rgba(255,255,255,0.15)" stroke-dasharray="3,3"/>
                    <text x="${sx}" y="${margin.top + graphH + 20}" font-size="11" fill="#8b95c9" text-anchor="middle">${sdVal}</text>
                `;
            }).join('')}

            <!-- Marqueur du Candidat -->
            <line x1="${userX}" y1="${margin.top - 10}" x2="${userX}" y2="${margin.top + graphH}" stroke="#f72585" stroke-width="2.5"/>
            <circle cx="${userX}" cy="${userY}" r="7" fill="#f72585" stroke="#ffffff" stroke-width="2"/>
            <rect x="${Math.max(10, Math.min(w - 110, userX - 50))}" y="${margin.top - 25}" width="100" height="22" rx="4" fill="#f72585"/>
            <text x="${Math.max(10, Math.min(w - 110, userX - 50)) + 50}" y="${margin.top - 10}" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">QI ${iq} (${percentile}e %)</text>
        </svg>`;

        svgContainer.innerHTML = svg;
    },

    /**
     * Rendu de la grille des 5 domaines CHC
     */
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
            if (history.length === 0) {
                historyContainer.innerHTML = `<p class="empty-history">Aucun test enregistré pour l'instant.</p>`;
                return;
            }

            historyContainer.innerHTML = history.map(item => `
                <div class="history-item">
                    <span class="history-date">${item.date} (${item.mode === 'express' ? 'Express' : 'Complet'})</span>
                    <span class="history-score">QI ${item.fsiq}</span>
                    <span class="history-badge">${item.classification}</span>
                </div>
            `).join('');
        } catch (e) {
            historyContainer.innerHTML = '';
        }
    },

    resetQuiz() {
        this.state.currentIndex = 0;
        this.state.userAnswers = {};
        clearInterval(this.state.itemTimer);
    }
};
