// Bibliothèque : volume réel de cartes, statistiques, cartes personnalisées et import local.
import { esc, fmtNumber, toast, confirmBox } from '../dom.js';
import { icons } from '../icons.js';
import { topbar } from '../parts.js';
import { cleanCard, validateCard, parseImport, norm, LEVELS, CUSTOM_CATEGORY } from '../../engine/deck.js';

let formErrors = [];

function customId(word) {
  return `perso-${norm(word).replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
}

/** Ajoute des cartes personnalisées en écartant les doublons de la bibliothèque. */
function addCustom(app, cards) {
  const known = new Set(app.cards.map((c) => norm(c.word)));
  const fresh = [];
  let dupes = 0;
  for (const c of cards) {
    if (known.has(norm(c.word))) {
      dupes++;
      continue;
    }
    known.add(norm(c.word));
    fresh.push({ ...c, id: customId(c.word) });
  }
  app.saveCustom([...app.custom, ...fresh]);
  return { added: fresh.length, dupes };
}

export function render(app) {
  const cards = app.cards;
  const stats = app.cardStats;
  const seen = cards.filter((c) => stats[c.id]?.seen).length;
  const totals = Object.values(stats).reduce((t, s) => ({ g: t.g + s.g, p: t.p + s.p, b: t.b + s.b }), { g: 0, p: 0, b: 0 });
  const played = totals.g + totals.p + totals.b;
  const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
  const cats = [...Object.entries(app.library.categories), ...(app.custom.length ? [[CUSTOM_CATEGORY, 'Cartes perso']] : [])];
  const hardest = cards
    .filter((c) => stats[c.id] && stats[c.id].seen >= 1 && stats[c.id].p + stats[c.id].b > 0)
    .sort((a, b) => stats[b.id].p + stats[b.id].b - (stats[a.id].p + stats[a.id].b))
    .slice(0, 5);
  return `<main class="screen">
    ${topbar('Bibliothèque')}
    <section class="big-count"><div class="n">${fmtNumber(cards.length)}</div><div class="muted">cartes disponibles hors ligne</div></section>

    <section class="panel"><div class="head">Difficultés</div><div class="body">
      ${[1, 2, 3].map((l) => `<div class="kv"><span>${LEVELS[l]}</span><b>${fmtNumber(cards.filter((c) => c.level === l).length)}</b></div>`).join('')}
      <p class="hint">Niveaux ajoutés par l’application (le jeu original n’en a pas).</p>
    </div></section>

    <section class="panel"><div class="head">Thèmes</div><div class="body">
      ${cats
        .map(([id, label]) => {
          const list = cards.filter((c) => c.category === id);
          const s = list.filter((c) => stats[c.id]?.seen).length;
          return `<div><div class="row between"><span>${esc(label)}</span><span class="muted small">${s} / ${list.length} jouées</span></div><div class="meter"><i style="width:${pct(s, list.length)}%"></i></div></div>`;
        })
        .join('')}
    </div></section>

    <section class="panel"><div class="head">Cartes jouées</div><div class="body">
      <div class="kv"><span>Cartes déjà sorties</span><b>${fmtNumber(seen)} (${pct(seen, cards.length)} %)</b></div>
      <div class="kv"><span>Devinées</span><b>${pct(totals.g, played)} %</b></div>
      <div class="kv"><span>Passées</span><b>${pct(totals.p, played)} %</b></div>
      <div class="kv"><span>Buzzées</span><b>${pct(totals.b, played)} %</b></div>
      ${hardest.length ? `<div class="field"><span class="label">Les plus redoutées</span>${hardest.map((c) => `<div class="small">${esc(c.word)} <span class="muted">· ${stats[c.id].p} passée(s), ${stats[c.id].b} buzz</span></div>`).join('')}</div>` : ''}
      <p class="hint">Les cartes jamais jouées sortent en priorité, puis les plus anciennes : les répétitions entre parties sont limitées.</p>
      <button class="btn small block" data-act="reset-history">${icons.trash} Réinitialiser l’historique des cartes</button>
    </div></section>

    <section class="panel"><div class="head">Ajouter une carte</div><div class="body">
      <div class="field"><label for="cw">Mot à deviner</label><input class="input" id="cw" maxlength="32" autocomplete="off" autocapitalize="sentences"></div>
      <div class="field"><span class="label">5 mots interdits</span><div class="taboo-inputs">
        ${[1, 2, 3, 4, 5].map((i) => `<input class="input" data-taboo="${i}" maxlength="24" placeholder="Mot interdit ${i}" autocomplete="off" autocapitalize="sentences">`).join('')}
      </div></div>
      <div class="field"><span class="label">Difficulté</span><div class="seg" id="clevel">
        ${[1, 2, 3].map((l) => `<button data-level="${l}" aria-pressed="${l === 2}">${LEVELS[l]}</button>`).join('')}
      </div></div>
      ${formErrors.length ? `<div class="error-list">${formErrors.map(esc).join('<br>')}</div>` : ''}
      <button class="btn violet block" data-act="add">${icons.plus} Ajouter la carte</button>
    </div></section>

    <section class="panel"><div class="head">Importer un fichier</div><div class="body">
      <p>Fichier <b>JSON</b> ou <b>CSV</b> présent sur l’iPhone (app Fichiers). Aucune connexion nécessaire.</p>
      <pre class="sample">mot;interdit1;interdit2;interdit3;interdit4;interdit5;niveau
Cowboy;Chapeau;Cheval;États-Unis;Rodéo;Ranch;1</pre>
      <pre class="sample">[{"word": "Cowboy", "taboo": ["Chapeau", "Cheval", "États-Unis", "Rodéo", "Ranch"], "level": 1}]</pre>
      <p class="hint">Niveau : 1 facile, 2 normal, 3 difficile (2 par défaut). Chaque carte est vérifiée : exactement 5 mots interdits, sans répéter le mot à deviner.</p>
      <label class="btn block file-btn">${icons.upload} Choisir un fichier<input type="file" id="import" accept=".json,.csv,.txt,application/json,text/csv,text/plain"></label>
    </div></section>

    <section class="panel"><div class="head">Mes cartes (${app.custom.length})</div><div class="body">
      ${app.custom.length
        ? app.custom
            .slice()
            .reverse()
            .map((c) => `<div class="card-line"><span><b>${esc(c.word)}</b><br><span class="small muted">${c.taboo.map(esc).join(' · ')}</span></span><button class="icon-btn" data-del="${esc(c.id)}" aria-label="Supprimer" style="background:#f1edff;color:var(--panel-text)">${icons.trash}</button></div>`)
            .join('')
        : '<p class="muted">Aucune carte personnalisée.</p>'}
      ${app.custom.length ? `<button class="btn small block" data-act="export">${icons.download} Exporter mes cartes (JSON)</button>` : ''}
    </div></section>
  </main>`;
}

export function mount(app, root) {
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.level) {
      root.querySelectorAll('#clevel button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    } else if (b.dataset.act === 'add') {
      const level = Number(root.querySelector('#clevel [aria-pressed="true"]').dataset.level);
      const card = cleanCard({
        word: root.querySelector('#cw').value,
        taboo: [...root.querySelectorAll('[data-taboo]')].map((i) => i.value),
        level,
      });
      formErrors = validateCard(card);
      if (!formErrors.length) {
        const { added } = addCustom(app, [card]);
        if (!added) formErrors = ['Cette carte existe déjà dans la bibliothèque.'];
        else toast(`« ${card.word} » ajoutée !`);
      }
      app.refresh();
    } else if (b.dataset.del) {
      app.saveCustom(app.custom.filter((c) => c.id !== b.dataset.del));
      app.refresh();
    } else if (b.dataset.act === 'export') {
      const blob = new Blob([JSON.stringify({ cards: app.custom.map(({ word, taboo, level }) => ({ word, taboo, level })) }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tabou-mes-cartes.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } else if (b.dataset.act === 'reset-history') {
      if (await confirmBox({ title: 'Réinitialiser l’historique ?', text: 'Toutes les cartes seront considérées comme jamais jouées.', ok: 'Réinitialiser', danger: true })) {
        app.cardStats = {};
        app.storage.saveCardStats({});
        toast('Historique des cartes réinitialisé.');
        app.refresh();
      }
    }
  });

  root.querySelector('#import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const { cards, errors } = parseImport(text, file.name);
    const { added, dupes } = addCustom(app, cards);
    app.refresh();
    const parts = [`${added} carte${added > 1 ? 's' : ''} importée${added > 1 ? 's' : ''}`];
    if (dupes) parts.push(`${dupes} déjà présente${dupes > 1 ? 's' : ''}`);
    if (errors.length) parts.push(`${errors.length} refusée${errors.length > 1 ? 's' : ''}`);
    toast(parts.join(' · '));
    if (errors.length) {
      await confirmBox({ title: 'Cartes refusées', text: errors.slice(0, 8).join('\n') + (errors.length > 8 ? `\n… et ${errors.length - 8} autres` : ''), ok: 'Compris', cancel: 'Fermer' });
    }
  });

  return () => {
    formErrors = [];
  };
}
