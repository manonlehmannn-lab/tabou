// Point d'entrée : chargement des cartes, état global, navigation et sauvegarde automatique.
import * as G from './engine/game.js';
import { createStorage, summarizeGame } from './engine/storage.js';
import { buildPile, eligibleCards, recordCard, DIFFICULTIES, CUSTOM_CATEGORY } from './engine/deck.js';
import { setFxPrefs, unlockAudio, keepAwake } from './ui/fx.js';
import { remainingMs, isRunning } from './engine/timer.js';
import * as home from './ui/screens/home.js';
import * as setup from './ui/screens/setup.js';
import * as intro from './ui/screens/intro.js';
import * as play from './ui/screens/play.js';
import * as review from './ui/screens/review.js';
import * as board from './ui/screens/board.js';
import * as over from './ui/screens/over.js';
import * as library from './ui/screens/library.js';
import * as rules from './ui/screens/rules.js';
import * as settings from './ui/screens/settings.js';
import * as stats from './ui/screens/stats.js';

const SCREENS = { home, setup, intro, play, review, board, over, library, rules, settings, stats };
export const APP_VERSION = '1.0.0';

const storage = createStorage();
const root = document.getElementById('app');
let cleanup = null;

export const app = {
  version: APP_VERSION,
  storage,
  library: { categories: {}, cards: [] },
  cards: [],
  byId: new Map(),
  settings: storage.loadSettings(),
  game: storage.loadGame(),
  history: storage.loadHistory(),
  cardStats: storage.loadCardStats(),
  custom: storage.loadCustomCards(),
  screen: null,
  params: {},

  go(name, params = {}) {
    if (cleanup) cleanup();
    cleanup = null;
    app.screen = name;
    app.params = params;
    const s = SCREENS[name];
    root.innerHTML = s.render(app, params);
    window.scrollTo(0, 0);
    // Chaque écran reçoit son propre élément : ses écouteurs disparaissent avec lui.
    cleanup = s.mount ? s.mount(app, root.firstElementChild, params) || null : null;
  },

  /** Rafraîchit l'écran courant (après un changement d'état). */
  refresh() {
    app.go(app.screen, app.params);
  },

  setGame(game) {
    app.game = game;
    storage.saveGame(game);
  },

  saveSettings(patch = {}) {
    app.settings = { ...app.settings, ...patch };
    storage.saveSettings(app.settings);
    setFxPrefs({ sound: app.settings.sound, haptics: app.settings.haptics });
    applyTheme();
  },

  categoryLabel(id) {
    return id === CUSTOM_CATEGORY ? 'Cartes perso' : app.library.categories[id] || id;
  },

  /** Cartes retenues pour les réglages de difficulté donnés. */
  eligible(s = app.settings) {
    const preset = DIFFICULTIES[s.difficulty] || DIFFICULTIES.normal;
    const filter = s.difficulty === 'perso'
      ? { levels: s.customLevels, categories: s.customCategories }
      : { levels: preset.levels };
    return eligibleCards(app.cards, filter);
  },

  /** Lance une partie à partir de l'écran de configuration. */
  startGame({ players, teams, mode, rules }) {
    const pile = buildPile(app.eligible(), app.cardStats);
    const game = G.createGame({ players, teams, mode, rules, pile });
    app.setGame(game);
    app.go('intro');
  },

  rematch() {
    const pile = buildPile(app.eligible(), app.cardStats);
    app.setGame(G.rematch(app.game, pile));
    app.go('intro');
  },

  /** Valide le tour : statistiques des cartes, sauvegarde, et fin de partie éventuelle. */
  validateTurn() {
    const now = Date.now();
    for (const c of app.game.turn.cards) app.cardStats = recordCard(app.cardStats, c.id, c.result, now);
    storage.saveCardStats(app.cardStats);
    const g = G.validateTurn(app.game, now);
    app.setGame(g);
    if (g.phase === 'over') {
      app.history = [...app.history, summarizeGame(g)];
      storage.saveHistory(app.history);
      app.go('over');
    } else {
      app.go('intro');
    }
  },

  /** Ajoute des cartes à la pioche si elle s'épuise (en cas de très longue partie). */
  ensurePile() {
    const g = app.game;
    if (g.pile.length > 3) return;
    const used = new Set(g.used);
    let ids = buildPile(app.eligible(), app.cardStats).filter((id) => !used.has(id));
    if (!ids.length) ids = buildPile(app.cards, app.cardStats).filter((id) => !used.has(id));
    if (ids.length) app.setGame(G.refillPile(g, ids));
  },

  rebuildCards() {
    const custom = app.custom.map((c) => ({ ...c, category: CUSTOM_CATEGORY }));
    app.cards = [...app.library.cards, ...custom];
    app.byId = new Map(app.cards.map((c) => [c.id, c]));
  },

  saveCustom(list) {
    app.custom = list;
    storage.saveCustomCards(list);
    app.rebuildCards();
  },

  /** Écran à afficher pour reprendre la partie sauvegardée. */
  resumeScreen() {
    const g = app.game;
    if (!g) return 'home';
    return { intro: 'intro', playing: 'play', review: 'review', over: 'over' }[g.phase] || 'home';
  },

  resume() {
    app.go(app.resumeScreen());
  },
};

function applyTheme() {
  const t = app.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b0a45' : '#f2eefc');
}

/**
 * Partie rouverte pendant un tour : avec le réglage « suspendre », le chrono est arrêté
 * à l'instant de la dernière sauvegarde ; avec « continuer », il a continué de tourner.
 */
function restoreClock() {
  const g = app.game;
  if (!g || g.phase !== 'playing') return;
  if (app.settings.background === 'pause' && isRunning(g.turn.clock)) {
    app.setGame(G.pauseTurn(g, Math.max(g.updatedAt, g.turn.clock.runningSince)));
  } else if (remainingMs(g.turn.clock, Date.now()) <= 0) {
    app.setGame(G.expire(g, Date.now()));
  }
}

async function loadLibrary() {
  const res = await fetch('data/cards.json');
  app.library = await res.json();
  app.rebuildCards();
}

async function boot() {
  applyTheme();
  setFxPrefs({ sound: app.settings.sound, haptics: app.settings.haptics });
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyTheme);
  // Le premier contact débloque le son sur iOS.
  const unlock = () => unlockAudio();
  window.addEventListener('pointerdown', unlock, { capture: true });
  // Navigation simple : tout bouton portant data-go ouvre l'écran indiqué.
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) app.go(b.dataset.go);
  });
  try {
    await loadLibrary();
  } catch {
    root.innerHTML = '<div class="screen"><p class="center">Impossible de charger les cartes. Rouvrez l’application.</p></div>';
    return;
  }
  restoreClock();
  app.go('home');

  // Sauvegarde de sécurité quand l'application passe en arrière-plan ou se ferme.
  const persist = () => app.game && storage.saveGame(app.game);
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      play.onHidden?.(app);
      persist();
      keepAwake(false);
    } else {
      play.onVisible?.(app);
    }
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
