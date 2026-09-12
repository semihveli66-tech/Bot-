#!/usr/bin/env python3
"""
Baut aus dem Arbeitsstand das fertige Upload-Paket.

Aufruf:  python3 build.py

Ergebnis im Ordner upload/ – genau diese Dateien kommen per FTP auf den
Server, alle flach in dasselbe Verzeichnis (keine Unterordner noetig):

    index.html  impressum.html  datenschutz.html  fonts.css
    preise.js   kontakt.php     robots.txt        sitemap.xml
"""

import os
import shutil

WURZEL = os.path.dirname(os.path.abspath(__file__))
ZIEL = os.path.join(WURZEL, 'upload')


def lies(*teile):
    with open(os.path.join(WURZEL, *teile), encoding='utf-8') as f:
        return f.read()


def schreib(name, inhalt):
    with open(os.path.join(ZIEL, name), 'w', encoding='utf-8') as f:
        f.write(inhalt)


os.makedirs(ZIEL, exist_ok=True)

# ---- Startseite: CSS und main.js einbetten, preise.js bleibt separat ----
index = lies('index.html')
index = index.replace(
    '<link rel="stylesheet" href="css/style.css" />',
    '<style>\n' + lies('css', 'style.css') + '\n  </style>')
index = index.replace(
    '<script src="js/preise.js"></script>\n  <script src="js/main.js"></script>',
    '<script src="preise.js"></script>\n  <script>\n' + lies('js', 'main.js') + '\n  </script>')
assert 'href="css/' not in index and 'src="js/' not in index, 'Ordner-Verweis uebrig'
assert 'src="preise.js"' in index, 'preise.js nicht verlinkt'
schreib('index.html', index)

# ---- Rechtsseiten: eigenes, kompaktes Stylesheet einbetten ----
legal_css = lies('legal-style.css')
for quelle, ziel in [('src-impressum.html', 'impressum.html'),
                     ('src-datenschutz.html', 'datenschutz.html')]:
    seite = lies(quelle).replace(
        '<link rel="stylesheet" href="LEGAL_CSS" />',
        '<style>\n' + legal_css + '\n  </style>')
    assert 'LEGAL_CSS' not in seite, 'Platzhalter nicht ersetzt'
    schreib(ziel, seite)

# ---- Dateien, die unveraendert uebernommen werden ----
for name, pfad in [('preise.js', ('js', 'preise.js')),
                   ('fonts.css', ('fonts.css',)),
                   ('kontakt.php', ('kontakt.php',)),
                   ('robots.txt', ('robots.txt',)),
                   ('sitemap.xml', ('sitemap.xml',))]:
    schreib(name, lies(*pfad))

# ---- Vollversion in einer Datei (nur zur Vorschau, nicht fuer den Server) ----
vorschau = lies('index.html')
vorschau = vorschau.replace(
    '<link rel="stylesheet" href="css/style.css" />',
    '<style>\n' + lies('css', 'style.css') + '\n  </style>')
vorschau = vorschau.replace(
    '<script src="js/preise.js"></script>\n  <script src="js/main.js"></script>',
    '<script>\n' + lies('js', 'preise.js') + '\n' + lies('js', 'main.js') + '\n  </script>')
with open(os.path.join(WURZEL, 'phonetastic-komplett.html'), 'w', encoding='utf-8') as f:
    f.write(vorschau)

print('Upload-Paket gebaut:')
for f in sorted(os.listdir(ZIEL)):
    groesse = os.path.getsize(os.path.join(ZIEL, f)) // 1024
    print('  %-20s %3d KB' % (f, groesse))
