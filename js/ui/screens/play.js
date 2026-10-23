// Écran de jeu : carte, chronomètre, boutons Deviné / Passer / Buzzer.
import { esc, fitText, fmtTime } from '../dom.js';
import { icons, challengeIcon } from '../icons.js';
import { cardHTML, nameOf, sideName, teamOf, RESULT_LABELS, theTeam } from '../parts.js';
import * as G from '../../engine/game.js';
import { remainingMs, isRunning } from '../../engine/timer.js';
import { CHALLENGES } from '../../engine/challenges.js';
import { sound, haptic, keepAwake } from '../fx.js';

const MIN_GAP_MS = 250; // évite qu'un double appui valide deux cartes d'un coup
let view = null;

function scoreChips(g) {
  const live = G.liveScores(g);
  if (g.mode === 'solo') {
    return `<span class="team-S"><span class="sc" data-sc="${g.turn.giver}">${live[g.turn.giver]}</span></span>`;
  }
  return g.teams
    .map((t) => `<span class="team-${t.id}"><span class="sc" data-sc="${t.id}" aria-label="${esc(t.name)}">${live[t.id]}</span></span>`)
    .join('<span class="muted">–</span>');
}

function controls(app) {
  const g = app.game;
  const t = g.turn;
  const left = app.settings.buzzerSide === 'left';
  const watchers = g.mode === 'solo' ? 'mot interdit' : esc(teamOf(g, G.opponentOf(g, t.teamId)).name.replace(/^Équipe /, ''));
  const pass = `<button class="act pass" data-res="passed">${icons.skip} Passer</button>`;
  if (t.challenge === 'everyone') {
    // Grille 2 × 2 : les deux équipes peuvent trouver, le buzzer reste du côté de l'adversaire.
    const found = g.teams
      .map((tm) => `<button class="act team${tm.id}" data-res="${tm.id === t.teamId ? 'guessed' : 'stolen'}">${icons.check}<span>${esc(tm.name.replace(/^Équipe /, ''))}</span></button>`)
      .join('');
    const buzz = `<button class="buzzer pill" data-res="buzzed" aria-label="Buzzer">BUZZ<small>${watchers}</small></button>`;
    return `<div class="controls everyone-mode">${found}${left ? buzz + pass : pass + buzz}</div>`;
  }
  return `<div class="controls ${left ? 'buzz-left' : ''}">
    <div class="giver-col">
      <button class="act ok" data-res="guessed">${icons.check} Deviné</button>
      ${pass}
    </div>
    <div class="buzz-col"><button class="buzzer" data-res="buzzed" aria-label="Buzzer">BUZZ<small>${watchers}</small></button></div>
  </div>`;
}

function banner(g) {
  const t = g.turn;
  if (t.challenge === 'classic') return '';
  const c = CHALLENGES[t.challenge];
  const opp = G.opponentOf(g, t.teamId);
  const text = {
    tete: `seul <b style="font-family:inherit;text-transform:none;color:inherit">${nameOf(g, t.guesser)}</b> peut répondre.`,
    double: 'temps doublé pour ce tour.',
    statue: `donneur immobile ! ${opp ? esc(theTeam(teamOf(g, opp).name)) : 'les autres'} touche les boutons.`,
    everyone: 'touchez l’équipe qui a trouvé.',
  }[t.challenge];
  return `<div class="banner ${t.challenge}">${challengeIcon(t.challenge)}<div><b>${esc(c.name)}</b> · ${text}</div></div>`;
}

