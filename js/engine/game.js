// Moteur de partie : état sérialisable et transitions pures (aucun accès au DOM).
//
// Règles du livret appliquées ici :
//  - deux équipes jouent à tour de rôle ; à chaque tour un donneur d'indices fait
//    deviner son équipe pendant que l'autre surveille et tient le buzzer ;
//  - 1 point à l'équipe active par mot deviné, 1 point à l'adversaire par carte
//    passée ou buzzée ;
//  - la partie s'arrête quand tous les joueurs ont été donneurs le même nombre de
//    fois ; l'équipe qui a le plus de points gagne ; en cas d'égalité, on continue.
//
// Choix de l'application (le livret ne les précise pas) :
//  - série équitable : chaque équipe joue k × (taille de la plus grande équipe)
//    tours, et le donneur tourne dans chaque équipe. Avec des équipes égales,
//    c'est exactement la règle du livret ; avec des équipes inégales, les deux
//    équipes ont autant de tours et chaque joueur est donneur au moins k fois ;
//  - prolongation en cas d'égalité : une nouvelle série complète (ou un tour par
//    équipe si les joueurs l'ont choisi), jusqu'au départage.
import { createClock, start, pause, remainingMs, acceptsAction, isExpired } from './timer.js';
import { allowedChallenges, rollChallenge, durationFor } from './challenges.js';
import { RESULTS, tallyTurn, addPoints } from './scoring.js';

export const GAME_VERSION = 1;

export const DEFAULT_RULES = {
  duration: 60, // secondes : choix de l'application, le livret utilise un sablier
  turnsPerPlayer: 2,
  dice: 'off', // 'off' | 'random' | 'manual'
  everyoneScoring: 'finder',
  overtime: 'series', // 'series' | 'single'
  startTeam: 'A',
};

/**
 * Crée une partie.
 * players : [{ id, name }]
 * teams : [{ id, name, color, players: [ids] }] (mode 'teams') ; ignoré en mode 'solo'
 */
export function createGame({ players, teams, mode = 'teams', rules = {}, pile = [], now = Date.now() }) {
  const r = { ...DEFAULT_RULES, ...rules };
  if (mode === 'solo') r.dice = 'off';
  const game = {
    version: GAME_VERSION,
    id: `g${now.toString(36)}`,
    createdAt: now,
    updatedAt: now,
    mode,
    rules: r,
    players: Object.fromEntries(players.map((p) => [p.id, { id: p.id, name: p.name, turns: 0 }])),
    teams:
      mode === 'teams'
        ? teams.map((t) => ({ id: t.id, name: t.name, color: t.color, players: t.players.slice(), queue: t.players.slice(), watchCursor: 0 }))
        : [{ id: 'S', name: 'Tous', color: 'violet', players: players.map((p) => p.id), queue: players.map((p) => p.id), watchCursor: 0 }],
    order: mode === 'teams' ? orderFrom(teams, r.startTeam) : ['S'],
    scores: mode === 'teams' ? Object.fromEntries(teams.map((t) => [t.id, 0])) : Object.fromEntries(players.map((p) => [p.id, 0])),
    pile: pile.slice(),
    used: [],
    history: [], // tours terminés
    seriesEnds: [], // index (nombre de tours joués) de fin de chaque série
    overtime: 0,
    pendingDouble: null, // équipe qui doit recevoir la compensation du double sablier
    phase: 'intro', // 'intro' | 'playing' | 'review' | 'over'
    turn: null,
    winner: null,
  };
  game.seriesEnds.push(seriesLength(game, false));
  game.turn = prepareTurn(game);
  return game;
}

function orderFrom(teams, startTeam) {
  const ids = teams.map((t) => t.id);
  return ids[0] === startTeam ? ids : ids.slice().reverse();
}

/** Nombre total de tours (toutes équipes) dans une série. */
export function seriesLength(game, isOvertime) {
  if (game.mode === 'solo') {
    const k = isOvertime ? 1 : game.rules.turnsPerPlayer;
    return k * game.teams[0].players.length;
  }
  const biggest = Math.max(...game.teams.map((t) => t.players.length));
  const perTeam = isOvertime ? (game.rules.overtime === 'single' ? 1 : biggest) : game.rules.turnsPerPlayer * biggest;
  return perTeam * game.teams.length;
}

export function team(game, id) {
  return game.teams.find((t) => t.id === id);
}

export function opponentOf(game, teamId) {
  return game.teams.find((t) => t.id !== teamId)?.id ?? null;
}

