// Règles : livret officiel d'un côté, adaptations de l'application de l'autre, clairement séparées.
import { icons, challengeIcon } from '../icons.js';
import { CHALLENGES, DIE_FACES } from '../../engine/challenges.js';
import { esc } from '../dom.js';

const BOOK = '<span class="tag">Livret</span>';
const APP = '<span class="tag app">Choix de l’application</span>';

export function render(app, params) {
  return `<main class="screen">
    <header class="topbar">
      <button class="icon-btn" data-act="back" aria-label="Retour">${icons.back}</button>
      <h1>Règles</h1>
      <span class="spacer"></span>
    </header>

    <section class="panel"><div class="head">1. Mise en place</div><div class="body">
      <p>${BOOK}</p>
      <h3>Formez 2 équipes</h3>
      <p>4 joueurs ou plus. Les équipes se placent en alternance autour de la table : chacun peut ainsi surveiller l’autre équipe.</p>
      <h3>Préparez les cartes</h3>
      <p>Dans l’application, la pioche est mélangée automatiquement et une carte ne revient jamais au cours d’une partie.</p>
    </div></section>

    <section class="panel"><div class="head">2. But du jeu</div><div class="body">
      <p>${BOOK}</p>
      <p>Faire deviner à votre équipe le mot inscrit en haut de la carte <b>sans utiliser les 5 mots Tabou</b> écrits en dessous. Sinon, l’autre équipe vous buzze !</p>
      <div class="example-card"><div class="w">COWBOY</div><ul><li>Chapeau</li><li>Cheval</li><li>États-Unis</li><li>Rodéo</li><li>Ranch</li></ul></div>
      <p class="center muted small">Exemple : « C’est un homme qui sait manier le lasso… »</p>
    </div></section>

    <section class="panel"><div class="head">3. Jouer</div><div class="body">
      <p>${BOOK}</p>
      <p>Une équipe fait deviner pendant que l’autre vérifie qu’aucun mot Tabou n’est utilisé.</p>
      <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
        <li>L’équipe A désigne son donneur d’indices, qui prend les cartes (ici : le téléphone).</li>
        <li>L’équipe B tient le sablier et désigne un joueur au buzzer, placé à côté du donneur pour voir la carte.</li>
        <li>Le donneur commence dès que le sablier est retourné : il décrit le mot, met de côté les cartes buzzées ou passées et retourne une nouvelle carte dès qu’un mot est deviné.</li>
        <li>Quand le temps est écoulé, le tour est terminé.</li>
        <li>C’est ensuite à l’équipe B de jouer : les rôles sont inversés.</li>
      </ol>
    </div></section>

    <section class="panel"><div class="head">Quand buzzer ?</div><div class="body">
      <p>${BOOK}</p>
      <p>Buzzez dès qu’une de ces règles n’est pas respectée :</p>
      <ul>
        <li>Dire le mot à deviner ou l’un des 5 mots Tabou.</li>
        <li>Dire <b>une partie</b> des mots inscrits sur la carte : ni « rail » ni « fer » pour faire deviner « ferraille ».</li>
        <li>Faire des gestes.</li>
        <li>Dire que le mot « rime avec » ou « ressemble à » un autre.</li>
        <li>Utiliser des abréviations ou des initiales : pas « TV » pour « télévision ».</li>
        <li>Faire des bruitages (explosion, bruit d’un engin…).</li>
      </ul>
      <p><b>Chanter est autorisé</b>, si le cœur vous en dit !</p>
      <p class="muted small">L’équipe adverse est seule juge : c’est elle qui appuie sur le buzzer.</p>
    </div></section>

    <section class="panel"><div class="head">Barème</div><div class="body">
      <p>${BOOK}</p>
      <div class="kv"><span>Mot deviné</span><b>+1 pour l’équipe active</b></div>
      <div class="kv"><span>Carte passée</span><b>+1 pour l’adversaire</b></div>
      <div class="kv"><span>Carte buzzée</span><b>+1 pour l’adversaire</b></div>
    </div></section>

    <section class="panel"><div class="head">4. Comment gagner</div><div class="body">
      <p>${BOOK}</p>
      <p>Lorsque tous les joueurs ont passé le même nombre de tours comme donneur d’indices, l’équipe qui a le plus de points remporte la partie. <b>En cas d’égalité, continuez à jouer.</b></p>
    </div></section>

    <section class="panel"><div class="head">5. Modes du dé défi</div><div class="body">
      <p>${BOOK}</p>
      <p>Si vous maîtrisez le mode classique, pimentez la partie avec le dé défi :</p>
      ${DIE_FACES.map((id) => `<div class="rule-mode"><span class="ic">${challengeIcon(id)}</span><div><h3>${esc(CHALLENGES[id].name)}</h3><p>${esc(CHALLENGES[id].rule)}</p></div></div>`).join('')}
    </div></section>

    <section class="panel" style="border-color:var(--coral)"><div class="head" style="background:var(--coral)">Adaptations de l’application</div><div class="body">
      <p>${APP} Le livret ne fixe pas ces points ; voici les conventions retenues, modifiables quand c’est indiqué.</p>
      <ul>
        <li><b>Durée du sablier :</b> 60 s par défaut (réglable de 30 s à 2 min). Le livret ne donne pas de durée chiffrée.</li>
        <li><b>Rotation :</b> le donneur d’indices tourne automatiquement dans chaque équipe ; on peut le remplacer par un coéquipier qui a fait deviner moins souvent.</li>
        <li><b>Nombre de tours :</b> chaque joueur fait deviner 2 fois par défaut (réglable).</li>
        <li><b>Équipes inégales :</b> les deux équipes jouent autant de tours (k × taille de la plus grande équipe). Chacun fait deviner au moins k fois ; dans la petite équipe, certains font deviner une fois de plus. Avec des équipes égales, c’est exactement la règle du livret.</li>
        <li><b>Égalité :</b> une nouvelle série complète est jouée (chacun refait deviner une fois), puis le score est vérifié à nouveau. Option : un seul tour par équipe.</li>
        <li><b>Fin du temps :</b> une action n’est comptée que si elle a lieu strictement avant zéro ; en cas d’égalité exacte, c’est la fin du temps qui l’emporte. La carte à l’écran à zéro ne rapporte aucun point. Une erreur de manipulation peut être corrigée sur l’écran de fin de tour, et chaque correction est consignée.</li>
        <li><b>Dé défi :</b> tirage équitable (1 chance sur 5 par face), ou défi choisi à la main. Le double sablier n’est pas tiré au dernier tour d’une série, car l’adversaire n’aurait plus de tour pour recevoir sa compensation. Le tour de compensation n’en déclenche pas un autre.</li>
        <li><b>Statue :</b> l’équipe adverse « retourne les cartes », c’est-à-dire qu’elle touche les boutons du téléphone.</li>
        <li><b>Tout le monde joue :</b> le livret ne précise pas le score. Par défaut, le point va à l’équipe qui trouve le mot ; option : seule l’équipe active marque, et un mot trouvé par l’adversaire est défaussé sans point. Les cartes passées ou buzzées rapportent toujours 1 point à l’adversaire.</li>
        <li><b>Difficultés :</b> les niveaux Facile, Normal, Difficile et Mélangé sont un ajout de l’application.</li>
        <li><b>2 ou 3 joueurs :</b> variante non officielle « chacun pour soi », sans buzzer adverse ni dé défi.</li>
      </ul>
    </div></section>
  </main>`;
}

export function mount(app, root, params) {
  root.querySelector('[data-act="back"]').addEventListener('click', () => app.go(params.from || 'home'));
}
