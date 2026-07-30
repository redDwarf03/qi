/**
 * QI METRIX 2026 - Moteur de Synthèse Vocale (Web Speech API)
 *
 * Utilisé pour les problèmes de raisonnement énoncés à l'oral : l'énoncé n'est
 * dit qu'UNE SEULE FOIS et n'est jamais affiché, ce qui empêche les relectures
 * successives et charge réellement la mémoire de travail (comme en passation
 * clinique). Si aucune voix française n'est disponible, on retombe sur un
 * affichage écrit plutôt que de perdre la question.
 */

const SpeechEngine = {
    available: false,
    /**
     * Passe à true dès qu'une énonciation est refusée par la politique
     * d'autoplay du navigateur (erreur 'not-allowed'). On cesse alors d'essayer
     * et l'appelant bascule définitivement sur l'affichage écrit.
     */
    blocked: false,
    lastError: null,
    voice: null,
    _readyPromise: null,
    _token: 0,
    _keepAlive: null,
    _safety: null,

    /**
     * Charge la liste des voix (asynchrone sur Chrome) et sélectionne une voix FR.
     * @returns {Promise<boolean>} true si une voix française est utilisable
     */
    init() {
        if (this._readyPromise) return this._readyPromise;

        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            this._readyPromise = Promise.resolve(false);
            return this._readyPromise;
        }

        /**
         * Renvoie true uniquement si une voix FRANÇAISE a été retenue.
         * Chrome peuple la liste par vagues (voix locales d'abord, voix réseau
         * ensuite) : se contenter d'une liste non vide ferait abandonner à la
         * première vague et manquerait une voix française arrivant après.
         */
        const pickVoice = () => {
            const voices = window.speechSynthesis.getVoices() || [];
            if (!voices.length) return false;
            this.voice =
                voices.find(v => v.lang === 'fr-FR' && v.localService) ||
                voices.find(v => v.lang === 'fr-FR') ||
                voices.find(v => v.lang && v.lang.toLowerCase().startsWith('fr')) ||
                null;
            this.available = !!this.voice;
            return this.available;
        };

        this._readyPromise = new Promise(resolve => {
            if (pickVoice()) return resolve(this.available);

            let settled = false;
            const onVoicesChanged = () => {
                if (settled) return;
                if (pickVoice()) {
                    settled = true;
                    window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                    resolve(this.available);
                }
            };
            window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

            // Garde-fou, et seule sortie possible lorsque l'appareil n'a
            // aucune voix française : certains navigateurs n'émettent jamais
            // 'voiceschanged'. Coût assumé de 1,5 s sur ces appareils, contre
            // le risque de conclure « pas de voix FR » avant qu'elle arrive.
            setTimeout(() => {
                if (settled) return;
                settled = true;
                window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
                pickVoice();
                resolve(this.available);
            }, 1500);
        });

        return this._readyPromise;
    },

    /**
     * Estimation de la durée de lecture, utilisée comme filet de sécurité si
     * l'évènement 'end' n'est jamais émis (bug connu de Chrome sur les énoncés longs).
     */
    estimateDurationMs(text, rate = 0.95) {
        const words = String(text).trim().split(/\s+/).length;
        return Math.round((words / (2.6 * rate)) * 1000) + 1200;
    },

    /**
     * Énonce un texte une seule fois.
     * @param {String} text
     * @param {Object} handlers { onstart, onend } - onend(spoken) est appelé au plus
     *                 une fois, et jamais si un cancel() est survenu entre-temps.
     *                 `spoken` vaut false si le navigateur a refusé de lire :
     *                 l'appelant DOIT alors afficher l'énoncé, sinon la question
     *                 devient impossible à traiter.
     * @returns {Boolean} false si la synthèse est indisponible (l'appelant doit alors afficher le texte)
     */
    speak(text, handlers = {}) {
        if (!this.available || this.blocked || !window.speechSynthesis) return false;

        this.cancel();
        const token = ++this._token;
        let finished = false;
        let started = false;

        const finish = () => {
            if (finished) return;
            finished = true;
            // Une énonciation périmée (annulée, ou remplacée par la suivante) ne
            // doit ni couper les minuteurs courants ni faire avancer le quiz.
            if (token !== this._token) return;
            this._stopKeepAlive();
            if (handlers.onend) handlers.onend(started);
        };

        try {
            const utterance = new SpeechSynthesisUtterance(String(text));
            utterance.voice = this.voice;
            utterance.lang = this.voice ? this.voice.lang : 'fr-FR';
            utterance.rate = 0.95;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            utterance.onstart = () => {
                started = true;
                if (token === this._token && handlers.onstart) handlers.onstart();
            };
            utterance.onend = finish;
            utterance.onerror = (e) => {
                this.lastError = (e && e.error) || 'unknown';
                // 'not-allowed' = politique d'autoplay : inutile de réessayer ensuite.
                if (this.lastError === 'not-allowed') this.blocked = true;
                finish();
            };

            // Chrome interrompt la synthèse au bout de ~15 s sans ce ping.
            this._keepAlive = setInterval(() => {
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.pause();
                    window.speechSynthesis.resume();
                } else {
                    this._stopKeepAlive();
                }
            }, 9000);

            // Filet de sécurité si 'end' n'arrive jamais
            this._safety = setTimeout(finish, this.estimateDurationMs(text) + 4000);

            window.speechSynthesis.speak(utterance);
            return true;
        } catch (e) {
            console.warn('Speech synthesis error:', e);
            this.blocked = true;
            this._stopKeepAlive();
            if (handlers.onend) handlers.onend(false);
            return true;
        }
    },

    _stopKeepAlive() {
        if (this._keepAlive) { clearInterval(this._keepAlive); this._keepAlive = null; }
        if (this._safety) { clearTimeout(this._safety); this._safety = null; }
    },

    /** Coupe toute énonciation en cours sans déclencher le onend de l'appelant. */
    cancel() {
        this._token++;
        this._stopKeepAlive();
        try {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        } catch (e) { /* noop */ }
    }
};
