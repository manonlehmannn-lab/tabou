#!/usr/bin/env python3
"""Rend assets/icons/icon.svg en PNG aux tailles requises par iOS et le manifeste.

Usage : .venv/bin/python tools/make_icons.py   (Playwright + Pillow)
"""
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "assets" / "icons"


def render(svg, size, scale=1.0, bg="#1b0a45"):
    inner = int(size * scale)
    html = f"""<html><body style="margin:0;background:{bg};width:{size}px;height:{size}px;display:grid;place-items:center">
      <img src="data:image/svg+xml;base64,{__import__('base64').b64encode(svg.encode()).decode()}" width="{inner}" height="{inner}">
    </body></html>"""
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": size, "height": size})
        page.set_content(html)
        page.wait_for_timeout(200)
        png = page.screenshot()
        b.close()
    return Image.open(BytesIO(png)).convert("RGB")


def main():
    svg = (ICONS / "icon.svg").read_text(encoding="utf-8")
    full = render(svg, 1024)
    full.save(ICONS / "icon-1024.png")
    for name, size in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180), ("favicon-32.png", 32)]:
        full.resize((size, size), Image.LANCZOS).save(ICONS / name)
    # Version « maskable » : contenu réduit pour rester dans la zone sûre des masques Android.
    render(svg, 512, scale=0.8).save(ICONS / "icon-maskable-512.png")
    print("Icônes générées dans", ICONS.relative_to(ROOT))


if __name__ == "__main__":
    main()
