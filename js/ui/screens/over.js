// Fin de partie : vainqueur, score final, meilleurs tours, revanche.
import { icons } from '../icons.js';
import { nameOf, sideName } from '../parts.js';
import * as G from '../../engine/game.js';
import { confetti, sound, haptic } from '../fx.js';

const TROPHY = `<svg class="trophy" viewBox="0 0 120 120" aria-hidden="true">
  <defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ffab2e"/></linearGradient></defs>
  <path d="M36 16h48v26c0 15-10 26-24 26S36 57 36 42z" fill="url(#gold)" stroke="#3a1b8f" stroke-width="5" stroke-linejoin="round"/>
  <path d="M36 24H20c0 16 8 24 18 26M84 24h16c0 16-8 24-18 26" fill="none" stroke="#3a1b8f" stroke-width="5" stroke-linecap="round"/>
  <path d="M52 68h16v14H52z" fill="url(#gold)" stroke="#3a1b8f" stroke-width="5"/>
  <rect x="36" y="82" width="48" height="16" rx="5" fill="#ff8576" stroke="#3a1b8f" stroke-width="5"/>
  <path d="M60 28l4 8 9 1-6.5 6 1.5 9-8-4.5-8 4.5 1.5-9L47 37l9-1z" fill="#fff"/>
</svg>`;

let celebrated = null;

export function render(app) {
  const g = app.game;
  const best = G.bestTurns(g, 3);
  const winner = sideName(g, g.winner);
  const final = g.mode === 'teams'
    ? `<div class="final"><span style="color:var(--team-A)">${g.scores.A}</span> – <span style="color:var(--team-B)">${g.scores.B}</span></div>
       <p class="muted">${sideName(g, 'A')} contre ${sideName(g, 'B')}</p>`
    : `<div class="final">${g.scores[g.winner]} pts</div>`;
  return `<main class="screen">
    <section class="victory team-${g.mode === 'teams' ? g.winner : 'S'}">
      ${TROPHY}
      <h1>${winner} gagne !</h1>
      ${final}
      ${g.overtime ? `<p class="tag app">Départagé après ${g.overtime} prolongation${g.overtime > 1 ? 's' : ''}</p>` : ''}
    </section>
    ${g.mode === 'solo' ? `<section class="panel"><div class="head">Classement</div><div class="body">${G.standings(g).map((s, i) => `<div class="kv"><span>${i + 1}. ${nameOf(g, s.id)}</span><b>${s.score}</b></div>`).join('')}</div></section>` : ''}
    <section class="panel"><div class="head">Meilleurs tours</div><div class="body">
      ${best
        .map((t, i) => `<div class="kv"><span>${['🥇', '🥈', '🥉'][i]} <b>${nameOf(g, t.giver)}</b> <span class="muted small">${g.mode === 'teams' ? `· ${sideName(g, t.teamId)}` : ''} · tour ${t.number}</span></span><b>${t.guessed} mot${t.guessed > 1 ? 's' : ''}</b></div>`)
        .join('') || '<p class="muted">Aucun tour.</p>'}
    </div></section>
    <section class="panel"><div class="head">La partie</div><div class="body">
      <div class="kv"><span>Tours joués</span><b>${g.history.length}</b></div>
      <div class="kv"><span>Mots devinés</span><b>${count(g, 'guessed') + count(g, 'stolen')}</b></div>
      <div class="kv"><span>Cartes passées</span><b>${count(g, 'passed')}</b></div>
      <div class="kv"><span>Buzzers</span><b>${count(g, 'buzzed')}</b></div>
    </div></section>
    <button class="btn primary block" data-act="rematch">${icons.swap} Revanche (mêmes équipes)</button>
    <button class="btn violet block" data-act="new">${icons.users} Nouvelle partie</button>
    <button class="btn block" data-act="home">${icons.home} Accueil</button>
  </main>`;
}

const count = (g, r) => g.history.reduce((s, t) => s + t.cards.filter((c) => c.result === r).length, 0);

export function mount(app, root) {
  if (celebrated !== app.game.id) {
    celebrated = app.game.id;
    setTimeout(() => {
      confetti();
      sound('victory');
      haptic('ok');
    }, 250);
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'rematch') app.rematch();
    else if (b.dataset.act === 'new') {
      app.storage.clearGame();
      app.game = null;
      app.go('setup', { reset: true });
    } else {
      app.storage.clearGame();
      app.game = null;
      app.go('home');
    }
  });
}
