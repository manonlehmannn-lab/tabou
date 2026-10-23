// Constitution des équipes. Livret : « Formez 2 équipes » (4 joueurs ou plus).
import { shuffle } from './random.js';

export const MIN_OFFICIAL_PLAYERS = 4;
export const MIN_TEAM_SIZE = 2; // un donneur d'indices + au moins un joueur qui devine

export const TEAM_STYLES = [
  { id: 'A', name: 'Équipe Violette', color: 'violet' },
  { id: 'B', name: 'Équipe Corail', color: 'corail' },
];

let counter = 0;
export function makePlayerId() {
  counter += 1;
  return `p${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Normalise une liste de prénoms : espaces retirés, noms vides remplacés, doublons numérotés. */
export function cleanNames(names) {
  const seen = new Map();
  return names.map((raw, i) => {
    let name = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 18) || `Joueur ${i + 1}`;
    const key = name.toLocaleLowerCase('fr');
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n > 1) name = `${name} ${n}`;
    return name;
  });
}

/**
 * Répartition automatique équilibrée : ordre mélangé puis distribution alternée.
 * Avec un nombre impair, l'équipe A reçoit le joueur supplémentaire.
 */
export function balancedSplit(playerIds, { random = true } = {}) {
  const order = random ? shuffle(playerIds) : playerIds.slice();
  const a = [];
  const b = [];
  order.forEach((id, i) => (i % 2 === 0 ? a : b).push(id));
  return [a, b];
}

export function movePlayer(teams, playerId) {
  return teams.map((t) =>
    t.includes(playerId) ? t.filter((id) => id !== playerId) : [...t, playerId]
  );
}

/** Renvoie la liste des problèmes empêchant de lancer une partie en équipes. */
export function checkTeams(teams) {
  const issues = [];
  if (teams.length !== 2) issues.push('Il faut exactement deux équipes.');
  teams.forEach((t, i) => {
    if (t.length < MIN_TEAM_SIZE) {
      issues.push(`${TEAM_STYLES[i].name} doit compter au moins ${MIN_TEAM_SIZE} joueurs.`);
    }
  });
  return issues;
}

/** Mode de jeu adapté au nombre de joueurs. */
export function modeForCount(count) {
  if (count >= MIN_OFFICIAL_PLAYERS) return 'teams';
  if (count >= 2) return 'solo'; // variante non officielle
  return null;
}
