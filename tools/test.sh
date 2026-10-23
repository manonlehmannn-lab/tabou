#!/bin/sh
# Tests du moteur et de la bibliothèque dans JavaScriptCore (moteur de Safari).
set -e
cd "$(dirname "$0")/.."
python3 tools/cards.py validate > /dev/null || { python3 tools/cards.py validate | grep ERREUR; exit 1; }
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
"$JSC" -m tests/run-jsc.js
