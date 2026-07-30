/**
 * QI METRIX 2026 - Moteur de Génération Procédurale d'Items
 *
 * Garanties structurelles (vérifiées par validateItem / generateTestBattery) :
 *  - un item a exactement UNE bonne réponse ;
 *  - deux options d'un même item ne sont jamais visuellement identiques
 *    (comparaison sur le SVG rendu, pas sur la fonction génératrice) ;
 *  - deux items d'une même batterie ne sont jamais identiques ;
 *  - les types de tâche sont distribués en cycle, pas tirés au hasard,
 *    donc on ne peut pas tomber 5 fois de suite sur la même forme d'exercice.
 */

const QuestionBank = {

    CONFIG: {
        // Cadence d'affichage des chiffres/lettres à mémoriser, un par un.
        // Standard clinique (WAIS) : ~1 stimulus par seconde. Augmenter cette
        // valeur rend la tâche plus facile (davantage de temps de répétition mentale).
        spanStepMs: 1200,
        spanGapMs: 300,
        // Nombre maximal de tentatives de régénération d'un item invalide ou dupliqué.
        maxGenerationAttempts: 40
    },

    PALETTE: ['#0ea5e9', '#6366f1', '#ec4899', '#f59e0b', '#8b5cf6', '#10b981'],

    // Types de tâche par domaine, parcourus en cycle pour garantir la variété.
    DOMAIN_TYPES: {
        Gf:   ['rotation', 'union', 'progression', 'grid'],
        Gvis: ['rotation', 'mirror', 'odd'],
        // 'runningDigits' reproduit le sous-test Running Digits, promu en épreuve
        // centrale de mémoire de travail dans la WAIS-5 (2024), tandis que
        // Séquence Lettres-Chiffres y est rétrogradé en épreuve supplémentaire.
        Gwm:  ['digitForward', 'digitBackward', 'runningDigits', 'letterNumber'],
        Gs:   ['coding', 'search'],
        GcQ:  ['wordProblem', 'series', 'analogy', 'oddOneOut']
    },

    utils: {
        randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },

        /** Fisher-Yates : le `sort(() => Math.random() - 0.5)` précédent était fortement biaisé. */
        shuffle(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
            }
            return arr;
        },

        sample(arr) { return arr[this.randInt(0, arr.length - 1)]; },

        /** Tire n éléments distincts d'un tableau. */
        sampleDistinct(arr, n) {
            return this.shuffle(arr.slice()).slice(0, n);
        },

        hash(str) {
            let h = 5381;
            for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
            return (h >>> 0).toString(36);
        },

        /** Normalise un angle dans [0,360) pour que deux rotations visuellement
         *  identiques produisent la même chaîne SVG (indispensable au dédoublonnage). */
        normAngle(a) { return ((Math.round(a) % 360) + 360) % 360; }
    },

    /** Normalisation des réponses libres : "4 7 2", "4-7-2", "472" sont équivalents. */
    normalizeAnswer(value) {
        return String(value == null ? '' : value)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
    },

    // =========================================================================
    // GÉOMÉTRIE DISCRÈTE : POLYOMINOS
    // Les rotations/miroirs sont calculés exactement sur une grille entière.
    // C'est ce qui élimine le bug de l'ancienne version où le distracteur
    // "miroir" d'une forme symétrique était pixel-pour-pixel identique à la
    // bonne réponse (forme en U : sommets symétriques + repère sur l'axe).
    // =========================================================================
    polyomino: {
        normalize(shape) {
            const minX = Math.min(...shape.cells.map(c => c[0]));
            const minY = Math.min(...shape.cells.map(c => c[1]));
            return {
                cells: shape.cells.map(([x, y]) => [x - minX, y - minY]),
                marker: [shape.marker[0] - minX, shape.marker[1] - minY]
            };
        },

        rotate(shape) {
            return this.normalize({
                cells: shape.cells.map(([x, y]) => [-y, x]),
                marker: [-shape.marker[1], shape.marker[0]]
            });
        },

        mirror(shape) {
            return this.normalize({
                cells: shape.cells.map(([x, y]) => [-x, y]),
                marker: [-shape.marker[0], shape.marker[1]]
            });
        },

        rotateTimes(shape, n) {
            let s = this.normalize(shape);
            for (let i = 0; i < ((n % 4) + 4) % 4; i++) s = this.rotate(s);
            return s;
        },

        /** Signature canonique : deux formes de même clé sont indistinguables à l'écran. */
        key(shape) {
            const s = this.normalize(shape);
            const cells = s.cells.map(c => c.join(',')).sort().join(';');
            return `${cells}|${s.marker.join(',')}`;
        },

        /** Construit un polyomino connexe aléatoire de `size` cases. */
        random(size) {
            const cells = [[0, 0]];
            const has = (x, y) => cells.some(c => c[0] === x && c[1] === y);
            let guard = 0;
            while (cells.length < size && guard++ < 400) {
                const [bx, by] = cells[Math.floor(Math.random() * cells.length)];
                const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
                if (!has(bx + dx, by + dy)) cells.push([bx + dx, by + dy]);
            }
            const marker = cells[Math.floor(Math.random() * cells.length)];
            return this.normalize({ cells, marker: marker.slice() });
        },

        /**
         * Une forme n'est utilisable que si ses 4 rotations ET ses 4 rotations
         * miroir donnent 8 apparences distinctes. Sinon un distracteur pourrait
         * coïncider avec la bonne réponse.
         */
        isFullyAsymmetric(shape) {
            const keys = new Set();
            for (let r = 0; r < 4; r++) {
                keys.add(this.key(this.rotateTimes(shape, r)));
                keys.add(this.key(this.rotateTimes(this.mirror(shape), r)));
            }
            return keys.size === 8;
        },

        randomAsymmetric(size) {
            for (let i = 0; i < 120; i++) {
                const s = this.random(size);
                if (this.isFullyAsymmetric(s)) return s;
            }
            // Repli déterministe : tétromino en L étendu, asymétrique par construction.
            return this.normalize({
                cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
                marker: [0, 0]
            });
        }
    },

    // =========================================================================
    // GÉNÉRATEURS SVG
    // =========================================================================
    SVGGenerators: {
        shapes: {
            circle: (cx, cy, r, c, fill = 'none', w = 3) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${c}" stroke-width="${w}"/>`,
            rect: (x, y, w, h, c, fill = 'none', sw = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${c}" stroke-width="${sw}"/>`,
            polygon: (pts, c, fill = 'none', w = 3) => `<polygon points="${pts}" fill="${fill}" stroke="${c}" stroke-width="${w}"/>`,
            line: (x1, y1, x2, y2, c, w = 3) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`,
            star: (cx, cy, r, c, fill = 'none') => {
                const pts = [];
                for (let i = 0; i < 5; i++) {
                    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
                }
                return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${c}" stroke-width="3"/>`;
            }
        },

        /** Glyphes asymétriques : leur rotation est toujours visuellement discernable. */
        glyphs: {
            arrow: (s, c) => `${QuestionBank.SVGGenerators.shapes.line(s / 2, s * 0.8, s / 2, s * 0.22, c, 4)}
                <polygon points="${s / 2 - 8},${s * 0.36} ${s / 2},${s * 0.14} ${s / 2 + 8},${s * 0.36}" fill="${c}" stroke="${c}" stroke-width="1"/>`,
            flag: (s, c) => `${QuestionBank.SVGGenerators.shapes.line(s * 0.32, s * 0.85, s * 0.32, s * 0.15, c, 4)}
                <polygon points="${s * 0.32},${s * 0.18} ${s * 0.78},${s * 0.32} ${s * 0.32},${s * 0.46}" fill="${c}" stroke="${c}" stroke-width="1"/>`,
            hook: (s, c) => `<path d="M ${s * 0.28} ${s * 0.82} L ${s * 0.28} ${s * 0.3} L ${s * 0.72} ${s * 0.3}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
                <circle cx="${s * 0.72}" cy="${s * 0.3}" r="5" fill="${c}"/>`,
            wedge: (s, c) => `<polygon points="${s * 0.2},${s * 0.8} ${s * 0.5},${s * 0.2} ${s * 0.8},${s * 0.8}" fill="none" stroke="${c}" stroke-width="3.5"/>
                <circle cx="${s * 0.5}" cy="${s * 0.68}" r="4.5" fill="${c}"/>`
        },

        /** Petits symboles utilisés par les tâches de vitesse (Gs). */
        symbols: {
            circle: (c) => `<circle cx="15" cy="15" r="11" fill="none" stroke="${c}" stroke-width="3"/>`,
            square: (c) => `<rect x="4" y="4" width="22" height="22" rx="3" fill="none" stroke="${c}" stroke-width="3"/>`,
            triangle: (c) => `<polygon points="15,3 27,26 3,26" fill="none" stroke="${c}" stroke-width="3"/>`,
            diamond: (c) => `<polygon points="15,2 28,15 15,28 2,15" fill="none" stroke="${c}" stroke-width="3"/>`,
            cross: (c) => `<line x1="5" y1="5" x2="25" y2="25" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><line x1="25" y1="5" x2="5" y2="25" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`,
            plus: (c) => `<line x1="15" y1="3" x2="15" y2="27" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><line x1="3" y1="15" x2="27" y2="15" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`,
            star: (c) => QuestionBank.SVGGenerators.shapes.star(15, 15, 12, c, 'none'),
            arc: (c) => `<path d="M 4 24 A 12 12 0 0 1 26 24" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`
        },

        matrixPattern(gridSize, cellsData, missingIndex) {
            const size = 260;
            const cellSize = Math.floor((size - (gridSize + 1) * 6) / gridSize);
            let svgHtml = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
            svgHtml += `<rect width="${size}" height="${size}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>`;

            let cellIdx = 0;
            for (let r = 0; r < gridSize; r++) {
                for (let c = 0; c < gridSize; c++) {
                    const x = 6 + c * (cellSize + 6);
                    const y = 6 + r * (cellSize + 6);
                    svgHtml += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>`;

                    if (cellIdx === missingIndex) {
                        svgHtml += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="8" fill="rgba(2, 132, 199, 0.1)" stroke="#0ea5e9" stroke-width="2" stroke-dasharray="4,4"/>`;
                        svgHtml += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 8}" font-size="28" font-weight="bold" fill="#0ea5e9" text-anchor="middle">?</text>`;
                    } else if (cellsData[cellIdx]) {
                        svgHtml += `<g transform="translate(${x}, ${y})">${cellsData[cellIdx](cellSize)}</g>`;
                    }
                    cellIdx++;
                }
            }
            svgHtml += `</svg>`;
            return svgHtml;
        },

        renderOptionSvg(renderFn, size = 90) {
            return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${size}" height="${size}" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
                <g>${renderFn(size)}</g>
            </svg>`;
        },

        /** Dessine un polyomino centré dans une boîte carrée. */
        polyominoSvg(shape, size, color, accent) {
            const cells = shape.cells;
            const w = Math.max(...cells.map(c => c[0])) + 1;
            const h = Math.max(...cells.map(c => c[1])) + 1;
            const pad = size * 0.12;
            const unit = Math.min((size - 2 * pad) / w, (size - 2 * pad) / h);
            const offX = (size - unit * w) / 2;
            const offY = (size - unit * h) / 2;

            let out = '';
            cells.forEach(([x, y]) => {
                const isMarker = (x === shape.marker[0] && y === shape.marker[1]);
                out += `<rect x="${(offX + x * unit).toFixed(2)}" y="${(offY + y * unit).toFixed(2)}" width="${unit.toFixed(2)}" height="${unit.toFixed(2)}" fill="${isMarker ? accent : 'rgba(15,23,42,0.06)'}" stroke="${color}" stroke-width="${Math.max(1.5, unit * 0.09).toFixed(2)}"/>`;
            });
            return out;
        },

        /** Grille de n points, utilisée par les matrices de progression numérique. */
        dotsSvg(n, size, color) {
            const cols = Math.ceil(Math.sqrt(Math.max(1, n)));
            const rows = Math.ceil(n / cols);
            const r = Math.max(3, Math.min(size / (cols * 3.2), size / (rows * 3.2)));
            const stepX = size / (cols + 1);
            const stepY = size / (rows + 1);
            let out = '';
            for (let i = 0; i < n; i++) {
                const cx = stepX * ((i % cols) + 1);
                const cy = stepY * (Math.floor(i / cols) + 1);
                out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}"/>`;
            }
            return out;
        }
    },

    // =========================================================================
    // VALIDATION & DÉDOUBLONNAGE
    // =========================================================================

    /** Empreinte visuelle d'une option : on rend réellement le SVG pour comparer. */
    optionSignature(opt) {
        if (typeof opt.render === 'function') {
            try { return 'svg:' + this.utils.hash(opt.render(90)); }
            catch (e) { return 'svg:err'; }
        }
        return 'txt:' + this.normalizeAnswer(opt.text);
    },

    /** Empreinte d'un item : énoncé + stimulus + bonne réponse. */
    itemSignature(item) {
        let stimulus = '';
        if (typeof item.renderMatrix === 'function') {
            try { stimulus = item.renderMatrix(); } catch (e) { stimulus = 'err'; }
        }
        if (item.presentation) stimulus += '|' + item.presentation.steps.join('');
        const correct = item.inputMode === 'text'
            ? (item.acceptedAnswers || []).join('/')
            : (item.options || []).filter(o => o.isCorrect).map(o => this.optionSignature(o)).join('/');
        return this.utils.hash(`${item.domain}|${item.type}|${item.questionText}|${stimulus}|${correct}`);
    },

    /**
     * Rejette tout item structurellement cassé. C'est ce filtre qui empêche
     * les « deux fois la même proposition » et les « deux bonnes réponses ».
     */
    validateItem(item) {
        if (!item || !item.domain) return false;

        if (item.inputMode === 'text') {
            return Array.isArray(item.acceptedAnswers) && item.acceptedAnswers.length > 0
                && item.acceptedAnswers.every(a => typeof a === 'string' && a.length > 0);
        }

        const opts = item.options;
        if (!Array.isArray(opts) || opts.length < 3) return false;
        if (opts.filter(o => o.isCorrect).length !== 1) return false;

        const sigs = opts.map(o => this.optionSignature(o));
        if (sigs.some(s => !s || s === 'txt:')) return false;
        return new Set(sigs).size === sigs.length;
    },

    /** Mélange les options et réassigne les identifiants. */
    finalizeOptions(options) {
        this.utils.shuffle(options);
        options.forEach((opt, idx) => { opt.id = idx; });
        return options;
    },

    // =========================================================================
    // Gf — RAISONNEMENT FLUIDE (matrices)
    // =========================================================================
    generateGf(difficulty, idIndex, type) {
        const U = this.utils;
        const G = this.SVGGenerators;
        let cells, correctRender, wrongRenders, questionText;

        if (type === 'rotation') {
            const color = U.sample(this.PALETTE);
            const glyphName = U.sample(Object.keys(G.glyphs));
            const glyph = G.glyphs[glyphName];
            const step = U.sample([45, 90, 135, -45, -90, -135]);
            const base = U.randInt(0, 7) * 45;

            const make = (angle) => (s) => `<g transform="rotate(${U.normAngle(angle)}, ${s / 2}, ${s / 2})">${glyph(s, color)}</g>`;

            cells = [];
            for (let i = 0; i < 8; i++) cells.push(make(base + i * step));
            cells.push(null);

            const correctAngle = U.normAngle(base + 8 * step);
            correctRender = make(correctAngle);
            wrongRenders = U.shuffle([45, 90, 135, 180, 225, 270, 315])
                .filter(d => U.normAngle(correctAngle + d) !== correctAngle)
                .slice(0, 3)
                .map(d => make(correctAngle + d));

            questionText = 'Identifiez la figure qui complète logiquement la matrice.';

        } else if (type === 'union') {
            // Règle : 3e colonne = réunion des deux premières. Tous les distracteurs
            // comportent EXACTEMENT le même nombre de traits que la bonne réponse,
            // sinon la réponse se devinait en comptant les traits.
            const strokeColors = { v: '#8b5cf6', h: '#ec4899', d1: '#f59e0b', d2: '#6366f1' };
            const draw = {
                v: (s) => G.shapes.line(s / 2, 10, s / 2, s - 10, strokeColors.v, 3),
                h: (s) => G.shapes.line(10, s / 2, s - 10, s / 2, strokeColors.h, 3),
                d1: (s) => G.shapes.line(10, 10, s - 10, s - 10, strokeColors.d1, 3),
                d2: (s) => G.shapes.line(s - 10, 10, 10, s - 10, strokeColors.d2, 3)
            };
            const makeLines = (set) => (s) => set.slice().sort().map(k => draw[k](s)).join('');

            const paths = ['v', 'h', 'd1', 'd2'];
            const pair = () => U.sampleDistinct(paths, 2);
            const rows = [pair(), pair(), pair()];
            cells = [];
            for (let r = 0; r < 3; r++) {
                cells.push(makeLines([rows[r][0]]));
                cells.push(makeLines([rows[r][1]]));
                if (r < 2) cells.push(makeLines(rows[r])); else cells.push(null);
            }

            const correctSet = rows[2].slice().sort();
            correctRender = makeLines(correctSet);

            const allPairs = [];
            for (let i = 0; i < paths.length; i++) {
                for (let j = i + 1; j < paths.length; j++) allPairs.push([paths[i], paths[j]]);
            }
            wrongRenders = U.shuffle(allPairs)
                .filter(p => p.slice().sort().join('') !== correctSet.join(''))
                .slice(0, 3)
                .map(p => makeLines(p));

            questionText = 'Chaque 3e case combine les deux précédentes. Quelle figure complète la matrice ?';

        } else if (type === 'progression') {
            const color = U.sample(this.PALETTE);
            const start = U.randInt(1, 3);
            const rowStep = U.randInt(1, 2);
            const colStep = U.randInt(1, 3);
            const countAt = (r, c) => start + r * rowStep + c * colStep;

            cells = [];
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    if (r === 2 && c === 2) { cells.push(null); continue; }
                    const n = countAt(r, c);
                    cells.push((s) => G.dotsSvg(n, s, color));
                }
            }

            const correctN = countAt(2, 2);
            correctRender = (s) => G.dotsSvg(correctN, s, color);
            const candidates = [correctN - 1, correctN + 1, correctN - 2, correctN + 2, correctN + 3]
                .filter(n => n > 0 && n !== correctN);
            wrongRenders = U.shuffle(candidates).slice(0, 3).map(n => (s) => G.dotsSvg(n, s, color));

            questionText = 'Le nombre de points suit une règle. Combien de points dans la case manquante ?';

        } else {
            // grid : forme déterminée par la ligne, couleur par la colonne (carré latin si difficile)
            const symbolNames = U.sampleDistinct(Object.keys(G.symbols), 3);
            const colors = U.sampleDistinct(this.PALETTE, 3);
            const latin = difficulty >= 3;

            const shapeIdxAt = (r, c) => latin ? (r + c) % 3 : r;
            const colorIdxAt = (r, c) => latin ? (r + 2 * c) % 3 : c;
            const makeCell = (si, ci) => (s) => `<g transform="translate(${s / 2 - 15}, ${s / 2 - 15})">${G.symbols[symbolNames[si]](colors[ci])}</g>`;

            cells = [];
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    if (r === 2 && c === 2) { cells.push(null); continue; }
                    cells.push(makeCell(shapeIdxAt(r, c), colorIdxAt(r, c)));
                }
            }

            const cs = shapeIdxAt(2, 2), cc = colorIdxAt(2, 2);
            correctRender = makeCell(cs, cc);
            const combos = [];
            for (let si = 0; si < 3; si++) {
                for (let ci = 0; ci < 3; ci++) {
                    if (si !== cs || ci !== cc) combos.push([si, ci]);
                }
            }
            wrongRenders = U.shuffle(combos).slice(0, 3).map(([si, ci]) => makeCell(si, ci));

            questionText = 'Forme et couleur obéissent chacune à une règle. Quelle case complète la grille ?';
        }

        const options = this.finalizeOptions([
            { render: correctRender, isCorrect: true },
            ...wrongRenders.map(w => ({ render: w, isCorrect: false }))
        ]);

        return {
            id: `gf_${idIndex}`,
            domain: 'Gf',
            type: `gf_${type}`,
            difficulty,
            inputMode: 'choice',
            timeLimitSeconds: 30 + difficulty * 5,
            questionText,
            renderMatrix: () => G.matrixPattern(3, cells, 8),
            options
        };
    },

    // =========================================================================
    // Gvis — TRAITEMENTS VISUO-SPATIAUX
    // =========================================================================
    generateGvis(difficulty, idIndex, type) {
        const U = this.utils;
        const G = this.SVGGenerators;
        const P = this.polyomino;

        const size = Math.min(7, 4 + difficulty);
        const base = P.randomAsymmetric(size);
        const color = difficulty > 3 ? '#ec4899' : '#6366f1';
        const accent = difficulty > 3 ? '#f59e0b' : '#0ea5e9';

        const renderMatrix = () => {
            const box = 200;
            return `<svg width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${box}" height="${box}" rx="12" fill="#ffffff" stroke="${color}" stroke-width="2"/>
                ${G.polyominoSvg(base, box, color, accent)}
            </svg>`;
        };
        const toOption = (shape) => (s) => G.polyominoSvg(shape, s, color, accent);

        // Les 8 apparences possibles ; isFullyAsymmetric garantit qu'elles sont
        // toutes distinctes, donc aucun distracteur ne peut égaler la bonne réponse.
        const rotations = [0, 1, 2, 3].map(n => ({ shape: P.rotateTimes(base, n), quarter: n, mirrored: false }));
        const mirrors = [0, 1, 2, 3].map(n => ({ shape: P.rotateTimes(P.mirror(base), n), quarter: n, mirrored: true }));

        let correctEntry, pool, questionText;

        if (type === 'rotation') {
            const quarter = U.sample([1, 2, 3]);
            correctEntry = rotations[quarter];
            pool = rotations.filter(r => r.quarter !== quarter).concat(mirrors);
            const label = quarter === 1 ? '90° vers la droite' : quarter === 2 ? '180°' : '90° vers la gauche';
            questionText = `Quelle figure correspond exactement à la forme ci-dessus après une rotation de ${label} ?`;

        } else if (type === 'mirror') {
            correctEntry = mirrors[U.sample([0, 1, 2, 3])];
            pool = rotations.concat(mirrors.filter(m => m !== correctEntry));
            questionText = "Quelle figure est l'image dans un miroir de la forme ci-dessus (retournement, pas simple rotation) ?";

        } else {
            // odd : trois rotations légitimes + un retournement à démasquer
            correctEntry = U.sample(mirrors);
            pool = rotations.slice();
            questionText = "Trois de ces figures s'obtiennent en tournant la forme ci-dessus. Laquelle est impossible à obtenir sans la retourner ?";
        }

        const correctKey = P.key(correctEntry.shape);
        const distractors = [];
        const seen = new Set([correctKey]);
        U.shuffle(pool).forEach(entry => {
            const k = P.key(entry.shape);
            if (seen.has(k) || distractors.length >= 3) return;
            seen.add(k);
            distractors.push(entry);
        });

        const options = this.finalizeOptions([
            { render: toOption(correctEntry.shape), isCorrect: true },
            ...distractors.map(d => ({ render: toOption(d.shape), isCorrect: false }))
        ]);

        return {
            id: `gvis_${idIndex}`,
            domain: 'Gvis',
            type: `gvis_${type}`,
            difficulty,
            inputMode: 'choice',
            timeLimitSeconds: 25 + difficulty * 5,
            questionText,
            renderMatrix,
            options
        };
    },

    // =========================================================================
    // Gwm — MÉMOIRE DE TRAVAIL
    // Présentation séquentielle (un stimulus à la fois) + saisie libre.
    // En QCM avec la séquence affichée en entier, l'ordre inverse se lisait
    // simplement de droite à gauche : la tâche « inverse » ne testait rien.
    // =========================================================================
    generateGwm(difficulty, idIndex, type) {
        const U = this.utils;

        if (type === 'letterNumber') {
            const length = Math.min(8, 4 + Math.floor(difficulty / 2) + U.randInt(0, 1));
            const letters = 'BCDFHJKLMPRSTVZ'.split('');
            const steps = [];
            const usedDigits = new Set();
            const usedLetters = new Set();
            for (let i = 0; i < length; i++) {
                if (i % 2 === 0 || usedLetters.size >= letters.length) {
                    let d;
                    do { d = String(U.randInt(1, 9)); } while (usedDigits.has(d) && usedDigits.size < 9);
                    usedDigits.add(d);
                    steps.push(d);
                } else {
                    let l;
                    do { l = U.sample(letters); } while (usedLetters.has(l));
                    usedLetters.add(l);
                    steps.push(l);
                }
            }
            U.shuffle(steps);

            const digits = steps.filter(s => /[0-9]/.test(s)).sort();
            const alpha = steps.filter(s => /[A-Z]/.test(s)).sort();
            const answer = digits.concat(alpha).join('');

            return {
                id: `gwm_${idIndex}`,
                domain: 'Gwm',
                type: 'gwm_letterNumber',
                difficulty,
                inputMode: 'text',
                timeLimitSeconds: 25 + length * 3,
                questionText: "Vous allez voir des chiffres et des lettres, un par un. Restituez d'abord les **chiffres par ordre croissant**, puis les **lettres par ordre alphabétique**.",
                inputHint: 'Exemple de format : 2 5 B R',
                presentation: { kind: 'sequence', steps, stepMs: this.CONFIG.spanStepMs, gapMs: this.CONFIG.spanGapMs },
                acceptedAnswers: [this.normalizeAnswer(answer)]
            };
        }

        if (type === 'runningDigits') {
            // Le sujet ignore quand la série s'arrêtera et doit restituer les N
            // derniers chiffres : impossible de se reposer sur une répétition
            // mentale complète, il faut maintenir une fenêtre glissante.
            const tailLength = Math.min(5, 2 + Math.floor(difficulty / 2));
            const length = tailLength + U.randInt(3, 5) + difficulty;
            const steps = [];
            for (let i = 0; i < length; i++) {
                let d;
                do { d = String(U.randInt(1, 9)); } while (steps.length && d === steps[steps.length - 1]);
                steps.push(d);
            }
            const answer = steps.slice(-tailLength).join('');

            return {
                id: `gwm_${idIndex}`,
                domain: 'Gwm',
                type: 'gwm_runningDigits',
                difficulty,
                inputMode: 'text',
                timeLimitSeconds: 20 + tailLength * 4,
                questionText: `Une série de chiffres de longueur inconnue va défiler. À la fin, saisissez uniquement les **${tailLength} DERNIERS** chiffres, dans l'ordre.`,
                inputHint: `${tailLength} chiffres attendus — espaces et tirets ignorés`,
                // hideLength : le compteur « n / N » révélerait la longueur totale
                // et permettrait d'anticiper la fin, ce qui annule l'épreuve.
                presentation: { kind: 'sequence', steps, stepMs: this.CONFIG.spanStepMs, gapMs: this.CONFIG.spanGapMs, hideLength: true },
                acceptedAnswers: [this.normalizeAnswer(answer)]
            };
        }

        const isReverse = (type === 'digitBackward');
        const length = Math.min(9, 3 + difficulty + U.randInt(0, 1));
        const steps = [];
        for (let i = 0; i < length; i++) {
            // Pas deux fois le même chiffre d'affilée : sinon la cadence
            // d'affichage rend le doublon indétectable.
            let d;
            do { d = String(U.randInt(1, 9)); } while (steps.length && d === steps[steps.length - 1]);
            steps.push(d);
        }

        const answer = (isReverse ? steps.slice().reverse() : steps.slice()).join('');

        return {
            id: `gwm_${idIndex}`,
            domain: 'Gwm',
            type: isReverse ? 'gwm_digitBackward' : 'gwm_digitForward',
            difficulty,
            inputMode: 'text',
            timeLimitSeconds: 20 + length * 3,
            questionText: isReverse
                ? "Les chiffres défilent un par un. Saisissez-les ensuite dans l'**ordre INVERSE** (du dernier au premier)."
                : "Les chiffres défilent un par un. Saisissez-les ensuite dans l'**ordre NORMAL**.",
            inputHint: 'Chiffres uniquement, espaces et tirets ignorés',
            presentation: { kind: 'sequence', steps, stepMs: this.CONFIG.spanStepMs, gapMs: this.CONFIG.spanGapMs },
            acceptedAnswers: [this.normalizeAnswer(answer)]
        };
    },

    // =========================================================================
    // Gs — VITESSE DE TRAITEMENT
    // L'ancienne tâche était binaire OUI/NON : 50 % de réussite au hasard,
    // ce qui rendait l'indice à peu près ininterprétable.
    // =========================================================================
    generateGs(difficulty, idIndex, type) {
        const U = this.utils;
        const G = this.SVGGenerators;
        const symbolNames = Object.keys(G.symbols);

        if (type === 'coding') {
            const keySize = Math.min(6, 3 + difficulty);
            const keySymbols = U.sampleDistinct(symbolNames, keySize);
            const keyDigits = U.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].slice()).slice(0, keySize);
            const probeIdx = U.randInt(0, keySize - 1);
            const color = '#0f172a';

            const renderMatrix = () => {
                const w = 320, h = 190;
                const cell = Math.min(46, (w - 40) / keySize);
                let svg = `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
                    <rect width="${w}" height="${h}" rx="12" fill="#ffffff" stroke="#8b5cf6" stroke-width="2"/>
                    <text x="16" y="24" font-size="12" fill="#6366f1" font-weight="600">TABLE DE CORRESPONDANCE</text>`;
                keySymbols.forEach((name, i) => {
                    const x = 20 + i * cell;
                    svg += `<rect x="${x}" y="34" width="${cell - 6}" height="${cell - 6}" rx="6" fill="#f8fafc" stroke="#cbd5e1"/>`;
                    svg += `<g transform="translate(${x + (cell - 6) / 2 - 15}, ${34 + (cell - 6) / 2 - 15}) scale(0.85)">${G.symbols[name](color)}</g>`;
                    svg += `<text x="${x + (cell - 6) / 2}" y="${34 + cell + 12}" font-size="16" font-weight="700" fill="#0ea5e9" text-anchor="middle">${keyDigits[i]}</text>`;
                });
                svg += `<line x1="16" y1="126" x2="${w - 16}" y2="126" stroke="#e2e8f0" stroke-width="1"/>
                    <text x="16" y="148" font-size="12" fill="#6366f1" font-weight="600">SYMBOLE À CODER</text>
                    <g transform="translate(${w / 2 - 15}, 150)">${G.symbols[keySymbols[probeIdx]](color)}</g>
                </svg>`;
                return svg;
            };

            const correct = keyDigits[probeIdx];
            const wrongs = keyDigits.filter(d => d !== correct);
            const options = this.finalizeOptions([
                { text: String(correct), isCorrect: true },
                ...U.shuffle(wrongs).slice(0, 3).map(d => ({ text: String(d), isCorrect: false }))
            ]);

            return {
                id: `gs_${idIndex}`,
                domain: 'Gs',
                type: 'gs_coding',
                difficulty,
                inputMode: 'choice',
                timeLimitSeconds: Math.max(7, 15 - difficulty),
                questionText: 'CODAGE RAPIDE : quel chiffre correspond au symbole affiché sous la table ?',
                renderMatrix,
                options
            };
        }

        // search : compter les occurrences exactes (forme + couleur) de la cible
        const targetName = U.sample(symbolNames);
        const targetColor = U.sample(this.PALETTE);
        const rowLength = Math.min(14, 7 + difficulty);
        const occurrences = U.randInt(0, 3);

        const row = [];
        for (let i = 0; i < occurrences; i++) row.push({ name: targetName, color: targetColor });
        let guard = 0;
        while (row.length < rowLength && guard++ < 500) {
            const name = U.sample(symbolNames);
            const color = U.sample(this.PALETTE);
            if (name === targetName && color === targetColor) continue; // éviterait de fausser le compte
            row.push({ name, color });
        }
        U.shuffle(row);

        const renderMatrix = () => {
            const w = 340, h = 175;
            const step = Math.min(34, (w - 40) / rowLength);
            let svg = `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${w}" height="${h}" rx="12" fill="#ffffff" stroke="#8b5cf6" stroke-width="2"/>
                <text x="16" y="24" font-size="12" fill="#6366f1" font-weight="600">SYMBOLE CIBLE</text>
                <g transform="translate(${w / 2 - 15}, 34) scale(1.2)">${G.symbols[targetName](targetColor)}</g>
                <line x1="16" y1="92" x2="${w - 16}" y2="92" stroke="#e2e8f0" stroke-width="1"/>
                <text x="16" y="114" font-size="12" fill="#6366f1" font-weight="600">LIGNE À BALAYER</text>
                <g transform="translate(20, 128)">`;
            row.forEach((item, idx) => {
                svg += `<g transform="translate(${(idx * step).toFixed(1)}, 0) scale(${(step / 34).toFixed(3)})">${G.symbols[item.name](item.color)}</g>`;
            });
            svg += `</g></svg>`;
            return svg;
        };

        const candidates = [0, 1, 2, 3, 4].filter(n => n !== occurrences);
        const options = this.finalizeOptions([
            { text: String(occurrences), isCorrect: true },
            ...U.shuffle(candidates).slice(0, 3).map(n => ({ text: String(n), isCorrect: false }))
        ]);

        return {
            id: `gs_${idIndex}`,
            domain: 'Gs',
            type: 'gs_search',
            difficulty,
            inputMode: 'choice',
            timeLimitSeconds: Math.max(8, 16 - difficulty),
            questionText: 'BALAYAGE VISUEL : combien de fois le symbole cible apparaît-il EXACTEMENT (forme ET couleur) dans la ligne ?',
            renderMatrix,
            options
        };
    },

    // =========================================================================
    // GcQ — RAISONNEMENT VERBAL & QUANTITATIF
    // =========================================================================

    VERBAL_ANALOGIES: [
        { q: 'PLUME est à OISEAU ce que ÉCAILLE est à :', a: 'POISSON', w: ['SERPENT', 'FEUILLE', 'POIL'] },
        { q: 'SCULPTEUR est à MARBRE ce que ÉCRIVAIN est à :', a: 'MOTS', w: ['LIVRE', 'PLUME', 'IMPRIMERIE'] },
        { q: 'ORBITE est à PLANÈTE ce que TRAJECTOIRE est à :', a: 'PROJECTILE', w: ['VOITURE', 'ESPACE', 'VITESSE'] },
        { q: 'LUMIÈRE est à AVEUGLE ce que SON est à :', a: 'SOURD', w: ['MUSIQUE', 'OREILLE', 'MUET'] },
        { q: 'MÉDECIN est à PATIENT ce que AVOCAT est à :', a: 'CLIENT', w: ['JUGE', 'TRIBUNAL', 'LOI'] },
        { q: 'AFFAMÉ est à NOURRITURE ce que ASSOIFFÉ est à :', a: 'EAU', w: ['DÉSERT', 'VERRE', 'SOIF'] },
        { q: 'GRAINE est à ARBRE ce que ŒUF est à :', a: 'OISEAU', w: ['NID', 'COQUILLE', 'POULE'] },
        { q: 'THERMOMÈTRE est à TEMPÉRATURE ce que BALANCE est à :', a: 'MASSE', w: ['CUISINE', 'ÉQUILIBRE', 'MÉTAL'] },
        { q: 'PRÉFACE est à LIVRE ce que PRÉLUDE est à :', a: 'MORCEAU', w: ['ORCHESTRE', 'PIANO', 'SILENCE'] },
        { q: 'ARCHIPEL est à ÎLE ce que CONSTELLATION est à :', a: 'ÉTOILE', w: ['CIEL', 'PLANÈTE', 'NUIT'] },
        { q: 'ÉBAUCHE est à TABLEAU ce que BROUILLON est à :', a: 'TEXTE', w: ['STYLO', 'CAHIER', 'ÉCOLE'] },
        { q: 'CANICULE est à CHALEUR ce que DÉLUGE est à :', a: 'PLUIE', w: ['ARCHE', 'FLEUVE', 'ORAGE'] },
        { q: 'AVARE est à ARGENT ce que GLOUTON est à :', a: 'NOURRITURE', w: ['ASSIETTE', 'RESTAURANT', 'FAIM'] },
        { q: 'BOUSSOLE est à DIRECTION ce que HORLOGE est à :', a: 'TEMPS', w: ['AIGUILLE', 'MUR', 'RENDEZ-VOUS'] },
        { q: 'ÉTINCELLE est à INCENDIE ce que RUMEUR est à :', a: 'SCANDALE', w: ['SILENCE', 'JOURNAL', 'VÉRITÉ'] },
        { q: 'CHIRURGIEN est à SCALPEL ce que MENUISIER est à :', a: 'RABOT', w: ['ATELIER', 'CHAISE', 'FORÊT'] },
        { q: 'DICTIONNAIRE est à MOT ce que ATLAS est à :', a: 'CARTE', w: ['VOYAGE', 'PAYS', 'GÉOGRAPHIE'] },
        { q: 'FAMINE est à NOURRITURE ce que SÉCHERESSE est à :', a: 'EAU', w: ['SOLEIL', 'DÉSERT', 'RÉCOLTE'] },
        { q: 'MURMURE est à CRI ce que TIÈDE est à :', a: 'BRÛLANT', w: ['FROID', 'GLACÉ', 'DOUX'] },
        { q: 'ANCRE est à NAVIRE ce que RACINE est à :', a: 'ARBRE', w: ['TERRE', 'FEUILLE', 'JARDIN'] },
        { q: 'PARTITION est à MUSICIEN ce que PLAN est à :', a: 'ARCHITECTE', w: ['MAISON', 'CHANTIER', 'BÉTON'] },
        { q: 'CICATRICE est à BLESSURE ce que SOUVENIR est à :', a: 'ÉVÉNEMENT', w: ['OUBLI', 'PHOTO', 'MÉMOIRE'] },
        { q: 'ÉCLUSE est à CANAL ce que BARRAGE est à :', a: 'RIVIÈRE', w: ['LAC', 'BÉTON', 'ÉLECTRICITÉ'] },
        { q: 'PRUDENT est à TÉMÉRAIRE ce que ÉCONOME est à :', a: 'DÉPENSIER', w: ['RICHE', 'PAUVRE', 'AVARE'] },
        { q: 'ESQUISSE est à PRÉCISION ce que APERÇU est à :', a: 'DÉTAIL', w: ['RÉSUMÉ', 'IMAGE', 'RAPIDITÉ'] },
        { q: 'VIRUS est à MALADIE ce que BUG est à :', a: 'PANNE', w: ['ORDINATEUR', 'CODE', 'INTERNET'] },
        { q: 'PÉTALE est à FLEUR ce que TUILE est à :', a: 'TOIT', w: ['MAISON', 'ARGILE', 'PLUIE'] },
        { q: 'INSPIRER est à EXPIRER ce que ABSORBER est à :', a: 'REJETER', w: ['BOIRE', 'ÉPONGE', 'REMPLIR'] }
    ],

    ODD_ONE_OUT_SETS: [
        { family: ['VIOLON', 'ALTO', 'VIOLONCELLE', 'HARPE', 'CONTREBASSE'], intruders: ['TROMPETTE', 'TAMBOUR', 'FLÛTE'] },
        { family: ['CUIVRE', 'FER', 'ZINC', 'PLOMB', 'NICKEL'], intruders: ['GRANIT', 'VERRE', 'BOIS'] },
        { family: ['CARRÉ', 'LOSANGE', 'TRAPÈZE', 'RECTANGLE', 'PARALLÉLOGRAMME'], intruders: ['TRIANGLE', 'PENTAGONE', 'CERCLE'] },
        { family: ['SEINE', 'LOIRE', 'RHÔNE', 'GARONNE', 'MOSELLE'], intruders: ['LÉMAN', 'ATLANTIQUE', 'ALPES'] },
        { family: ['MERCURE', 'VÉNUS', 'MARS', 'JUPITER', 'SATURNE'], intruders: ['LUNE', 'SOLEIL', 'PHOBOS'] },
        { family: ['CHÊNE', 'HÊTRE', 'BOULEAU', 'ÉRABLE', 'FRÊNE'], intruders: ['SAPIN', 'FOUGÈRE', 'ROSIER'] },
        { family: ['AIGLE', 'FAUCON', 'BUSE', 'ÉPERVIER', 'MILAN'], intruders: ['CORBEAU', 'PIGEON', 'MOUETTE'] },
        { family: ['ROMAN', 'NOUVELLE', 'CONTE', 'FABLE', 'RÉCIT'], intruders: ['SONNET', 'TABLEAU', 'SYMPHONIE'] },
        { family: ['SECONDE', 'MINUTE', 'HEURE', 'JOUR', 'SEMAINE'], intruders: ['MÈTRE', 'LITRE', 'GRAMME'] },
        { family: ['SCALPEL', 'PINCE', 'BISTOURI', 'SUTURE', 'COMPRESSE'], intruders: ['MARTEAU', 'TOURNEVIS', 'CLÉ'] },
        { family: ['ESPAGNOL', 'ITALIEN', 'PORTUGAIS', 'ROUMAIN', 'FRANÇAIS'], intruders: ['ALLEMAND', 'FINNOIS', 'HONGROIS'] },
        { family: ['TRIANGLE', 'PENTAGONE', 'HEPTAGONE', 'NONAGONE', 'HENDÉCAGONE'], intruders: ['CARRÉ', 'HEXAGONE', 'OCTOGONE'] }
    ],

    /**
     * Problèmes de logique arithmétique avec informations parasites.
     * Chaque modèle renvoie { text, answer, traps } où `traps` sont les résultats
     * d'erreurs de raisonnement plausibles (oubli d'un facteur, usage d'un
     * nombre inutile), qui font de bien meilleurs distracteurs que du bruit.
     */
    WORD_PROBLEM_TEMPLATES: [
        function machines(U) {
            const perMachineDay = U.randInt(2, 6);
            const machines = U.randInt(3, 6);
            const days = U.randInt(2, 4);
            const needed = U.randInt(4, 12);
            const daily = machines * perMachineDay;
            const target = needed * perMachineDay * days;
            const workers = U.randInt(15, 40);
            const hours = U.randInt(6, 10);
            return {
                text: `Dans un atelier, ${machines} machines fabriquent ${daily} ballons par jour. L'usine emploie ${workers} ouvriers et fonctionne ${hours} heures par jour. Combien faudrait-il de machines pour fabriquer ${target} ballons en ${days} jours ?`,
                answer: needed,
                // Erreurs plausibles : oubli de la division par les jours ;
                // division du total par la cadence actuelle de l'atelier.
                traps: [needed * days, Math.round(target / daily), machines + days]
            };
        },

        function hens(U) {
            const perHenDay = U.randInt(1, 3);
            const hens = U.randInt(3, 6);
            const days = U.randInt(2, 5);
            const hens2 = U.randInt(4, 12);
            const days2 = U.randInt(2, 6);
            const eggs = hens * days * perHenDay;
            const hectares = U.randInt(3, 20);
            return {
                text: `Dans une ferme de ${hectares} hectares, ${hens} poules pondent ${eggs} œufs en ${days} jours. Combien d'œufs pondront ${hens2} poules en ${days2} jours ?`,
                answer: hens2 * days2 * perHenDay,
                // Oubli du facteur "jours" ; recopie de l'énoncé ; mise à l'échelle
                // sur les poules seulement. (hens2*days2 collisionnait avec la
                // réponse dès que perHenDay valait 1.)
                traps: [hens2 * perHenDay, eggs, Math.round(eggs * hens2 / hens)]
            };
        },

        function painters(U) {
            const perPainterDay = U.randInt(1, 3);
            const painters = U.randInt(2, 5);
            const days = U.randInt(2, 4);
            const walls = painters * days * perPainterDay;
            const targetPainters = U.randInt(3, 9);
            const targetDays = U.randInt(2, 5);
            const liters = U.randInt(20, 60);
            const floors = U.randInt(2, 6);
            return {
                text: `Un immeuble de ${floors} étages a été repeint avec ${liters} litres de peinture. Si ${painters} peintres peignent ${walls} murs en ${days} jours, combien de murs peindront ${targetPainters} peintres en ${targetDays} jours ?`,
                answer: targetPainters * targetDays * perPainterDay,
                // Oubli du facteur "jours" ; recopie de l'énoncé ; mise à l'échelle
                // sur les peintres seulement.
                traps: [targetPainters * perPainterDay, walls, Math.round(walls * targetPainters / painters)]
            };
        },

        function tap(U) {
            const rate = U.randInt(3, 12);
            const minutes = U.randInt(4, 15);
            const volume = rate * minutes;
            const capacity = volume + U.randInt(50, 300);
            const weight = U.randInt(8, 40);
            return {
                text: `Un robinet débite ${rate} litres par minute. La cuve a une capacité totale de ${capacity} litres et pèse ${weight} kilos à vide. Combien de minutes faut-il pour y verser ${volume} litres ?`,
                answer: minutes,
                traps: [Math.round(capacity / rate), rate + minutes, volume - rate]
            };
        },

        function train(U) {
            const speed = U.sample([60, 80, 90, 120]);
            const minutes = U.sample([15, 20, 30, 40, 45]);
            const distance = Math.round(speed * minutes / 60);
            const passengers = U.randInt(80, 400);
            const cars = U.randInt(4, 12);
            return {
                text: `Un train roule à ${speed} kilomètres par heure. Il transporte ${passengers} passagers répartis dans ${cars} wagons. Combien de minutes lui faut-il pour parcourir ${distance} kilomètres ?`,
                answer: minutes,
                // Confusion distance/temps, puis deux voisins plausibles.
                traps: [distance, minutes + 10, Math.max(2, minutes - 5)]
            };
        },

        function pens(U) {
            const unitPrice = U.randInt(2, 9);
            const lot = U.randInt(3, 8);
            const lotPrice = unitPrice * lot;
            const quantity = U.randInt(4, 15);
            const openHour = U.randInt(7, 10);
            const aisles = U.randInt(4, 14);
            return {
                text: `Un lot de ${lot} stylos coûte ${lotPrice} euros. Le magasin ouvre à ${openHour} heures et compte ${aisles} rayons. Combien coûtent ${quantity} stylos achetés à l'unité au même prix ?`,
                answer: quantity * unitPrice,
                traps: [quantity * lotPrice, lotPrice + quantity, quantity + unitPrice]
            };
        },

        function ages(U) {
            const childAge = U.randInt(6, 16);
            // L'écart mère-enfant vaut childAge + gap : on impose gap >= 20 - childAge
            // pour que la mère ait au moins 20 ans de plus que son fils.
            const minGap = Math.max(2, 20 - childAge);
            const gap = U.randInt(minGap, minGap + 8);
            const motherAge = 2 * childAge + gap;
            // Ces quantités parasites démarrent à 2 : au singulier, l'énoncé lu
            // à voix haute produirait « 1 autres enfants ».
            const siblings = U.randInt(2, 4);
            const cars = U.randInt(2, 3);
            return {
                text: `Aujourd'hui, Marc a ${childAge} ans et sa mère a ${motherAge} ans. La famille compte ${siblings} autres enfants et possède ${cars} voitures. Dans combien d'années l'âge de la mère sera-t-il exactement le double de celui de Marc ?`,
                answer: gap,
                // motherAge - childAge vaut par construction childAge + gap :
                // les deux anciens pièges étaient toujours le même nombre.
                traps: [motherAge - childAge, childAge, Math.round(motherAge / 2)]
            };
        },

        function books(U) {
            const pagesPerDay = U.randInt(15, 45);
            const days = U.randInt(3, 12);
            const totalPages = pagesPerDay * days;
            const books = U.randInt(2, 6);
            const shelves = U.randInt(3, 9);
            return {
                text: `Léa possède ${books} livres rangés sur ${shelves} étagères. Elle lit ${pagesPerDay} pages par jour sans jamais s'arrêter. En combien de jours aura-t-elle lu ${totalPages} pages ?`,
                answer: days,
                traps: [totalPages - pagesPerDay, days * books, pagesPerDay + days]
            };
        }
    ],

    generateGcQ(difficulty, idIndex, type) {
        const U = this.utils;

        if (type === 'wordProblem') {
            const template = U.sample(this.WORD_PROBLEM_TEMPLATES);
            const problem = template(U);
            const correct = Math.round(problem.answer);

            const seen = new Set([correct]);
            const distractors = [];
            (problem.traps || []).forEach(t => {
                const v = Math.round(t);
                if (v > 0 && !seen.has(v)) { seen.add(v); distractors.push(v); }
            });
            // Complément si des pièges ont collisionné entre eux
            let delta = 1;
            while (distractors.length < 3 && delta < 40) {
                [correct + delta, correct - delta].forEach(v => {
                    if (distractors.length < 3 && v > 0 && !seen.has(v)) { seen.add(v); distractors.push(v); }
                });
                delta++;
            }

            const options = this.finalizeOptions([
                { text: String(correct), isCorrect: true },
                ...distractors.slice(0, 3).map(v => ({ text: String(v), isCorrect: false }))
            ]);

            return {
                id: `gcq_${idIndex}`,
                domain: 'GcQ',
                type: 'gcq_wordProblem',
                difficulty,
                inputMode: 'choice',
                oral: true,
                timeLimitSeconds: 40 + difficulty * 5,
                questionText: problem.text,
                spokenText: problem.text,
                options
            };
        }

        if (type === 'analogy') {
            const item = U.sample(this.VERBAL_ANALOGIES);
            const options = this.finalizeOptions([
                { text: item.a, isCorrect: true },
                ...item.w.map(w => ({ text: w, isCorrect: false }))
            ]);
            return {
                id: `gcq_${idIndex}`,
                domain: 'GcQ',
                type: 'gcq_analogy',
                difficulty,
                inputMode: 'choice',
                timeLimitSeconds: 25 + difficulty * 3,
                questionText: `Analogie verbale : ${item.q}`,
                options
            };
        }

        if (type === 'oddOneOut') {
            const set = U.sample(this.ODD_ONE_OUT_SETS);
            const family = U.sampleDistinct(set.family, 3);
            const intruder = U.sample(set.intruders);
            const options = this.finalizeOptions([
                { text: intruder, isCorrect: true },
                ...family.map(f => ({ text: f, isCorrect: false }))
            ]);
            return {
                id: `gcq_${idIndex}`,
                domain: 'GcQ',
                type: 'gcq_oddOneOut',
                difficulty,
                inputMode: 'choice',
                timeLimitSeconds: 25 + difficulty * 3,
                questionText: "Trouvez l'intrus : quel mot n'appartient pas à la même catégorie que les trois autres ?",
                options
            };
        }

        // series : suite numérique
        const start = U.randInt(2, 12);
        const seq = [start];
        const logic = U.randInt(1, 6);
        const factor = U.randInt(2, 4);
        const add = U.randInt(1, 6);

        for (let i = 1; i < 6; i++) {
            const prev = seq[i - 1];
            if (logic === 1) seq.push(prev + add * i);
            else if (logic === 2) seq.push(prev * factor + add);
            else if (logic === 3) seq.push(prev + Math.pow(2, i));
            else if (logic === 4) seq.push(prev + prev + i);
            else if (logic === 5) seq.push(prev + (i % 2 === 0 ? add : add * 2));
            else seq.push(prev + i * i);
        }

        const correctAns = seq.pop();
        const seen = new Set([correctAns]);
        const distractors = [];
        U.shuffle([-2, -1, 1, 2, 3, -3, 10, -10]).forEach(d => {
            const v = correctAns + d;
            if (distractors.length < 3 && v > 0 && !seen.has(v)) { seen.add(v); distractors.push(v); }
        });

        const options = this.finalizeOptions([
            { text: String(correctAns), isCorrect: true },
            ...distractors.map(v => ({ text: String(v), isCorrect: false }))
        ]);

        return {
            id: `gcq_${idIndex}`,
            domain: 'GcQ',
            type: 'gcq_series',
            difficulty,
            inputMode: 'choice',
            timeLimitSeconds: 25 + difficulty * 8,
            questionText: `Raisonnement quantitatif : complétez la série logique — ${seq.join(' — ')} — ?`,
            options
        };
    },

    // =========================================================================
    // ASSEMBLAGE DE LA BATTERIE
    // =========================================================================

    generateItem(domain, difficulty, idIndex, type) {
        switch (domain) {
            case 'Gf': return this.generateGf(difficulty, idIndex, type);
            case 'Gvis': return this.generateGvis(difficulty, idIndex, type);
            case 'Gwm': return this.generateGwm(difficulty, idIndex, type);
            case 'Gs': return this.generateGs(difficulty, idIndex, type);
            case 'GcQ': return this.generateGcQ(difficulty, idIndex, type);
            default: return null;
        }
    },

    /**
     * @param {Number} totalItems Nombre total d'items (réparti équitablement sur les 5 domaines)
     */
    generateTestBattery(totalItems) {
        const U = this.utils;
        const domains = ['Gf', 'Gvis', 'Gwm', 'Gs', 'GcQ'];
        const perDomain = Math.max(1, Math.floor(totalItems / domains.length));

        const items = [];
        const usedSignatures = new Set();

        domains.forEach((domain, d) => {
            // Cycle de types mélangé : sur `perDomain` items, chaque type revient
            // le même nombre de fois (±1). Impossible d'avoir 5 fois la même tâche.
            const types = this.DOMAIN_TYPES[domain];
            const schedule = [];
            while (schedule.length < perDomain) {
                U.shuffle(types.slice()).forEach(t => {
                    if (schedule.length < perDomain) schedule.push(t);
                });
            }

            for (let i = 0; i < perDomain; i++) {
                const difficulty = Math.min(5, Math.max(1, Math.ceil(((i + 1) / perDomain) * 5)));
                const idIdx = d * perDomain + i;
                let item = null;

                for (let attempt = 0; attempt < this.CONFIG.maxGenerationAttempts; attempt++) {
                    // Après plusieurs échecs, on autorise un autre type du domaine
                    // plutôt que de boucler sur un générateur en difficulté.
                    const type = attempt < this.CONFIG.maxGenerationAttempts / 2
                        ? schedule[i]
                        : U.sample(types);

                    const candidate = this.generateItem(domain, difficulty, idIdx, type);
                    if (!candidate || !this.validateItem(candidate)) continue;

                    const sig = this.itemSignature(candidate);
                    if (usedSignatures.has(sig)) continue;

                    usedSignatures.add(sig);
                    candidate.signature = sig;
                    item = candidate;
                    break;
                }

                if (item) items.push(item);
                else console.warn(`Impossible de générer un item valide pour ${domain} (difficulté ${difficulty})`);
            }
        });

        // Entrelacement : on mélange les domaines par palier de difficulté, de
        // sorte que la difficulté monte globalement sans enchaîner un même domaine.
        const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        items.forEach(item => buckets[item.difficulty].push(item));

        let battery = [];
        for (let level = 1; level <= 5; level++) {
            battery = battery.concat(U.shuffle(buckets[level]));
        }

        // Évite deux items consécutifs du même domaine quand c'est possible.
        for (let i = 1; i < battery.length - 1; i++) {
            if (battery[i].domain !== battery[i - 1].domain) continue;
            for (let j = i + 1; j < battery.length; j++) {
                if (battery[j].domain === battery[i].domain) continue;
                if (battery[j].difficulty !== battery[i].difficulty) continue;
                const tmp = battery[i]; battery[i] = battery[j]; battery[j] = tmp;
                break;
            }
        }

        return battery;
    }
};
