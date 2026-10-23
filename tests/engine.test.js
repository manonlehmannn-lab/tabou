// Tests du moteur de règles, indépendants de l'interface.
import { test, assert, eq, throws } from './harness.js';
import * as G from '../js/engine/game.js';
import { balancedSplit, checkTeams, cleanNames, modeForCount, movePlayer } from '../js/engine/teams.js';
import { allowedChallenges, rollChallenge, DIE_FACES } from '../js/engine/challenges.js';
import { pointsFor } from '../js/engine/scoring.js';
import * as T from '../js/engine/timer.js';
import { buildPile, parseImport, validateCard, cleanCard, recordCard, eligibleCards } from '../js/engine/deck.js';
import { createStorage, summarizeGame } from '../js/engine/storage.js';
import { setRandomSource, seeded } from '../js/engine/random.js';

setRandomSource(seeded(42));

const SEC = 1000;
const pileOf = (n) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

/** Partie en équipes : sizes = [taille A, taille B]. */
function newGame(sizes, rules = {}, pile = pileOf(2000)) {
  const players = [];
  const teams = [
    { id: 'A', name: 'Violets', color: 'violet', players: [] },
    { id: 'B', name: 'Corail', color: 'corail', players: [] },
  ];
  sizes.forEach((n, ti) => {
    for (let i = 0; i < n; i++) {
      const id = `${teams[ti].id}${i + 1}`;
      players.push({ id, name: id });
      teams[ti].players.push(id);
    }
  });
  return G.createGame({ players, teams, rules, pile, now: 0 });
}

let clock = 1_000_000;
/** Joue un tour complet : actions espacées d'une seconde, puis fin du temps et validation. */
function playTurn(game, actions = [], { validate = true } = {}) {
  let g = game;
  if (g.turn.challenge === 'tete' && !g.turn.guesser) {
    g = G.setGuesser(g, G.team(g, g.turn.teamId).players.find((id) => id !== g.turn.giver));
  }
  g = G.startTurn(g, clock);
  const start = clock;
  for (const a of actions) {
    clock += SEC;
    const r = G.cardAction(g, a, clock);
    assert(r.accepted, `action ${a} refusée`);
    g = r.game;
  }
  clock = start + g.turn.clock.durationMs;
  g = G.expire(g, clock);
  eq(g.phase, 'review', 'le tour doit se terminer à zéro');
  return validate ? G.validateTurn(g, clock) : g;
}

function playUntilOver(game, actionsFor = () => ['guessed']) {
  let g = game;
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 500) g = playTurn(g, actionsFor(g));
  assert(g.phase === 'over', 'la partie devait se terminer');
  return g;
}

const turnsOf = (g) => Object.values(g.players).map((p) => p.turns);

// ——— Équipes ———

test('répartition automatique équilibrée de 4 à 12 joueurs', () => {
  for (let n = 4; n <= 12; n++) {
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    const [a, b] = balancedSplit(ids);
    assert(Math.abs(a.length - b.length) <= 1, `${n} joueurs : ${a.length}/${b.length}`);
    eq([...a, ...b].sort(), ids.slice().sort(), 'aucun joueur perdu');
    eq(checkTeams([a, b]), []);
  }
});

test('modification manuelle des équipes et contrôle de taille minimale', () => {
  let teams = [['a', 'b'], ['c', 'd']];
  teams = movePlayer(teams, 'a');
  eq(teams, [['b'], ['c', 'd', 'a']]);
  assert(checkTeams(teams).length === 1, 'une équipe d’un joueur est refusée');
});

test('prénoms nettoyés, vides remplacés et doublons numérotés', () => {
  eq(cleanNames(['  Alice ', '', 'alice']), ['Alice', 'Joueur 2', 'alice 2']);
  eq(modeForCount(4), 'teams');
  eq(modeForCount(3), 'solo');
  eq(modeForCount(1), null);
});

// ——— Barème du livret ———

