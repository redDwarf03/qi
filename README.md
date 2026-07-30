# 🧠 QI Metrix 2026

**QI Metrix 2026** est une application web standalone interactive, dont la structure en 5 domaines s'inspire de la **WAIS-5** (Pearson, 2024) et du modèle **CHC de Cattell-Horn-Carroll**.

> ⚠️ **Les normes sont synthétiques, pas étalonnées.** Aucun échantillon représentatif n'a été recueilli : les scores sont calculés à partir d'un taux de réussite attendu posé a priori. Ce n'est pas un bilan psychométrique, et le résultat n'est pas comparable à un QI mesuré par un psychologue. En France, la batterie clinique de référence pour l'adulte reste la **WAIS-IV** ; la WAIS-5 y est annoncée pour 2026.

L'application est entièrement jouable dans le navigateur, sans nécessiter de serveur backend ni base de données. Elle propose un rendu visuel premium, des tests dynamiques et un rapport neuro-psychologique détaillé vulgarisé et accessible à tous (dès 16 ans).

🌐 **[Accéder à l'application web](https://reddwarf03.github.io/qi)**

## 🚀 Fonctionnalités Clés

- **2 batteries** : Express (25 items, ~12 min) ou Complète (50 items, ~25 min).
- **5 Domaines Cognitifs Évalués (Théorie CHC)** :
  - 🧩 **Raisonnement Fluide ($Gf$)** : Résolution de problèmes nouveaux et abstraits (Matrices).
  - 📐 **Traitements Visuo-Spatiaux ($Gvis$)** : Manipulation mentale de formes 2D/3D.
  - ⚡ **Mémoire de Travail ($Gwm$)** : Maintien et traitement d'informations à court terme.
  - ⏱️ **Vitesse de Traitement ($Gs$)** : Rapidité et précision de l'attention visuelle.
  - 🧠 **Raisonnement Verbal & Quantitatif ($Gc/Gq$)** : Compréhension conceptuelle et logique mathématique.
- **17 types de tâches distincts** (4 Gf + 3 Gvis + 4 Gwm + 2 Gs + 4 GcQ), distribués en cycle : sur une batterie donnée, un même type de question ne peut pas revenir plus de 2 à 3 fois.
- **Empans de mémoire en conditions cliniques** : les chiffres défilent **un par un** puis disparaissent, et la réponse se saisit **au clavier** (pas de QCM). C'est ce qui rend l'ordre inverse réellement coûteux — avec la séquence affichée en entier, il suffisait de la lire de droite à gauche.
- **Problèmes de logique énoncés à l'oral** (Web Speech API) : l'énoncé est dit **une seule fois** et jamais affiché, et contient des informations parasites destinées à brouiller le raisonnement. Repli automatique sur l'affichage écrit si aucune voix française n'est disponible.
- **Courbe de Gauss Interactive** : Calcule le Rang Percentile exact et affiche la distribution normale ($\mu = 100, \sigma = 15$).
- **Générateurs Vectoriels (SVG)** : Aucun asset image externe n'est requis. Matrices, symboles de vitesse et formes à faire pivoter sont générés mathématiquement.
- **Audio-Haptique (Web Audio API)** : Effets sonores de sélection et minuteurs générés par synthétiseur direct (désactivables via le bouton muet ; les énoncés oraux restent audibles).
- **Rapport Clinique Didactique** : Explications neuro-psychologiques claires, avec détection de l'hétérogénéité cognitive (profil dysharmonique).
- **Score traçable** : le rapport affiche le calcul du QIT, la fidélité de la batterie et le décompte brut par domaine, pour que le chiffre soit vérifiable à la main.
- **Export PDF** : Styles CSS `@media print` intégrés pour imprimer ou enregistrer le rapport final.

## 🧮 Comment le QIT est calculé

Trois choix volontaires, qui expliquent que les scores soient plus sobres qu'un test de QI grand public :

1. **Le QIT est la moyenne des cinq indices.** Il ne peut donc jamais dépasser votre meilleur domaine ni descendre sous votre plus faible. Les vraies WAIS amplifient le composite (un profil homogène à 120 partout donne un QIT supérieur à 120), mais cette amplification suppose un étalonnage sur échantillon représentatif — inapplicable ici.
2. **Régression vers la moyenne selon le nombre d'items.** Une performance extrême sur 5 items est plus probablement du bruit qu'un vrai niveau extrême : les scores sont resserrés vers 100, d'autant plus que la batterie est courte. Un sans-faute donne environ 127 en Express contre 132 en batterie complète.
3. **Intervalle de confiance dérivé de la fidélité réelle** (Spearman-Brown), et non d'un SEM constant emprunté à la WAIS.

## 🛠️ Architecture Technique

Projet **100% Vanilla** (aucun framework, aucune dépendance, aucune étape de build) :
- `index.html` : Structure sémantique de l'interface et des écrans.
- `style.css` : Design System "Dark Cyber-Psychometrics" (Glassmorphism, gradients HSL, CSS Variables).
- `js/app.js` : Contrôleur principal. Chaque item suit un cycle **présentation → réponse** ; le chronomètre ne démarre qu'à la phase de réponse.
- `js/psychometrics.js` : Moteur de calcul (z-scores, fonction d'erreur $erf(x)$, fidélité, étalonnage par âge).
- `js/questions.js` : Génération procédurale des items, géométrie discrète (polyominos) et couche de validation qui rejette tout item aux options dupliquées.
- `js/speech.js` : Synthèse vocale des énoncés oraux, avec détection de voix et repli.
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
Ce projet est fourni à des fins éducatives et démonstratives. Bien qu'il s'inspire de la rigueur des tests psychométriques actuels (WAIS-5, Matrices de Raven), il ne se substitue en aucun cas à un véritable bilan neuropsychologique encadré par un psychologue diplômé.
