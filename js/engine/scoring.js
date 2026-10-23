// Barème. Livret, section 3.4 :
//   « L'équipe A marque 1 point pour chaque mot deviné.
//     L'équipe A donne 1 point à l'équipe B pour chaque mot buzzé ou passé. »

export const RESULTS = {
  guessed: 'guessed', // deviné par l'équipe du donneur d'indices
  stolen: 'stolen', // « Tout le monde joue » : deviné par l'équipe adverse
  passed: 'passed',
  buzzed: 'buzzed',
  unplayed: 'unplayed', // carte à l'écran quand le temps s'écoule : aucun point
};

/**
 * « Tout le monde joue » : le livret ne précise pas l'attribution des points.
 *  - 'finder' (défaut de l'application) : l'équipe qui trouve marque le point.
 *  - 'activeOnly' : seule l'équipe du donneur peut marquer ; un mot trouvé par
 *    l'adversaire est défaussé sans point.
 */
export const EVERYONE_SCORING = ['finder', 'activeOnly'];

/** Points rapportés par une carte, sous la forme { [teamId]: points }. */
export function pointsFor(result, { active, opponent, everyoneScoring = 'finder' }) {
  switch (result) {
    case RESULTS.guessed:
      return { [active]: 1 };
    case RESULTS.stolen:
      return everyoneScoring === 'finder' ? { [opponent]: 1 } : {};
    case RESULTS.passed:
    case RESULTS.buzzed:
      return { [opponent]: 1 };
    default:
      return {};
  }
}

/** Variante non officielle « chacun pour soi » : seul un mot deviné rapporte un point au donneur. */
export function soloPointsFor(result, { giver }) {
  return result === RESULTS.guessed ? { [giver]: 1 } : {};
}

export function addPoints(total, delta) {
  const out = { ...total };
  for (const [k, v] of Object.entries(delta)) out[k] = (out[k] || 0) + v;
  return out;
}

/** Totaux d'un tour à partir de ses cartes. */
export function tallyTurn(cards, ctx, solo = false) {
  const counts = { guessed: 0, stolen: 0, passed: 0, buzzed: 0, unplayed: 0 };
  let points = {};
  for (const c of cards) {
    counts[c.result] = (counts[c.result] || 0) + 1;
    points = addPoints(points, solo ? soloPointsFor(c.result, ctx) : pointsFor(c.result, ctx));
  }
  return { counts, points };
}
