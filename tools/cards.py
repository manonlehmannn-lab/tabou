#!/usr/bin/env python3
"""Validation et construction de la bibliothèque de cartes Tabou.

Usage :
    python3 tools/cards.py validate [fichier.json ...]   # contrôle (tous les fichiers par défaut)
    python3 tools/cards.py build                          # contrôle puis génère data/cards.json
    python3 tools/cards.py spell [fichier.json ...]       # orthographe via le correcteur macOS (français)
    python3 tools/cards.py stats                          # répartition par catégorie / niveau

Format d'un fichier source (cards-src/<categorie>.json) :
    {"category": "animaux",
     "cards": [{"word": "Girafe", "taboo": ["Cou", "Afrique", "Taches", "Grande", "Savane"], "level": 1}, ...]}
level : 1 = facile, 2 = normal, 3 = difficile.
"""
import json
import re
import subprocess
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "cards-src"
OUT = ROOT / "data" / "cards.json"

CATEGORIES = {
    "quotidien": "Vie quotidienne",
    "objets": "Objets",
    "metiers": "Métiers",
    "nourriture": "Nourriture",
    "animaux": "Animaux",
    "lieux": "Lieux et pays",
    "sciences": "Sciences",
    "technologie": "Technologie",
    "sport": "Sport",
    "cinema": "Cinéma et télévision",
    "musique": "Musique",
    "histoire": "Histoire et géographie",
    "personnalites": "Personnalités",
    "culture": "Culture générale",
    "expressions": "Expressions françaises",
    "situations": "Situations amusantes",
}
TABOO_COUNT = 5
# Mots-outils ignorés lors de la comparaison des racines.
STOP = set("""le la les l un une des de du d et ou en au aux a à sur sous dans par pour avec sans
ce cet cette ces se sa son ses mon ma mes ton ta tes qui que quoi est il elle on y ne pas plus""".split())


def norm(s):
    """Minuscules, sans accents, apostrophes et tirets en espaces."""
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[’'`\-–—_.,!?;:()«»\"/]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def tokens(s):
    return [t for t in norm(s).split() if t not in STOP and len(t) >= 3]


def stem(t):
    """Racine grossière : retire le pluriel et quelques terminaisons fréquentes."""
    for suf in ("ements", "ement", "euses", "euse", "eurs", "eur", "ettes", "ette", "ages", "age",
                "ions", "ion", "ies", "ie", "es", "s", "x", "e"):
        if len(t) - len(suf) >= 4 and t.endswith(suf):
            return t[: -len(suf)]
    return t


def shares_root(a, b):
    """Vrai si un mot significatif de a est contenu dans un mot de b (ou l'inverse)."""
    for x in tokens(a):
        for y in tokens(b):
            if x == y or stem(x) == stem(y):
                return True
            # « fer » ou « rail » pour « ferraille » : exemple du livret.
            short, long_ = (x, y) if len(x) <= len(y) else (y, x)
            if (len(short) == 3 and long_.startswith(short)) or (len(short) >= 4 and short in long_):
                return True
    return False


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", norm(s)).strip("-")


def load_sources(paths=None):
    files = [Path(p) for p in paths] if paths else sorted(SRC.glob("*.json"))
    out = []
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            out.append((f, None, f"JSON invalide : {e}"))
            continue
        out.append((f, data, None))
    return out


def check_card(card, category):
    """Renvoie la liste des erreurs bloquantes pour une carte."""
    errs = []
    if not isinstance(card, dict):
        return ["la carte n'est pas un objet"]
    word = card.get("word")
    taboo = card.get("taboo")
    level = card.get("level")
    if not isinstance(word, str) or not word.strip():
        return ["mot principal manquant"]
    if word != word.strip() or "  " in word:
        errs.append("espaces superflus dans le mot principal")
    if len(word) > 32:
        errs.append("mot principal trop long (> 32 caractères)")
    if word.isupper() and len(word) > 3:
        errs.append("mot principal en majuscules (l'affichage s'en charge)")
    if level not in (1, 2, 3):
        errs.append(f"niveau invalide : {level!r}")
    if category not in CATEGORIES:
        errs.append(f"catégorie inconnue : {category!r}")
    if not isinstance(taboo, list) or len(taboo) != TABOO_COUNT:
        n = len(taboo) if isinstance(taboo, list) else 0
        errs.append(f"{n} mots interdits au lieu de {TABOO_COUNT}")
        return errs
    seen = set()
    for t in taboo:
        if not isinstance(t, str) or not t.strip():
            errs.append("mot interdit vide")
            continue
        if t != t.strip() or "  " in t:
            errs.append(f"espaces superflus : {t!r}")
        if len(t) > 24:
            errs.append(f"mot interdit trop long : {t!r}")
        n = norm(t)
        if n in seen:
            errs.append(f"mot interdit en double : {t!r}")
        seen.add(n)
        if shares_root(word, t):
            errs.append(f"« {t} » reprend une partie du mot principal (déjà interdit par la règle)")
    # Deux mots interdits de même racine n'apportent qu'une seule vraie contrainte.
    for i in range(len(taboo)):
        for j in range(i + 1, len(taboo)):
            if isinstance(taboo[i], str) and isinstance(taboo[j], str) and shares_root(taboo[i], taboo[j]):
                errs.append(f"« {taboo[i]} » et « {taboo[j]} » ont la même racine")
    return errs


def validate(paths=None, quiet=False):
    errors, warnings = [], []
    cards = []
    by_word = {}
    for f, data, err in load_sources(paths):
        if err:
            errors.append(f"{f.name}: {err}")
            continue
        category = data.get("category")
        if category not in CATEGORIES:
            errors.append(f"{f.name}: catégorie inconnue {category!r}")
        if f.stem != category:
            warnings.append(f"{f.name}: le nom du fichier ne correspond pas à la catégorie {category!r}")
        for i, card in enumerate(data.get("cards", [])):
            where = f"{f.name}#{i + 1}"
            label = card.get("word") if isinstance(card, dict) else "?"
            for e in check_card(card, category):
                errors.append(f"{where} {label}: {e}")
            if not isinstance(card, dict) or not isinstance(card.get("word"), str):
                continue
            key = norm(card["word"])
            if key in by_word:
                errors.append(f"{where} {label}: doublon de {by_word[key]}")
                continue
            by_word[key] = where
            cards.append({**card, "category": category, "_where": where})

    # Quasi-doublons : singulier/pluriel ou variantes très proches du mot principal.
    stems = defaultdict(list)
    for c in cards:
        stems[" ".join(stem(t) for t in tokens(c["word"])) or norm(c["word"])].append(c)
    for k, group in stems.items():
        if len(group) > 1:
            names = ", ".join(f"{c['word']} ({c['_where']})" for c in group)
            warnings.append(f"mots principaux très proches : {names}")

    # Cartes quasi identiques : au moins 4 mots interdits communs.
    sets = [(c, {norm(t) for t in c["taboo"]}) for c in cards if isinstance(c.get("taboo"), list)]
    index = defaultdict(list)
    for idx, (c, s) in enumerate(sets):
        for t in s:
            index[t].append(idx)
    flagged = set()
    for idx, (c, s) in enumerate(sets):
        common = Counter(j for t in s for j in index[t] if j != idx)
        for j, n in common.items():
            if n >= 4 and (min(idx, j), max(idx, j)) not in flagged:
                flagged.add((min(idx, j), max(idx, j)))
                warnings.append(f"cartes trop proches : {c['word']} / {sets[j][0]['word']} ({n} interdits communs)")

    if not quiet:
        for w in warnings:
            print("ATTENTION", w)
        for e in errors:
            print("ERREUR", e)
        print(f"{len(cards)} cartes valides lues, {len(errors)} erreur(s), {len(warnings)} avertissement(s).")
    return cards, errors, warnings


def build():
    cards, errors, _ = validate(quiet=False)
    if errors:
        print("Construction annulée : corrigez les erreurs.")
        return 1
    out = []
    ids = set()
    for c in sorted(cards, key=lambda c: (list(CATEGORIES).index(c["category"]), norm(c["word"]))):
        cid = f"{c['category'][:3]}-{slug(c['word'])}"
        assert cid not in ids, cid
        ids.add(cid)
        out.append({"id": cid, "word": c["word"], "taboo": c["taboo"], "level": c["level"], "category": c["category"]})
    payload = {"version": 1, "count": len(out), "categories": CATEGORIES, "cards": out}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)} : {len(out)} cartes écrites.")
    return 0


