# PHONETASTIC – Handy Reparatur (Website)

Voll funktionierende, responsive Website für **PHONETASTIC**, den Handy-Reparatur-
und Verkaufsshop in Wien-Favoriten am Reumannplatz.

## Live-URL (nach Aktivierung von GitHub Pages)

```
https://semihveli66-tech.github.io/Bot-/
```

## Dateien

```
index.html       # Startseite (im Root, damit Pages sie direkt ausliefert)
css/style.css    # Design inkl. nachgebautem Neon-Logo (Grün → Blau)
js/main.js       # Navigation, Animationen, Kontaktformular
.nojekyll        # sorgt für korrekte Auslieferung über GitHub Pages
```

## Website live nehmen (GitHub Pages, kostenlos)

1. Repo auf GitHub öffnen → **Settings**
2. Linke Leiste → **Pages**
3. **Source**: „Deploy from a branch"
4. **Branch**: `claude/handyshop-favoriten-website-eyi3gg`, Ordner **`/ (root)`** → **Save**
5. Nach ca. 1 Minute ist die Seite unter obiger URL erreichbar.

Tipp: Zum dauerhaften Betrieb empfiehlt sich der Merge in den `main`-Branch und
dann Pages von `main` / `root` ausliefern.

## Sofort ansehen (ohne Pages)

`index.html` herunterladen und im Browser öffnen – oder lokal:

```bash
python3 -m http.server 8000   # dann http://localhost:8000
```

## Vor dem echten Livegang anpassen

| Platzhalter | ändern auf |
|---|---|
| `01 234 56 78` / `+43123456780` | echte Telefonnummer |
| `info@phonetastic.at` | echte E-Mail |
| `Reumannplatz 1, 1100 Wien` | genaue Adresse |
| Preise (49/35/39 €) | echte Preise |
| Karten-Koordinaten (iframe `marker=`) | echte Position |
| Impressum / Datenschutz (Footer) | Pflichtseiten (in AT gesetzlich erforderlich) |

## Logo

Das PHONETASTIC-Logo ist als CSS/HTML nachgebaut (Klasse `.brand`) – dadurch ist es
gestochen scharf auf allen Bildschirmen und lädt ohne zusätzliche Bilddatei.
