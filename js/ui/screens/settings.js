// Paramètres : apparence, sons, chronomètre, conventions de jeu, données.
import { esc, toast, confirmBox, fmtNumber } from '../dom.js';
import { topbar, toggle, seg, segValue } from '../parts.js';
import { sound, haptic, unlockAudio } from '../fx.js';

export function render(app) {
  const s = app.settings;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const offline = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
  return `<main class="screen">
    ${topbar('Paramètres')}

    <section class="panel"><div class="head">Apparence</div><div class="body">
      ${seg('theme', s.theme, [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']])}
    </div></section>

    <section class="panel"><div class="head">Sons et vibrations</div><div class="body">
      ${toggle('sound', s.sound, 'Sons', 'Buzzer, fin du sablier, points. Le mode silencieux de l’iPhone coupe aussi les sons.')}
      ${toggle('haptics', s.haptics, 'Vibrations', 'Sur iPhone, Safari ne permet qu’un léger retour haptique lors d’un appui (buzzer, boutons) ; pas de vibration à la fin du temps.')}
      <button class="btn small block" data-act="test">Tester le buzzer</button>
    </div></section>

    <section class="panel"><div class="head">Chronomètre</div><div class="body">
      <div class="field"><span class="label">Si l’application passe en arrière-plan pendant un tour</span>
        ${seg('background', s.background, [['pause', 'Suspendre le sablier'], ['run', 'Le laisser couler']])}
        <p class="hint">${s.background === 'pause' ? 'Recommandé : un appel ou un verrouillage involontaire ne gâche pas le tour. Le tour reprend avec un bouton « Reprendre ».' : 'Le temps continue de s’écouler, comme un vrai sablier. Si le temps est écoulé au retour, le tour est terminé.'}</p>
      </div>
      ${toggle('countdown', s.countdown, 'Compte à rebours 3-2-1', 'Avant le départ du sablier, le temps de prendre le téléphone.')}
      <div class="field"><span class="label">Position du buzzer</span>
        ${seg('buzzerSide', s.buzzerSide, [['left', 'À gauche'], ['right', 'À droite']])}
        <p class="hint">Placez-le du côté où se tient le joueur adverse chargé de surveiller.</p>
      </div>
    </div></section>

    <section class="panel"><div class="head">Conventions de jeu</div><div class="body">
      <span class="tag app">Choix de l’application</span>
      <div class="field"><span class="label">Défi « Tout le monde joue » : qui marque quand l’adversaire trouve ?</span>
        ${seg('everyoneScoring', s.everyoneScoring, [['finder', 'L’équipe qui trouve'], ['activeOnly', 'Personne']])}
        <p class="hint">Le livret ne le précise pas. Par défaut, l’équipe qui trouve le mot marque le point.</p>
      </div>
      <div class="field"><span class="label">Prolongation en cas d’égalité</span>
        ${seg('overtime', s.overtime, [['series', 'Série complète'], ['single', 'Un tour par équipe']])}
        <p class="hint">Série complète : chaque joueur refait deviner une fois, l’égalité de passages est conservée.</p>
      </div>
      <p class="hint">Ces réglages s’appliquent aux nouvelles parties.</p>
    </div></section>

    <section class="panel"><div class="head">Données</div><div class="body">
      <p class="small">Tout est enregistré uniquement sur cet appareil : aucun compte, aucun serveur.</p>
      <button class="btn small block" data-act="reset-cards">Réinitialiser l’historique des cartes</button>
      <button class="btn small block" data-act="reset-all" style="color:var(--red-2)">Effacer toutes les données</button>
    </div></section>

    <section class="panel"><div class="head">À propos</div><div class="body">
      <div class="kv"><span>Version</span><b>${esc(app.version)}</b></div>
      <div class="kv"><span>Cartes intégrées</span><b>${fmtNumber(app.library.cards.length)}</b></div>
      <div class="kv"><span>Hors ligne</span><b>${offline ? 'Prêt ✓' : 'Rouvrez l’application une fois'}</b></div>
      <div class="kv"><span>Installée sur l’écran d’accueil</span><b>${standalone ? 'Oui ✓' : 'Non'}</b></div>
      ${standalone ? '' : '<p class="hint">Dans Safari : bouton Partager, puis « Sur l’écran d’accueil ».</p>'}
      <p class="hint">Application indépendante inspirée du jeu de société des mots interdits ; ni affiliée ni approuvée par Hasbro. Polices Fredoka et Barlow Condensed (licence SIL OFL).</p>
    </div></section>
  </main>`;
}

export function mount(app, root) {
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.toggle) {
      app.saveSettings({ [b.dataset.toggle]: !app.settings[b.dataset.toggle] });
      app.refresh();
    } else if (b.dataset.seg) {
      app.saveSettings({ [b.dataset.seg]: segValue(b) });
      app.refresh();
    } else if (b.dataset.act === 'test') {
      unlockAudio();
      sound('buzzed');
      haptic('buzz');
    } else if (b.dataset.act === 'reset-cards') {
      if (await confirmBox({ title: 'Réinitialiser l’historique des cartes ?', text: 'Les cartes déjà jouées pourront ressortir en priorité.', ok: 'Réinitialiser', danger: true })) {
        app.cardStats = {};
        app.storage.saveCardStats({});
        toast('Historique des cartes réinitialisé.');
      }
    } else if (b.dataset.act === 'reset-all') {
      if (await confirmBox({ title: 'Tout effacer ?', text: 'Partie en cours, statistiques, cartes personnalisées et réglages seront supprimés.', ok: 'Tout effacer', danger: true })) {
        try {
          Object.keys(localStorage).filter((k) => k.startsWith('tabou:')).forEach((k) => localStorage.removeItem(k));
        } catch {
          /* stockage indisponible */
        }
        location.reload();
      }
    }
  });
}