test('mot deviné : 1 point pour l’équipe active', () => {
  let g = G.startTurn(newGame([2, 2]), 0);
  g = G.cardAction(g, 'guessed', SEC).game;
  eq(G.liveScores(g), { A: 1, B: 0 });
});

test('carte passée : 1 point pour l’équipe adverse', () => {
  let g = G.startTurn(newGame([2, 2]), 0);
  g = G.cardAction(g, 'passed', SEC).game;
  eq(G.liveScores(g), { A: 0, B: 1 });
});

test('carte buzzée : 1 point pour l’équipe adverse', () => {
  let g = G.startTurn(newGame([2, 2]), 0);
  g = G.cardAction(g, 'buzzed', SEC).game;
  eq(G.liveScores(g), { A: 0, B: 1 });
});

test('passage immédiat à la carte suivante après chaque action', () => {
  let g = G.startTurn(newGame([2, 2]), 0);
  eq(g.turn.current, 'c1');
  for (const [i, a] of ['guessed', 'passed', 'buzzed'].entries()) {
    g = G.cardAction(g, a, (i + 1) * SEC).game;
    eq(g.turn.current, `c${i + 2}`, `après ${a}`);
  }
});

test('les points du tour sont ajoutés au score à la validation', () => {
  let g = newGame([2, 2]);
  g = playTurn(g, ['guessed', 'guessed', 'passed', 'buzzed', 'guessed']);
  eq(g.scores, { A: 3, B: 2 });
  eq(g.history[0].points, { A: 3, B: 2 });
});

// ——— Chronomètre ———

test('fin automatique du tour à zéro et carte en cours non comptée', () => {
  let g = G.startTurn(newGame([2, 2]), 0);
  g = G.cardAction(g, 'guessed', 10 * SEC).game;
  const r = G.cardAction(g, 'guessed', 60 * SEC);
  assert(!r.accepted, 'aucune carte validée à zéro');
  eq(r.game.phase, 'review');
  eq(r.game.turn.cards.map((c) => c.result), ['guessed', 'unplayed']);
  eq(G.liveScores(r.game), { A: 1, B: 0 });
});

test('règle temporelle déterministe : action et fin simultanées → la fin l’emporte', () => {
  const c = T.start(T.createClock(60 * SEC), 0);
  assert(T.acceptsAction(c, 60 * SEC - 1), '1 ms avant la fin : acceptée');
  assert(!T.acceptsAction(c, 60 * SEC), 'à l’instant exact de la fin : refusée');
});

test('pause et reprise du chronomètre', () => {
  let c = T.start(T.createClock(60 * SEC), 0);
  c = T.pause(c, 20 * SEC);
  eq(T.remainingMs(c, 500 * SEC), 40 * SEC, 'en pause, le temps ne s’écoule pas');
  c = T.start(c, 500 * SEC);
  eq(T.remainingMs(c, 510 * SEC), 30 * SEC);
});

test('annulation de la dernière action', () => {
  let g = G.startTurn(newGame([2, 2]), 0);
  g = G.cardAction(g, 'buzzed', SEC).game;
  eq(g.turn.current, 'c2');
  g = G.undoAction(g, 2 * SEC);
  eq(g.turn.current, 'c1', 'la carte annulée revient');
  eq(g.turn.cards, []);
  eq(g.pile[0], 'c2', 'la carte suivante retourne sur la pioche');
  eq(G.liveScores(g), { A: 0, B: 0 });
});

test('correction du résultat après le tour, avec historique des modifications', () => {
  let g = playTurn(newGame([2, 2]), ['passed', 'guessed'], { validate: false });
  g = G.correctCard(g, 0, 'guessed', 5);
  eq(g.turn.corrections.length, 1);
  eq(g.turn.corrections[0].from, 'passed');
  g = G.validateTurn(g);
  eq(g.scores, { A: 2, B: 0 });
});

// ——— Rotation et fin de partie ———

