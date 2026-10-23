// Les cinq modes du dé défi (livret, section 5).
import { randomInt } from './random.js';

export const CHALLENGES = {
  classic: {
    id: 'classic',
    name: 'Jeu classique',
    rule: 'Pas de défi supplémentaire pour ce tour.',
  },
  tete: {
    id: 'tete',
    name: 'Tête-à-tête',
    rule: 'Choisissez un membre de votre équipe : seul celui-ci pourra tenter de deviner les mots pour ce tour.',
  },
  double: {
    id: 'double',
    name: 'Double sablier',
    rule: "Votre équipe dispose d'un double sablier pour ce tour. Pour plus d'équité, l'équipe adverse aura le même défi pour le tour suivant.",
  },
  statue: {
    id: 'statue',
    name: 'Statue',
    rule: "Vous devez rester complètement immobile pendant que vous donnez des indices. L'autre équipe retourne les cartes.",
  },
  everyone: {
    id: 'everyone',
    name: 'Tout le monde joue',
    rule: 'Les deux équipes peuvent trouver les mots.',
  },
};

export const DIE_FACES = ['classic', 'tete', 'double', 'statue', 'everyone'];

/**
 * Défis autorisés pour un tour.
 * Choix de l'application : le double sablier est exclu du dernier tour d'une série,
 * car l'équipe adverse n'aurait plus de tour pour bénéficier de la compensation.
 */
export function allowedChallenges({ isLastTurnOfSeries, guessers }) {
  return DIE_FACES.filter((id) => {
    if (id === 'double' && isLastTurnOfSeries) return false;
    if (id === 'tete' && guessers < 1) return false;
    return true;
  });
}

/** Lancer de dé équitable : chaque face autorisée a la même probabilité. */
export function rollChallenge(allowed) {
  return allowed[randomInt(allowed.length)];
}

export function durationFor(challengeId, baseSeconds) {
  return challengeId === 'double' ? baseSeconds * 2 : baseSeconds;
}
