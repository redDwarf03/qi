# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**QI Metrix 2026** — standalone browser IQ-test app (French UI), deployed via GitHub Pages at https://reddwarf03.github.io/qi from the `main` branch root.

### Psychometric framing — do not overclaim

The app's structure is *inspired by* the WAIS-5; its norms are synthetic. Keep the copy honest:

- The test is **WAIS-5** (Arabic numeral). Pearson dropped the Roman numeral; "WAIS-V" does not exist and every occurrence was removed.
- WAIS-5 shipped in the US in late 2024. **In France the standardised battery is still the WAIS-IV**, with WAIS-5 announced for 2026 — so a French-language app must not imply it is running French WAIS-5 norms.
- Classification labels follow WAIS-5's neutral descriptors (Très élevé / Élevé / Moyen supérieur / Moyen / Moyen inférieur / Faible / Très faible). WAIS-IV's evaluative wording was deliberately dropped; **"Borderline" in particular is retired** (stigmatising, and confused with borderline personality disorder). Do not reintroduce it or "Supérieur".
- A score ≥ 130 is **not** an HPI diagnosis. HPI is a clinician's conclusion after a full in-person assessment; the app states this explicitly and must keep doing so.
- Quantitative reasoning belongs to **fluid reasoning** (FRI) and the ancillary Quantitative Reasoning Index in WAIS-5, *not* to Verbal Comprehension. The `GcQ` domain is a deliberate Gc+Gq blend and is labelled `ICV + IRQ`; labelling it plain "ICV" is wrong.
- The Flynn effect has stalled: WAIS-5 norms run **1.9 points below** WAIS-IV (≈1.2 pts/decade vs 3 historically). Newer norms do not make scores more generous, so avoid "Normes 2026" branding that implies inflation.
- `AGE_BANDS` gradients are calibrated on the WAIS-5 cross-sectional aging analysis: PSI declines earliest/steepest, FRI≈VSI next, WMI best preserved of the vulnerable four, VCI peaks 45–54 and only declines after 80. Keep that ordering if you retune them.

100% vanilla: no build step, no package.json, no dependencies, no tests, no linter. The only external network fetch is a Google Fonts `@import` at the top of `style.css`.

## Running

Open `index.html` directly in a browser, or serve the root:

```bash
python -m http.server 8080   # or: npx http-server ./ -p 8080
```

Deploy = push to `main`. There is no CI.

## Architecture

Five globals loaded as classic `<script>` tags in dependency order at the bottom of `index.html` — `psychometrics.js`, `audio.js`, `speech.js`, `questions.js`, then `app.js`. No modules, no imports; each file defines one object literal (`PsychometricsEngine`, `SoundEngine`, `SpeechEngine`, `QuestionBank`, `App`). Order matters: `app.js` calls `App.init()` on `DOMContentLoaded` and reads from the other four.

`questions.js` and `psychometrics.js` are pure — no DOM references — so they can be exercised directly under Node (`eval` the file, then append `globalThis.X = X`; a bare `const` inside `eval` does not escape to module scope). That is the fastest way to check generator invariants or scoring behaviour without a browser.

**Screen model** — all six screens (`welcome`, `calibration`, `quiz`, `computing`, `results`, `references`) exist simultaneously as `<section class="screen">` in `index.html`. `App.showScreen(id)` toggles the `.active` class; nothing is ever created or destroyed. All app state lives in `App.state`.

**The CHC domain key is the contract between all four files.** The five string ids `Gf`, `Gvis`, `Gwm`, `Gs`, `GcQ` appear in `PsychometricsEngine.DOMAINS` (display name, color, icon, plain-language description), as the `domain` field on every generated item, and as the keys of the raw/max score maps in `App.calculateAndShowResults`. Adding or renaming a domain means touching all three places plus `QuestionBank.generateTestBattery`'s hardcoded `domains` array and its `/ 5` division.

**Items are generated procedurally, never stored.** `QuestionBank.generate{Gf,Gvis,Gwm,Gs,GcQ}(difficulty, idIndex, type)` each return an item object; the only static banks are the verbal analogies, odd-one-out sets, and word-problem templates in `questions.js`. Visuals are SVG strings built by closures — an item carries `renderMatrix()` (the stimulus) and each option carries `render(size)` (the choice); `app.js` calls them and injects via `innerHTML`. No image assets exist or should be added.

**`DOMAIN_TYPES` is the variety mechanism.** Each domain lists its task types, and `generateTestBattery` walks a *shuffled cycle* of that list rather than picking at random — that is what bounds how often one task shape can recur. Adding a type means adding the string there and handling it in the domain's generator.

**Every generated item passes `validateItem` before entering the battery**, and its `itemSignature` must be unused. Validation rejects: no options, more or fewer than exactly one `isCorrect`, and any two options whose *rendered* signature collides. `optionSignature` actually invokes `render(90)` and hashes the SVG string, so two different closures that draw the same picture are correctly detected as duplicates. Never bypass this — it is the guard against the whole class of "two identical choices / two correct answers" bugs. Rotation angles must be normalised mod 360 (`utils.normAngle`) or visually identical options will hash differently and slip through.

**Gvis uses exact discrete geometry** (`QuestionBank.polyomino`), not hand-tuned SVG coordinates. Shapes are cell lists on an integer grid; `rotate` is `(x,y) → (-y,x)`, `mirror` is `(x,y) → (-x,y)`, and `key()` gives a canonical signature. `randomAsymmetric` only returns shapes whose 4 rotations and 4 mirrored rotations yield **8 distinct keys**, which is what makes a mirrored distractor provably different from the correct answer. The previous hand-coded U shape was symmetric about its own axis with the marker dot sitting on that axis, so its "mirror" distractor was pixel-identical to the answer.

