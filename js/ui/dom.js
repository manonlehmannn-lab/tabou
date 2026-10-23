// Petits utilitaires d'affichage.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export const fmtNumber = (n) => n.toLocaleString('fr-FR');

export function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function toast(message) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

/** Boîte de confirmation dans le style de l'application. */
export function confirmBox({ title, text = '', ok = 'Confirmer', cancel = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'overlay';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <h2>${esc(title)}</h2>
      ${text ? `<p class="center muted">${esc(text)}</p>` : ''}
      <button class="btn ${danger ? 'primary' : 'violet'} block" data-r="1">${esc(ok)}</button>
      <button class="btn block" data-r="0">${esc(cancel)}</button>
    </div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (!b && e.target !== el) return;
      el.remove();
      resolve(b ? b.dataset.r === '1' : false);
    });
    document.body.appendChild(el);
  });
}

/** Ajuste la taille de police d'un élément pour que son texte tienne sur sa largeur. */
export function fitText(el, max, min = 22) {
  let size = max;
  el.style.fontSize = `${size}px`;
  while (size > min && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
    size -= 2;
    el.style.fontSize = `${size}px`;
  }
}