export function render(app) {
  const g = app.game;
  const t = g.turn;
  const card = t.current ? app.byId.get(t.current) : null;
  return `<main class="screen play team-${t.teamId}">
    <div class="screen-flash" id="flash"></div>
    <header class="play-head">
      <div class="who">
        <span class="team-pill">${g.mode === 'solo' ? 'Chacun pour soi' : esc(sideName(g, t.teamId))}</span>
        <div class="giver">${nameOf(g, t.giver)} fait deviner</div>
      </div>
      <div class="live-score">${scoreChips(g)}</div>
      <button class="icon-btn" data-act="pause" aria-label="Pause">${icons.pause}</button>
    </header>
    <div class="timer" id="timer">
      <div class="digits" id="digits">${fmtTime(t.clock ? remainingMs(t.clock, Date.now()) : g.rules.duration * 1000)}</div>
      <div class="bar"><div class="fill" id="fill"></div></div>
    </div>
    ${banner(g)}
    <div class="card-zone" id="zone">
      ${card ? cardHTML(card, app.categoryLabel(card.category)) : ''}
      <div class="card-tools"><button class="icon-btn" data-act="hide" aria-label="Masquer la carte">${icons.eyeOff}</button></div>
    </div>
    <div class="undo-row">
      <span class="last" id="last"></span>
      <button class="undo-btn" data-act="undo" ${t.cards.length ? '' : 'disabled'}>${icons.undo} Annuler</button>
    </div>
    ${controls(app)}
  </main>`;
}

/** Ajuste le mot principal à la largeur, puis les cinq interdits à la hauteur restante. */
function fitWord(root) {
  const card = root.querySelector('.tcard:not([class*="exit"])');
  if (!card) return;
  const band = card.querySelector('.word');
  if (band) {
    fitText(band, 46, 24);
    // Expression longue : le bandeau ne dépasse pas un tiers de la carte.
    let size = parseFloat(band.style.fontSize);
    while (size > 24 && band.offsetHeight > card.clientHeight * 0.34) {
      size -= 2;
      band.style.fontSize = `${size}px`;
    }
  }
  const ul = card.querySelector('.taboo');
  if (!ul) return;
  const items = [...ul.children];
  for (let size = 28; size >= 13; size -= 1) {
    for (const li of items) {
      li.style.fontSize = `${size}px`;
      li.style.paddingBlock = `${Math.max(2, Math.round(size / 5))}px`;
    }
    if (ul.scrollHeight <= ul.clientHeight + 1) break;
  }
}

function updateScores(root, g, delta) {
  const live = G.liveScores(g);
  root.querySelectorAll('[data-sc]').forEach((el) => {
    const id = el.dataset.sc;
    const before = Number(el.textContent);
    el.textContent = live[id] ?? 0;
    if (delta && live[id] > before) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
      const plus = document.createElement('span');
      plus.className = 'plus-one';
      plus.textContent = `+${live[id] - before}`;
      el.appendChild(plus);
      setTimeout(() => plus.remove(), 800);
    }
  });
}

function showCard(app, root, exitResult) {
  const zone = root.querySelector('#zone');
  const old = zone.querySelector('.tcard:not([class*="exit"])');
  if (old && exitResult) {
    const stamp = document.createElement('div');
    stamp.className = `stamp ${exitResult}`;
    stamp.textContent = { guessed: 'Deviné', stolen: 'Trouvé', passed: 'Passé', buzzed: 'Buzz !' }[exitResult];
    old.appendChild(stamp);
    old.classList.remove('enter');
    old.classList.add(`exit-${exitResult}`);
    setTimeout(() => old.remove(), 520);
  } else if (old) old.remove();
  const id = app.game.turn.current;
  const card = id ? app.byId.get(id) : null;
  const tpl = document.createElement('template');
  tpl.innerHTML = cardHTML(card, card ? app.categoryLabel(card.category) : '');
  zone.insertBefore(tpl.content.firstElementChild, zone.querySelector('.card-tools'));
  fitWord(root);
}

