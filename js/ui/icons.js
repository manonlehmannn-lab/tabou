// Icônes SVG originales (trait arrondi, couleur courante).

const svg = (body, vb = 24) =>
  `<svg viewBox="0 0 ${vb} ${vb}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  play: svg('<path d="M7 5l12 7-12 7z" fill="currentColor"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  skip: svg('<path d="M5 6l7 6-7 6zM13 6l7 6-7 6z" fill="currentColor"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: svg('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 004.4-1"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>'),
  rules: svg('<path d="M5 4h10a4 4 0 014 4v12H9a4 4 0 01-4-4z"/><path d="M9 9h6M9 13h6"/>'),
  cards: svg('<rect x="3" y="6" width="12" height="15" rx="2.5"/><path d="M8 3h10a2.5 2.5 0 012.5 2.5V18"/>'),
  stats: svg('<path d="M5 20V11M12 20V4M19 20v-6"/>'),
  settings: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 6l2.2 1.6M17.6 16.4l2.2 1.6M2.5 13h3M18.5 11h3M4.2 18l2.2-1.6M17.6 7.6L19.8 6"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>'),
  shuffle: svg('<path d="M3 7h3.5c2 0 3.3 1 4.5 3l2 4c1.2 2 2.5 3 4.5 3H21M3 17h3.5c1.4 0 2.4-.5 3.3-1.5M14.2 8.5C15 7.5 16 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4"/>'),
  sound: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>'),
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 19v-3"/>'),
  download: svg('<path d="M12 4v12M7 11l5 5 5-5M4 16v3a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 19v-3"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  home: svg('<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>'),
  swap: svg('<path d="M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"/>'),
  bell: svg('<path d="M6 17V11a6 6 0 0112 0v6l2 2H4z"/><path d="M10 21h4"/>'),
  // Faces du dé défi.
  tete: svg('<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.9-4.2 3.8-6.5 7.5-6.5s6.6 2.3 7.5 6.5"/>'),
  double: svg('<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/><path d="M15.5 15.5l4 4M19.5 15.5l-4 4" stroke-width="2.4"/>'),
  statue: svg('<path d="M4 21h16M5 18h14M6 18V9M10 18V9M14 18V9M18 18V9M3.5 9h17L12 3.5z"/>'),
  everyone: svg('<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 19c.6-3 2.7-4.8 5.5-4.8s4.9 1.8 5.5 4.8M10.5 19c.6-3 2.7-4.8 5.5-4.8s4.9 1.8 5.5 4.8"/>'),
  classic: svg('<path d="M5 6.5c3-1.6 11-1.6 14 0M12 6v12.5c0 1.2-.6 2-1.8 2" stroke-width="2.8"/>'),
};

export const challengeIcon = (id) => icons[id] || icons.classic;