/** Index du tour à venir (0 pour le premier). */
export function turnNumber(game) {
  return game.history.length;
}

function activeTeamId(game) {
  if (game.mode === 'solo') return 'S';
  return game.order[turnNumber(game) % game.order.length];
}

/** Donneur d'indices proposé : tête de la file de rotation de l'équipe. */
function giverFor(game, t) {
  return t.queue[0];
}

/** Joueurs pouvant remplacer le donneur proposé sans rompre l'équité : ceux qui ont le moins de passages. */
export function eligibleGivers(game) {
  const t = team(game, game.turn.teamId);
  const min = Math.min(...t.players.map((id) => game.players[id].turns));
  return t.players.filter((id) => game.players[id].turns === min);
}

export function isLastTurnOfSeries(game) {
  return turnNumber(game) + 1 === game.seriesEnds[game.seriesEnds.length - 1];
}

/** Prépare l'annonce du tour suivant (phase 'intro'). */
function prepareTurn(game) {
  const teamId = activeTeamId(game);
  const t = team(game, teamId);
  const giver = giverFor(game, t);
  const opp = opponentOf(game, teamId);
  const o = opp && team(game, opp);
  const watcher = o ? o.players[o.watchCursor % o.players.length] : null;
  let challenge = 'classic';
  let forced = false;
  if (game.mode === 'teams' && game.pendingDouble === teamId) {
    challenge = 'double';
    forced = true;
  } else if (game.rules.dice === 'random') {
    challenge = rollChallenge(allowedFor(game, teamId));
  }
  const turn = {
    number: turnNumber(game) + 1,
    teamId,
    giver,
    watcher,
    challenge,
    forced, // compensation imposée du double sablier
    rolled: game.rules.dice === 'random' && !forced,
    guesser: null, // tête-à-tête
    clock: null,
    cards: [], // { id, result, at (ms restantes) }
    current: null,
    corrections: [],
    startedAt: null,
    endedAt: null,
  };
  return withDefaultGuesser(game, turn);
}

/** Tête-à-tête avec un seul coéquipier possible : il est désigné d'office. */
function withDefaultGuesser(game, turn) {
  if (turn.challenge !== 'tete') return { ...turn, guesser: null };
  const mates = team(game, turn.teamId).players.filter((id) => id !== turn.giver);
  return { ...turn, guesser: mates.length === 1 ? mates[0] : turn.guesser && mates.includes(turn.guesser) ? turn.guesser : null };
}

function allowedFor(game, teamId) {
  return allowedChallenges({ isLastTurnOfSeries: isLastTurnOfSeries(game), guessers: team(game, teamId).players.length - 1 });
}

export function allowedChallengesNow(game) {
  return allowedFor(game, game.turn.teamId);
}

// ——— Actions de la phase d'annonce ———

export function chooseChallenge(game, challengeId) {
  assertPhase(game, 'intro');
  if (game.turn.forced) return game;
  if (game.rules.dice !== 'manual') throw new Error('Le défi est tiré au sort');
  if (!allowedChallengesNow(game).includes(challengeId)) throw new Error('Défi non autorisé pour ce tour');
  return touch({ ...game, turn: withDefaultGuesser(game, { ...game.turn, challenge: challengeId, guesser: null }) });
}

export function setGiver(game, playerId) {
  assertPhase(game, 'intro');
  if (!eligibleGivers(game).includes(playerId)) throw new Error('Ce joueur a déjà été donneur plus souvent');
  return touch({ ...game, turn: withDefaultGuesser(game, { ...game.turn, giver: playerId, guesser: null }) });
}

export function setGuesser(game, playerId) {
  assertPhase(game, 'intro');
  const t = team(game, game.turn.teamId);
  if (!t.players.includes(playerId) || playerId === game.turn.giver) throw new Error('Joueur invalide pour le tête-à-tête');
  return touch({ ...game, turn: { ...game.turn, guesser: playerId } });
}

export function canStart(game) {
  if (game.phase !== 'intro') return false;
  if (game.turn.challenge === 'tete' && !game.turn.guesser) return false;
  return true;
}

/** « Commencer le tour » : le chronomètre démarre et la première carte est retournée. */
export function startTurn(game, now = Date.now()) {
  if (!canStart(game)) throw new Error('Le tour ne peut pas commencer');
  const turn = game.turn;
  const seconds = durationFor(turn.challenge, game.rules.duration);
  let g = { ...game, phase: 'playing', turn: { ...turn, clock: start(createClock(seconds * 1000), now), startedAt: now } };
  if (turn.challenge === 'double') {
    // La compensation est due dès que le double sablier est joué ; un tour de compensation n'en crée pas d'autre.
    g.pendingDouble = turn.forced ? null : opponentOf(g, turn.teamId);
  }
  return touch(drawCard(g));
}

