#!/bin/sh
# Construit la bibliothèque de cartes et le service worker, puis lance les tests.
set -e
cd "$(dirname "$0")/.."
python3 tools/cards.py build
python3 tools/build_sw.py
sh tools/test.sh
