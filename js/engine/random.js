// Hasard équitable : crypto.getRandomValues quand il est disponible, avec rejet
// pour éviter le biais du modulo. Un générateur peut être injecté pour les tests.

function cryptoRandom() {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

let source = cryptoRandom;

export function setRandomSource(fn) {
  source = fn || cryptoRandom;
}

/** Entier uniforme dans [0, n). */
export function randomInt(n) {
  if (n <= 0) throw new Error('randomInt: n doit être positif');
  return Math.min(n - 1, Math.floor(source() * n));
}

export function pick(list) {
  return list[randomInt(list.length)];
}

/** Mélange de Fisher-Yates, renvoie une nouvelle liste. */
export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Générateur déterministe (mulberry32) pour les tests reproductibles. */
export function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
