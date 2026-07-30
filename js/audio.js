/**
 * QI METRIX 2026 - Moteur Audio Synthétique (Web Audio API)
 * Aucun fichier audio externe requis
 */

const SoundEngine = {
    audioCtx: null,
    muted: false,

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    },

    playTone(freq, type, duration, gainVal = 0.1) {
        if (this.muted) return;
        this.init();
        if (!this.audioCtx) return;

        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = type; // 'sine', 'square', 'triangle', 'sawtooth'
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

            gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) {
            console.warn('Audio play error:', e);
        }
    },

    playClick() {
        this.playTone(600, 'sine', 0.05, 0.08);
    },

    playSelect() {
        this.playTone(880, 'sine', 0.08, 0.12);
    },

    playTimerBeep() {
        this.playTone(1050, 'triangle', 0.1, 0.15);
    },

    playSuccess() {
        if (this.muted) return;
        this.init();
        if (!this.audioCtx) return;

        const now = this.audioCtx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, index) => {
            setTimeout(() => {
                this.playTone(freq, 'sine', 0.25, 0.12);
            }, index * 80);
        });
    },

    playFinish() {
        if (this.muted) return;
        this.init();
        if (!this.audioCtx) return;

        [440, 554.37, 659.25, 880].forEach((freq, index) => {
            setTimeout(() => {
                this.playTone(freq, 'triangle', 0.35, 0.15);
            }, index * 120);
        });
    }
};