test('rotation des donneurs d’indices et alternance des équipes', () => {
  let g = newGame([3, 3], { turnsPerPlayer: 2 });
  const seq = [];
  while (g.phase !== 'over') {
    seq.push(`${g.turn.teamId}:${g.turn.giver}`);
    g = playTurn(g, g.turn.teamId === 'A' ? ['guessed'] : []);
  }
  eq(seq.slice(0, 6), ['A:A1', 'B:B1', 'A:A2', 'B:B2', 'A:A3', 'B:B3']);
  eq(seq.slice(6, 12), ['A:A1', 'B:B1', 'A:A2', 'B:B2', 'A:A3', 'B:B3']);
  eq(seq.length, 12);
});

for (const [n, sizes] of [[4, [2, 2]], [5, [3, 2]], [6, [3, 3]], [8, [4, 4]], [9, [5, 4]]]) {
  test(`partie complète à ${n} joueurs (${sizes.join(' contre ')})`, () => {
    let g = newGame(sizes, { turnsPerPlayer: 2 });
    // L'équipe A devine deux mots par tour, l'équipe B un seul : A gagne.
    g = playUntilOver(g, (gg) => (gg.turn.teamId === 'A' ? ['guessed', 'guessed'] : ['guessed']));
    eq(g.winner, 'A');
    const big = Math.max(...sizes);
    eq(g.history.length, 2 * 2 * big, 'chaque équipe joue k × (plus grande équipe) tours');
    const perTeam = (id) => g.history.filter((t) => t.teamId === id).length;
    eq(perTeam('A'), perTeam('B'), 'les deux équipes jouent autant de tours');
    if (sizes[0] === sizes[1]) {
      assert(turnsOf(g).every((t) => t === 2), 'livret : chaque joueur donneur le même nombre de fois');
    }
  });
}

test('équipes inégales : chacun au moins k passages, écart d’au plus 1 dans une équipe', () => {
  let g = newGame([4, 2], { turnsPerPlayer: 1 });
  g = playUntilOver(g, (gg) => (gg.turn.teamId === 'B' ? ['guessed'] : []));
  const a = G.team(g, 'A').players.map((id) => g.players[id].turns);
  const b = G.team(g, 'B').players.map((id) => g.players[id].turns);
  eq(a, [1, 1, 1, 1]);
  eq(b, [2, 2]);
  eq(g.winner, 'B');
});

test('victoire après répartition équitable des tours, pas avant', () => {
  let g = newGame([2, 2], { turnsPerPlayer: 1 });
  g = playTurn(g, Array(10).fill('guessed')); // A mène 10 à 0
  eq(g.phase, 'intro', 'pas de victoire anticipée à un score arbitraire');
  g = playTurn(g, []);
  g = playTurn(g, []);
  eq(g.phase, 'intro');
  g = playTurn(g, []);
  eq(g.phase, 'over');
  eq(g.winner, 'A');
  assert(turnsOf(g).every((t) => t === 1));
});

test('égalité en fin de partie → prolongation par série complète (livret : on continue)', () => {
  let g = newGame([2, 2], { turnsPerPlayer: 1 });
  for (let i = 0; i < 4; i++) g = playTurn(g, ['guessed']);
  eq(g.phase, 'intro', 'égalité 2-2 : la partie continue');
  eq(g.overtime, 1);
  eq(G.progress(g), { played: 0, total: 4, overtime: 1 });
  g = playTurn(g, ['guessed', 'guessed']);
  eq(g.phase, 'intro', 'la prolongation se joue jusqu’au bout de la série');
  for (let i = 0; i < 3; i++) g = playTurn(g, []);
  eq(g.phase, 'over');
  eq(g.winner, 'A');
  assert(turnsOf(g).every((t) => t === 2), 'après prolongation, tous les joueurs restent à égalité de passages');
});

test('prolongation courte (un tour par équipe) quand les joueurs la choisissent', () => {
  let g = newGame([2, 2], { turnsPerPlayer: 1, overtime: 'single' });
  for (let i = 0; i < 4; i++) g = playTurn(g, []);
  eq(g.overtime, 1);
  g = playTurn(g, []);
  g = playTurn(g, []);
  eq(g.overtime, 2, 'toujours à égalité : nouvelle prolongation');
  g = playTurn(g, ['passed']);
  g = playTurn(g, []);
  eq(g.phase, 'over');
  eq(g.winner, 'B');
});

