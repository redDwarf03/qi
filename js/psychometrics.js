/**
 * QI METRIX 2026 - Moteur de Calcul Psychométrique (structure inspirée WAIS-5 & théorie CHC)
 *
 * Trois principes tenus par ce fichier :
 *  1. Le QIT est la MOYENNE des cinq indices, donc toujours compris entre le
 *     plus faible et le plus fort d'entre eux. L'ancienne version amplifiait le
 *     z moyen par sqrt(k / (1 + (k-1)r)) = 1,274, ce qui produisait un QIT
 *     supérieur à tous les indices (un 132 pour des indices plafonnant à 131).
 *     Cette amplification est légitime sur une vraie WAIS étalonnée, pas sur des
 *     normes synthétiques calculées à partir de quelques items.
 *  2. Les scores sont RÉGRESSÉS VERS LA MOYENNE en fonction du nombre d'items :
 *     une batterie courte ne peut pas produire un score extrême crédible.
 *  3. L'intervalle de confiance est dérivé de la fidélité réelle de la batterie,
 *     pas d'un SEM constant de 3,2 emprunté à la WAIS.
 */

const PsychometricsEngine = {
    // 5 domaines CHC principaux (expliqués simplement)
    DOMAINS: {
        Gf: { id: 'Gf', name: 'Raisonnement Fluide', acronym: 'IRF', color: '#0ea5e9', icon: '🧩', desc: 'Votre capacité de déduction. C’est ce qui vous permet de résoudre des problèmes nouveaux, de trouver la logique d’une suite sans avoir besoin de l’apprendre à l’école.' },
        Gvis: { id: 'Gvis', name: 'Traitements Visuo-Spatiaux', acronym: 'IVS', color: '#6366f1', icon: '📐', desc: 'Votre imagination spatiale. C’est la capacité à tourner mentalement des objets dans votre tête, utile pour s’orienter, le design ou l’architecture.' },
        Gwm: { id: 'Gwm', name: 'Mémoire de Travail', acronym: 'IMT', color: '#ec4899', icon: '⚡', desc: 'Votre "mémoire vive" mentale. Elle sert à retenir des infos sur le moment (comme un code reçu par SMS) et à jongler avec pour faire un calcul de tête.' },
        Gs: { id: 'Gs', name: 'Vitesse de Traitement', acronym: 'IVT', color: '#8b5cf6', icon: '⏱️', desc: 'La réactivité de votre cerveau. C’est votre vitesse pour analyser des images ou symboles simples rapidement et sans vous tromper.' },
        // Attention : ce domaine n'est PAS l'ICV. Dans la WAIS-5, le raisonnement
        // quantitatif (Arithmétique, Balances, Relations) alimente l'indice de
        // raisonnement fluide et l'indice auxiliaire IRQ, pas la compréhension
        // verbale. Le libeller « ICV » revenait à ranger les suites numériques
        // et les problèmes arithmétiques dans le verbal, ce qui est faux.
        GcQ: { id: 'GcQ', name: 'Raisonnement Verbal & Quantitatif', acronym: 'ICV + IRQ', color: '#f59e0b', icon: '🧠', desc: 'Deux choses à la fois : votre stock de connaissances et de vocabulaire (le versant verbal), et votre logique des nombres (le versant quantitatif). Dans la WAIS-5 ce sont deux indices séparés ; ils sont regroupés ici faute d’assez d’items pour les distinguer.' }
    },

    /**
     * Taux de réussite attendu d'un sujet moyen, par domaine.
     * Ces valeurs diffèrent car les tâches n'ont pas la même difficulté
     * intrinsèque : un empan de chiffres en saisie libre est bien plus sévère
     * qu'un QCM à 4 choix où le hasard rapporte déjà 25 %.
     */
    DOMAIN_CALIBRATION: {
        Gf:   { meanRatio: 0.55, sdRatio: 0.18 },
        Gvis: { meanRatio: 0.55, sdRatio: 0.18 },
        Gwm:  { meanRatio: 0.45, sdRatio: 0.18 },
        Gs:   { meanRatio: 0.62, sdRatio: 0.17 },
        GcQ:  { meanRatio: 0.52, sdRatio: 0.18 }
    },

    /**
     * Corrélation inter-items moyenne supposée, base du calcul de fidélité
     * (Spearman-Brown). Elle règle simultanément la force de la régression vers
     * la moyenne et la largeur de l'intervalle de confiance : 0,30 place le
     * sans-faute de la batterie complète autour de 132 tout en gardant un IC
     * d'environ ±6 points, ce qui reste honnête pour un test en ligne.
     */
    AVG_INTER_ITEM_R: 0.30,

    /**
     * Correction d'âge appliquée au SEUIL attendu, et non au z-score.
     * L'ancienne version multipliait z par un facteur > 1, ce qui aggravait
     * mécaniquement les scores faibles des sujets âgés (z = -1 devenait -1,15) :
     * l'étalonnage par âge doit décaler l'attente, pas étirer l'échelle.
     * Un delta négatif abaisse l'attente, donc rend le score plus favorable.
     *
     * Gradients calés sur l'analyse transversale de l'échantillon WAIS-5
     * (Intelligence, 2025), qui établit quatre trajectoires distinctes :
     *  - IVT (Gs) : décline le plus tôt (dès 20-24 ans) et le plus fort
     *    (≈2,0 écarts-types à 85-90 ans) ;
     *  - IRF (Gf) et IVS (Gvis) : déclin dès avant 45 ans, marqué ensuite
     *    (≈1,6 et 1,4 ET) ;
     *  - IMT (Gwm) : vulnérable mais le mieux préservé des quatre (≈1,1 ET),
     *    d'où un gradient volontairement plus doux que Gf/Gvis ;
     *  - ICV (Gc) : culmine entre 45 et 54 ans, stable jusqu'à 74 ans, ne
     *    décline qu'à partir de 80 ans — d'où des deltas POSITIFS en milieu
     *    de vie (on attend davantage) puis négatifs au grand âge.
     */
    AGE_BANDS: [
        { maxAge: 17,  deltas: { Gf: 0.00, Gvis: 0.00, Gwm: -0.02, Gs: 0.01, GcQ: -0.06 } },
        { maxAge: 24,  deltas: { Gf: 0.00, Gvis: 0.00, Gwm: 0.00, Gs: 0.00, GcQ: 0.00 } },
        { maxAge: 34,  deltas: { Gf: -0.01, Gvis: -0.01, Gwm: -0.01, Gs: -0.03, GcQ: 0.02 } },
        { maxAge: 44,  deltas: { Gf: -0.02, Gvis: -0.02, Gwm: -0.02, Gs: -0.05, GcQ: 0.03 } },
        { maxAge: 54,  deltas: { Gf: -0.04, Gvis: -0.04, Gwm: -0.03, Gs: -0.07, GcQ: 0.04 } },
        { maxAge: 64,  deltas: { Gf: -0.06, Gvis: -0.06, Gwm: -0.04, Gs: -0.10, GcQ: 0.03 } },
        { maxAge: 74,  deltas: { Gf: -0.09, Gvis: -0.08, Gwm: -0.06, Gs: -0.13, GcQ: 0.02 } },
        { maxAge: 200, deltas: { Gf: -0.12, Gvis: -0.11, Gwm: -0.09, Gs: -0.17, GcQ: -0.02 } }
    ],

    getAgeDeltas(age) {
        const band = this.AGE_BANDS.find(b => age <= b.maxAge);
        return band ? band.deltas : this.AGE_BANDS[this.AGE_BANDS.length - 1].deltas;
    },

    /**
     * Fidélité d'un score composé de n items (formule de Spearman-Brown).
     * 6 items -> 0,67 ; 10 items -> 0,77 ; 50 items -> 0,94.
     */
    reliability(nItems) {
        const r = this.AVG_INTER_ITEM_R;
        if (!nItems || nItems < 1) return 0;
        return (nItems * r) / (1 + (nItems - 1) * r);
    },

    /** Approximation de la fonction d'erreur erf(x) (Abramowitz & Stegun 7.1.26). */
    erf(x) {
        const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
        const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;

        const sign = (x < 0) ? -1 : 1;
        x = Math.abs(x);
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
    },

    /** Percentile associé à un score standard (M=100, SD=15). */
    calculatePercentile(iq) {
        const z = (iq - 100) / 15;
        const cdf = 0.5 * (1 + this.erf(z / Math.sqrt(2)));
        const percentile = cdf * 100;
        if (percentile > 99.9) return 99.9;
        if (percentile < 0.1) return 0.1;
        return Math.round(percentile * 10) / 10;
    },

    /**
     * Ajustement de la vitesse de traitement selon le temps de réaction moyen.
     * Les tâches Gs sont désormais limitées à 7-16 s ; les seuils sont calés
     * là-dessus. L'effet est volontairement modéré (±15 %) car le temps de
     * réaction mesuré inclut le temps de rendu et de lecture de la consigne.
     */
    speedAdjustment(avgReactionTime) {
        if (!avgReactionTime || avgReactionTime >= 900) return 1.0;
        if (avgReactionTime > 9) return 0.85;
        if (avgReactionTime > 6.5) return 0.93;
        if (avgReactionTime < 3.5) return 1.10;
        return 1.0;
    },

    /**
     * Calcul complet des résultats.
     * @param {Object} rawScores Score brut par domaine (ex: { Gf: 7, ... })
     * @param {Object} maxScores Nombre d'items présentés par domaine
     * @param {Number} age
     * @param {Number} totalTimeSeconds
     * @param {Object} avgRT Temps de réaction moyen par domaine (secondes)
     */
    computeFullReport(rawScores, maxScores, age = 25, totalTimeSeconds = 600, avgRT = {}) {
        const ageDeltas = this.getAgeDeltas(age);
        const indices = {};
        const estimatedZ = [];
        let totalItems = 0;

        for (const [domainId, raw] of Object.entries(rawScores)) {
            const max = maxScores[domainId] || 0;
            if (max <= 0) continue;
            totalItems += max;

            const calib = this.DOMAIN_CALIBRATION[domainId] || { meanRatio: 0.55, sdRatio: 0.22 };
            let ratio = Math.min(1.0, Math.max(0, raw / max));

            if (domainId === 'Gs') {
                ratio = Math.min(1.0, ratio * this.speedAdjustment(avgRT[domainId]));
            }

            const expected = calib.meanRatio + (ageDeltas[domainId] || 0);
            let zObserved = (ratio - expected) / calib.sdRatio;
            zObserved = Math.max(-3.2, Math.min(3.2, zObserved));

            // Régression vers la moyenne : avec peu d'items, une performance
            // extrême est plus probablement du bruit qu'un vrai niveau extrême.
            const rel = this.reliability(max);
            const zEstimated = zObserved * rel;

            const indexScore = Math.round(100 + zEstimated * 15);
            indices[domainId] = {
                ...this.DOMAINS[domainId],
                rawScore: raw,
                maxScore: max,
                ratio: Math.round(ratio * 100),
                score: indexScore,
                zScore: Math.round(zEstimated * 100) / 100,
                zObserved: Math.round(zObserved * 100) / 100,
                reliability: Math.round(rel * 1000) / 1000,
                percentile: this.calculatePercentile(indexScore),
                classification: this.getClassification(indexScore)
            };

            estimatedZ.push(zEstimated);
        }

        // QIT = moyenne arithmétique des z estimés -> reste toujours dans
        // l'intervalle [indice min, indice max]. Le nombre affiché est donc
        // vérifiable à la main par l'utilisateur à partir des cinq indices.
        const domainCount = estimatedZ.length;
        const avgZ = domainCount > 0 ? estimatedZ.reduce((a, b) => a + b, 0) / domainCount : 0;
        let fsiq = Math.round(100 + avgZ * 15);
        fsiq = Math.max(45, Math.min(160, fsiq));

        const fsiqPercentile = this.calculatePercentile(fsiq);

        // Intervalle de confiance dérivé de la fidélité effective de la batterie.
        const compositeReliability = this.reliability(totalItems);
        const sem = Math.max(2.5, 15 * Math.sqrt(Math.max(0, 1 - compositeReliability)));
        const ciLower = Math.max(45, Math.round(fsiq - 1.96 * sem));
        const ciUpper = Math.min(160, Math.round(fsiq + 1.96 * sem));

        // Analyse d'hétérogénéité cognitive
        const indexScoresArray = Object.values(indices).map(i => i.score);
        const maxIndex = indexScoresArray.length ? Math.max(...indexScoresArray) : 100;
        const minIndex = indexScoresArray.length ? Math.min(...indexScoresArray) : 100;
        const spread = maxIndex - minIndex;

        const meanIndex = indexScoresArray.reduce((a, b) => a + b, 0) / (indexScoresArray.length || 1);
        const variance = indexScoresArray.reduce((sq, n) => sq + Math.pow(n - meanIndex, 2), 0) / (indexScoresArray.length || 1);
        const stdDevIndices = Math.round(Math.sqrt(variance) * 10) / 10;

        const isDisharmonious = spread >= 23;
        const strengths = Object.values(indices).filter(i => i.score >= 115).map(i => i.name);
        const weaknesses = Object.values(indices).filter(i => i.score <= 88).map(i => i.name);

        return {
            fsiq,
            percentile: fsiqPercentile,
            ci95: [ciLower, ciUpper],
            classification: this.getClassification(fsiq),
            indices,
            reliabilityReport: {
                totalItems,
                compositeReliability: Math.round(compositeReliability * 1000) / 1000,
                sem: Math.round(sem * 10) / 10,
                fsiqFormula: `QIT = moyenne des ${domainCount} indices (${indexScoresArray.join(' + ')}) ÷ ${domainCount} ≈ ${Math.round(meanIndex)}`,
                shortBatteryWarning: totalItems < 40
                    ? "Batterie courte : les scores sont volontairement resserrés autour de 100. La batterie complète produit un profil plus contrasté et plus fiable."
                    : null
            },
            profileAnalysis: {
                spread,
                stdDevIndices,
                isDisharmonious,
                strengths,
                weaknesses,
                heterogeneityNote: isDisharmonious
                    ? "⚖️ **Profil Atypique (Hétérogène)** : Vous avez un gros écart de points (plus de 22) entre votre point le plus fort et le plus faible. Cela veut dire que votre cerveau a des spécialités très marquées ! Le score global (QI) est donc moins important que l'analyse de vos talents uniques."
                    : "⚖️ **Profil Classique (Homogène)** : Vos compétences sont bien équilibrées entre les différents domaines (logique, vitesse, mémoire, etc.). Votre score global de QI est un excellent reflet de vos capacités générales."
            },
            neuroInterpretation: this.generateNeuroInterpretation(fsiq, indices, isDisharmonious),
            testMetadata: {
                age,
                totalTimeSeconds,
                formattedTime: this.formatTime(totalTimeSeconds),
                date: new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }),
                version: 'Normes synthétiques — structure inspirée WAIS-5 / CHC'
            }
        };
    },

    /**
     * Classifications descriptives alignées sur la WAIS-5 (Pearson, 2024).
     *
     * La WAIS-5 a abandonné les libellés évaluatifs de la WAIS-IV au profit de
     * descripteurs neutres : « Supérieur » devient « Élevé », et surtout
     * « Limite / Borderline » (70-79) devient « Faible ». Le terme borderline
     * était jugé stigmatisant et confondu avec le trouble de personnalité
     * borderline, qui n'a aucun rapport.
     *
     * Le HPI a également été retiré : en France, le haut potentiel intellectuel
     * est une conclusion clinique posée par un psychologue au terme d'un bilan
     * complet, jamais la sortie automatique d'un score ≥ 130 — a fortiori d'un
     * questionnaire en ligne.
     */
    getClassification(score) {
        if (score >= 130) return { label: 'Très élevé', level: 'extremely-high', badge: '🥇 Très élevé', desc: 'Environ 2 % de la population se situe à ce niveau. Une grande aisance à saisir des liens complexes rapidement.' };
        if (score >= 120) return { label: 'Élevé', level: 'very-high', badge: '🌟 Élevé', desc: 'Environ 7 % de la population. Très grande facilité d’apprentissage et de logique.' };
        if (score >= 110) return { label: 'Moyen supérieur', level: 'high-average', badge: '✨ Moyen supérieur', desc: 'Au-dessus de la majorité. Vous réfléchissez vite et bien.' };
        if (score >= 90) return { label: 'Moyen', level: 'average', badge: '⚖️ Moyen', desc: 'Pile dans la norme (environ 50 % des gens). Un fonctionnement sain, équilibré et solide pour le quotidien.' };
        if (score >= 80) return { label: 'Moyen inférieur', level: 'low-average', badge: '🔹 Moyen inférieur', desc: 'Légèrement sous la moyenne exacte, mais totalement fonctionnel pour la vie de tous les jours.' };
        if (score >= 70) return { label: 'Faible', level: 'very-low', badge: '🔸 Faible', desc: 'Des difficultés possibles sur des tâches très abstraites ou scolaires difficiles.' };
        return { label: 'Très faible', level: 'extremely-low', badge: '🔻 Très faible', desc: 'Un apprentissage qui demande davantage de temps et, le cas échéant, un accompagnement adapté.' };
    },

    /** Génération de l'avis neuropsychologique détaillé (didactique) */
    generateNeuroInterpretation(fsiq, indices, isDisharmonious) {
        const paragraphs = [];

        if (fsiq >= 130) {
            paragraphs.push("🏆 **Score global : très élevé.** Vous comprenez les choses très vite et vous faites des liens que beaucoup ne voient pas. Un mot important : ce résultat **ne constitue pas un diagnostic de haut potentiel intellectuel**. Le HPI se pose au terme d'un bilan complet passé en face à face avec un psychologue, jamais à partir d'un questionnaire en ligne.");
        } else if (fsiq >= 115) {
            paragraphs.push("🌟 **Score global : Supérieur à la moyenne.** Vous êtes très à l'aise pour apprendre et comprendre des choses nouvelles. Vous avez une belle vivacité d'esprit qui vous aide à résoudre facilement des problèmes complexes au travail ou dans les études.");
        } else if (fsiq >= 90) {
            paragraphs.push("🎯 **Score global : Moyenne Standard.** Votre score est exactement là où se trouve la majorité de la population. C'est parfait ! Vous avez toutes les capacités cognitives nécessaires pour réussir vos projets, apprendre à un rythme classique et gérer le quotidien avec équilibre.");
        } else {
            paragraphs.push("🌱 **Score global : À consolider.** L'apprentissage purement abstrait ou rapide peut parfois vous demander un effort supplémentaire. Vous réussirez mieux si on vous explique les choses étape par étape, avec des exemples concrets plutôt que de la théorie compliquée.");
        }

        const sortedIndices = Object.values(indices).sort((a, b) => b.score - a.score);
        if (sortedIndices.length) {
            const topDomain = sortedIndices[0];
            const lowestDomain = sortedIndices[sortedIndices.length - 1];

            paragraphs.push(`💪 **Votre Super-Pouvoir :** Vous brillez particulièrement en **${topDomain.name} (Score: ${topDomain.score})**. Concrètement, cela veut dire : ${topDomain.desc}`);

            if (isDisharmonious) {
                paragraphs.push(`🕵️‍♂️ **Note du Psychologue :** Le test montre que vous avez des pics de génie et des faiblesses plus marquées (notamment en **${lowestDomain.name}**). C'est normal, personne n'est parfait partout ! Cela montre simplement que vous avez une façon de penser bien à vous (par exemple, vous pouvez être ultra logique, mais moins rapide, ou inversement).`);
            }
        }

        paragraphs.push("📐 **Comment lire votre QIT :** il s'agit de la **moyenne de vos cinq indices**, il ne peut donc jamais dépasser votre meilleur domaine ni descendre sous votre plus faible. Les scores sont aussi resserrés vers 100 en fonction du nombre d'items passés : c'est volontaire, une batterie courte ne peut pas prouver un score extrême.");

        return paragraphs;
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins} min ${secs < 10 ? '0' : ''}${secs} s`;
    }
};
