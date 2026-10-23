// Tableau des scores : équipes, passages de chaque joueur, historique des tours.
import { esc } from '../dom.js';
import { icons } from '../icons.js';
import { nameOf, sideName } from '../parts.js';
import * as G from '../../engine/game.js';
import { CHALLENGES } from '../../engine/challenges.js';

export function render(app, params) {
  const g = app.game;
  const scores = G.liveScores(g);
  const p = G.progress(g);
  const lead = G.standings({ scores })[0];
  const teams = g.mode === 'teams'
    ? `<div class="board-teams">${g.teams
        .map(
          (t) => `<div class="board-team team-${t.id} ${scores[t.id] === lead.score && scores[t.id] > 0 ? 'lead' : ''}">
        <input class="input" data-rename="${t.id}" value="${esc(t.name)}" maxlength="22" aria-label="Nom de l’équipe" style="background:rgba(255,255,255,.16);color:#fff;border-color:transparent;min-height:38px;font-size:15px;padding:0 8px">
        <div class="score">${scores[t.id]}</div>
        ${t.players.map((id) => `<div class="pl"><span>${nameOf(g, id)}</span><span>${g.players[id].turns} tour${g.players[id].turns > 1 ? 's' : ''}</span></div>`).join('')}
      </div>`
        )
        .join('')}</div>`
    : `<section class="panel"><div class="head">Classement</div><div class="body">${G.standings({ scores })
        .map((s, i) => `<div class="kv"><span>${i + 1}. ${nameOf(g, s.id)} <span class="muted small">(${g.players[s.id].turns} tour${g.players[s.id].turns > 1 ? 's' : ''})</span></span><b>${s.score}</b></div>`)
        .join('')}</div></section>`;
  const hist = g.history.length
    ? g.history
        .slice()
        .reverse()
        .map((t) => {
          const guessed = t.cards.filter((c) => c.result === 'guessed' || c.result === 'stolen').length;
          const pts = g.mode === 'teams' ? `+${t.points[t.teamId] || 0} / +${t.points[G.opponentOf(g, t.teamId)] || 0}` : `+${t.points[t.giver] || 0}`;
          return `<div class="hist team-${t.teamId}">
            <span class="no">${t.number}</span>
            <span><b>${nameOf(g, t.giver)}</b> <span class="muted small">· ${guessed} deviné${guessed > 1 ? 's' : ''}${t.challenge !== 'classic' ? ` · ${esc(CHALLENGES[t.challenge].name)}` : ''}${t.corrections.length ? ' · corrigé' : ''}</span></span>
            <span class="pts">${pts}</span>
          </div>`;
        })
        .join('')
    : '<p class="muted center">Aucun tour terminé pour l’instant.</p>';
  return `<main class="screen">
    <header class="topbar">
      <button class="icon-btn" data-act="back" aria-label="Retour">${icons.back}</button>
      <h1>Classement</h1>
      <span class="spacer"></span>
    </header>
    <p class="progress-line">${p.overtime ? `Prolongation ${p.overtime} · ` : ''}${p.played} / ${p.total} tours joués dans la série${g.phase === 'playing' ? ' · tour en cours compté' : ''}</p>
    ${teams}
    <section class="panel"><div class="head">Historique des tours</div><div class="body">
      ${g.mode === 'teams' ? `<p class="hint">Points : équipe active / équipe adverse.</p>` : ''}
      <div class="history-list">${hist}</div>
    </div></section>
    <p class="hint center">Fin de partie : quand chaque joueur a été donneur ${g.rules.turnsPerPlayer} fois${g.mode === 'teams' ? ' (et que les deux équipes ont joué autant de tours)' : ''}. En cas d’égalité, la partie continue.</p>
  </main>`;
}

export function mount(app, root, params) {
  root.querySelector('[data-act="back"]').addEventListener('click', () => app.go(params.from || app.resumeScreen()));
  root.querySelectorAll('[data-rename]').forEach((input) =>
    input.addEventListener('change', () => app.setGame(G.renameTeam(app.game, input.dataset.rename, input.value)))
  );
}