// ——— Dé défi ———

test('tirage du dé équitable sur les cinq faces', () => {
  setRandomSource(seeded(7));
  const counts = Object.fromEntries(DIE_FACES.map((f) => [f, 0]));
  const N = 50000;
  for (let i = 0; i < N; i++) counts[rollChallenge(DIE_FACES)]++;
  for (const f of DIE_FACES) assert(Math.abs(counts[f] / N - 0.2) < 0.01, `${f} : ${counts[f]}`);
  setRandomSource(seeded(42));
});

test('défi tête-à-tête : un seul coéquipier désigné avant le départ', () => {
  let g = newGame([3, 3], { dice: 'manual' });
  g = G.chooseChallenge(g, 'tete');
  assert(!G.canStart(g), 'il faut désigner le joueur');
  throws(() => G.setGuesser(g, g.turn.giver), 'le donneur ne peut pas être le devineur');
  throws(() => G.setGuesser(g, 'B1'), 'un adversaire ne peut pas être le devineur');
  g = G.setGuesser(g, 'A2');
  assert(G.canStart(g));
  g = G.startTurn(g, 0);
  eq(g.turn.guesser, 'A2');
});

test('tête-à-tête à deux : le seul coéquipier est désigné d’office', () => {
  let g = G.chooseChallenge(newGame([2, 2], { dice: 'manual' }), 'tete');
  eq(g.turn.guesser, 'A2');
});

test('défi double sablier : durée doublée et compensation pour l’adversaire au tour suivant', () => {
  let g = newGame([2, 2], { dice: 'manual', duration: 60 });
  g = G.chooseChallenge(g, 'double');
  g = G.startTurn(g, 0);
  eq(g.turn.clock.durationMs, 120 * SEC);
  eq(g.pendingDouble, 'B', 'obligation mémorisée');
  g = G.validateTurn(G.expire(g, 120 * SEC), 120 * SEC);
  eq(g.turn.teamId, 'B');
  eq(g.turn.challenge, 'double');
  assert(g.turn.forced, 'défi imposé');
  g = G.chooseChallenge(g, 'classic');
  eq(g.turn.challenge, 'double', 'la compensation ne peut pas être remplacée');
  g = G.startTurn(g, 200 * SEC);
  eq(g.turn.clock.durationMs, 120 * SEC);
  eq(g.pendingDouble, null, 'la compensation n’en crée pas une autre');
  g = G.validateTurn(G.expire(g, 320 * SEC), 320 * SEC);
  eq(g.turn.forced, false);
});

test('double sablier compensé même avec le dé aléatoire', () => {
  let g = newGame([2, 2], { dice: 'random' });
  let seen = false;
  for (let i = 0; i < 200 && g.phase !== 'over'; i++) {
    const wasDouble = g.turn.challenge === 'double' && !g.turn.forced;
    const team = g.turn.teamId;
    g = playTurn(g, []);
    if (wasDouble && g.phase !== 'over') {
      seen = true;
      eq(g.turn.teamId !== team && g.turn.challenge, 'double');
    }
  }
  assert(seen, 'au moins un double sablier tiré');
});

test('double sablier jamais tiré au dernier tour d’une série (compensation impossible)', () => {
  eq(allowedChallenges({ isLastTurnOfSeries: true, guessers: 2 }).includes('double'), false);
  let g = newGame([2, 2], { dice: 'manual', turnsPerPlayer: 1 });
  for (let i = 0; i < 3; i++) g = playTurn(g, []);
  assert(G.isLastTurnOfSeries(g));
  throws(() => G.chooseChallenge(g, 'double'));
});

