# Tabou — le jeu des mots interdits

Application web installable (PWA) pour jouer au jeu des mots interdits entre amis, **sur un seul iPhone** qu'on se passe. Elle fonctionne **entièrement hors ligne** après la première ouverture : pas de compte, pas de serveur, pas d'abonnement.

👉 **Jouer : https://manonlehmannn-lab.github.io/tabou/**

- 2 185 cartes françaises intégrées, sur 16 thèmes et 3 niveaux, chacune avec exactement 5 mots interdits.
- Règles du livret officiel : rotation des donneurs, buzzer adverse, barème, conditions de victoire, prolongation.
- Les cinq modes du dé défi (tirage équitable ou choix manuel).
- Chronomètre automatique, sons, retour haptique, annulation et correction, sauvegarde et reprise automatiques.

## Installer sur l'iPhone

1. Ouvrir **https://manonlehmannn-lab.github.io/tabou/** dans **Safari** (connexion nécessaire une seule fois).
2. Toucher **Partager** (carré avec une flèche), puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. Lancer Tabou depuis son icône. Il fonctionne ensuite en mode avion.

Pourquoi une PWA plutôt qu'une app native ? Ce Mac n'a pas Xcode (seulement les outils en ligne de commande, sans SDK iOS). Une app native signée avec un compte Apple gratuit expire au bout de **7 jours** : il faudrait la réinstaller chaque semaine avec le Mac et un câble, et un compte gratuit est limité à 3 apps. La PWA s'installe une fois, ne coûte rien, est hébergée gratuitement par GitHub Pages et se met à jour toute seule.

Limites de Safari sur iPhone, connues et assumées :

- **Vibrations** : iOS n'expose pas l'API de vibration au web. L'application utilise le retour haptique natif disponible depuis iOS 18, qui ne fonctionne que pendant un appui (buzzer, boutons). La fin du sablier est signalée par un son et une alerte visuelle, sans vibration.
- **Son** : le bouton silencieux de l'iPhone coupe aussi les sons de l'application.
- **Données** : elles restent dans l'application installée. Supprimer l'icône efface les parties et les statistiques.

## Règles appliquées

### Règles du livret officiel

| Point | Règle |
|---|---|
| Joueurs | 4 ou plus, en 2 équipes. |
| Tour | L'équipe A désigne un donneur d'indices. L'équipe B tient le sablier et désigne un joueur au buzzer, à côté du donneur. |
| Carte | Faire deviner le mot du haut sans dire les 5 mots Tabou. |
| Interdits | Le mot ou une partie des mots de la carte (ni « fer » ni « rail » pour « ferraille »), les gestes, « rime avec » ou « ressemble à », les abréviations et initiales (« TV »), les bruitages. **Chanter est autorisé.** |
| Score | +1 pour l'équipe active par mot deviné. +1 pour l'adversaire par carte passée ou buzzée. |
| Fin | Quand tous les joueurs ont été donneurs le même nombre de fois, l'équipe qui a le plus de points gagne. En cas d'égalité, on continue. |
| Dé défi | Jeu classique, Tête-à-tête, Double sablier (avec la même compensation pour l'adversaire au tour suivant), Statue (l'autre équipe retourne les cartes), Tout le monde joue. |

### Choix de l'application

Le livret ne règle pas les points suivants. Chaque choix est signalé dans l'écran Règles de l'application.

