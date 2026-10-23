// Contrôle qualité de la bibliothèque intégrée data/cards.json.
import { test, assert, eq } from './harness.js';
import { validateCard, norm, TABOO_COUNT } from '../js/engine/deck.js';

const library = globalThis.readFile
  ? JSON.parse(readFile('data/cards.json'))
  : await (await fetch(new URL('../data/cards.json', import.meta.url))).json();

test('la bibliothèque compte au moins 1 000 cartes et le compteur est exact', () => {
  assert(library.cards.length >= 1000, `${library.cards.length} cartes`);
  eq(library.count, library.cards.length);
});

test(`chaque carte comporte exactement ${TABOO_COUNT} mots interdits valides`, () => {
  const bad = library.cards.filter((c) => c.taboo.length !== TABOO_COUNT || validateCard(c).length);
  eq(bad.map((c) => c.word), []);
});

test('aucun doublon de mot principal ni d’identifiant', () => {
  const words = library.cards.map((c) => norm(c.word));
  eq(new Set(words).size, words.length, 'mots uniques');
  const ids = library.cards.map((c) => c.id);
  eq(new Set(ids).size, ids.length, 'identifiants uniques');
});

test('niveaux et thèmes renseignés pour toutes les cartes, les 16 thèmes couverts', () => {
  const cats = new Set(Object.keys(library.categories));
  assert(library.cards.every((c) => [1, 2, 3].includes(c.level) && cats.has(c.category)));
  for (const cat of cats) {
    const n = library.cards.filter((c) => c.category === cat).length;
    assert(n >= 50, `${cat} : ${n} cartes`);
  }
  for (const lv of [1, 2, 3]) {
    const n = library.cards.filter((c) => c.level === lv).length;
    assert(n >= 200, `niveau ${lv} : ${n} cartes`);
  }
});