function setLast(root, g) {
  const last = g.turn.cards[g.turn.cards.length - 1];
  const el = root.querySelector('#last');
  const undo = root.querySelector('[data-act="undo"]');
  undo.disabled = !g.turn.cards.length;
  if (!last) {
    el.textContent = '';
    return;
  }
  el.textContent = '';
  const word = document.createElement('b');
  word.textContent = view.app.byId.get(last.id)?.word ?? '';
  el.append(word, ` · ${RESULT_LABELS[last.result]}`);
}

function tick(app, root) {
  if (!view || view.root !== root) return;
  const g = app.game;
  if (g.phase !== 'playing') return;
  const now = Date.now();
  const rem = remainingMs(g.turn.clock, now);
  const total = g.turn.clock.durationMs;
  const timer = root.querySelector('#timer');
  root.querySelector('#digits').textContent = fmtTime(rem);
  root.querySelector('#fill').style.transform = `scaleX(${rem / total})`;
  const secs = Math.ceil(rem / 1000);
  timer.classList.toggle('warn', rem <= 20000 && rem > 10000);
  timer.classList.toggle('danger', rem <= 10000);
  timer.classList.toggle('paused', !isRunning(g.turn.clock));
  root.querySelector('#flash').classList.toggle('danger', rem <= 5000 && isRunning(g.turn.clock));
  if (isRunning(g.turn.clock) && secs !== view.lastSec) {
    if (secs <= 5 && secs > 0) sound(secs <= 3 ? 'tickLast' : 'tick');
    view.lastSec = secs;
  }
  if (rem <= 0) {
    finish(app, root);
    return;
  }
  view.raf = requestAnimationFrame(() => tick(app, root));
}

/** Fin du temps : aucun appui n'est plus accepté, puis récapitulatif. */
function finish(app, root) {
  if (view.finished) return;
  view.finished = true;
  app.setGame(G.expire(app.game, Date.now()));
  sound('timeUp');
  haptic('end');
  keepAwake(false);
  root.querySelectorAll('.act, .buzzer, [data-act="undo"]').forEach((b) => (b.disabled = true));
  const ov = document.createElement('div');
  ov.className = 'countdown';
  ov.innerHTML = '<span style="font-size:64px;text-align:center;line-height:1.1">Temps<br>écoulé !</span>';
  document.body.appendChild(ov);
  setTimeout(() => {
    ov.remove();
    if (app.screen === 'play') app.go('review');
  }, 1300);
}

function act(app, root, result, btn) {
  const now = Date.now();
  if (now - view.lastAction < MIN_GAP_MS) return;
  view.lastAction = now;
  const r = G.cardAction(app.game, result, now);
  if (!r.accepted) {
    if (r.game.phase === 'review') {
      app.game = r.game;
      finish(app, root);
    }
    return;
  }
  app.setGame(r.game);
  app.ensurePile();
  if (result === 'buzzed') {
    btn.classList.remove('pressed');
    void btn.offsetWidth;
    btn.classList.add('pressed');
    const flash = root.querySelector('#flash');
    flash.classList.remove('buzz');
    void flash.offsetWidth;
    flash.classList.add('buzz');
    haptic('buzz');
  } else haptic(result === 'passed' ? 'pass' : 'ok');
  sound(result);
  showCard(app, root, result);
  updateScores(root, app.game, true);
  setLast(root, app.game);
}

function undo(app, root) {
  const g = G.undoAction(app.game, Date.now());
  if (g === app.game) return;
  app.setGame(g);
  sound('tap');
  showCard(app, root, null);
  updateScores(root, g, false);
  setLast(root, g);
}