- **Durée du sablier** : 60 s par défaut, réglable de 30 s à 2 min. Le livret ne donne pas de durée chiffrée.
- **Nombre de tours** : 2 par joueur par défaut, réglable de 1 à 6. Aucune partie ne s'arrête à un score fixé.
- **Rotation** : automatique dans chaque équipe. On peut remplacer le donneur par un coéquipier, à condition qu'il ait fait deviner moins souvent.
- **Équipes inégales** : chaque équipe joue *k × (taille de la plus grande équipe)* tours. Les deux équipes ont donc autant de tours, chacun fait deviner au moins *k* fois, et l'écart dans une équipe est d'au plus un passage. Avec des équipes égales, cela revient exactement à la règle du livret.
- **Égalité** : on rejoue une série complète, qui conserve l'égalité des passages, puis on vérifie de nouveau. Option : un seul tour par équipe.
- **Temps** : une action n'est comptée que si elle arrive *strictement avant* zéro. En cas d'égalité exacte, la fin du temps l'emporte. La carte affichée à zéro ne rapporte rien. Une erreur peut être corrigée sur l'écran de fin de tour, et chaque correction est enregistrée.
- **Dé** : chaque face a une chance sur cinq. Le double sablier n'est jamais tiré au dernier tour d'une série, car la compensation serait impossible. Un tour de compensation n'en déclenche pas d'autre.
- **Statue** : l'équipe adverse touche les boutons du téléphone.
- **Tout le monde joue** : par défaut, le point va à l'équipe qui trouve. Option : seule l'équipe active marque.
- **Niveaux Facile, Normal, Difficile, Mélangé et Personnalisé** : un ajout de l'application.
- **2 ou 3 joueurs** : variante *non officielle* « chacun pour soi », sans buzzer adverse ni dé.

## La bibliothèque de cartes

Les sources sont dans `cards-src/`, un fichier JSON par thème. `tools/cards.py` contrôle chaque carte :

- exactement 5 mots interdits, tous distincts ;
- aucun mot interdit ne reprend une partie du mot à deviner, et deux interdits d'une même carte n'ont pas la même racine ;
- aucun doublon dans toute la bibliothèque ;
- signalement des quasi-doublons : singulier et pluriel, cartes partageant 4 interdits ou plus ;
- orthographe vérifiée avec le correcteur français de macOS (`python3 tools/cards.py spell`).

Le script compile ensuite `data/cards.json`.

| Thème | Cartes | Thème | Cartes |
|---|---|---|---|
| Vie quotidienne | 131 | Sport | 138 |
| Objets | 138 | Cinéma et télévision | 134 |
| Métiers | 132 | Musique | 135 |
| Nourriture | 136 | Histoire et géographie | 133 |
| Animaux | 137 | Personnalités | 151 |
| Lieux et pays | 138 | Culture générale | 137 |
| Sciences | 124 | Expressions françaises | 153 |
| Technologie | 132 | Situations amusantes | 136 |

Par niveau : 745 faciles, 882 normales, 558 difficiles.

Dans l'application, on peut ajouter ses propres cartes ou importer un fichier **JSON** ou **CSV** depuis l'app Fichiers :

```
mot;interdit1;interdit2;interdit3;interdit4;interdit5;niveau
Cowboy;Chapeau;Cheval;États-Unis;Rodéo;Ranch;1
```

## Développement

Aucune dépendance pour l'application elle-même : HTML, CSS et modules JavaScript natifs.

```sh
python3 -m http.server 8000          # puis http://localhost:8000
sh tools/build.sh                    # cartes + service worker + tests du moteur (JavaScriptCore)
python3 -m venv .venv && .venv/bin/pip install playwright pillow && .venv/bin/playwright install webkit chromium
.venv/bin/python tests/e2e.py        # parties complètes dans WebKit au format iPhone, mode avion
.venv/bin/python tools/make_icons.py # icônes PNG depuis assets/icons/icon.svg
```

Après toute modification de fichiers de l'application, relancez `python3 tools/build_sw.py`. Ce script régénère la liste des fichiers mis en cache et la version du service worker.

```
js/engine/   moteur de règles, sans aucun accès au DOM
  game.js        états et transitions de la partie, rotation, séries, prolongation, victoire
  scoring.js     barème
  timer.js       sablier, avec règle temporelle déterministe
  challenges.js  dé défi
  teams.js       équipes et répartition
  deck.js        cartes : validation, import, pioche sans répétition
  storage.js     sauvegarde locale
  random.js      hasard équitable (crypto)
js/ui/       interface : écrans, icônes, sons et vibrations
js/app.js    navigation, sauvegarde automatique, arrière-plan
tests/       tests du moteur et de la bibliothèque (jsc), tests de bout en bout (Playwright)
tools/       validation des cartes, service worker, icônes
```

---

Application indépendante, inspirée du jeu de société des mots interdits. Elle n'est ni affiliée à Hasbro ni approuvée par Hasbro. Le logo, l'icône et les illustrations sont originaux. Polices : Fredoka et Barlow Condensed, sous licence SIL OFL.
