// Bibliothèque de cartes : validation, import local, filtrage et pioche sans répétition.
import { shuffle } from './random.js';

export const TABOO_COUNT = 5;
export const LEVELS = { 1: 'Facile', 2: 'Normal', 3: 'Difficile' };
export const CUSTOM_CATEGORY = 'perso';

/** Préréglages de difficulté (fonctionnalité de l'application, pas une règle du livret). */
export const DIFFICULTIES = {
  facile: { label: 'Facile', levels: [1], hint: 'Mots courants et accessibles' },
  normal: { label: 'Normal', levels: [2], hint: 'Équilibré, idéal en soirée' },
  difficile: { label: 'Difficile', levels: [3], hint: 'Associations plus subtiles' },
  melange: { label: 'Mélangé', levels: [1, 2, 3], hint: 'Les trois niveaux' },
  perso: { label: 'Personnalisé', levels: null, hint: 'Niveaux et thèmes au choix' },
};

const STOP = new Set(
  'le la les l un une des de du d et ou en au aux a à sur sous dans par pour avec sans ce cet cette ces se sa son ses mon ma mes ton ta tes qui que est il elle on y ne pas plus'.split(' ')
);

export function norm(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`\-–—_.,!?;:()«»"/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  return norm(s)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function stem(t) {
  for (const suf of ['ements', 'ement', 'euses', 'euse', 'eurs', 'eur', 'ettes', 'ette', 'ages', 'age', 'ions', 'ion', 'ies', 'ie', 'es', 's', 'x', 'e']) {
    if (t.length - suf.length >= 4 && t.endsWith(suf)) return t.slice(0, -suf.length);
  }
  return t;
}

/** Même logique que tools/cards.py : « fer » ou « rail » pour « ferraille ». */
export function sharesRoot(a, b) {
  for (const x of tokens(a)) {
    for (const y of tokens(b)) {
      if (x === y || stem(x) === stem(y)) return true;
      const [short, long] = x.length <= y.length ? [x, y] : [y, x];
      if ((short.length === 3 && long.startsWith(short)) || (short.length >= 4 && long.includes(short))) return true;
    }
  }
  return false;
}

const cap = (s) => s.charAt(0).toLocaleUpperCase('fr') + s.slice(1);

/** Nettoie une carte saisie ou importée. */
export function cleanCard(raw) {
  const tidy = (s) => cap(String(s ?? '').replace(/\s+/g, ' ').trim());
  const level = Number(raw.level ?? raw.niveau ?? 2);
  return {
    word: tidy(raw.word ?? raw.mot ?? ''),
    taboo: (raw.taboo ?? raw.interdits ?? []).map(tidy).filter(Boolean),
    level: [1, 2, 3].includes(level) ? level : 2,
  };
}

/** Liste des problèmes d'une carte (vide si la carte est valide). */
export function validateCard(card) {
  const errs = [];
  if (!card.word) return ['Mot principal manquant.'];
  if (card.word.length > 32) errs.push('Mot principal trop long.');
  if (card.taboo.length !== TABOO_COUNT) errs.push(`Il faut exactement ${TABOO_COUNT} mots interdits (${card.taboo.length} fournis).`);
  const seen = new Set();
  for (const t of card.taboo) {
    const n = norm(t);
    if (seen.has(n)) errs.push(`« ${t} » apparaît deux fois.`);
    seen.add(n);
    if (sharesRoot(card.word, t)) errs.push(`« ${t} » reprend une partie du mot à deviner.`);
  }
  return errs;
}

/** Import d'un fichier local JSON ou CSV. Renvoie les cartes valides et les erreurs par ligne. */
export function parseImport(text, filename = '') {
  const cards = [];
  const errors = [];
  let rows;
  const trimmed = text.replace(/^﻿/, '').trim();
  if (filename.toLowerCase().endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      rows = Array.isArray(data) ? data : data.cards;
      if (!Array.isArray(rows)) throw new Error('aucune liste « cards »');
    } catch (e) {
      return { cards, errors: [`JSON illisible : ${e.message}`] };
    }
  } else {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const sep = (lines[0] || '').includes(';') ? ';' : ',';
    rows = [];
    lines.forEach((line, i) => {
      const cols = splitCsv(line, sep);
      if (i === 0 && /^(mot|word)$/i.test(cols[0])) return; // en-tête
      const last = cols[cols.length - 1];
      const hasLevel = cols.length === 7 && /^[123]$/.test(last);
      rows.push({ word: cols[0], taboo: cols.slice(1, 6), level: hasLevel ? Number(last) : 2, _line: i + 1 });
    });
  }
  rows.forEach((row, i) => {
    const card = cleanCard(row || {});
    const errs = validateCard(card);
    const where = row && row._line ? `ligne ${row._line}` : `carte ${i + 1}`;
    if (errs.length) errors.push(`${where} (${card.word || '?'}) : ${errs.join(' ')}`);
    else cards.push(card);
  });
  return { cards, errors };
}

function splitCsv(line, sep) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Cartes retenues pour une partie selon la difficulté choisie. */
export function eligibleCards(cards, { levels, categories }) {
  return cards.filter(
    (c) => (!levels || levels.includes(c.level)) && (!categories || categories.includes(c.category))
  );
}

const DAY = 24 * 3600 * 1000;

/**
 * Ordre de pioche pour une nouvelle partie : d'abord les cartes jamais jouées
 * (mélangées), puis les cartes déjà vues, des plus anciennes aux plus récentes
 * (mélangées à l'intérieur d'une même journée).
 */
export function buildPile(cards, stats = {}, exclude = []) {
  const skip = new Set(exclude);
  const fresh = [];
  const seen = [];
  for (const c of cards) {
    if (skip.has(c.id)) continue;
    (stats[c.id] && stats[c.id].seen ? seen : fresh).push(c.id);
  }
  const older = shuffle(seen).sort(
    (a, b) => Math.floor(stats[a].last / DAY) - Math.floor(stats[b].last / DAY)
  );
  return [...shuffle(fresh), ...older];
}

/** Statistiques persistantes d'une carte après qu'elle a été montrée. */
export function recordCard(stats, id, result, now) {
  const s = stats[id] || { seen: 0, last: 0, g: 0, p: 0, b: 0 };
  const next = { ...s, seen: s.seen + 1, last: now };
  if (result === 'guessed' || result === 'stolen') next.g += 1;
  if (result === 'passed') next.p += 1;
  if (result === 'buzzed') next.b += 1;
  return { ...stats, [id]: next };
}