function pauseMenu(app, root) {
  app.setGame(G.pauseTurn(app.game, Date.now()));
  keepAwake(false);
  document.querySelector('.overlay.pause')?.remove();
  const el = document.createElement('div');
  el.className = 'overlay pause';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
    <h2>Pause</h2>
    <p class="center muted">Le sablier est arrêté. ${fmtTime(remainingMs(app.game.turn.clock, Date.now()))} restantes.</p>
    <button class="btn primary block" data-p="resume">${icons.play} Reprendre le tour</button>
    <button class="btn block" data-p="board">${icons.trophy} Tableau des scores</button>
    <button class="btn block" data-p="rules">${icons.rules} Règles</button>
    <button class="btn block" data-p="home">${icons.home} Accueil (partie sauvegardée)</button>
  </div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    el.remove();
    if (b.dataset.p === 'resume') resume(app, root);
    else if (b.dataset.p === 'board') app.go('board', { from: 'play' });
    else if (b.dataset.p === 'rules') app.go('rules', { from: 'play' });
    else app.go('home');
  });
  document.body.appendChild(el);
  tick(app, root);
}

function resume(app, root) {
  app.setGame(G.resumeTurn(app.game, Date.now()));
  keepAwake(true);
  cancelAnimationFrame(view.raf);
  tick(app, root);
}

function countdown(app, root, then) {
  const ov = document.createElement('div');
  ov.className = 'countdown';
  document.body.appendChild(ov);
  let n = 3;
  const step = () => {
    if (!view || view.root !== root) return ov.remove();
    if (n === 0) {
      ov.remove();
      then();
      return;
    }
    ov.innerHTML = `<span>${n}</span>`;
    sound('count');
    n -= 1;
    view.cd = setTimeout(step, 800);
  };
  step();
}

export function mount(app, root, params) {
  view = { app, root, raf: 0, lastSec: null, lastAction: 0, finished: false, cd: 0 };
  fitWord(root);

  const begin = () => {
    app.setGame(G.startTurn(app.game, Date.now()));
    app.ensurePile();
    sound('start');
    keepAwake(true);
    showCard(app, root, null);
    tick(app, root);
  };

  if (app.game.phase === 'intro') {
    root.querySelector('#zone .tcard')?.remove();
    if (params.countdown) countdown(app, root, begin);
    else begin();
  } else if (app.game.phase === 'playing') {
    if (!isRunning(app.game.turn.clock)) pauseMenu(app, root);
    else {
      keepAwake(true);
      tick(app, root);
    }
    setLast(root, app.game);
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.res) {
      if (app.game.phase !== 'playing' || !isRunning(app.game.turn.clock)) return;
      act(app, root, b.dataset.res, b);
    } else if (b.dataset.act === 'undo') undo(app, root);
    else if (b.dataset.act === 'pause') pauseMenu(app, root);
    else if (b.dataset.act === 'hide') toggleCover(root, b);
  });

  return () => {
    cancelAnimationFrame(view.raf);
    clearTimeout(view.cd);
    document.querySelectorAll('.countdown, .overlay.pause').forEach((el) => el.remove());
    view = null;
  };
}

function toggleCover(root, btn) {
  const zone = root.querySelector('#zone');
  const cover = zone.querySelector('.cover');
  if (cover) {
    cover.remove();
    btn.innerHTML = icons.eyeOff;
    return;
  }
  const el = document.createElement('div');
  el.className = 'cover';
  el.innerHTML = `<div>${icons.eye}Carte masquée<br><span class="small" style="font-weight:500">Touchez pour l’afficher</span></div>`;
  el.addEventListener('click', () => toggleCover(root, btn));
  zone.appendChild(el);
  btn.innerHTML = icons.eye;
}

// ——— Arrière-plan (appelés par app.js) ———

export function onHidden(app) {
  if (app.screen !== 'play' || !app.game || app.game.phase !== 'playing') return;
  if (app.settings.background === 'pause') app.setGame(G.pauseTurn(app.game, Date.now()));
}

export function onVisible(app) {
  if (!view || app.screen !== 'play' || app.game.phase !== 'playing') return;
  if (!isRunning(app.game.turn.clock)) {
    if (!document.querySelector('.overlay.pause')) pauseMenu(app, view.root);
  } else {
    keepAwake(true);
    cancelAnimationFrame(view.raf);
    tick(app, view.root);
  }
}