SPELL_JXA = r"""
ObjC.import('AppKit'); ObjC.import('Foundation');
function run(argv) {
  var text = $.NSString.stringWithContentsOfFileEncodingError(argv[0], $.NSUTF8StringEncoding, null).js;
  var sc = $.NSSpellChecker.sharedSpellChecker;
  sc.setLanguage('fr');
  var out = [];
  text.split('\n').forEach(function (w) {
    if (!w) return;
    var r = sc.checkSpellingOfStringStartingAt(w, 0);
    if (r.length > 0) out.push(w);
  });
  return out.join('\n');
}
"""


def spell(paths=None):
    """Signale les mots inconnus du dictionnaire français de macOS (noms propres inclus : à relire)."""
    words = set()
    for _, data, err in load_sources(paths):
        if err:
            continue
        for c in data.get("cards", []):
            for w in [c.get("word", "")] + list(c.get("taboo", [])):
                for part in re.split(r"[\s\-’']+", w):
                    part = part.strip(".,!?()«»\"")
                    if part and not part[0].isdigit():
                        words.add(part)
    tmp = ROOT / "tools" / ".spell-words.txt"
    tmp.write_text("\n".join(sorted(words)), encoding="utf-8")
    try:
        res = subprocess.run(["osascript", "-l", "JavaScript", "-e", SPELL_JXA, str(tmp)],
                             capture_output=True, text=True, check=True)
    finally:
        tmp.unlink(missing_ok=True)
    unknown = [w for w in res.stdout.split("\n") if w]
    lower = [w for w in unknown if w[0].islower()]
    proper = [w for w in unknown if not w[0].islower()]
    print(f"{len(words)} mots contrôlés. Inconnus du dictionnaire : {len(lower)} en minuscule, {len(proper)} capitalisés.")
    print("Minuscules (fautes probables) :", ", ".join(sorted(lower)))
    print("Capitalisés (noms propres ou fautes) :", ", ".join(sorted(proper)))
    return 0


def stats():
    cards, errors, _ = validate(quiet=True)
    by_cat = Counter(c["category"] for c in cards)
    by_level = Counter(c["level"] for c in cards)
    for cat, label in CATEGORIES.items():
        lv = Counter(c["level"] for c in cards if c["category"] == cat)
        print(f"{label:28} {by_cat[cat]:5}   facile {lv[1]:4}  normal {lv[2]:4}  difficile {lv[3]:4}")
    print(f"TOTAL {len(cards)}  facile {by_level[1]}  normal {by_level[2]}  difficile {by_level[3]}  ({len(errors)} erreurs)")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "validate"
    args = sys.argv[2:] or None
    if cmd == "validate":
        _, errs, _ = validate(args)
        sys.exit(1 if errs else 0)
    elif cmd == "build":
        sys.exit(build())
    elif cmd == "spell":
        sys.exit(spell(args))
    elif cmd == "stats":
        stats()
    else:
        print(__doc__)
        sys.exit(2)
