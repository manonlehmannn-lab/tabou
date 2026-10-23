#!/usr/bin/env python3
"""Tests de bout en bout dans WebKit (moteur de Safari iOS), format iPhone.

Usage : .venv/bin/python tests/e2e.py
Lance un serveur local, joue des parties complètes via l'interface, vérifie la
sauvegarde/reprise et le fonctionnement hors ligne (mode avion simulé).
"""
import functools
import http.server
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
PORT = 8799
URL = f"http://localhost:{PORT}/"
results = []


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a: None
    httpd = http.server.ThreadingHTTPServer(("localhost", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def check(name, fn):
    try:
        fn()
        results.append((name, True, ""))
        print(f"  ✓ {name}")
    except Exception as e:  # noqa: BLE001
        results.append((name, False, str(e)))
        print(f"  ✗ {name}\n      {str(e).splitlines()[0][:300]}")


def new_page(browser, dark=False, clock=True):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                              has_touch=True, color_scheme="dark" if dark else "light")
    page = ctx.new_page()
    page.errors = []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    if clock:
        page.clock.install()
    page.goto(URL)
    page.wait_for_selector(".home")
    return ctx, page


def setup_game(page, names, turns=1, duration="30", dice="off", settings=None):
    if settings:
        page.evaluate(f"localStorage.setItem('tabou:v1:settings', JSON.stringify({settings}))")
        page.reload()
        page.wait_for_selector(".home")
    page.click("text=Nouvelle partie")
    # Ajuste le nombre de champs puis saisit les prénoms.
    while page.locator("[data-name]").count() < len(names):
        page.click('[data-act="plus"]')
    while page.locator("[data-name]").count() > len(names):
        page.click('[data-act="minus"]')
    for i, n in enumerate(names):
        page.locator("[data-name]").nth(i).fill(n)
    page.click("text=Continuer")
    if len(names) >= 4:
        page.wait_for_selector(".team-box")
    page.click("text=Continuer")
    page.click(f'[data-seg="duration"][data-value="{duration}"]')
    while int(page.locator(".stepper .val").inner_text()) > turns:
        page.click('[data-act="tminus"]')
    while int(page.locator(".stepper .val").inner_text()) < turns:
        page.click('[data-act="tplus"]')
    if len(names) >= 4:
        page.click(f'[data-seg="dice"][data-value="{dice}"]')
        page.click('[data-seg="startTeam"][data-value="A"]')
    page.click('[data-act="start"]')
    page.wait_for_selector(".intro")


def play_turn(page, actions, seconds=30):
    """Démarre le tour, effectue les actions, laisse le sablier s'écouler, valide."""
    page.click('[data-act="start"]')
    page.clock.run_for(2600)  # compte à rebours 3-2-1
    page.wait_for_selector(".tcard .taboo")
    for a in actions:
        page.clock.run_for(600)
        page.click({"guessed": ".act.ok", "passed": ".act.pass", "buzzed": ".buzzer"}[a])
    page.clock.run_for(seconds * 1000)
    page.clock.run_for(1500)
    page.wait_for_selector("text=Fin du tour")


def scores(page):
    return [int(x) for x in page.locator(".score-row .big").all_inner_texts()]


def main():
    httpd = serve()
    with sync_playwright() as p:
        browser = p.webkit.launch()

        def full_game_4():
            ctx, page = new_page(browser)
            setup_game(page, ["Alice", "Bob", "Chloé", "David"], turns=1)
            # Tour 1 (Violette) : 3 devinés, 1 passé, 1 buzzé → 3 / 2.
            expect(page.locator(".announce")).to_contain_text("À l’équipe Violette de jouer !")
            expect(page.locator(".announce")).to_contain_text("L’équipe Corail surveille les mots interdits")
            play_turn(page, ["guessed", "guessed", "passed", "guessed", "buzzed"])
            tiles = page.locator(".stat-tile .n").all_inner_texts()
            assert tiles == ["3", "1", "1"], tiles
            assert scores(page) == [3, 2], scores(page)
            page.click('[data-act="validate"]')
            # Trois autres tours : Corail 1, Violette 1, Corail 0 → 4 à 3.
            play_turn(page, ["guessed"])
            page.click('[data-act="validate"]')
            play_turn(page, ["guessed"])
            page.click('[data-act="validate"]')
            play_turn(page, [])
            expect(page.locator(".next-up")).to_contain_text("verdict")
            page.click('[data-act="validate"]')
            page.wait_for_selector(".victory")
            expect(page.locator(".victory h1")).to_contain_text("Équipe Violette gagne")
            final = page.locator(".final").inner_text().replace(" ", "")
            assert final == "4–3", final
            assert not page.errors, page.errors
            ctx.close()

        def tie_overtime():
            ctx, page = new_page(browser)
            setup_game(page, ["A1", "B1", "A2", "B2"], turns=1)
            for _ in range(4):
                play_turn(page, ["guessed"])
                page.click('[data-act="validate"]')
            # 2 – 2 après une série : prolongation annoncée sur l'écran suivant.
            expect(page.locator(".progress-line")).to_contain_text("Prolongation 1")
            assert not page.errors, page.errors
            ctx.close()

        def time_up_blocks_actions():
            ctx, page = new_page(browser)
            setup_game(page, ["A", "B", "C", "D"], turns=1)
            page.click('[data-act="start"]')
            page.clock.run_for(2600)
            page.wait_for_selector(".tcard .taboo")
            page.clock.run_for(30_000)
            # Le temps est écoulé : les boutons sont neutralisés.
            page.locator(".act.ok").click(force=True, timeout=2000)
            page.clock.run_for(1500)
            page.wait_for_selector("text=Fin du tour")
            assert page.locator(".stat-tile .n").first.inner_text() == "0"
            expect(page.locator(".card-list")).to_contain_text("Non jouée")
            ctx.close()

        def undo_and_correction():
            ctx, page = new_page(browser)
            setup_game(page, ["A", "B", "C", "D"], turns=1)
            page.click('[data-act="start"]')
            page.clock.run_for(2600)
            page.wait_for_selector(".tcard .taboo")
            first = page.locator(".tcard:not([class*=exit]) .w").inner_text()
            page.clock.run_for(500)
            page.click(".act.pass")
            page.clock.run_for(500)
            page.click('[data-act="undo"]')
            assert page.locator(".tcard:not([class*=exit]) .w").inner_text() == first, "la carte annulée revient"
            page.clock.run_for(500)
            page.click(".act.pass")
            page.clock.run_for(31_500)
            page.wait_for_selector("text=Fin du tour")
            assert scores(page) == [0, 1]
            page.click('[data-act="edit"]')
            page.locator('[data-fix="0"][data-r="guessed"]').click()
            assert scores(page) == [1, 0], scores(page)
            expect(page.locator(".panel")).to_contain_text("Modifications")
            ctx.close()

        def challenges_ui():
            ctx, page = new_page(browser)
            setup_game(page, ["A", "B", "C", "D", "E", "F"], turns=1, dice="manual")
            # Tête-à-tête : le départ exige de choisir le coéquipier.
            page.click('[data-challenge="tete"]')
            assert page.locator('[data-act="start"]').is_disabled()
            page.locator("[data-guesser]").first.click()
            assert page.locator('[data-act="start"]').is_enabled()
            # Double sablier : 60 s, puis compensation imposée à l'adversaire.
            page.click('[data-challenge="double"]')
            page.click('[data-act="start"]')
            page.clock.run_for(2600)
            page.wait_for_selector(".banner.double")
            assert page.locator("#digits").inner_text() in ("1:00", "0:59"), page.locator("#digits").inner_text()
            page.clock.run_for(62_000)
            page.wait_for_selector("text=Fin du tour")
            page.click('[data-act="validate"]')
            expect(page.locator(".challenge")).to_contain_text("Compensation")
            expect(page.locator("#ch-name")).to_have_text("Double sablier")
            assert page.locator(".challenge-picker").count() == 0
            play_turn(page, [], seconds=60)
            page.click('[data-act="validate"]')
            # Statue : rappel visuel.
            page.click('[data-challenge="statue"]')
            expect(page.locator(".announce")).to_contain_text("tient le téléphone")
            page.click('[data-act="start"]')
            page.clock.run_for(2600)
            page.wait_for_selector(".banner.statue")
            page.clock.run_for(31_500)
            page.wait_for_selector("text=Fin du tour")
            page.click('[data-act="validate"]')
            # Tout le monde joue : point à l'équipe qui trouve.
            page.click('[data-challenge="everyone"]')
            page.click('[data-act="start"]')
            page.clock.run_for(2600)
            page.wait_for_selector(".everyone-mode")
            page.clock.run_for(500)
            page.click('.act.teamA')  # l'adversaire (Violette) trouve pendant le tour de Corail
            page.clock.run_for(31_500)
            page.wait_for_selector("text=Fin du tour")
            expect(page.locator(".card-list")).to_contain_text("Trouvé par")
            assert not page.errors, page.errors
            ctx.close()

        def save_and_resume():
            ctx, page = new_page(browser, clock=False)
            setup_game(page, ["Alice", "Bob", "Chloé", "David"], turns=2)
            page.click('[data-act="start"]')
            page.wait_for_selector(".tcard .taboo", timeout=6000)
            page.wait_for_timeout(500)
            page.click(".act.ok")
            page.wait_for_timeout(400)
            page.click(".act.ok")
            # « Fermeture » de l'application en plein tour, puis réouverture.
            page.reload()
            page.wait_for_selector(".home")
            expect(page.locator('[data-act="resume"]')).to_contain_text("2 – 0")
            page.click('[data-act="resume"]')
            page.wait_for_selector(".overlay.pause")
            expect(page.locator(".overlay.pause")).to_contain_text("restantes")
            page.click('[data-p="resume"]')
            page.wait_for_timeout(300)
            assert page.locator("#digits").inner_text() != "0:00"
            assert page.locator('[data-sc="A"]').inner_text() == "2"
            assert not page.errors, page.errors
            ctx.close()

        def no_repeat_cards():
            ctx, page = new_page(browser)
            setup_game(page, ["A", "B", "C", "D"], turns=1)
            seen = []
            for _ in range(2):
                page.click('[data-act="start"]')
                page.clock.run_for(2600)
                page.wait_for_selector(".tcard .taboo")
                for _ in range(25):
                    page.clock.run_for(300)
                    seen.append(page.locator(".tcard:not([class*=exit]) .w").inner_text())
                    page.click(".act.ok")
                page.clock.run_for(31_500)
                page.wait_for_selector("text=Fin du tour")
                page.click('[data-act="validate"]')
            assert len(seen) == len(set(seen)) == 50, (len(seen), len(set(seen)))
            ctx.close()

        def solo_variant():
            ctx, page = new_page(browser)
            setup_game(page, ["Léa", "Max", "Zoé"], turns=1)
            expect(page.locator(".announce")).to_contain_text("faire deviner")
            play_turn(page, ["guessed", "guessed"])
            page.click('[data-act="validate"]')
            play_turn(page, ["guessed"])
            page.click('[data-act="validate"]')
            play_turn(page, [])
            page.click('[data-act="validate"]')
            page.wait_for_selector(".victory")
            expect(page.locator(".victory h1")).to_contain_text("Léa gagne")
            ctx.close()

        def screens_and_library():
            ctx, page = new_page(browser, dark=True)
            for go in ["rules", "library", "stats", "settings"]:
                page.click(f'[data-go="{go}"]')
                page.wait_for_selector(".topbar h1")
                page.click('.topbar [data-go="home"], .topbar [data-act="back"]')
                page.wait_for_selector(".home")
            page.click('[data-go="library"]')
            total = page.locator(".big-count .n").inner_text().replace(" ", "").replace(" ", "")
            assert int(total) >= 2000, total
            page.fill("#cw", "Raclette party")
            for i, w in enumerate(["Fromage", "Savoie", "Pommes de terre", "Appareil", "Hiver"]):
                page.locator("[data-taboo]").nth(i).fill(w)
            page.click('[data-act="add"]')
            expect(page.locator(".panel").last).to_contain_text("Raclette party")
            csv = "mot;i1;i2;i3;i4;i5;niveau\nCowboy maison;Chapeau;Cheval;États-Unis;Rodéo;Ranch;1\nRaté;Un\n"
            page.set_input_files("#import", files=[{"name": "cartes.csv", "mimeType": "text/csv", "buffer": csv.encode()}])
            page.wait_for_selector("text=Cartes refusées")
            page.click("text=Compris")
            expect(page.locator(".panel").last).to_contain_text("Cowboy maison")
            assert not page.errors, page.errors
            ctx.close()

        check("partie complète à 4 joueurs dans l’interface, score et vainqueur", full_game_4)
        check("égalité en fin de série → prolongation", tie_overtime)
        check("fin automatique à zéro, plus aucune carte validable", time_up_blocks_actions)
        check("annulation d’une action et correction après le tour", undo_and_correction)
        check("défis du dé : tête-à-tête, double sablier + compensation, statue, tout le monde joue", challenges_ui)
        check("sauvegarde et reprise après fermeture en plein tour", save_and_resume)
        check("aucune carte répétée sur 50 cartes jouées", no_repeat_cards)
        check("variante non officielle à 3 joueurs", solo_variant)
        check("écrans annexes, bibliothèque, ajout et import de cartes", screens_and_library)
        browser.close()

        # Mode avion : Chromium, dont Playwright pilote le réseau des service workers.
        def airplane_mode():
            b = p.chromium.launch()
            ctx = b.new_context(viewport={"width": 390, "height": 844})
            page = ctx.new_page()
            page.goto(URL)
            page.wait_for_selector(".home")
            page.evaluate("navigator.serviceWorker.ready")
            page.reload()
            page.wait_for_selector(".home")
            page.wait_for_function("navigator.serviceWorker.controller !== null")
            ctx.set_offline(True)
            page.reload()
            page.wait_for_selector(".home")
            expect(page.locator(".footer-note")).to_contain_text("2")
            page.click("text=Nouvelle partie")
            for i, n in enumerate(["A", "B", "C", "D"]):
                page.locator("[data-name]").nth(i).fill(n)
            page.click("text=Continuer")
            page.click("text=Continuer")
            page.click('[data-act="start"]')
            page.click('[data-act="start"]')
            page.wait_for_selector(".tcard .taboo", timeout=8000)
            assert page.locator(".tcard .taboo li").count() == 5
            assert page.evaluate("document.fonts.check('700 20px Fredoka')"), "polices disponibles hors ligne"
            b.close()

        check("fonctionnement intégral hors ligne (mode avion)", airplane_mode)
    httpd.shutdown()
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} scénarios réussis.")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
