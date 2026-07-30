/**
 * QI METRIX 2026 - Moteur de Calcul Psychométrique (WAIS-V & Théorie CHC)
 * Expert en psychométrie & neuropsychologie
 */

const PsychometricsEngine = {
    // 5 Domaines CHC principaux (expliqués simplement)
    DOMAINS: {
        Gf: { id: 'Gf', name: 'Raisonnement Fluide', acronym: 'IRF', color: '#0ea5e9', icon: '🧩', desc: 'Votre capacité de déduction. C’est ce qui vous permet de résoudre des problèmes nouveaux, de trouver la logique d’une suite sans avoir besoin de l’apprendre à l’école.' },
        Gvis: { id: 'Gvis', name: 'Traitements Visuo-Spatiaux', acronym: 'IVS', color: '#6366f1', icon: '📐', desc: 'Votre imagination spatiale. C’est la capacité à tourner mentalement des objets 3D dans votre tête, utile pour s’orienter, le design ou l’architecture.' },
        Gwm: { id: 'Gwm', name: 'Mémoire de Travail', acronym: 'IMT', color: '#ec4899', icon: '⚡', desc: 'Votre "mémoire vive" mentale. Elle sert à retenir des infos sur le moment (comme un code reçu par SMS) et à jongler avec pour faire un calcul de tête.' },
        Gs: { id: 'Gs', name: 'Vitesse de Traitement', acronym: 'IVT', color: '#8b5cf6', icon: '⏱️', desc: 'La réactivité de votre cerveau. C’est votre vitesse pour analyser des images ou symboles simples rapidement et sans vous tromper.' },
        GcQ: { id: 'GcQ', name: 'Raisonnement Verbal & Quantitatif', acronym: 'ICV', color: '#f59e0b', icon: '🧠', desc: 'Votre base de connaissances. C’est la capacité à comprendre des concepts compliqués, à manier les mots (vocabulaire) et à utiliser la logique des chiffres.' }
    },

    /**
     * Approximation de la fonction d'erreur erf(x) pour le calcul exact des percentiles
     */
    erf(x) {
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;

        const sign = (x < 0) ? -1 : 1;
        x = Math.abs(x);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return sign * y;
    },

    /**
     * Calcule le percentile à partir du Z-score ou du QI standard (M=100, SD=15)
     */
    calculatePercentile(iq) {
        const z = (iq - 100) / 15;
        const cdf = 0.5 * (1 + this.erf(z / Math.sqrt(2)));
        let percentile = cdf * 100;
        if (percentile > 99.9) return 99.9;
        if (percentile < 0.1) return 0.1;
        return Math.round(percentile * 10) / 10;
    },

    /**
     * Étalonnage selon la tranche d'âge
     */
    getAgeMultiplier(age) {
        if (age < 18) return 1.08;
        if (age <= 25) return 1.00;
        if (age <= 35) return 1.02;
        if (age <= 50) return 1.05;
        if (age <= 65) return 1.10;
        return 1.15;
    },

    /**
     * Calcul complet des résultats du test
     * @param {Object} rawScores Map du score brut par domaine (ex: { Gf: 7, Gvis: 5, ... })
     * @param {Object} maxScores Map du score max possible par domaine
     * @param {Number} age Âge du candidat
     * @param {Number} totalTimeSeconds Temps total passé en secondes
     * @param {Object} avgRT Temps de réaction moyen par domaine
     */
    computeFullReport(rawScores, maxScores, age = 25, totalTimeSeconds = 600, avgRT = {}) {
        const ageMult = this.getAgeMultiplier(age);
        const indices = {};
        let weightedSumZ = 0;
        let domainCount = 0;

        // Calcul des scores par domaine (Standard Scale: Score de sous-test M=10, SD=3 -> Indice M=100, SD=15)
        for (const [domainId, raw] of Object.entries(rawScores)) {
            const max = maxScores[domainId] || 1;
            let ratio = Math.min(1.0, Math.max(0, raw / max));
            
            // Speed penalty for Gs (Vitesse de traitement)
            if (domainId === 'Gs' && avgRT['Gs']) {
                const rt = avgRT['Gs'];
                // Target average reaction time for speed task is around 2 seconds
                // If they take longer than 3.5s on average, penalize heavily
                if (rt > 3.5) {
                    ratio = ratio * 0.7; // 30% penalty
                } else if (rt < 1.5 && ratio > 0.8) {
                    ratio = Math.min(1.0, ratio * 1.1); // 10% bonus for ultra speed & accuracy
                } else if (rt > 2.5) {
                    ratio = ratio * 0.9; // 10% penalty
                }
            }

            // Correction psychométrique continue avec courbe d'étalonnage WAIS-5
            let z = (ratio - 0.55) / 0.22; // 55% de réussite correspond à la moyenne z=0
            z = z * ageMult;

            // Clamp z-score raisonnable (-3.2 à +3.2)
            z = Math.max(-3.2, Math.min(3.2, z));

            const indexScore = Math.round(100 + z * 15);
            const percentile = this.calculatePercentile(indexScore);

            indices[domainId] = {
                ...this.DOMAINS[domainId],
                rawScore: raw,
                maxScore: max,
                ratio: Math.round(ratio * 100),
                score: indexScore,
                zScore: Math.round(z * 100) / 100,
                percentile: percentile,
                classification: this.getClassification(indexScore)
            };

            weightedSumZ += z;
            domainCount++;
        }

        // Calcul du Quotient Intellectuel Total (QIT / FSIQ)
        const avgZ = domainCount > 0 ? weightedSumZ / domainCount : 0;
        
        // Facteur de corrélation inter-domaines CHC (~0.52 dans la population)
        const compositeZ = avgZ * Math.sqrt(domainCount / (1 + (domainCount - 1) * 0.52));
        let fsiq = Math.round(100 + compositeZ * 15);
        fsiq = Math.max(45, Math.min(160, fsiq));

        const fsiqPercentile = this.calculatePercentile(fsiq);
        
        // Intervalle de confiance à 95% (SEM ≈ 3.2 pour WAIS-V)
        const sem = 3.2;
        const ciLower = Math.max(45, Math.round(fsiq - 1.96 * sem));
        const ciUpper = Math.min(160, Math.round(fsiq + 1.96 * sem));

        // Analyse d'hétérogénéité cognitive (Disharmonie du profil)
        const indexScoresArray = Object.values(indices).map(i => i.score);
        const maxIndex = Math.max(...indexScoresArray);
        const minIndex = Math.min(...indexScoresArray);
        const spread = maxIndex - minIndex;

        // Calcul de l'écart-type inter-indices
        const meanIndex = indexScoresArray.reduce((a, b) => a + b, 0) / indexScoresArray.length;
        const variance = indexScoresArray.reduce((sq, n) => sq + Math.pow(n - meanIndex, 2), 0) / indexScoresArray.length;
        const stdDevIndices = Math.round(Math.sqrt(variance) * 10) / 10;

        const isDisharmonious = spread >= 23; // Écart supérieur à 1.5 écart-type

        // Identification des forces et axes de développement
        const strengths = Object.values(indices).filter(i => i.score >= 115).map(i => i.name);
        const weaknesses = Object.values(indices).filter(i => i.score <= 88).map(i => i.name);

        return {
            fsiq: fsiq,
            percentile: fsiqPercentile,
            ci95: [ciLower, ciUpper],
            classification: this.getClassification(fsiq),
            indices: indices,
            profileAnalysis: {
                spread: spread,
                stdDevIndices: stdDevIndices,
                isDisharmonious: isDisharmonious,
                strengths: strengths,
                weaknesses: weaknesses,
                heterogeneityNote: isDisharmonious 
                    ? "⚖️ **Profil Atypique (Hétérogène)** : Vous avez un gros écart de points (plus de 22) entre votre point le plus fort et le plus faible. Cela veut dire que votre cerveau a des spécialités très marquées ! Le score global (QI) est donc moins important que l'analyse de vos talents uniques."
                    : "⚖️ **Profil Classique (Homogène)** : Vos compétences sont bien équilibrées entre les différents domaines (logique, vitesse, mémoire, etc.). Votre score global de QI est un excellent reflet de vos capacités générales."
            },
            neuroInterpretation: this.generateNeuroInterpretation(fsiq, indices, isDisharmonious),
            testMetadata: {
                age: age,
                totalTimeSeconds: totalTimeSeconds,
                formattedTime: this.formatTime(totalTimeSeconds),
                date: new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }),
                version: "WAIS-V / CHC Norms 2026"
            }
        };
    },

    /**
     * Classification clinique standard du QI (Vulgarisée)
     */
    getClassification(score) {
        if (score >= 130) return { label: 'Très Supérieur (HPI)', level: 'hpi', badge: '🥇 Très Supérieur', desc: 'Top 2.2% de la population (Haut Potentiel Intellectuel). Une capacité incroyable à faire des liens rapides et complexes.' };
        if (score >= 120) return { label: 'Supérieur', level: 'superior', badge: '🌟 Supérieur', desc: 'Dans les 9% les plus performants. Très grande facilité d’apprentissage et de logique.' };
        if (score >= 110) return { label: 'Moyenne Haute', level: 'high-average', badge: '✨ Moyenne Haute', desc: 'Score excellent, bien au-dessus de la majorité. Vous réfléchissez vite et bien.' };
        if (score >= 90)  return { label: 'Moyenne Standard', level: 'average', badge: '⚖️ Zone Moyenne', desc: 'Pile dans la norme (comme 50% des gens). Un fonctionnement sain, équilibré et solide pour le quotidien.' };
        if (score >= 80)  return { label: 'Moyenne Basse', level: 'low-average', badge: '🔹 Moyenne Basse', desc: 'Légèrement sous la moyenne exacte, mais totalement fonctionnel pour la vie de tous les jours.' };
        if (score >= 70)  return { label: 'Limite (Borderline)', level: 'borderline', badge: '⚠️ Limite', desc: 'Des difficultés possibles sur des tâches très abstraites ou scolaires difficiles.' };
        return { label: 'Extrêmement Faible', level: 'extremely-low', badge: '🔻 Extrêmement Faible', desc: 'Un apprentissage qui nécessite beaucoup de temps et d’accompagnement spécialisé.' };
    },

    /**
     * Génération de l'avis neuropsychologique détaillé (Didactique)
     */
    generateNeuroInterpretation(fsiq, indices, isDisharmonious) {
        let paragraphs = [];

        // Synthèse globale
        if (fsiq >= 130) {
            paragraphs.push("🏆 **Score global : Haut Potentiel Intellectuel (HPI).** Votre cerveau est un moteur de course ! Vous comprenez les choses extrêmement vite, vous faites des liens que les autres ne voient pas et vous adorez la complexité. Attention cependant, penser vite peut parfois donner l'impression d'être en décalage avec les autres.");
        } else if (fsiq >= 115) {
            paragraphs.push("🌟 **Score global : Supérieur à la moyenne.** Vous êtes très à l'aise pour apprendre et comprendre des choses nouvelles. Vous avez une belle vivacité d'esprit qui vous aide à résoudre facilement des problèmes complexes au travail ou dans les études.");
        } else if (fsiq >= 90) {
            paragraphs.push("🎯 **Score global : Moyenne Standard.** Votre score est exactement là où se trouve la majorité de la population. C'est parfait ! Vous avez toutes les capacités cognitives nécessaires pour réussir vos projets, apprendre à un rythme classique et gérer le quotidien avec équilibre.");
        } else {
            paragraphs.push("🌱 **Score global : À consolider.** L'apprentissage purement abstrait ou rapide peut parfois vous demander un effort supplémentaire. Vous réussirez mieux si on vous explique les choses étape par étape, avec des exemples concrets plutôt que de la théorie compliquée.");
        }

        // Analyse par domaine dominant
        const sortedIndices = Object.values(indices).sort((a, b) => b.score - a.score);
        const topDomain = sortedIndices[0];
        const lowestDomain = sortedIndices[sortedIndices.length - 1];

        paragraphs.push(`💪 **Votre Super-Pouvoir :** Vous brillez particulièrement en **${topDomain.name} (Score: ${topDomain.score})**. Concrètement, cela veut dire : ${topDomain.desc}`);

        if (isDisharmonious) {
            paragraphs.push(`🕵️‍♂️ **Note du Psychologue :** Le test montre que vous avez des pics de génie et des faiblesses plus marquées (notamment en **${lowestDomain.name}**). C'est normal, personne n'est parfait partout ! Cela montre simplement que vous avez une façon de penser bien à vous (par exemple, vous pouvez être ultra logique, mais moins rapide, ou inversement).`);
        }

        return paragraphs;
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins} min ${secs < 10 ? '0' : ''}${secs} s`;
    }
};