test('défi statue : le tour se joue normalement avec le défi affiché', () => {
  let g = G.chooseChallenge(newGame([2, 2], { dice: 'manual' }), 'statue');
  g = playTurn(g, ['guessed', 'buzzed']);
  eq(g.history[0].challenge, 'statue');
  eq(g.scores, { A: 1, B: 1 });
});

test('défi tout le monde joue : le point va à l’équipe qui trouve (convention par défaut)', () => {
  let g = G.chooseChallenge(newGame([2, 2], { dice: 'manual' }), 'everyone');
  g = playTurn(g, ['guessed', 'stolen', 'stolen', 'passed']);
  eq(g.scores, { A: 1, B: 3 });
});

test('défi tout le monde joue : convention « seule l’équipe active marque »', () => {
  let g = G.chooseChallenge(newGame([2, 2], { dice: 'manual', everyoneScoring: 'activeOnly' }), 'everyone');
  g = playTurn(g, ['guessed', 'stolen', 'passed']);
  eq(g.scores, { A: 1, B: 1 });
  eq(pointsFor('stolen', { active: 'A', opponent: 'B', everyoneScoring: 'activeOnly' }), {});
});

test('« trouvé par l’adversaire » refusé hors du défi tout le monde joue', () => {
  const g = G.startTurn(newGame([2, 2]), 0);
  throws(() => G.cardAction(g, 'stolen', SEC));
});

test('donneur remplaçable uniquement par un joueur ayant le moins de passages', () => {
  let g = newGame([3, 3]);
  eq(G.eligibleGivers(g), ['A1', 'A2', 'A3']);
  g = G.setGiver(g, 'A3');
  g = playTurn(g, []);
  g = playTurn(g, []);
  eq(g.turn.giver, 'A1');
  throws(() => G.setGiver(g, 'A3'), 'A3 a déjà joué');
});

// ——— Cartes ———

test('aucune carte ne réapparaît pendant une partie', () => {
  let g = newGame([4, 4], { turnsPerPlayer: 3 }, pileOf(3000));
  g = playUntilOver(g, (gg) => Array(gg.turn.teamId === 'A' ? 12 : 11).fill('guessed').concat(['passed', 'buzzed']));
  const ids = g.history.flatMap((t) => t.cards.map((c) => c.id));
  eq(new Set(ids).size, ids.length, 'cartes uniques');
});

test('pioche : cartes jamais jouées d’abord, puis les plus anciennes', () => {
  const cards = pileOf(6).map((id) => ({ id }));
  const stats = { c1: { seen: 1, last: 10 * 86400000 }, c2: { seen: 1, last: 1 * 86400000 } };
  const pile = buildPile(cards, stats);
  eq(pile.slice(0, 4).sort(), ['c3', 'c4', 'c5', 'c6']);
  eq(pile.slice(4), ['c2', 'c1']);
  eq(buildPile(cards, stats, ['c3', 'c4']).length, 4, 'exclusion des cartes de la partie');
});

test('filtre de difficulté et de thème', () => {
  const cards = [
    { id: 'a', level: 1, category: 'sport' },
    { id: 'b', level: 2, category: 'sport' },
    { id: 'c', level: 3, category: 'animaux' },
  ];
  eq(eligibleCards(cards, { levels: [1, 3] }).map((c) => c.id), ['a', 'c']);
  eq(eligibleCards(cards, { levels: null, categories: ['animaux'] }).map((c) => c.id), ['c']);
});

test('statistiques de cartes jouées', () => {
  let s = recordCard({}, 'x', 'guessed', 5);
  s = recordCard(s, 'x', 'buzzed', 9);
  eq(s.x, { seen: 2, last: 9, g: 1, p: 0, b: 1 });
});

