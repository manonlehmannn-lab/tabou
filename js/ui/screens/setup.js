// Configuration d'une partie en trois étapes : joueurs, équipes, réglages.
import { esc, fmtNumber, toast } from '../dom.js';
import { icons } from '../icons.js';
import { topbar, seg, segValue } from '../parts.js';
import { balancedSplit, checkTeams, cleanNames, makePlayerId, modeForCount, movePlayer, TEAM_STYLES } from '../../engine/teams.js';
import { DIFFICULTIES, LEVELS } from '../../engine/deck.js';
import { randomInt } from '../../engine/random.js';

const MAX_PLAYERS = 20;
let draft = null;

function freshDraft(app) {
  const s = app.settings;
  const names = s.lastPlayers.length >= 2 ? s.lastPlayers : ['', '', '', ''];
  const players = names.map((name) => ({ id: makePlayerId(), name }));
  return {
    step: 1,
    players,
    split: null,
    splitKey: '',
    teamNames: TEAM_STYLES.map((t) => t.name),
    opts: {
      difficulty: s.difficulty,
      customLevels: s.customLevels.slice(),
      customCategories: s.customCategories ? s.customCategories.slice() : null,
      duration: s.duration,
      turnsPerPlayer: s.turnsPerPlayer,
      dice: s.dice,
      startTeam: 'A',
    },
  };
}

const key = (d) => d.players.map((p) => p.id).join(',');

function ensureSplit(d) {
  if (!d.split || d.splitKey !== key(d)) {
    const [a, b] = balancedSplit(d.players.map((p) => p.id));
    d.split = [a, b];
    d.splitKey = key(d);
  }
}

function stepPlayers(d) {
  const n = d.players.length;
  const mode = modeForCount(n);
  return `<section class="panel"><div class="head">Les joueurs</div><div class="body">
    <div class="row between">
      <span class="label">Nombre de joueurs</span>
      <div class="stepper">
        <button class="icon-btn" data-act="minus" aria-label="Retirer un joueur" ${n <= 2 ? 'disabled' : ''}>${icons.minus}</button>
        <span class="val">${n}</span>
        <button class="icon-btn" data-act="plus" aria-label="Ajouter un joueur" ${n >= MAX_PLAYERS ? 'disabled' : ''}>${icons.plus}</button>
      </div>
    </div>
    <div class="player-list">
      ${d.players
        .map(
          (p, i) => `<div class="player-row">
        <span class="num">${i + 1}</span>
        <input class="input" data-name="${p.id}" value="${esc(p.name)}" placeholder="Prénom du joueur ${i + 1}" maxlength="18" autocomplete="off" autocapitalize="words" enterkeyhint="next">
        ${n > 2 ? `<button class="icon-btn" data-remove="${p.id}" aria-label="Retirer">${icons.close}</button>` : ''}
      </div>`
        )
        .join('')}
    </div>
    ${mode === 'solo' ? `<div class="warn"><b>Variante non officielle à ${n} joueurs.</b> Le livret prévoit 4 joueurs ou plus. Ici, chacun fait deviner les autres à son tour et marque 1 point par mot trouvé ; pas de buzzer adverse, le groupe se surveille.</div>` : ''}
  </div></section>`;
}

function stepTeams(app, d) {
  const n = d.players.length;
  if (modeForCount(n) === 'solo') {
    return `<section class="panel"><div class="head">Chacun pour soi</div><div class="body">
      <p>Variante non officielle : pas d’équipes. Le rôle de donneur d’indices tourne entre ${n} joueurs, les autres devinent.</p>
      <p class="muted small">Pour la règle officielle, ajoutez des joueurs (4 minimum) afin de former deux équipes.</p>
    </div></section>`;
  }
  ensureSplit(d);
  const byId = Object.fromEntries(d.players.map((p, i) => [p.id, p.name.trim() || `Joueur ${i + 1}`]));
  const issues = checkTeams(d.split);
  return `<p class="center muted small">Touchez un joueur pour le changer d’équipe.</p>
    <div class="teams">
      ${d.split
        .map(
          (ids, ti) => `<div class="team-box ${TEAM_STYLES[ti].id} team-${TEAM_STYLES[ti].id}">
        <input class="input" data-team-name="${ti}" value="${esc(d.teamNames[ti])}" maxlength="22" aria-label="Nom de l’équipe">
        ${ids.map((id) => `<button class="chip" data-move="${id}">${esc(byId[id])} ${icons.swap}</button>`).join('')}
        <span class="hint center">${ids.length} joueur${ids.length > 1 ? 's' : ''}</span>
      </div>`
        )
        .join('')}
    </div>
    ${issues.length ? `<div class="warn">${issues.map(esc).join('<br>')}</div>` : ''}
    ${d.split[0].length !== d.split[1].length && !issues.length ? `<div class="warn small">Équipes inégales : les deux équipes joueront autant de tours ; dans la plus petite, les joueurs feront deviner un peu plus souvent.</div>` : ''}
    <button class="btn ghost block" data-act="shuffle">${icons.shuffle} Répartir au hasard</button>`;
}

