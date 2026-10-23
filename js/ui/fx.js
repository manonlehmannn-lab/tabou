// Sons (synthétisés, aucun fichier à télécharger), vibrations, veille de l'écran et confettis.

let ctx = null;
let master = null;
const prefs = { sound: true, haptics: true };

export function setFxPrefs(p) {
  Object.assign(prefs, p);
}

/** À appeler lors d'un geste : iOS n'autorise le son qu'après une interaction. */
export function unlockAudio() {
  try {
    // Safari 17+ : jouer le son même quand l'iPhone est en mode silencieux serait intrusif ; on reste en « ambient ».
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone({ freq, to, type = 'sine', dur = 0.15, gain = 0.5, delay = 0, attack = 0.005 }) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, gain = 0.3, delay = 0, freq = 1200 }) {
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
}

const SOUNDS = {
  guessed() {
    tone({ freq: 880, dur: 0.12, gain: 0.35 });
    tone({ freq: 1320, dur: 0.22, gain: 0.35, delay: 0.08 });
  },
  stolen() {
    tone({ freq: 660, dur: 0.12, gain: 0.35 });
    tone({ freq: 990, dur: 0.22, gain: 0.35, delay: 0.08 });
  },
  passed() {
    tone({ freq: 520, to: 260, type: 'triangle', dur: 0.22, gain: 0.35 });
    noise({ dur: 0.18, gain: 0.08, freq: 2400 });
  },
  buzzed() {
    // Buzzer distinctif : deux ondes carrées graves désaccordées.
    tone({ freq: 146, type: 'square', dur: 0.6, gain: 0.32 });
    tone({ freq: 155, type: 'sawtooth', dur: 0.6, gain: 0.22 });
    tone({ freq: 73, type: 'square', dur: 0.6, gain: 0.18 });
  },
  tick() {
    tone({ freq: 1800, type: 'square', dur: 0.03, gain: 0.12 });
  },
  tickLast() {
    tone({ freq: 2200, type: 'square', dur: 0.05, gain: 0.18 });
  },
  start() {
    [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.14, gain: 0.3, delay: i * 0.07 }));
  },
  count() {
    tone({ freq: 660, dur: 0.12, gain: 0.3 });
  },
  timeUp() {
    tone({ freq: 880, type: 'square', dur: 0.18, gain: 0.25 });
    tone({ freq: 880, type: 'square', dur: 0.18, gain: 0.25, delay: 0.24 });
    tone({ freq: 440, to: 220, type: 'sawtooth', dur: 0.9, gain: 0.3, delay: 0.48 });
  },
  dice() {
    for (let i = 0; i < 7; i++) noise({ dur: 0.05, gain: 0.25, delay: i * 0.09, freq: 900 + Math.random() * 900 });
  },
  land() {
    tone({ freq: 392, dur: 0.1, gain: 0.3 });
    tone({ freq: 784, dur: 0.25, gain: 0.3, delay: 0.07 });
  },
  victory() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: i === 5 ? 0.7 : 0.16, gain: 0.32, delay: i * 0.13 }));
  },
  tap() {
    tone({ freq: 600, dur: 0.04, gain: 0.12 });
  },
};

export function sound(name) {
  if (!prefs.sound || !ctx || !SOUNDS[name]) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    SOUNDS[name]();
  } catch {
    /* le son n'est qu'un plus */
  }
}

// ——— Vibrations ———
// Android : API Vibration. iPhone (Safari 18+) : l'API n'existe pas ; on déclenche le
// retour haptique natif d'un interrupteur caché, ce qui ne fonctionne que pendant un geste.
let hapticSwitch = null;
function iosTick() {
  if (!hapticSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    hapticSwitch = label;
  }
  hapticSwitch.click();
}

const PATTERNS = { light: [12], buzz: [80, 40, 120], ok: [20], end: [200, 100, 200, 100, 400], pass: [30] };

export function haptic(kind = 'light') {
  if (!prefs.haptics) return;
  try {
    if (navigator.vibrate) navigator.vibrate(PATTERNS[kind] || PATTERNS.light);
    else {
      iosTick();
      if (kind === 'buzz' || kind === 'end') setTimeout(iosTick, 120);
    }
  } catch {
    /* ignoré */
  }
}

// ——— Écran allumé pendant le tour ———
let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

// ——— Confettis de victoire ———
export function confetti(duration = 3200) {
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti';
  document.body.appendChild(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = (canvas.width = innerWidth * dpr);
  const h = (canvas.height = innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  const c = canvas.getContext('2d');
  const colors = ['#ff8576', '#8a63ff', '#ffb340', '#20c98d', '#f8a9a0', '#ffffff', '#ff5c8a'];
  const parts = Array.from({ length: 160 }, () => ({
    x: w / 2 + (Math.random() - 0.5) * w * 0.3,
    y: h * 0.35,
    vx: (Math.random() - 0.5) * 22 * dpr,
    vy: (-Math.random() * 20 - 8) * dpr,
    r: (5 + Math.random() * 7) * dpr,
    a: Math.random() * Math.PI,
    va: (Math.random() - 0.5) * 0.4,
    color: colors[(Math.random() * colors.length) | 0],
  }));
  const t0 = performance.now();
  (function frame(t) {
    const life = t - t0;
    c.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.55 * dpr;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      c.save();
      c.globalAlpha = Math.max(0, 1 - life / duration);
      c.translate(p.x, p.y);
      c.rotate(p.a);
      c.fillStyle = p.color;
      c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      c.restore();
    }
    if (life < duration) requestAnimationFrame(frame);
    else canvas.remove();
  })(t0);
}
