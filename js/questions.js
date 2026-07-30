/**
 * QI METRIX 2026 - Banque d'Items Psychométriques & Générateurs Vectoriels SVG
 * Normes CHC / WAIS-V
 */

const QuestionBank = {

    /**
     * Générateur d'illustrations SVG pour les items visuels
     */
    SVGGenerators: {
        
        /**
         * Génère une matrice 2x2 ou 3x3 avec la case manquante (?)
         */
        matrixPattern(gridSize, cellsData, missingIndex = 8) {
            const size = 260;
            const cellSize = Math.floor((size - (gridSize + 1) * 6) / gridSize);
            let svgHtml = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="matrix-svg" xmlns="http://www.w3.org/2000/svg">`;
            
            svgHtml += `<rect width="${size}" height="${size}" rx="12" fill="#14172b" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>`;

            let cellIdx = 0;
            for (let r = 0; r < gridSize; r++) {
                for (let c = 0; c < gridSize; c++) {
                    const x = 6 + c * (cellSize + 6);
                    const y = 6 + r * (cellSize + 6);

                    svgHtml += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="8" fill="#1c203b" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;

                    if (cellIdx === missingIndex) {
                        svgHtml += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="8" fill="rgba(0, 242, 254, 0.08)" stroke="#00f2fe" stroke-width="2" stroke-dasharray="4,4"/>`;
                        svgHtml += `<text x="${x + cellSize/2}" y="${y + cellSize/2 + 8}" font-size="28" font-weight="bold" fill="#00f2fe" text-anchor="middle">?</text>`;
                    } else if (cellsData[cellIdx]) {
                        svgHtml += `<g transform="translate(${x}, ${y})">${cellsData[cellIdx](cellSize)}</g>`;
                    }
                    cellIdx++;
                }
            }
            svgHtml += `</svg>`;
            return svgHtml;
        },

        /**
         * Génère un choix de réponse SVG pour les matrices
         */
        renderOptionSvg(renderFn, size = 90) {
            return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${size}" height="${size}" rx="8" fill="#1c203b" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
                <g transform="translate(0, 0)">${renderFn(size)}</g>
            </svg>`;
        },

        // Helper formes géométriques de base
        shapes: {
            circle(cx, cy, r, color, fill = "none", strokeWidth = 3) {
                return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${color}" stroke-width="${strokeWidth}"/>`;
            },
            rect(x, y, w, h, color, fill = "none", strokeWidth = 3, rx = 4) {
                return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${color}" stroke-width="${strokeWidth}"/>`;
            },
            polygon(points, color, fill = "none", strokeWidth = 3) {
                return `<polygon points="${points}" fill="${fill}" stroke="${color}" stroke-width="${strokeWidth}"/>`;
            },
            line(x1, y1, x2, y2, color, strokeWidth = 3) {
                return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
            },
            star(cx, cy, r, color, fill = "none") {
                let pts = [];
                for (let i = 0; i < 5; i++) {
                    let a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
                }
                return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${color}" stroke-width="3"/>`;
            }
        }
    },

    /**
     * Liste complète des items
     */
    getItems() {
        const S = this.SVGGenerators.shapes;
        const G = this.SVGGenerators;

        return [
            // ==========================================
            // DOMAINE 1: RAISONNEMENT FLUIDE (Gf)
            // ==========================================
            {
                id: 'gf_1',
                domain: 'Gf',
                timeLimitSeconds: 45,
                type: 'matrix',
                questionText: 'Identifiez le motif logique qui complète la matrice ci-dessous :',
                renderMatrix: () => {
                    // Matrice 3x3 avec rotation progressive d'une flèche (0, 45, 90, 135...)
                    const renderCell = (angle, color) => (s) => `
                        <g transform="rotate(${angle}, ${s/2}, ${s/2})">
                            ${S.line(s/2, s*0.8, s/2, s*0.2, color, 4)}
                            ${S.polygon(`${s/2 - 8},${s*0.35} ${s/2},${s*0.15} ${s/2 + 8},${s*0.35}`, color, color, 1)}
                        </g>
                    `;
                    const cells = [
                        renderCell(0, '#00f2fe'),   renderCell(45, '#00f2fe'),  renderCell(90, '#00f2fe'),
                        renderCell(135, '#7f00ff'), renderCell(180, '#7f00ff'), renderCell(225, '#7f00ff'),
                        renderCell(270, '#ffb703'), renderCell(315, '#ffb703'), null
                    ];
                    return G.matrixPattern(3, cells, 8);
                },
                options: [
                    { id: 0, isCorrect: true, render: (s) => `<g transform="rotate(0, ${s/2}, ${s/2})">${S.line(s/2, s*0.8, s/2, s*0.2, '#ffb703', 4)}${S.polygon(`${s/2 - 8},${s*0.35} ${s/2},${s*0.15} ${s/2 + 8},${s*0.35}`, '#ffb703', '#ffb703', 1)}</g>` },
                    { id: 1, render: (s) => `<g transform="rotate(90, ${s/2}, ${s/2})">${S.line(s/2, s*0.8, s/2, s*0.2, '#ffb703', 4)}${S.polygon(`${s/2 - 8},${s*0.35} ${s/2},${s*0.15} ${s/2 + 8},${s*0.35}`, '#ffb703', '#ffb703', 1)}</g>` },
                    { id: 2, render: (s) => `<g transform="rotate(180, ${s/2}, ${s/2})">${S.line(s/2, s*0.8, s/2, s*0.2, '#ffb703', 4)}${S.polygon(`${s/2 - 8},${s*0.35} ${s/2},${s*0.15} ${s/2 + 8},${s*0.35}`, '#ffb703', '#ffb703', 1)}</g>` },
                    { id: 3, render: (s) => `<g transform="rotate(270, ${s/2}, ${s/2})">${S.line(s/2, s*0.8, s/2, s*0.2, '#00f2fe', 4)}${S.polygon(`${s/2 - 8},${s*0.35} ${s/2},${s*0.15} ${s/2 + 8},${s*0.35}`, '#00f2fe', '#00f2fe', 1)}</g>` }
                ]
            },
            {
                id: 'gf_2',
                domain: 'Gf',
                timeLimitSeconds: 50,
                type: 'matrix',
                questionText: 'Déterminez la figure manquante selon la progression logique des formes et couleurs :',
                renderMatrix: () => {
                    const renderCell = (shape, count, color) => (s) => {
                        let html = '';
                        const offsets = count === 1 ? [[s/2, s/2]] : count === 2 ? [[s/3, s/2], [2*s/3, s/2]] : [[s/3, s/3], [2*s/3, s/3], [s/2, 2*s/3]];
                        offsets.forEach(([cx, cy]) => {
                            if (shape === 'c') html += S.circle(cx, cy, 10, color, color);
                            else if (shape === 's') html += S.rect(cx-9, cy-9, 18, 18, color, color);
                            else html += S.polygon(`${cx},${cy-10} ${cx-10},${cy+8} ${cx+10},${cy+8}`, color, color);
                        });
                        return html;
                    };
                    const cells = [
                        renderCell('c', 1, '#00f2fe'), renderCell('s', 2, '#7f00ff'), renderCell('t', 3, '#f72585'),
                        renderCell('s', 3, '#00f2fe'), renderCell('t', 1, '#7f00ff'), renderCell('c', 2, '#f72585'),
                        renderCell('t', 2, '#00f2fe'), renderCell('c', 3, '#7f00ff'), null
                    ];
                    return G.matrixPattern(3, cells, 8);
                },
                options: [
                    { id: 0, render: (s) => S.rect(s/2-10, s/2-10, 20, 20, '#f72585', '#f72585') },
                    { id: 1, isCorrect: true, render: (s) => S.rect(s/3-9, s/2-9, 18, 18, '#f72585', '#f72585') + S.rect(2*s/3-9, s/2-9, 18, 18, '#f72585', '#f72585') },
                    { id: 2, render: (s) => S.circle(s/2, s/2, 12, '#00f2fe', '#00f2fe') },
                    { id: 3, render: (s) => S.polygon(`${s/2},${s/2-10} ${s/2-10},${s/2+8} ${s/2+10},${s/2+8}`, '#7f00ff', '#7f00ff') }
                ]
            },
            {
                id: 'gf_3',
                domain: 'Gf',
                timeLimitSeconds: 60,
                type: 'matrix',
                questionText: 'Addition logique : La 3ème colonne est la fusion/superposition des deux premières. Trouvez la case manquante :',
                renderMatrix: () => {
                    const renderCell = (lines) => (s) => {
                        let html = '';
                        if (lines.includes('v')) html += S.line(s/2, 10, s/2, s-10, '#4cc9f0', 3);
                        if (lines.includes('h')) html += S.line(10, s/2, s-10, s/2, '#4cc9f0', 3);
                        if (lines.includes('d1')) html += S.line(10, 10, s-10, s-10, '#ffb703', 3);
                        if (lines.includes('d2')) html += S.line(s-10, 10, 10, s-10, '#ffb703', 3);
                        return html;
                    };
                    const cells = [
                        renderCell(['v']), renderCell(['h']), renderCell(['v', 'h']),
                        renderCell(['d1']), renderCell(['d2']), renderCell(['d1', 'd2']),
                        renderCell(['v', 'd1']), renderCell(['h', 'd2']), null
                    ];
                    return G.matrixPattern(3, cells, 8);
                },
                options: [
                    { id: 0, render: (s) => S.line(s/2, 10, s/2, s-10, '#4cc9f0', 3) + S.line(10, s/2, s-10, s/2, '#4cc9f0', 3) },
                    { id: 1, isCorrect: true, render: (s) => S.line(s/2, 10, s/2, s-10, '#4cc9f0', 3) + S.line(10, s/2, s-10, s/2, '#4cc9f0', 3) + S.line(10, 10, s-10, s-10, '#ffb703', 3) + S.line(s-10, 10, 10, s-10, '#ffb703', 3) },
                    { id: 2, render: (s) => S.line(10, 10, s-10, s-10, '#ffb703', 3) },
                    { id: 3, render: (s) => S.line(s-10, 10, 10, s-10, '#ffb703', 3) + S.line(10, s/2, s-10, s/2, '#4cc9f0', 3) }
                ]
            },

            // ==========================================
            // DOMAINE 2: TRAITEMENTS VISUO-SPATIAUX (Gvis)
            // ==========================================
            {
                id: 'gvis_1',
                domain: 'Gvis',
                timeLimitSeconds: 45,
                type: 'spatial',
                questionText: 'Quelle figure correspond exactement à la forme originale après une rotation de 90° dans le sens horaire ?',
                renderMatrix: () => {
                    const size = 200;
                    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                        <rect width="${size}" height="${size}" rx="12" fill="#14172b" stroke="#7f00ff" stroke-width="2"/>
                        <g transform="translate(40, 40)">
                            ${S.polygon('20,20 80,20 80,60 120,60 120,100 20,100', '#7f00ff', 'rgba(127,0,255,0.2)', 3)}
                            ${S.circle(50, 50, 8, '#00f2fe', '#00f2fe')}
                        </g>
                    </svg>`;
                },
                options: [
                    { id: 0, isCorrect: true, render: (s) => `<g transform="translate(10,10) rotate(90, 35, 35)">${S.polygon('10,10 50,10 50,30 70,30 70,60 10,60', '#7f00ff', 'rgba(127,0,255,0.2)', 2)}${S.circle(30, 30, 5, '#00f2fe', '#00f2fe')}</g>` },
                    { id: 1, render: (s) => `<g transform="translate(10,10) scale(-1, 1) translate(-70,0)">${S.polygon('10,10 50,10 50,30 70,30 70,60 10,60', '#7f00ff', 'rgba(127,0,255,0.2)', 2)}${S.circle(30, 30, 5, '#f72585', '#f72585')}</g>` },
                    { id: 2, render: (s) => `<g transform="translate(10,10) rotate(180, 35, 35)">${S.polygon('10,10 50,10 50,30 70,30 70,60 10,60', '#7f00ff', 'rgba(127,0,255,0.2)', 2)}${S.circle(50, 30, 5, '#00f2fe', '#00f2fe')}</g>` },
                    { id: 3, render: (s) => `<g transform="translate(10,10) rotate(270, 35, 35)">${S.polygon('10,10 50,10 50,30 70,30 70,60 10,60', '#f72585', 'rgba(247,37,133,0.2)', 2)}${S.circle(30, 30, 5, '#00f2fe', '#00f2fe')}</g>` }
                ]
            },
            {
                id: 'gvis_2',
                domain: 'Gvis',
                timeLimitSeconds: 50,
                type: 'spatial',
                questionText: 'Parmi les patrons ci-dessous, lequel permet de reconstituer le cube 3D représenté ?',
                renderMatrix: () => {
                    const size = 200;
                    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                        <rect width="${size}" height="${size}" rx="12" fill="#14172b" stroke="#7f00ff" stroke-width="2"/>
                        <!-- Isometric 3D Cube -->
                        <g transform="translate(100, 90)">
                            <!-- Top face -->
                            <polygon points="0,-40 40,-20 0,0 -40,-20" fill="rgba(0, 242, 254, 0.3)" stroke="#00f2fe" stroke-width="2"/>
                            ${S.circle(0, -20, 8, '#00f2fe', '#00f2fe')}
                            <!-- Left face -->
                            <polygon points="-40,-20 0,0 0,45 -40,25" fill="rgba(127, 0, 255, 0.3)" stroke="#7f00ff" stroke-width="2"/>
                            ${S.line(-20, -10, -20, 35, '#7f00ff', 3)}
                            <!-- Right face -->
                            <polygon points="0,0 40,-20 40,25 0,45" fill="rgba(247, 37, 133, 0.3)" stroke="#f72585" stroke-width="2"/>
                            ${S.star(20, 12, 6, '#f72585', '#f72585')}
                        </g>
                    </svg>`;
                },
                options: [
                    { id: 0, isCorrect: true, text: 'Patron A : Cercle en haut, Ligne verticale à gauche, Étoile à droite' },
                    { id: 1, text: 'Patron B : Étoile en haut, Cercle à gauche, Carré à droite' },
                    { id: 2, text: 'Patron C : Ligne horizontale en haut, Étoile à gauche, Cercle à droite' },
                    { id: 3, text: 'Patron D : Triangle en haut, Ligne verticale à gauche, Étoile à droite' }
                ]
            },

            // ==========================================
            // DOMAINE 3: MÉMOIRE DE TRAVAIL (Gwm)
            // ==========================================
            {
                id: 'gwm_1',
                domain: 'Gwm',
                timeLimitSeconds: 30,
                type: 'digit_span',
                questionText: 'Mémorisez la séquence numérique ci-dessous, puis restituez-la DANS L’ORDRE INVERSE :',
                sequence: [7, 3, 9, 2, 5],
                options: [
                    { id: 0, text: '5 - 2 - 9 - 3 - 7', isCorrect: true },
                    { id: 1, text: '7 - 3 - 9 - 2 - 5' },
                    { id: 2, text: '5 - 9 - 2 - 3 - 7' },
                    { id: 3, text: '2 - 5 - 7 - 3 - 9' }
                ]
            },
            {
                id: 'gwm_2',
                domain: 'Gwm',
                timeLimitSeconds: 35,
                type: 'digit_span',
                questionText: 'Mémorisez cette seconde séquence plus complexe, puis restituez-la dans l’ordre INVERSE :',
                sequence: [4, 8, 1, 6, 3, 9],
                options: [
                    { id: 0, text: '9 - 3 - 6 - 1 - 8 - 4', isCorrect: true },
                    { id: 1, text: '4 - 8 - 1 - 6 - 3 - 9' },
                    { id: 2, text: '9 - 6 - 3 - 1 - 8 - 4' },
                    { id: 3, text: '8 - 4 - 6 - 1 - 9 - 3' }
                ]
            },

            // ==========================================
            // DOMAINE 4: VITESSE DE TRAITEMENT (Gs)
            // ==========================================
            {
                id: 'gs_1',
                domain: 'Gs',
                timeLimitSeconds: 15,
                type: 'speed_match',
                questionText: 'TÂCHE RAPIDE : Identifiez si le symbole cible apparaît exactement parmi les symboles de recherche :',
                renderMatrix: () => {
                    const size = 200;
                    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                        <rect width="${size}" height="${size}" rx="12" fill="#14172b" stroke="#4cc9f0" stroke-width="2"/>
                        <text x="20" y="35" font-size="14" fill="#8b95c9">SYMBOLE CIBLE :</text>
                        <g transform="translate(75, 45)">
                            ${S.star(25, 25, 18, '#4cc9f0', 'rgba(76, 201, 240, 0.2)')}
                        </g>
                        <line x1="20" y1="110" x2="180" y2="110" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                        <text x="20" y="135" font-size="14" fill="#8b95c9">GROUPE DE RECHERCHE :</text>
                        <g transform="translate(20, 145)">
                            ${S.circle(15, 15, 12, '#7f00ff')}
                            ${S.star(65, 15, 12, '#4cc9f0', 'rgba(76, 201, 240, 0.2)')}
                            ${S.rect(100, 3, 24, 24, '#f72585')}
                        </g>
                    </svg>`;
                },
                options: [
                    { id: 0, text: 'OUI (Le symbole est présent)', isCorrect: true },
                    { id: 1, text: 'NON (Absent)' }
                ]
            },
            {
                id: 'gs_2',
                domain: 'Gs',
                timeLimitSeconds: 15,
                type: 'speed_match',
                questionText: 'TÂCHE RAPIDE : Le symbole cible apparaît-il dans la liste ?',
                renderMatrix: () => {
                    const size = 200;
                    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                        <rect width="${size}" height="${size}" rx="12" fill="#14172b" stroke="#4cc9f0" stroke-width="2"/>
                        <text x="20" y="35" font-size="14" fill="#8b95c9">SYMBOLE CIBLE :</text>
                        <g transform="translate(75, 45)">
                            ${S.polygon('25,5 45,45 5,45', '#ffb703', 'none', 3)}
                        </g>
                        <line x1="20" y1="110" x2="180" y2="110" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
                        <text x="20" y="135" font-size="14" fill="#8b95c9">GROUPE DE RECHERCHE :</text>
                        <g transform="translate(25, 145)">
                            ${S.circle(15, 15, 12, '#00f2fe')}
                            ${S.polygon('65,5 75,25 55,25', '#f72585')}
                            ${S.rect(100, 3, 24, 24, '#7f00ff')}
                        </g>
                    </svg>`;
                },
                options: [
                    { id: 0, text: 'OUI (Présent)' },
                    { id: 1, text: 'NON (Absent)', isCorrect: true }
                ]
            },

            // ==========================================
            // DOMAINE 5: RAISONNEMENT VERBAL & QUANTITATIF (Gc/Gq)
            // ==========================================
            {
                id: 'gc_1',
                domain: 'GcQ',
                timeLimitSeconds: 40,
                type: 'analogy',
                questionText: 'Analogie conceptuelle : ÉLECTRON est à ATOME ce que PLANÈTE est à :',
                options: [
                    { id: 0, text: 'SYSTÈME SOLAIRE', isCorrect: true },
                    { id: 1, text: 'GALAXIE' },
                    { id: 2, text: 'ORBITE' },
                    { id: 3, text: 'ASTÉROÏDE' }
                ]
            },
            {
                id: 'gc_2',
                domain: 'GcQ',
                timeLimitSeconds: 45,
                type: 'number_series',
                questionText: 'Suite numérique logique : Complétez la séquence : 3 — 7 — 15 — 31 — 63 — ?',
                options: [
                    { id: 0, text: '127', isCorrect: true }, // x2 + 1
                    { id: 1, text: '125' },
                    { id: 2, text: '95' },
                    { id: 3, text: '126' }
                ]
            },
            {
                id: 'gc_3',
                domain: 'GcQ',
                timeLimitSeconds: 50,
                type: 'syllogism',
                questionText: 'Déduction logique : Si tous les Glaces sont Froids, et aucun Froid n’est Brûlant, alors :',
                options: [
                    { id: 0, text: 'Aucune Glace n’est Brûlante', isCorrect: true },
                    { id: 1, text: 'Toutes les Glaces sont Brûlantes' },
                    { id: 2, text: 'Certains Brûlants sont Froids' },
                    { id: 3, text: 'Aucune conclusion possible' }
                ]
            },
            {
                id: 'gf_4',
                domain: 'Gf',
                timeLimitSeconds: 55,
                type: 'matrix',
                questionText: 'Matrice de Raven avancée : Trouvez la figure qui complète la grille 3x3 :',
                renderMatrix: () => {
                    const renderCell = (numRings, color) => (s) => {
                        let html = '';
                        for(let i=1; i<=numRings; i++) {
                            html += S.circle(s/2, s/2, i * 8, color, 'none', 2);
                        }
                        return html;
                    };
                    const cells = [
                        renderCell(1, '#00f2fe'), renderCell(2, '#00f2fe'), renderCell(3, '#00f2fe'),
                        renderCell(2, '#7f00ff'), renderCell(3, '#7f00ff'), renderCell(1, '#7f00ff'),
                        renderCell(3, '#f72585'), renderCell(1, '#f72585'), null
                    ];
                    return G.matrixPattern(3, cells, 8);
                },
                options: [
                    { id: 0, isCorrect: true, render: (s) => S.circle(s/2, s/2, 8, '#f72585', 'none', 2) + S.circle(s/2, s/2, 16, '#f72585', 'none', 2) },
                    { id: 1, render: (s) => S.circle(s/2, s/2, 8, '#00f2fe', 'none', 2) },
                    { id: 2, render: (s) => S.circle(s/2, s/2, 24, '#7f00ff', 'none', 2) },
                    { id: 3, render: (s) => S.rect(s/2-12, s/2-12, 24, 24, '#f72585') }
                ]
            },
            {
                id: 'gc_4',
                domain: 'GcQ',
                timeLimitSeconds: 45,
                type: 'number_series',
                questionText: 'Raisonnement quantitatif : Complétez la série : 2 — 6 — 12 — 20 — 30 — ?',
                options: [
                    { id: 0, text: '42', isCorrect: true }, // +4, +6, +8, +10, +12
                    { id: 1, text: '40' },
                    { id: 2, text: '38' },
                    { id: 3, text: '44' }
                ]
            }
        ];
    }
};