`generateTestBattery(totalItems)` splits the count evenly across the five domains, ramps difficulty 1→5 within each domain, re-buckets by difficulty and shuffles within each bucket, then does a final pass swapping items to avoid two consecutive items from the same domain.

**Item shape** consumed by `App.renderCurrentQuestion`: `{ id, domain, type, difficulty, inputMode, timeLimitSeconds, questionText, options[]?, acceptedAnswers[]?, renderMatrix?, presentation?, oral?, spokenText?, inputHint? }`.

- `inputMode: 'choice'` → options grid; `'text'` → free-text field, answer checked against `acceptedAnswers` after `QuestionBank.normalizeAnswer` (uppercase, strip non-alphanumerics).
- `presentation: { steps, stepMs, gapMs }` → stimuli shown one at a time (`App.runSequencePresentation`). Cadence lives in `QuestionBank.CONFIG.spanStepMs`.
- `oral: true` → spoken once via `SpeechEngine`, text never rendered.

**Two-phase item lifecycle.** `renderCurrentQuestion` sets `state.phase = 'presenting'` and only calls `beginAnswerPhase` once speech or the sequence finishes; the countdown starts there, so memorisation time is not deducted from thinking time. `state.phase` also guards against double-submission. Anything that leaves the screen must call `App.abortItem()` (clears the interval, the presentation timeouts, and cancels speech).

**Speech can fail and the failure is not cosmetic.** Chrome rejects `speechSynthesis.speak` without user activation (`error: 'not-allowed'`), and an oral item whose audio never played has *no* visible question. `SpeechEngine.speak` therefore reports whether it truly started via `onend(spoken)`, sets `blocked = true` on `not-allowed`, and `App.revealOralFallback` puts the text back on screen. `SpeechEngine.cancel` bumps a generation token so a superseded utterance's late `onend` cannot advance the quiz.

**Scoring pipeline** (`PsychometricsEngine.computeFullReport`), all synthetic norms, not real WAIS-V tables:
1. Per-domain accuracy ratio, with a reaction-time adjustment applied only to `Gs`.
2. `z = (ratio − expectedMean) / sdRatio` from `DOMAIN_CALIBRATION`, where `expectedMean` is shifted by an **age delta** (`AGE_BANDS`). The age correction moves the *threshold*, never multiplies `z` — the old multiplier made a below-average older subject score worse, not better.
3. `z` is shrunk by `reliability(nItems)` (Spearman-Brown over `AVG_INTER_ITEM_R`): regression to the mean, so short batteries cannot yield extreme scores.
4. Index score = `100 + z*15`; percentile from a Gaussian CDF over a hand-rolled `erf()`.
5. **FSIQ is the plain mean of the shrunk domain z-scores**, so it always lies within the index range and the displayed formula is checkable by hand. Do not reintroduce the `√(k/(1+(k−1)r))` composite amplification — it produced an FSIQ above every index (the reported 132-with-max-131 case) and is only defensible with real normative tables.
6. 95% CI from the batterie's actual composite reliability, not a constant SEM.
7. Heterogeneity flagged when max−min index spread ≥ 23.

`AVG_INTER_ITEM_R` is the main tuning knob: it sets both the shrinkage strength and the CI width. At 0.30, a flawless full battery lands near 132 with a CI of roughly ±6.

The report object it returns is the single source for the whole results dashboard. Interpretation text uses `**bold**` markers that `app.js` converts to `<strong>` when rendering `neuroInterpretation`.

**Audio** is fully synthesized via Web Audio oscillators (`SoundEngine.playTone`), no audio files. `init()` is called lazily on every play to resume a suspended context after user gesture.

**Persistence** is `localStorage` under the key `qimetrix_history`, capped at the 5 most recent runs, read/written only by `App.saveToHistory` / `renderHistory`. Both are wrapped in try/catch — never assume it's available.

## Conventions

- All user-facing strings are French. Code comments are mostly French; identifiers are English.
- The report is designed to be printed: `style.css` has two `@media print` blocks driving "Export PDF" (`window.print()`). Any new results markup needs print rules too.
- Domain colors are duplicated — defined in `PsychometricsEngine.DOMAINS` (used for JS-injected inline styles) and separately as CSS variables in `style.css`. Keep them in sync.

## Conventions (continued)

- Battery sizes live in one place, `App.MODES` (express 25 / full 50). The calibration screen copy in `index.html` and the README must be updated with it — these three drifted apart before.
- Question text may contain `**bold**` markers; render it through `App.formatText`, which escapes HTML then converts the markers. Using `innerText` leaks literal asterisks to the user.
- The mute button only gates `SoundEngine` effects. Never route `SpeechEngine` through it: muting the oral problems would make them unanswerable.

## Known inconsistencies (verify before "fixing")

- `SoundEngine.playSuccess()` is still never called (only `playFinish` is). Harmless, but it is dead code.
- The undefined `var(--text)` / `var(--primary)` references are gone (reference links now use `.ref-link`), but a few inline `style=` attributes remain in the results and references screens; the defined names are `--text-primary` and the `--accent-*` family.
- `Gwm` now carries four tasks including `runningDigits` (WAIS-5 promoted Running Digits to a core working-memory subtest and demoted Letter-Number Sequencing to supplemental). Its `presentation.hideLength` flag suppresses the "n / N" counter — showing the total would reveal the series length and defeat the subtest.
- "Top 36.9% (Percentile 63.1e)" in the results hero is confusing phrasing inherited from the original build — it reads as if the user is in the top third when the percentile says otherwise.