test('validation et import de cartes personnalisées (JSON et CSV)', () => {
  eq(validateCard(cleanCard({ word: 'cowboy', taboo: ['chapeau', 'cheval', 'États-Unis', 'rodéo', 'ranch'] })), []);
  assert(validateCard(cleanCard({ word: 'Ferraille', taboo: ['Fer', 'Métal', 'Casse', 'Rouille', 'Vieux'] })).length > 0, 'règle « partie du mot »');
  assert(validateCard(cleanCard({ word: 'Ski', taboo: ['Neige'] })).length > 0, 'cinq mots obligatoires');
  const csv = 'mot;interdit1;interdit2;interdit3;interdit4;interdit5;niveau\nCowboy;Chapeau;Cheval;États-Unis;Rodéo;Ranch;1\nSki;Neige\n';
  const r = parseImport(csv, 'cartes.csv');
  eq(r.cards.length, 1);
  eq(r.cards[0].level, 1);
  eq(r.errors.length, 1);
  const j = parseImport(JSON.stringify([{ word: 'Pizza', taboo: ['Italie', 'Fromage', 'Tomate', 'Four', 'Pâte'], level: 1 }]), 'c.json');
  eq(j.cards[0].word, 'Pizza');
  eq(parseImport('{oups', 'x.json').cards.length, 0);
});

// ——— Sauvegarde ———

test('sauvegarde et reprise d’une partie après fermeture', () => {
  const mem = new Map();
  const backend = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  let g = newGame([3, 2], { dice: 'manual' });
  g = playTurn(g, ['guessed', 'passed']);
  g = G.chooseChallenge(g, 'double');
  g = G.startTurn(g, 0);
  g = G.cardAction(g, 'guessed', 5 * SEC).game;
  g = G.pauseTurn(g, 7 * SEC);
  createStorage(backend).saveGame(g);

  // « Fermeture » : nouvelle instance, lecture depuis le stockage.
  let r = createStorage(backend).loadGame();
  eq(r, JSON.parse(JSON.stringify(g)), 'état identique après rechargement');
  eq(T.remainingMs(r.turn.clock, 9999 * SEC), 113 * SEC, 'chrono suspendu conservé');
  r = G.resumeTurn(r, 100 * SEC);
  r = G.cardAction(r, 'guessed', 101 * SEC).game;
  eq(G.liveScores(r), { A: 1, B: 3 });
  eq(r.pendingDouble, 'A', 'défi en cours conservé');
  const used = new Set(r.used);
  assert(!r.pile.some((id) => used.has(id)), 'cartes tirées conservées');
});

test('une partie terminée n’est pas proposée à la reprise et alimente les statistiques', () => {
  const mem = new Map();
  const st = createStorage({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) });
  const g = playUntilOver(newGame([2, 2], { turnsPerPlayer: 1 }), (gg) => (gg.turn.teamId === 'B' ? ['guessed'] : []));
  st.saveGame(g);
  eq(st.loadGame(), null);
  const s = summarizeGame(g);
  eq(s.winnerName, 'Corail');
  eq(s.guessed, 2);
});

test('revanche avec les mêmes équipes : scores à zéro et l’autre équipe commence', () => {
  const g = playUntilOver(newGame([2, 2], { turnsPerPlayer: 1 }), (gg) => (gg.turn.teamId === 'A' ? ['guessed'] : []));
  const r = G.rematch(g, pileOf(50));
  eq(r.scores, { A: 0, B: 0 });
  eq(r.turn.teamId, 'B');
  eq(G.team(r, 'A').players, G.team(g, 'A').players);
});

// ——— Variante non officielle ———

test('variante chacun pour soi à 3 joueurs (non officielle)', () => {
  const players = ['x', 'y', 'z'].map((id) => ({ id, name: id }));
  let g = G.createGame({ players, mode: 'solo', rules: { turnsPerPlayer: 1, dice: 'random' }, pile: pileOf(100) });
  eq(g.rules.dice, 'off', 'pas de dé défi dans la variante');
  const givers = [];
  while (g.phase !== 'over') {
    givers.push(g.turn.giver);
    g = playTurn(g, g.turn.giver === 'y' ? ['guessed', 'guessed', 'passed'] : ['guessed']);
  }
  eq(givers, ['x', 'y', 'z']);
  eq(g.scores, { x: 1, y: 2, z: 1 });
  eq(g.winner, 'y');
});
