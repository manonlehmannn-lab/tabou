// Fragments d'interface partagés entre les écrans.
import { esc } from './dom.js';
import { icons } from './icons.js';
import { LEVELS } from '../engine/deck.js';

export const RESULT_LABELS = {
  guessed: 'Deviné',
  stolen: 'Trouvé par l’adversaire',
  passed: 'Passé',
  buzzed: 'Buzzé',
  unplayed: 'Non jouée',
};

export function topbar(title, { back = 'home', right = '' } = {}) {
  return `<header class="topbar">
    ${back ? `<button class="icon-btn" data-go="${back}" aria-label="Retour">${icons.back}</button>` : '<span class="spacer"></span>'}
    <h1>${esc(title)}</h1>
    ${right || '<span class="spacer"></span>'}
  </header>`;
}

export const teamOf = (game, id) => game.teams.find((t) => t.id === id);
export const nameOf = (game, playerId) => esc(game.players[playerId]?.name ?? '?');
export const teamName = (game, id) => esc(teamOf(game, id)?.name ?? '');

/** Nom affiché d'un camp : équipe en mode équipes, joueur en variante solo. */
export function sideName(game, id) {
  return game.mode === 'solo' ? nameOf(game, id) : teamName(game, id);
}

export function levelDots(level) {
  return `<span class="lv" aria-label="${LEVELS[level]}">${[1, 2, 3].map((i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</span>`;
}

/** Carte de jeu complète. */
export function cardHTML(card, categoryLabel) {
  if (!card) {
    return `<div class="tcard enter"><div class="empty-deck"><p>Plus aucune carte disponible.<br>Ajoutez des cartes ou réinitialisez l’historique.</p></div></div>`;
  }
  return `<article class="tcard enter" data-card="${esc(card.id)}">
    <div class="word"><span class="meta"><span class="cat">${esc(categoryLabel)}</span>${levelDots(card.level)}</span><span class="w">${esc(card.word)}</span></div>
    <div class="forbid-label">Mots interdits</div>
    <ul class="taboo">${card.taboo.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  </article>`;
}

/** Bouton interrupteur accessible. */
export function toggle(key, on, label, hint = '') {
  return `<div class="switch-row">
    <div><div>${esc(label)}</div>${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>
    <button class="toggle" role="switch" aria-pressed="${on}" aria-checked="${on}" aria-label="${esc(label)}" data-toggle="${key}"></button>
  </div>`;
}

/** Groupe de choix exclusifs. */
export function seg(key, value, options) {
  return `<div class="seg" role="group">${options
    .map(([v, label]) => `<button data-seg="${key}" data-value="${esc(v)}" aria-pressed="${String(v) === String(value)}">${esc(label)}</button>`)
    .join('')}</div>`;
}

/** Lecture d'une valeur de bouton de choix en conservant son type. */
export function segValue(btn) {
  const v = btn.dataset.value;
  if (v === 'true' || v === 'false') return v === 'true';
  return /^\d+$/.test(v) ? Number(v) : v;
}

/** « l’équipe Corail », ou « l’équipe « Les Loups » » pour un nom personnalisé. */
export function theTeam(name, capital = false) {
  const m = /^équipe\s+(.+)$/i.exec(name);
  const s = m ? `l’équipe ${m[1]}` : `l’équipe « ${name} »`;
  return capital ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
