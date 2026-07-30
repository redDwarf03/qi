# 🧠 QI Metrix 2026

**QI Metrix 2026** est une application web standalone interactive, conçue pour évaluer le Quotient Intellectuel (QI) selon le référentiel psychométrique actualisé de 2026 (basé sur la structure de la **WAIS-V** et le modèle **CHC de Cattell-Horn-Carroll**).

L'application est entièrement jouable dans le navigateur, sans nécessiter de serveur backend ni base de données. Elle propose un rendu visuel premium, des tests dynamiques et un rapport neuro-psychologique détaillé vulgarisé et accessible à tous (dès 16 ans).

🌐 **[Accéder à l'application web](https://reddwarf03.github.io/qi)**

## 🚀 Fonctionnalités Clés

- **5 Domaines Cognitifs Évalués (Théorie CHC)** :
  - 🧩 **Raisonnement Fluide ($Gf$)** : Résolution de problèmes nouveaux et abstraits (Matrices).
  - 📐 **Traitements Visuo-Spatiaux ($Gvis$)** : Manipulation mentale de formes 2D/3D.
  - ⚡ **Mémoire de Travail ($Gwm$)** : Maintien et traitement d'informations à court terme.
  - ⏱️ **Vitesse de Traitement ($Gs$)** : Rapidité et précision de l'attention visuelle.
  - 🧠 **Raisonnement Verbal & Quantitatif ($Gc/Gq$)** : Compréhension conceptuelle et logique mathématique.
- **Courbe de Gauss Interactive** : Calcule le Rang Percentile exact et affiche la distribution normale ($\mu = 100, \sigma = 15$).
- **Générateurs Vectoriels (SVG)** : Aucun asset image externe n'est requis. Les matrices de Raven, cibles de vitesse et rotations 3D sont générées mathématiquement en SVG.
- **Audio-Haptique (Web Audio API)** : Effets sonores de sélection et minuteurs générés par synthétiseur direct (désactivables via le bouton muet).
- **Rapport Clinique Didactique** : Explications neuro-psychologiques claires, adaptées à un jeune public, avec détection de l'hétérogénéité cognitive (profil dysharmonique).
- **Export PDF** : Styles CSS `@media print` intégrés pour imprimer ou enregistrer le rapport final de façon propre et professionnelle.

## 🛠️ Architecture Technique

Projet **100% Vanilla** (Aucun framework, aucune dépendance externe lourde) :
- `index.html` : Structure sémantique de l'interface et des écrans.
- `style.css` : Design System "Dark Cyber-Psychometrics" (Glassmorphism, gradients HSL, CSS Variables).
- `js/app.js` : Contrôleur principal (Navigation, minuteurs, UI dynamique).
- `js/psychometrics.js` : Moteur de calcul psychométrique (Conversions Z-Scores, intégration des fonctions d'erreur $erf(x)$).
- `js/questions.js` : Banque d'items et algorithmes de rendu vectoriel SVG.
- `js/audio.js` : Synthétiseur Web Audio.

## 📋 Installation & Exécution locale

Le projet étant une application front-end standalone, il suffit d'un navigateur web pour l'exécuter. 

1. Clonez ce dépôt :
   ```bash
   git clone https://github.com/redDwarf03/qi.git
   ```
2. Ouvrez simplement le fichier `index.html` dans n'importe quel navigateur web moderne.
3. *Alternativement, pour éviter tout blocage CORS sur de futurs modules, lancez un petit serveur local :*
   ```bash
   python -m http.server 8080
   # ou
   npx http-server ./ -p 8080
   ```
   Puis allez sur `http://localhost:8080`

## ⚖️ Mentions
Ce projet est fourni à des fins éducatives et démonstratives. Bien qu'il s'inspire de la rigueur des tests psychométriques actuels (WAIS-V, Matrices de Raven), il ne se substitue en aucun cas à un véritable bilan neuropsychologique encadré par un psychologue diplômé.
