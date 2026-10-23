// Fin du tour : récapitulatif, correction éventuelle des cartes, validation.
import { esc, fmtClock } from '../dom.js';
import { icons } from '../icons.js';
import { nameOf, sideName, RESULT_LABELS } from '../parts.js';
import * as G from '../../engine/game.js';

let editing = false;

const SHORT = { guessed: 'Deviné', stolen: 'Adverse', passed: 'Passé', buzzed: 'Buzzé', unplayed: 'Non jouée' };

/** Prochain donneur, calculé sur une copie validée du tour (sans rien enregistrer). */
function nextUp(game) {
  const g = G.validateTurn(game, game.updatedAt);
  if (g.phase === 'over') return { over: true };
  return { team: g.turn.teamId, giver: g.players[g.turn.giver].name, overtime: g.overtime > game.overtime };
}

export function render(app) {
  const g = app.game;
  const t = g.turn;
  const { counts, points } = G.turnTally(g);
  const opp = G.opponentOf(g, t.teamId);
  const live = G.liveScores(g);
  const next = nextUp(g);
  const options = G.resultsFor(g);
  const list = t.cards.length
    ? t.cards
        .map((c, i) => {
          const card = app.byId.get(c.id);
          const label = c.result === 'stolen' ? `Trouvé par ${sideName(g, opp)}` : RESULT_LABELS[c.result];
          return `<div class="card-line">
            <span class="w">${esc(card?.word ?? c.id)}</span>
            ${editing
              ? `<div class="res-pick">${options.map((r) => `<button class="${r}" data-fix="${i}" data-r="${r}" aria-pressed="${c.result === r}">${SHORT[r]}</button>`).join('')}</div>`
              : `<span class="res ${c.result}">${esc(label)}</span>`}
          </div>`;
        })
        .join('')
    : '<p class="muted center">Aucune carte jouée.</p>';
  const log = t.corrections.length
    ? `<div class="field"><span class="label">Modifications</span>${t.corrections
        .map((m) => `<div class="small muted">${fmtClock(m.at)} · <b>${esc(app.byId.get(m.id)?.word ?? m.id)}</b> : ${SHORT[m.from]} → ${SHORT[m.to]}</div>`)
        .join('')}</div>`
    : '';
  const scores = g.mode === 'teams'
    ? `<div class="score-row">
        <div class="sr team-A"><span class="big">${live.A}</span><span class="nm"><span class="dot"></span>${sideName(g, 'A')}</span></div>
        <span class="muted">–</span>
        <div class="sr team-B"><span class="big">${live.B}</span><span class="nm"><span class="dot"></span>${sideName(g, 'B')}</span></div>
      </div>`
    : `<div class="score-row">${nameOf(g, t.giver)} : <span class="big">${live[t.giver]}</span></div>`;
  const gains = g.mode === 'teams'
    ? `<div class="gains">
        <div class="gain team-${t.teamId}"><div class="pts">+${points[t.teamId] || 0}</div><div class="tn">${sideName(g, t.teamId)} </div><div class="tn" style="opacity:.75;font-size:12px">équipe active</div></div>
        <div class="gain team-${opp}"><div class="pts">+${points[opp] || 0}</div><div class="tn">${sideName(g, opp)} </div><div class="tn" style="opacity:.75;font-size:12px">adversaire</div></div>
      </div>`
    : `<div class="gains" style="grid-template-columns:1fr"><div class="gain team-S"><div class="pts">+${points[t.giver] || 0}</div><div class="tn">${nameOf(g, t.giver)}</div></div></div>`;
  return `<main class="screen">
    <header class="topbar">
      <span class="spacer"></span>
      <h1>Fin du tour</h1>
      <button class="icon-btn" data-act="board" aria-label="Scores">${icons.trophy}</button>
    </header>
    <p class="times-up">${counts.guessed + counts.stolen > 0 ? 'Bien joué !' : 'Temps écoulé !'}</p>
    <p class="center muted">${nameOf(g, t.giver)} · ${sideName(g, t.teamId)}</p>
    <div class="stat-tiles">
      <div class="stat-tile g"><div class="n">${counts.guessed + counts.stolen}</div><div class="l">${counts.stolen ? `devinés (${counts.stolen} par l’adversaire)` : 'devinés'}</div></div>
      <div class="stat-tile p"><div class="n">${counts.passed}</div><div class="l">passés</div></div>
      <div class="stat-tile b"><div class="n">${counts.buzzed}</div><div class="l">buzzés</div></div>
    </div>
    ${gains}
    ${scores}
    <section class="panel"><div class="head">Cartes du tour</div><div class="body">
      <div class="card-list">${list}</div>
      <button class="btn small block" data-act="edit">${editing ? `${icons.check} Terminer la correction` : 'Corriger une erreur de manipulation'}</button>
      ${log}
    </div></section>
    <div style="flex:1"></div>
    ${next.over
      ? '<p class="next-up">Toutes les équipes ont joué leurs tours : <b>place au verdict !</b></p>'
      : `<p class="next-up">${next.overtime ? '<b style="color:var(--coral)">Égalité ! Prolongation.</b><br>' : ''}Prochain donneur : <b>${esc(next.giver)}</b><br><span class="muted">${g.mode === 'teams' ? sideName(g, next.team) : ''}</span></p>`}
    <button class="btn primary block" data-act="validate">${next.over ? `${icons.trophy} Voir le résultat` : `Valider et continuer`}</button>
  </main>`;
}

export function mount(app, root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.fix) {
      app.setGame(G.correctCard(app.game, Number(b.dataset.fix), b.dataset.r, Date.now()));
      app.refresh();
    } else if (b.dataset.act === 'edit') {
      editing = !editing;
      app.refresh();
    } else if (b.dataset.act === 'board') app.go('board', { from: 'review' });
    else if (b.dataset.act === 'validate') {
      editing = false;
      app.validateTurn();
    }
  });
}