// ——— Pioche ———

function drawCard(game) {
  let pile = game.pile;
  if (!pile.length) return { ...game, turn: { ...game.turn, current: null } };
  const [id, ...rest] = pile;
  return { ...game, pile: rest, used: [...game.used, id], turn: { ...game.turn, current: id } };
}

/** Recharge la pioche si elle est vide (toutes les cartes ont été jouées). */
export function refillPile(game, ids) {
  return touch(drawIfNeeded({ ...game, pile: [...game.pile, ...ids.filter((id) => !game.pile.includes(id))] }));
}

function drawIfNeeded(game) {
  return game.phase === 'playing' && !game.turn.current ? drawCard(game) : game;
}

// ——— Actions pendant le tour ———

/**
 * Enregistre le sort de la carte affichée et retourne la suivante.
 * result : 'guessed' | 'stolen' | 'passed' | 'buzzed'
 * Refusé si le temps est écoulé (règle temporelle déterministe).
 */
export function cardAction(game, result, now = Date.now()) {
  if (game.phase !== 'playing' || !game.turn.current) return { game, accepted: false };
  if (!acceptsAction(game.turn.clock, now)) return { game: expire(game, now), accepted: false };
  if (result === RESULTS.stolen && game.turn.challenge !== 'everyone') throw new Error('Seulement en « Tout le monde joue »');
  const entry = { id: game.turn.current, result, at: remainingMs(game.turn.clock, now) };
  const g = { ...game, turn: { ...game.turn, cards: [...game.turn.cards, entry], current: null } };
  return { game: touch(drawCard(g)), accepted: true, entry };
}

/** Annule la dernière action du tour : la carte revient à l'écran, la carte suivante retourne sur la pioche. */
export function undoAction(game, now = Date.now()) {
  if (game.phase !== 'playing' || !game.turn.cards.length) return game;
  if (isExpired(game.turn.clock, now)) return game;
  const cards = game.turn.cards.slice();
  const last = cards.pop();
  let pile = game.pile;
  let used = game.used;
  if (game.turn.current) {
    pile = [game.turn.current, ...pile];
    used = used.filter((id) => id !== game.turn.current);
  }
  return touch({ ...game, pile, used, turn: { ...game.turn, cards, current: last.id } });
}

export function pauseTurn(game, now = Date.now()) {
  if (game.phase !== 'playing') return game;
  return touch({ ...game, turn: { ...game.turn, clock: pause(game.turn.clock, now) } });
}

export function resumeTurn(game, now = Date.now()) {
  if (game.phase !== 'playing') return game;
  return touch({ ...game, turn: { ...game.turn, clock: start(game.turn.clock, now) } });
}

/** À zéro, le tour s'arrête : la carte à l'écran n'est pas comptée. */
export function expire(game, now = Date.now()) {
  if (game.phase !== 'playing' || !isExpired(game.turn.clock, now)) return game;
  const t = game.turn;
  const cards = t.current ? [...t.cards, { id: t.current, result: RESULTS.unplayed, at: 0 }] : t.cards;
  return touch({ ...game, phase: 'review', turn: { ...t, clock: pause(t.clock, now), cards, current: null, endedAt: now } });
}

// ——— Récapitulatif et correction ———

export function turnContext(game, turn = game.turn) {
  return {
    active: turn.teamId,
    opponent: opponentOf(game, turn.teamId),
    giver: turn.giver,
    everyoneScoring: game.rules.everyoneScoring,
  };
}

export function turnTally(game, turn = game.turn) {
  return tallyTurn(turn.cards, turnContext(game, turn), game.mode === 'solo');
}

export function resultsFor(game, turn = game.turn) {
  const base = [RESULTS.guessed, RESULTS.passed, RESULTS.buzzed, RESULTS.unplayed];
  return turn.challenge === 'everyone' ? [RESULTS.guessed, RESULTS.stolen, ...base.slice(1)] : base;
}

/** Correction manuelle d'une carte après le tour, conservée dans l'historique des modifications. */
export function correctCard(game, index, result, now = Date.now()) {
  assertPhase(game, 'review');
  const cards = game.turn.cards.slice();
  const before = cards[index];
  if (!before || before.result === result) return game;
  if (!resultsFor(game).includes(result)) throw new Error('Résultat non autorisé');
  cards[index] = { ...before, result };
  const corrections = [...game.turn.corrections, { at: now, id: before.id, from: before.result, to: result }];
  return touch({ ...game, turn: { ...game.turn, cards, corrections } });
}