function stepOptions(app, d) {
  const o = d.opts;
  const count = app.eligible({ ...app.settings, ...o }).length;
  const solo = modeForCount(d.players.length) === 'solo';
  const cats = Object.entries(app.library.categories);
  const perso = o.difficulty === 'perso'
    ? `<div class="field"><span class="label">Niveaux</span><div class="check-grid">
        ${[1, 2, 3].map((l) => `<button class="check" data-level="${l}" aria-pressed="${o.customLevels.includes(l)}"><span class="box"></span>${LEVELS[l]}</button>`).join('')}
      </div></div>
      <div class="field"><span class="label">Thèmes</span><div class="check-grid">
        ${cats.map(([id, label]) => `<button class="check" data-cat="${id}" aria-pressed="${!o.customCategories || o.customCategories.includes(id)}"><span class="box"></span>${esc(label)}</button>`).join('')}
        ${app.custom.length ? `<button class="check" data-cat="perso" aria-pressed="${!o.customCategories || o.customCategories.includes('perso')}"><span class="box"></span>Cartes perso</button>` : ''}
      </div></div>`
    : '';
  return `<section class="panel"><div class="head">Les cartes</div><div class="body">
      ${seg('difficulty', o.difficulty, Object.entries(DIFFICULTIES).map(([k, v]) => [k, v.label]))}
      <p class="hint">${esc(DIFFICULTIES[o.difficulty].hint)} · <b>${fmtNumber(count)}</b> cartes disponibles. <span class="tag app">Option de l’application</span></p>
      ${perso}
      ${count < 30 ? '<div class="warn small">Très peu de cartes avec ces réglages.</div>' : ''}
    </div></section>
    <section class="panel"><div class="head">Le sablier</div><div class="body">
      ${seg('duration', o.duration, [[30, '30 s'], [45, '45 s'], [60, '60 s'], [90, '90 s'], [120, '2 min']])}
      <p class="hint">Le livret utilise un sablier sans durée chiffrée : 60 s est le réglage par défaut de l’application.</p>
    </div></section>
    <section class="panel"><div class="head">Durée de la partie</div><div class="body">
      <div class="row between">
        <span>Tours par joueur<br><span class="hint">comme donneur d’indices</span></span>
        <div class="stepper">
          <button class="icon-btn" data-act="tminus" aria-label="Moins" ${o.turnsPerPlayer <= 1 ? 'disabled' : ''}>${icons.minus}</button>
          <span class="val">${o.turnsPerPlayer}</span>
          <button class="icon-btn" data-act="tplus" aria-label="Plus" ${o.turnsPerPlayer >= 6 ? 'disabled' : ''}>${icons.plus}</button>
        </div>
      </div>
      <p class="hint">Livret : la partie s’arrête quand tous les joueurs ont été donneurs le même nombre de fois ; en cas d’égalité, on continue.</p>
    </div></section>
    ${solo ? '' : `<section class="panel"><div class="head">Dé défi</div><div class="body">
      ${seg('dice', o.dice, [['off', 'Classique'], ['random', 'Dé aléatoire'], ['manual', 'Défi au choix']])}
      <p class="hint">${o.dice === 'off' ? 'Règles classiques, sans défi (mode par défaut).' : o.dice === 'random' ? 'Un défi est tiré au sort avant chaque tour, chaque face ayant la même chance.' : 'Le défi est choisi avant chaque tour.'}</p>
    </div></section>
    <section class="panel"><div class="head">Qui commence ?</div><div class="body">
      ${seg('startTeam', o.startTeam, [['A', d.teamNames[0]], ['B', d.teamNames[1]], ['random', 'Au hasard']])}
    </div></section>`}`;
}

export function render(app) {
  if (!draft || app.params.reset) draft = freshDraft(app);
  const d = draft;
  const titles = ['Les joueurs', 'Les équipes', 'Les réglages'];
  const body = d.step === 1 ? stepPlayers(d) : d.step === 2 ? stepTeams(app, d) : stepOptions(app, d);
  const canNext = d.step !== 2 || modeForCount(d.players.length) === 'solo' || !checkTeams(d.split || [[], []]).length;
  return `<main class="screen">
    ${topbar(titles[d.step - 1], { back: '' , right: '' }).replace('<span class="spacer"></span>', `<button class="icon-btn" data-act="back" aria-label="Retour">${icons.back}</button>`)}
    <div class="steps">${[1, 2, 3].map((i) => `<span class="${i <= d.step ? 'on' : ''}"></span>`).join('')}</div>
    ${body}
    <div style="flex:1"></div>
    ${d.step < 3
      ? `<button class="btn primary block" data-act="next" ${canNext ? '' : 'disabled'}>Continuer</button>`
      : `<button class="btn primary block" data-act="start">${icons.play} C’est parti !</button>`}
  </main>`;
}

