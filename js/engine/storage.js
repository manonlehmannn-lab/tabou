// Sauvegarde locale (localStorage de l'iPhone). Aucune donnée ne quitte l'appareil.

const PREFIX = 'tabou:v1:';
const KEYS = {
  settings: 'settings',
  game: 'game',
  history: 'history',
  cardStats: 'cardStats',
  custom: 'customCards',
};

export const DEFAULT_SETTINGS = {
  theme: 'auto', // 'auto' | 'light' | 'dark'
  sound: true,
  haptics: true,
  duration: 60,
  turnsPerPlayer: 2,
  difficulty: 'normal',
  customLevels: [1, 2, 3],
  customCategories: null, // null = toutes
  dice: 'off',
  everyoneScoring: 'finder',
  overtime: 'series',
  background: 'pause', // 'pause' | 'run' : comportement du chrono en arrière-plan
  countdown: true, // 3-2-1 avant le départ du chrono
  buzzerSide: 'right',
  lastPlayers: [],
};

function memoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

export function createStorage(backend) {
  let store = backend;
  if (!store) {
    try {
      store = globalThis.localStorage;
      store.setItem(PREFIX + 'probe', '1');
      store.removeItem(PREFIX + 'probe');
    } catch {
      store = memoryStore();
    }
  }

  const read = (key, fallback) => {
    try {
      const raw = store.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      if (value == null) store.removeItem(PREFIX + key);
      else store.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false; // quota dépassé ou stockage indisponible : le jeu continue
    }
  };

  return {
    loadSettings: () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }),
    saveSettings: (s) => write(KEYS.settings, s),
    loadGame: () => {
      const g = read(KEYS.game, null);
      return g && g.version === 1 && g.phase !== 'over' ? g : null;
    },
    saveGame: (g) => write(KEYS.game, g),
    clearGame: () => write(KEYS.game, null),
    loadHistory: () => read(KEYS.history, []),
    saveHistory: (h) => write(KEYS.history, h.slice(-200)),
    loadCardStats: () => read(KEYS.cardStats, {}),
    saveCardStats: (s) => write(KEYS.cardStats, s),
    loadCustomCards: () => read(KEYS.custom, []),
    saveCustomCards: (c) => write(KEYS.custom, c),
  };
}

/** Résumé d'une partie terminée pour l'historique et les statistiques. */
export function summarizeGame(game) {
  const best = game.history.reduce(
    (b, t) => {
      const n = t.cards.filter((c) => c.result === 'guessed').length;
      return n > b.guessed ? { guessed: n, giver: game.players[t.giver]?.name, teamId: t.teamId } : b;
    },
    { guessed: -1 }
  );
  const count = (r) => game.history.reduce((s, t) => s + t.cards.filter((c) => c.result === r).length, 0);
  return {
    id: game.id,
    date: game.updatedAt,
    mode: game.mode,
    teams: game.teams.map((t) => ({ id: t.id, name: t.name, color: t.color, players: t.players.map((id) => game.players[id].name) })),
    scores: game.scores,
    winner: game.winner,
    winnerName: game.mode === 'teams' ? game.teams.find((t) => t.id === game.winner)?.name : game.players[game.winner]?.name,
    turns: game.history.length,
    overtime: game.overtime,
    guessed: count('guessed') + count('stolen'),
    passed: count('passed'),
    buzzed: count('buzzed'),
    best: best.guessed >= 0 ? best : null,
  };
}
