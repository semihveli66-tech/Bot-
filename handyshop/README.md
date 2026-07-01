# HandyShop Reumannplatz – Website

Voll funktionierende, responsive Website für einen Handy-Reparatur- und Verkaufsshop
in Wien-Favoriten am Reumannplatz.

## Inhalt / Bereiche

- **Hero** mit klarem Nutzenversprechen und Call-to-Action
- **Leistungen** (Display-Reparatur, Akku, Wasserschaden, Ladebuchse, Verkauf/Ankauf, Zubehör)
- **Preise** mit Richtwerten
- **Über uns** inkl. Öffnungszeiten & Anfahrt
- **Kontakt** mit funktionierendem Formular (Validierung + mailto) und OpenStreetMap-Karte
- Fixe Navigation mit Mobile-Menü, Scroll-Animationen, Floating-Anruf-Button
- SEO: Meta-Tags, Open Graph und `LocalBusiness`-Structured-Data

## Struktur

```
handyshop/
├── index.html      # Seiteninhalt
├── css/style.css   # komplettes Design (responsive)
├── js/main.js      # Navigation, Animationen, Formular
└── README.md
```

## Lokal öffnen

Einfach `index.html` im Browser öffnen – es sind keine Abhängigkeiten oder ein Build nötig.

Optional mit lokalem Server:

```bash
cd handyshop
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

## Anpassen (wichtig vor dem Livegang)

Ersetze die Platzhalter durch echte Daten:

| Platzhalter | Wo | Ändern auf |
|---|---|---|
| `01 234 56 78` / `+43123456780` | index.html, js/main.js | echte Telefonnummer |
| `info@handyshop-reumannplatz.at` | index.html, js/main.js | echte E-Mail |
| `Reumannplatz 1, 1100 Wien` | index.html | genaue Adresse |
| Preise (49 €, 35 €, 39 €) | index.html (Bereich Preise) | echte Preise |
| Karten-Koordinaten | index.html (iframe `marker=`) | echte Position |
| Impressum / Datenschutz | Footer-Links | Pflichtseiten ergänzen (in AT rechtlich erforderlich) |

## Kontaktformular

Das Formular validiert die Eingaben und öffnet das E-Mail-Programm (`mailto`).
Für echten serverlosen Versand einen Dienst wie **Formspree** eintragen:
in `js/main.js` den `mailto`-Block durch einen `fetch()`-POST an die Form-API ersetzen.

## Hinweis (Österreich)

Für den Livebetrieb sind **Impressum** und **Datenschutzerklärung** rechtlich verpflichtend.
Die Footer-Links sind bereits vorbereitet.
