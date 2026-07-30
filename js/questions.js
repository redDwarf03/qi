/**
 * QI METRIX 2026 - Moteur de Génération Procédurale d'Items
 * Industrialisation : Difficulté dynamique et infinité d'items
 */

const QuestionBank = {

    SVGGenerators: {
        shapes: {
            circle: (cx, cy, r, c, fill="none", w=3) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${c}" stroke-width="${w}"/>`,
            rect: (x, y, w, h, c, fill="none", sw=3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${c}" stroke-width="${sw}"/>`,
            polygon: (pts, c, fill="none", w=3) => `<polygon points="${pts}" fill="${fill}" stroke="${c}" stroke-width="${w}"/>`,
            line: (x1, y1, x2, y2, c, w=3) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`,
            star: (cx, cy, r, c, fill="none") => {
                let pts = [];
                for (let i = 0; i < 5; i++) {
                    let a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
                }
                return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${c}" stroke-width="3"/>`;
            }
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
                        svgHtml += `<text x="${x + cellSize/2}" y="${y + cellSize/2 + 8}" font-size="28" font-weight="bold" fill="#0ea5e9" text-anchor="middle">?</text>`;
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
        }
    },

    utils: {
        randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
        shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }
    },

    // ---------------------------------------------------------
    // GENERATEUR: RAISONNEMENT FLUIDE (Gf)
    // ---------------------------------------------------------
    generateGf(difficulty, idIndex) {
        const S = this.SVGGenerators.shapes;
        const G = this.SVGGenerators;
        
        let type = this.utils.randInt(1, 3);
        let cells = [];
        let missingIndex = 8;
        let correctRender, wrongRenders = [];

        if (type === 1 || difficulty < 3) {
            // Matrice de Rotation Simple
            let baseAngle = this.utils.randInt(0, 3) * 90;
            let step = (this.utils.randInt(0, 1) === 0 ? 45 : 90) * (this.utils.randInt(0, 1) === 0 ? 1 : -1);
            let colors = ['#0ea5e9', '#6366f1', '#f59e0b', '#ec4899'];
            let color = colors[this.utils.randInt(0, colors.length - 1)];

            const makeArrow = (angle, c) => (s) => `
                <g transform="rotate(${angle}, ${s/2}, ${s/2})">
                    ${S.line(s/2, s*0.8, s/2, s*0.2, c, 4)}
                    ${S.polygon(`${s/2 - 8},${s*0.35} ${s/2},${s*0.15} ${s/2 + 8},${s*0.35}`, c, c, 1)}
                </g>`;
            
            for(let i=0; i<8; i++) cells.push(makeArrow(baseAngle + i*step, color));
            cells.push(null);

            correctRender = makeArrow(baseAngle + 8*step, color);
            wrongRenders = [
                makeArrow(baseAngle + 8*step + 90, color),
                makeArrow(baseAngle + 8*step + 180, color),
                makeArrow(baseAngle + 8*step + 270, color)
            ];
        } else {
            // Matrice d'Addition Logique (XOR / OR)
            const makeLines = (lines) => (s) => {
                let h = '';
                if (lines.includes('v')) h += S.line(s/2, 10, s/2, s-10, '#8b5cf6', 3);
                if (lines.includes('h')) h += S.line(10, s/2, s-10, s/2, '#ec4899', 3);
                if (lines.includes('d1')) h += S.line(10, 10, s-10, s-10, '#f59e0b', 3);
                if (lines.includes('d2')) h += S.line(s-10, 10, 10, s-10, '#6366f1', 3);
                return h;
            };
            
            let possiblePaths = ['v', 'h', 'd1', 'd2'];
            let r1 = [possiblePaths[this.utils.randInt(0,3)]];
            let r2 = [possiblePaths[this.utils.randInt(0,3)]];
            let att1 = 0;
            while(r2[0] === r1[0] && att1++ < 50) r2 = [possiblePaths[this.utils.randInt(0,3)]];

            let row1 = [ r1, r2, [...new Set([...r1, ...r2])] ];
            
            let r3 = [possiblePaths[this.utils.randInt(0,3)]];
            let r4 = [possiblePaths[this.utils.randInt(0,3)]];
            let att2 = 0;
            while(r4[0] === r3[0] && att2++ < 50) r4 = [possiblePaths[this.utils.randInt(0,3)]];
            
            let row2 = [ r3, r4, [...new Set([...r3, ...r4])] ];

            let r5 = [possiblePaths[this.utils.randInt(0,3)]];
            let r6 = [possiblePaths[this.utils.randInt(0,3)]];
            let att3 = 0;
            while(r6[0] === r5[0] && att3++ < 50) r6 = [possiblePaths[this.utils.randInt(0,3)]];
            
            let row3 = [ r5, r6 ]; // Missing 3rd
            let correctArr = [...new Set([...r5, ...r6])];

            cells = [
                makeLines(row1[0]), makeLines(row1[1]), makeLines(row1[2]),
                makeLines(row2[0]), makeLines(row2[1]), makeLines(row2[2]),
                makeLines(row3[0]), makeLines(row3[1]), null
            ];

            correctRender = makeLines(correctArr);
            wrongRenders = [
                makeLines([r5[0]]), 
                makeLines([r6[0]]), 
                makeLines([possiblePaths.find(p => p !== r5[0] && p !== r6[0])])
            ];
        }

        let options = [ { render: correctRender, isCorrect: true } ];
        wrongRenders.forEach(w => options.push({ render: w, isCorrect: false }));
        this.utils.shuffle(options);
        options.forEach((opt, idx) => opt.id = idx);

        return {
            id: `gf_${idIndex}`,
            domain: 'Gf',
            timeLimitSeconds: 30 + (difficulty * 5),
            type: 'matrix',
            questionText: 'Identifiez le motif logique qui complète la matrice ci-dessous :',
            renderMatrix: () => G.matrixPattern(3, cells, 8),
            options: options
        };
    },

    // ---------------------------------------------------------
    // GENERATEUR: TRAITEMENT VISUO-SPATIAL (Gvis)
    // ---------------------------------------------------------
    generateGvis(difficulty, idIndex) {
        const S = this.SVGGenerators.shapes;
        const baseAngles = [90, 180, 270];
        let targetAngle = baseAngles[this.utils.randInt(0, 2)];
        
        let color = '#6366f1';
        let accColor = '#0ea5e9';
        if (difficulty > 3) {
            color = '#ec4899';
            accColor = '#f59e0b';
        }

        const shapeDefs = [
            { // L-shape
                base: { pts: '20,20 80,20 80,60 120,60 120,100 20,100', cx: 50, cy: 50 },
                opt: { pts: '10,10 50,10 50,30 70,30 70,60 10,60', cx: 30, cy: 30, rotX: 35, rotY: 35, flipX: -70 }
            },
            { // Z-shape
                base: { pts: '20,20 90,20 90,60 130,60 130,100 60,100 60,60 20,60', cx: 40, cy: 40 },
                opt: { pts: '10,10 55,10 55,35 80,35 80,60 40,60 40,35 10,35', cx: 25, cy: 22, rotX: 45, rotY: 35, flipX: -90 }
            },
            { // U-shape
                base: { pts: '20,20 50,20 50,80 90,80 90,20 120,20 120,110 20,110', cx: 70, cy: 95 },
                opt: { pts: '12,12 30,12 30,48 54,48 54,12 72,12 72,66 12,66', cx: 42, cy: 57, rotX: 42, rotY: 39, flipX: -84 }
            },
            { // Gamma
                base: { pts: '20,20 100,20 100,60 60,60 60,120 20,120', cx: 40, cy: 90 },
                opt: { pts: '12,12 60,12 60,36 36,36 36,72 12,72', cx: 24, cy: 54, rotX: 36, rotY: 42, flipX: -72 }
            }
        ];
        
        let shape = shapeDefs[this.utils.randInt(0, shapeDefs.length - 1)];

        const renderMatrix = () => {
            const size = 200;
            return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <rect width="${size}" height="${size}" rx="12" fill="#ffffff" stroke="${color}" stroke-width="2"/>
                <g transform="translate(40, 40)">
                    ${S.polygon(shape.base.pts, color, 'rgba(0,0,0,0.05)', 3)}
                    ${S.circle(shape.base.cx, shape.base.cy, 8, accColor, accColor)}
                </g>
            </svg>`;
        };

        const makeOpt = (rot, scaleX) => (s) => `<g transform="translate(10,10) scale(${scaleX}, 1) ${scaleX === -1 ? `translate(${shape.opt.flipX},0)` : ''} rotate(${rot}, ${shape.opt.rotX}, ${shape.opt.rotY})">
            ${S.polygon(shape.opt.pts, color, 'none', 2)}
            ${S.circle(shape.opt.cx, shape.opt.cy, 5, accColor, accColor)}
        </g>`;

        let correctRender = makeOpt(targetAngle, 1);
        let options = [ { render: correctRender, isCorrect: true } ];
        
        let wrongs = [];
        baseAngles.forEach(a => { if (a !== targetAngle) wrongs.push(makeOpt(a, 1)); });
        wrongs.push(makeOpt(targetAngle, -1)); // Mirrored

        this.utils.shuffle(wrongs);
        wrongs.slice(0, 3).forEach(w => options.push({ render: w, isCorrect: false }));
        this.utils.shuffle(options);
        options.forEach((opt, idx) => opt.id = idx);

        let directionStr = targetAngle === 90 ? "90° à droite" : targetAngle === 180 ? "180°" : "90° à gauche";

        return {
            id: `gvis_${idIndex}`,
            domain: 'Gvis',
            timeLimitSeconds: 25 + (difficulty * 5),
            type: 'spatial',
            questionText: `Quelle figure correspond exactement à la forme originale après une rotation de ${directionStr} ?`,
            renderMatrix: renderMatrix,
            options: options
        };
    },

    // ---------------------------------------------------------
    // GENERATEUR: MÉMOIRE DE TRAVAIL (Gwm)
    // ---------------------------------------------------------
    generateGwm(difficulty, idIndex) {
        let length = 3 + difficulty + this.utils.randInt(0, 1);
        let seq = [];
        for(let i=0; i<length; i++) {
            seq.push(this.utils.randInt(1, 9));
        }

        let isReverse = difficulty >= 3 || this.utils.randInt(0, 1) === 1;
        let correctArr = isReverse ? [...seq].reverse() : [...seq];
        let correctStr = correctArr.join(' - ');

        let options = [{ text: correctStr, isCorrect: true }];
        
        // Faux choix
        let attempts = 0;
        while(options.length < 4 && attempts < 100) {
            attempts++;
            let fakeArr = [...correctArr];
            if (Math.random() < 0.5 && fakeArr.length >= 2) {
                // Swap two adjacent items
                let swapIdx = this.utils.randInt(0, fakeArr.length - 2);
                let temp = fakeArr[swapIdx];
                fakeArr[swapIdx] = fakeArr[swapIdx + 1];
                fakeArr[swapIdx + 1] = temp;
            } else {
                // Alter one digit
                let alterIdx = this.utils.randInt(0, fakeArr.length - 1);
                fakeArr[alterIdx] = this.utils.randInt(1, 9);
            }
            
            let fakeStr = fakeArr.join(' - ');
            if (!options.find(o => o.text === fakeStr)) {
                options.push({ text: fakeStr, isCorrect: false });
            }
        }

        // Fallback ultime si 4 options n'ont pas encore été trouvées
        let fallbackAttempts = 0;
        while(options.length < 4 && fallbackAttempts < 50) {
            fallbackAttempts++;
            let fakeArr = Array.from({ length }, () => this.utils.randInt(1, 9));
            let fakeStr = fakeArr.join(' - ');
            if (!options.find(o => o.text === fakeStr)) {
                options.push({ text: fakeStr, isCorrect: false });
            }
        }
        
        this.utils.shuffle(options);
        options.forEach((opt, idx) => opt.id = idx);

        return {
            id: `gwm_${idIndex}`,
            domain: 'Gwm',
            timeLimitSeconds: 15 + (length * 3),
            type: 'digit_span',
            questionText: `Mémorisez la séquence, puis restituez-la dans l'ordre **${isReverse ? 'INVERSE' : 'NORMAL'}** :`,
            sequence: seq,
            options: options
        };
    },

    // ---------------------------------------------------------
    // GENERATEUR: VITESSE DE TRAITEMENT (Gs)
    // ---------------------------------------------------------
    generateGs(difficulty, idIndex) {
        const S = this.SVGGenerators.shapes;
        let isPresent = this.utils.randInt(0, 1) === 1;
        
        let shapesGen = [
            (c) => S.circle(15, 15, 12, c),
            (c) => S.rect(3, 3, 24, 24, c),
            (c) => S.star(15, 15, 12, c, 'none'),
            (c) => S.polygon('15,3 27,25 3,25', c)
        ];
        
        let colors = ['#0ea5e9', '#6366f1', '#ec4899', '#f59e0b', '#8b5cf6'];
        
        let targetShape = shapesGen[this.utils.randInt(0, shapesGen.length-1)];
        let targetColor = colors[this.utils.randInt(0, colors.length-1)];

        let searchGroup = [];
        let numSearchItems = 3 + difficulty;
        
        for (let i = 0; i < numSearchItems; i++) {
            if (isPresent && i === 0) {
                searchGroup.push({ shape: targetShape, color: targetColor });
            } else {
                searchGroup.push({
                    shape: shapesGen[this.utils.randInt(0, shapesGen.length-1)],
                    color: colors[this.utils.randInt(0, colors.length-1)]
                });
            }
        }
        
        // S'assurer que le target n'y est pas si isPresent est faux
        if (!isPresent) {
            searchGroup = searchGroup.map(item => {
                if (item.shape === targetShape && item.color === targetColor) {
                    return { shape: shapesGen[(shapesGen.indexOf(targetShape)+1)%shapesGen.length], color: targetColor };
                }
                return item;
            });
        }
        this.utils.shuffle(searchGroup);

        const renderMatrix = () => {
            const size = 300;
            let svg = `<svg width="100%" height="200" viewBox="0 0 ${size} 200">
                <rect width="${size}" height="200" rx="12" fill="#ffffff" stroke="#8b5cf6" stroke-width="2"/>
                <text x="20" y="35" font-size="14" fill="#6366f1">SYMBOLE CIBLE :</text>
                <g transform="translate(130, 40) scale(1.5)">
                    ${targetShape(targetColor)}
                </g>
                <line x1="20" y1="110" x2="${size-20}" y2="110" stroke="#e2e8f0" stroke-width="1"/>
                <text x="20" y="135" font-size="14" fill="#6366f1">GROUPE DE RECHERCHE :</text>
                <g transform="translate(20, 150)">`;
                
            searchGroup.forEach((item, idx) => {
                svg += `<g transform="translate(${idx * 40}, 0)">${item.shape(item.color)}</g>`;
            });
            
            svg += `</g></svg>`;
            return svg;
        };

        let options = [
            { id: 0, text: 'OUI (Le symbole est présent)', isCorrect: isPresent },
            { id: 1, text: 'NON (Absent)', isCorrect: !isPresent }
        ];

        return {
            id: `gs_${idIndex}`,
            domain: 'Gs',
            timeLimitSeconds: Math.max(5, 12 - difficulty), // Très rapide (10s à 6s)
            type: 'speed_match',
            questionText: 'TÂCHE DE VITESSE : Le symbole cible apparaît-il EXACTEMENT (forme et couleur) dans la ligne du bas ?',
            renderMatrix: renderMatrix,
            options: options
        };
    },

    // ---------------------------------------------------------
    // GENERATEUR: RAISONNEMENT VERBAL & QUANTITATIF (GcQ)
    // ---------------------------------------------------------
    generateGcQ(difficulty, idIndex) {
        let isMath = this.utils.randInt(0, 2) > 0; // 2/3 math, 1/3 verbal
        
        if (isMath) {
            let start = this.utils.randInt(2, 10);
            let seq = [start];
            let logic = this.utils.randInt(1, 4);
            let factor = this.utils.randInt(2, 4);
            let add = this.utils.randInt(1, 5);

            for (let i = 1; i < 5; i++) {
                let prev = seq[i-1];
                if (logic === 1) seq.push(prev + (add * i)); // Addition progressive
                else if (logic === 2) seq.push((prev * factor) + add); // Mult + Add
                else if (logic === 3) seq.push(prev + Math.pow(2, i)); // Puissance de 2
                else seq.push(prev + prev + i); // Fibonacci-like mixte
            }

            let correctAns = seq.pop();
            let correctStr = correctAns.toString();
            let options = [{ text: correctStr, isCorrect: true }];

            let diffs = [-2, -1, 1, 2, 10, -10];
            this.utils.shuffle(diffs);
            for (let i = 0; i < 3; i++) {
                options.push({ text: (correctAns + diffs[i]).toString(), isCorrect: false });
            }
            this.utils.shuffle(options);
            options.forEach((opt, idx) => opt.id = idx);

            return {
                id: `gcq_${idIndex}`,
                domain: 'GcQ',
                timeLimitSeconds: 20 + (difficulty * 10),
                type: 'number_series',
                questionText: `Raisonnement Quantitatif : Complétez la série logique : ${seq.join(' — ')} — ?`,
                options: options
            };
        } else {
            // Verbal Bank
            const analogies = [
                { q: "PLUME est à OISEAU ce que ÉCAILLE est à :", a: "POISSON", w: ["SERPENT", "FEUILLE", "POIL"] },
                { q: "SCULPTEUR est à MARBRE ce que ÉCRIVAIN est à :", a: "MOTS", w: ["LIVRE", "PLUME", "IMPRIMERIE"] },
                { q: "ORBITE est à PLANÈTE ce que TRAJECTOIRE est à :", a: "PROJECTILE", w: ["VOITURE", "ESPACE", "VITESSE"] },
                { q: "LUMIÈRE est à AVEUGLE ce que SON est à :", a: "SOURD", w: ["MUSIQUE", "OREILLE", "MUET"] }
            ];
            let item = analogies[this.utils.randInt(0, analogies.length-1)];
            
            let options = [{ text: item.a, isCorrect: true }];
            item.w.forEach(w => options.push({ text: w, isCorrect: false }));
            this.utils.shuffle(options);
            options.forEach((opt, idx) => opt.id = idx);

            return {
                id: `gcq_${idIndex}`,
                domain: 'GcQ',
                timeLimitSeconds: 25,
                type: 'analogy',
                questionText: `Analogie Verbale : ${item.q}`,
                options: options
            };
        }
    },

    /**
     * Génère une batterie complète d'items procéduraux
     * @param {Number} totalItems Nombre total d'items (ex: 30 pour Express, 75 pour Full)
     */
    generateTestBattery(totalItems) {
        let items = [];
        let domains = ['Gf', 'Gvis', 'Gwm', 'Gs', 'GcQ'];
        
        let itemsPerDomain = Math.floor(totalItems / 5);
        
        for (let d = 0; d < 5; d++) {
            let domain = domains[d];
            for (let i = 0; i < itemsPerDomain; i++) {
                // Progression de difficulté de 1 à 5
                let difficulty = Math.min(5, Math.max(1, Math.ceil(((i + 1) / itemsPerDomain) * 5)));
                let idIdx = (d * itemsPerDomain) + i;
                
                if (domain === 'Gf') items.push(this.generateGf(difficulty, idIdx));
                if (domain === 'Gvis') items.push(this.generateGvis(difficulty, idIdx));
                if (domain === 'Gwm') items.push(this.generateGwm(difficulty, idIdx));
                if (domain === 'Gs') items.push(this.generateGs(difficulty, idIdx));
                if (domain === 'GcQ') items.push(this.generateGcQ(difficulty, idIdx));
            }
        }
        
        // Entrelacement (Interleaving) des questions au lieu d'avoir tout Gf puis tout Gs
        // On mélange intelligemment tout en gardant une difficulté globalement croissante
        // On découpe en blocs de difficulté
        let chunks = { 1:[], 2:[], 3:[], 4:[], 5:[] };
        items.forEach((item, index) => {
            let diffLevel = Math.min(5, Math.max(1, Math.ceil((( (index % itemsPerDomain) + 1) / itemsPerDomain) * 5)));
            chunks[diffLevel].push(item);
        });
        
        let finalBattery = [];
        for (let i = 1; i <= 5; i++) {
            finalBattery = finalBattery.concat(this.utils.shuffle(chunks[i]));
        }

        return finalBattery;
    }
};


