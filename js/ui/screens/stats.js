// Statistiques et historique des parties terminées.
import { esc, fmtDate, fmtNumber, confirmBox } from '../dom.js';
import { topbar } from '../parts.js';

export function render(app) {
  const h = app.history;
  const words = h.reduce((s, g) => s + g.guessed, 0);
  const best = h.filter((g) => g.best).sort((a, b) => b.best.guessed - a.best.guessed)[0];
  const wins = {};
  for (const g of h) {
    const team = g.mode === 'teams' ? g.teams.find((t) => t.id === g.winner) : null;
    const names = team ? team.players : [g.winnerName];
    for (const n of names) wins[n] = (wins[n] || 0) + 1;
  }
  const podium = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const games = h
    .slice()
    .reverse()
    .slice(0, 30)
    .map((g) => {
      const score = g.mode === 'teams'
        ? `${esc(g.teams[0].name)} <b>${g.scores.A}</b> – <b>${g.scores.B}</b> ${esc(g.teams[1].name)}`
        : `Chacun pour soi · ${g.teams[0].players.length} joueurs`;
      return `<div class="card-line" style="align-items:flex-start">
        <span><span class="small muted">${fmtDate(g.date)} · ${g.turns} tours${g.overtime ? ' · prolongation' : ''}</span><br>${score}</span>
        <span class="res guessed">${esc(g.winnerName)}</span>
      </div>`;
    })
    .join('');
  return `<main class="screen">
    ${topbar('Statistiques')}
    <section class="stat-tiles">
      <div class="stat-tile"><div class="n">${h.length}</div><div class="l">parties</div></div>
      <div class="stat-tile g"><div class="n">${fmtNumber(words)}</div><div class="l">mots devinés</div></div>
      <div class="stat-tile p"><div class="n">${best ? best.best.guessed : 0}</div><div class="l">record en un tour</div></div>
    </section>
    ${best ? `<p class="center muted">Record détenu par <b>${esc(best.best.giver)}</b> (${fmtDate(best.date)})</p>` : ''}
    <section class="panel"><div class="head">Joueurs les plus victorieux</div><div class="body">
      ${podium.length ? podium.map(([n, w], i) => `<div class="kv"><span>${i + 1}. ${esc(n)}</span><b>${w} victoire${w > 1 ? 's' : ''}</b></div>`).join('') : '<p class="muted">Terminez une partie pour voir le classement.</p>'}
    </div></section>
    <section class="panel"><div class="head">Historique des scores</div><div class="body">
      ${games || '<p class="muted">Aucune partie terminée.</p>'}
    </div></section>
    ${h.length ? '<button class="btn small block" data-act="clear">Effacer les statistiques</button>' : ''}
  </main>`;
}

export function mount(app, root) {
  root.querySelector('[data-act="clear"]')?.addEventListener('click', async () => {
    if (await confirmBox({ title: 'Effacer les statistiques ?', ok: 'Effacer', danger: true })) {
      app.history = [];
      app.storage.saveHistory([]);
      app.refresh();
    }
  });
}
