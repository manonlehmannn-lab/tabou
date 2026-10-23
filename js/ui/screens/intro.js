// Annonce du tour : équipe active, donneur d'indices, équipe qui surveille, défi éventuel.
import { esc } from '../dom.js';
import { icons, challengeIcon } from '../icons.js';
import { nameOf, teamOf, theTeam } from '../parts.js';
import * as G from '../../engine/game.js';
import { CHALLENGES, DIE_FACES } from '../../engine/challenges.js';
import { sound, haptic } from '../fx.js';

// Tours dont l'animation du dé a déjà été jouée (pas de relance visuelle après un retour arrière).
const revealed = new Set();

function challengeBlock(game) {
  const t = game.turn;
  const c = CHALLENGES[t.challenge];
  const manual = game.rules.dice === 'manual' && !t.forced;
  const allowed = G.allowedChallengesNow(game);
  const forcedNote = t.forced
    ? `<p class="small" style="color:var(--coral-2);font-weight:600">Compensation : l’équipe adverse a eu le double sablier au tour précédent.</p>`
    : '';
  const lastNote = game.rules.dice !== 'off' && !allowed.includes('double') && !t.forced
    ? `<p class="hint">Dernier tour de la série : le double sablier n’est pas proposé, l’adversaire ne pourrait pas en bénéficier.</p>`
    : '';
  let guesser = '';
  if (t.challenge === 'tete') {
    const mates = teamOf(game, t.teamId).players.filter((id) => id !== t.giver);
    guesser = `<div class="field"><span class="label">Qui devine pour ce tour ? (choix du donneur)</span>
      <div class="guesser-pick">${mates.map((id) => `<button data-guesser="${id}" aria-pressed="${t.guesser === id}">${nameOf(game, id)}</button>`).join('')}</div>
    </div>`;
  }
  return `<section class="challenge" style="flex-direction:column;align-items:stretch">
    <div class="row" style="gap:14px">
      <div class="die" id="die">${challengeIcon(t.challenge)}</div>
      <div style="flex:1">
        <div class="hint">${t.forced ? 'Défi imposé' : manual ? 'Défi choisi' : 'Dé défi'}</div>
        <div class="name" id="ch-name">${esc(c.name)}</div>
        <div class="rule" id="ch-rule">${esc(c.rule)}</div>
      </div>
    </div>
    ${forcedNote}
    ${manual ? `<div class="challenge-picker">${DIE_FACES.map((id) => `<button data-challenge="${id}" aria-pressed="${t.challenge === id}" aria-label="${esc(CHALLENGES[id].name)}" ${allowed.includes(id) ? '' : 'disabled'}>${challengeIcon(id)}</button>`).join('')}</div>` : ''}
    ${lastNote}
    ${guesser}
  </section>`;
}

export function render(app) {
  const g = app.game;
  const t = g.turn;
  const p = G.progress(g);
  const solo = g.mode === 'solo';
  const opp = G.opponentOf(g, t.teamId);
  const givers = solo ? [] : G.eligibleGivers(g);
  const statue = t.challenge === 'statue';
  const announce = solo
    ? `<h2>À ${nameOf(g, t.giver)} de faire deviner !</h2>
       <div class="role"><span class="k">Les autres joueurs devinent et surveillent les mots interdits.</span></div>`
    : `<h2>À ${esc(theTeam(teamOf(g, t.teamId).name))} de jouer !</h2>
       <div class="role">
         <span class="k">Donneur d’indices</span>
         <span class="v">${nameOf(g, t.giver)}</span>
         ${givers.length > 1 ? `<div class="actions"><button class="btn small" style="background:rgba(255,255,255,.2);color:#fff" data-act="giver">${icons.swap} Changer</button></div>` : ''}
       </div>
       <p class="watch">${esc(theTeam(teamOf(g, opp).name, true))} surveille les mots interdits${t.watcher ? ` — buzzer : <b>${nameOf(g, t.watcher)}</b>` : ''}.</p>
       ${statue ? `<p class="watch"><b>Statue :</b> ${esc(theTeam(teamOf(g, opp).name))} tient le téléphone et touche les boutons.</p>` : ''}`;
  return `<main class="screen intro team-${t.teamId}">
    <header class="topbar">
      <button class="icon-btn" data-act="home" aria-label="Accueil">${icons.home}</button>
      <h1 class="progress-line" style="font-size:16px">${p.overtime ? `Prolongation ${p.overtime} · ` : ''}Tour ${p.played + 1} / ${p.total}</h1>
      <button class="icon-btn" data-act="board" aria-label="Scores">${icons.trophy}</button>
    </header>
    <section class="announce">
      <span class="turn-no">Tour n° ${t.number}</span>
      ${announce}
    </section>
    ${g.rules.dice !== 'off' || t.forced ? challengeBlock(g) : ''}
    <div style="flex:1"></div>
    <button class="btn primary block" data-act="start" style="min-height:66px;font-size:22px" ${G.canStart(g) ? '' : 'disabled'}>${icons.play} Commencer le tour</button>
    ${t.challenge === 'tete' && !t.guesser ? '<p class="center hint">Choisissez d’abord le joueur qui devine.</p>' : ''}
  </main>`;
}

function rollAnimation(app, root) {
  const t = app.game.turn;
  const key = `${app.game.id}:${t.number}`;
  if (!t.rolled || revealed.has(key)) return;
  revealed.add(key);
  const die = root.querySelector('#die');
  const name = root.querySelector('#ch-name');
  const rule = root.querySelector('#ch-rule');
  const start = root.querySelector('[data-act="start"]');
  if (!die) return;
  start.disabled = true;
  die.classList.add('rolling');
  rule.style.visibility = 'hidden';
  sound('dice');
  let i = 0;
  const spin = setInterval(() => {
    const face = DIE_FACES[i++ % DIE_FACES.length];
    die.innerHTML = challengeIcon(face);
    name.textContent = CHALLENGES[face].name;
  }, 95);
  setTimeout(() => {
    clearInterval(spin);
    die.classList.remove('rolling');
    die.classList.add('landed');
    die.innerHTML = challengeIcon(t.challenge);
    name.textContent = CHALLENGES[t.challenge].name;
    rule.style.visibility = '';
    start.disabled = !G.canStart(app.game);
    sound('land');
    haptic('light');
  }, 950);
}

export function mount(app, root) {
  rollAnimation(app, root);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const g = app.game;
    if (b.dataset.act === 'home') app.go('home');
    else if (b.dataset.act === 'board') app.go('board', { from: 'intro' });
    else if (b.dataset.act === 'giver') {
      const list = G.eligibleGivers(g);
      const next = list[(list.indexOf(g.turn.giver) + 1) % list.length];
      app.setGame(G.setGiver(g, next));
      app.refresh();
    } else if (b.dataset.challenge) {
      app.setGame(G.chooseChallenge(g, b.dataset.challenge));
      sound('tap');
      app.refresh();
    } else if (b.dataset.guesser) {
      app.setGame(G.setGuesser(g, b.dataset.guesser));
      app.refresh();
    } else if (b.dataset.act === 'start') {
      app.go('play', { countdown: app.settings.countdown });
    }
  });
}
