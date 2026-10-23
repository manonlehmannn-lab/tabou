#!/usr/bin/env python3
"""Génère sw.js : liste des fichiers mis en cache et version dérivée de leur contenu.

À relancer après toute modification de l'application (tools/build.sh le fait).
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INCLUDE = ["index.html", "manifest.webmanifest", "css", "js", "data", "assets"]
SKIP_SUFFIX = {".txt", ".md", ".svg"}

TEMPLATE = """// Service worker généré par tools/build_sw.py — ne pas modifier à la main.
// Stratégie : tout est mis en cache à l'installation, puis servi depuis le cache (hors ligne).
const VERSION = '{version}';
const CACHE = `tabou-${{VERSION}}`;
const ASSETS = {assets};

self.addEventListener('install', (event) => {{
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
}});

self.addEventListener('activate', (event) => {{
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tabou-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
}});

self.addEventListener('fetch', (event) => {{
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, {{ ignoreSearch: true }}).then((hit) => {{
      if (hit) return hit;
      return fetch(req)
        .then((res) => {{
          if (res.ok) {{
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }}
          return res;
        }})
        .catch(() => (req.mode === 'navigate' ? caches.match('./') : Response.error()));
    }})
  );
}});
"""


def files():
    out = []
    for item in INCLUDE:
        p = ROOT / item
        if p.is_file():
            out.append(p)
        else:
            out.extend(sorted(f for f in p.rglob("*") if f.is_file() and f.suffix not in SKIP_SUFFIX and not f.name.startswith(".")))
    return out


def main():
    paths = files()
    h = hashlib.sha256()
    for f in paths:
        h.update(f.relative_to(ROOT).as_posix().encode())
        h.update(f.read_bytes())
    assets = ["./"] + [f.relative_to(ROOT).as_posix() for f in paths]
    body = "[\n" + "".join(f"  '{a}',\n" for a in assets) + "]"
    (ROOT / "sw.js").write_text(TEMPLATE.format(version=h.hexdigest()[:12], assets=body), encoding="utf-8")
    print(f"sw.js : {len(assets)} fichiers en cache, version {h.hexdigest()[:12]}")


if __name__ == "__main__":
    main()