function readNames(root) {
  root.querySelectorAll('[data-name]').forEach((input) => {
    const p = draft.players.find((x) => x.id === input.dataset.name);
    if (p) p.name = input.value;
  });
  root.querySelectorAll('[data-team-name]').forEach((input) => {
    draft.teamNames[Number(input.dataset.teamName)] = input.value.trim() || TEAM_STYLES[Number(input.dataset.teamName)].name;
  });
}

export function mount(app, root) {
  const d = draft;
  const rerender = () => {
    readNames(root);
    app.go('setup');
  };

  root.addEventListener('input', (e) => {
    if (e.target.matches('[data-name], [data-team-name]')) readNames(root);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('[data-name]')) return;
    const inputs = [...root.querySelectorAll('[data-name]')];
    const i = inputs.indexOf(e.target);
    if (inputs[i + 1]) inputs[i + 1].focus();
    else e.target.blur();
  });

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const act = t.dataset.act;
    const o = d.opts;
    if (act === 'back') {
      readNames(root);
      if (d.step > 1) {
        d.step -= 1;
        app.go('setup');
      } else app.go('home');
    } else if (act === 'plus' && d.players.length < MAX_PLAYERS) {
      readNames(root);
      d.players.push({ id: makePlayerId(), name: '' });
      app.go('setup');
      const inputs = root.querySelectorAll('[data-name]');
      inputs[inputs.length - 1]?.focus();
    } else if (act === 'minus' && d.players.length > 2) {
      readNames(root);
      d.players.pop();
      app.go('setup');
    } else if (t.dataset.remove) {
      readNames(root);
      d.players = d.players.filter((p) => p.id !== t.dataset.remove);
      app.go('setup');
    } else if (act === 'next') {
      readNames(root);
      if (d.step === 1) {
        const cleaned = cleanNames(d.players.map((p) => p.name));
        d.players.forEach((p, i) => (p.name = cleaned[i]));
      }
      d.step += 1;
      app.go('setup');
    } else if (t.dataset.move) {
      d.split = movePlayer(d.split, t.dataset.move);
      rerender();
    } else if (act === 'shuffle') {
      d.split = null;
      rerender();
    } else if (t.dataset.seg) {
      o[t.dataset.seg] = segValue(t);
      rerender();
    } else if (t.dataset.level) {
      const l = Number(t.dataset.level);
      o.customLevels = o.customLevels.includes(l) ? o.customLevels.filter((x) => x !== l) : [...o.customLevels, l];
      if (!o.customLevels.length) o.customLevels = [l];
      rerender();
    } else if (t.dataset.cat) {
      const all = [...Object.keys(app.library.categories), ...(app.custom.length ? ['perso'] : [])];
      let cur = o.customCategories || all;
      cur = cur.includes(t.dataset.cat) ? cur.filter((x) => x !== t.dataset.cat) : [...cur, t.dataset.cat];
      if (!cur.length) cur = [t.dataset.cat];
      o.customCategories = cur.length === all.length ? null : cur;
      rerender();
    } else if (act === 'tminus' || act === 'tplus') {
      o.turnsPerPlayer = Math.min(6, Math.max(1, o.turnsPerPlayer + (act === 'tplus' ? 1 : -1)));
      rerender();
    } else if (act === 'start') {
      start(app);
    }
  });
}

function start(app) {
  const d = draft;
  const o = d.opts;
  if (!app.eligible({ ...app.settings, ...o }).length) {
    toast('Aucune carte ne correspond à ces réglages.');
    return;
  }
  const mode = modeForCount(d.players.length);
  // Les réglages choisis deviennent ceux par défaut de la prochaine partie.
  app.saveSettings({
    difficulty: o.difficulty,
    customLevels: o.customLevels,
    customCategories: o.customCategories,
    duration: o.duration,
    turnsPerPlayer: o.turnsPerPlayer,
    dice: o.dice,
    lastPlayers: d.players.map((p) => p.name),
  });
  const startTeam = o.startTeam === 'random' ? ['A', 'B'][randomInt(2)] : o.startTeam;
  const teams = mode === 'teams'
    ? TEAM_STYLES.map((t, i) => ({ ...t, name: d.teamNames[i], players: d.split[i] }))
    : undefined;
  const s = app.settings;
  app.startGame({
    players: d.players.map((p) => ({ id: p.id, name: p.name })),
    teams,
    mode,
    rules: {
      duration: o.duration,
      turnsPerPlayer: o.turnsPerPlayer,
      dice: o.dice,
      everyoneScoring: s.everyoneScoring,
      overtime: s.overtime,
      startTeam,
    },
  });
  draft = null;
}
