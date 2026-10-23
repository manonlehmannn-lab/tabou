// Accueil.
import { esc, fmtNumber } from '../dom.js';
import { icons } from '../icons.js';
import { sideName } from '../parts.js';
import { liveScores } from '../../engine/game.js';

export const LOGO = `<svg class="logo" viewBox="0 0 330 170" role="img" aria-label="Tabou">
  <defs>
    <linearGradient id="lg-coral" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb0a3"/><stop offset="1" stop-color="#ff6f61"/></linearGradient>
  </defs>
  <path d="M38 22h254a26 26 0 0126 26v66a26 26 0 01-26 26H120l-40 26 6-26H38a26 26 0 01-26-26V48a26 26 0 0126-26z" fill="#ffffff" fill-opacity=".1" stroke="#b8b2e6" stroke-opacity=".55" stroke-width="3"/>
  <g transform="rotate(-6 160 85)">
    <text x="24" y="118" textLength="152" lengthAdjust="spacingAndGlyphs" font-family="Fredoka, sans-serif" font-weight="700" font-size="92" fill="url(#lg-coral)" stroke="#3a1b8f" stroke-width="7" paint-order="stroke">Tab</text>
    <g transform="translate(216 90)">
      <circle r="27" fill="none" stroke="#3a1b8f" stroke-width="20"/>
      <circle r="27" fill="none" stroke="url(#lg-coral)" stroke-width="12"/>
      <path d="M-19 -19L19 19" stroke="#3a1b8f" stroke-width="18" stroke-linecap="round"/>
      <path d="M-19 -19L19 19" stroke="#ff6f61" stroke-width="10" stroke-linecap="round"/>
    </g>
    <text x="258" y="118" textLength="54" lengthAdjust="spacingAndGlyphs" font-family="Fredoka, sans-serif" font-weight="700" font-size="92" fill="url(#lg-coral)" stroke="#3a1b8f" stroke-width="7" paint-order="stroke">u</text>
  </g>
</svg>`;

export function render(app) {
  const g = app.game;
  const total = app.cards.length;
  let resume = '';
  if (g && g.phase !== 'over') {
    const ids = Object.keys(g.scores);
    const live = liveScores(g);
    const sc = g.mode === 'teams'
      ? `${sideName(g, ids[0])} ${live[ids[0]]} – ${live[ids[1]]} ${sideName(g, ids[1])}`
      : `Tour ${g.history.length + 1}`;
    resume = `<button class="btn violet block" data-act="resume" style="flex-direction:column;gap:2px;min-height:68px">
      <span class="row" style="gap:10px">${icons.play} Reprendre la partie</span>
      <span class="resume-info">${sc}</span>
    </button>`;
  }
  return `<main class="screen home">
    <div class="logo-wrap">
      ${LOGO}
      <div class="tagline">Le jeu des mots interdits</div>
    </div>
    <div class="home-actions">
      ${resume}
      <button class="btn primary block" data-go="setup">${icons.users} Nouvelle partie</button>
      <div class="home-grid">
        <button class="tile" data-go="rules">${icons.rules}Règles</button>
        <button class="tile" data-go="library">${icons.cards}Bibliothèque</button>
        <button class="tile" data-go="stats">${icons.stats}Statistiques</button>
        <button class="tile" data-go="settings">${icons.settings}Paramètres</button>
      </div>
      <p class="footer-note">${esc(fmtNumber(total))} cartes · 100 % hors ligne · sans compte</p>
    </div>
  </main>`;
}

export function mount(app, root) {
  root.querySelector('[data-act="resume"]')?.addEventListener('click', () => app.resume());
}