/** Valide le tour : points ajoutés, rotation avancée, victoire vérifiée en fin de série. */
export function validateTurn(game, now = Date.now()) {
  assertPhase(game, 'review');
  const t = game.turn;
  const { points } = turnTally(game);
  const scores = addPoints(game.scores, points);
  for (const k of Object.keys(game.scores)) scores[k] = scores[k] || 0;
  const players = { ...game.players, [t.giver]: { ...game.players[t.giver], turns: game.players[t.giver].turns + 1 } };
  const teams = game.teams.map((tm) => {
    if (tm.id === t.teamId) {
      // Le donneur passe en fin de file ; la file repart du joueur ayant le moins de passages.
      const order = [...tm.queue.filter((id) => id !== t.giver), t.giver];
      return { ...tm, queue: rotateToLeast(order, players) };
    }
    if (tm.id === opponentOf(game, t.teamId)) return { ...tm, watchCursor: tm.watchCursor + 1 };
    return tm;
  });
  const finished = { ...t, points, scoresAfter: scores };
  let g = { ...game, scores, players, teams, history: [...game.history, finished], turn: null };
  g = checkEnd(g);
  if (g.phase !== 'over') g = { ...g, phase: 'intro', turn: prepareTurn(g) };
  return touch(g, now);
}

/** Ordre de passage stable : les joueurs ayant le moins de passages d'abord, sans changer leur ordre relatif. */
function rotateToLeast(order, players) {
  const min = Math.min(...order.map((id) => players[id].turns));
  const i = order.findIndex((id) => players[id].turns === min);
  return [...order.slice(i), ...order.slice(0, i)];
}

function checkEnd(game) {
  const played = game.history.length;
  const end = game.seriesEnds[game.seriesEnds.length - 1];
  if (played < end) return game;
  const ranking = standings(game);
  if (ranking.length > 1 && ranking[0].score === ranking[1].score) {
    // Égalité : « continuez à jouer ».
    return { ...game, overtime: game.overtime + 1, seriesEnds: [...game.seriesEnds, end + seriesLength(game, true)] };
  }
  return { ...game, phase: 'over', winner: ranking[0].id };
}

export function standings(game) {
  const entries = Object.entries(game.scores).map(([id, score]) => ({ id, score }));
  return entries.sort((a, b) => b.score - a.score);
}

/** Progression de la série en cours, pour l'affichage. */
export function progress(game) {
  const ends = game.seriesEnds;
  const end = ends[ends.length - 1];
  const startAt = ends.length > 1 ? ends[ends.length - 2] : 0;
  return { played: game.history.length - startAt, total: end - startAt, overtime: game.overtime };
}

/** Points « en direct » pendant le tour, pour l'affichage du score. */
export function liveScores(game) {
  if (!game.turn || game.phase === 'intro') return game.scores;
  return addPoints(game.scores, turnTally(game).points);
}

export function bestTurns(game, n = 3) {
  return game.history
    .map((t) => ({ ...t, guessed: t.cards.filter((c) => c.result === RESULTS.guessed).length }))
    .sort((a, b) => b.guessed - a.guessed || a.number - b.number)
    .slice(0, n);
}

/** Revanche : mêmes joueurs et équipes, scores remis à zéro, l'autre équipe commence. */
export function rematch(game, pile, now = Date.now()) {
  const players = Object.values(game.players).map((p) => ({ id: p.id, name: p.name }));
  const startTeam = game.mode === 'teams' ? game.order[1] : 'A';
  return createGame({
    players,
    teams: game.mode === 'teams' ? game.teams.map((t) => ({ ...t, players: t.players.slice() })) : undefined,
    mode: game.mode,
    rules: { ...game.rules, startTeam },
    pile,
    now,
  });
}

export function renameTeam(game, teamId, name) {
  const clean = String(name).replace(/\s+/g, ' ').trim().slice(0, 22);
  if (!clean) return game;
  return touch({ ...game, teams: game.teams.map((t) => (t.id === teamId ? { ...t, name: clean } : t)) });
}

function assertPhase(game, phase) {
  if (game.phase !== phase) throw new Error(`Action impossible pendant la phase « ${game.phase} »`);
}

function touch(game, now = Date.now()) {
  return { ...game, updatedAt: now };
}
