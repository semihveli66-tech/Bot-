# PHONETASTIC – Website (phonetastic.at)

Responsive Website für **PHONETASTIC**, Handy-Reparatur und Zubehör-Shop in
Wien-Favoriten, Quellenstraße 111 (Ecke Favoritenstraße, beim Reumannplatz).

## Dateien

```
index.html       # Startseite
css/style.css    # Design inkl. Neon-Logo (Grün → Blau)
js/main.js       # Navigation, Animationen, Kontaktformular
CNAME            # Custom Domain für GitHub Pages (phonetastic.at)
robots.txt       # Suchmaschinen-Freigabe + Sitemap-Verweis
sitemap.xml      # Sitemap für Google
.nojekyll        # liefert alle Dateien unverändert über Pages aus
```

---

## Website live schalten auf phonetastic.at

### Schritt 1 – GitHub Pages aktivieren

1. Repo auf GitHub → **Settings** → **Pages**
2. **Source:** „Deploy from a branch"
3. **Branch:** `claude/handyshop-favoriten-website-eyi3gg`, Ordner **`/ (root)`** → **Save**
4. Unter **Custom domain** `phonetastic.at` eintragen → **Save**
   (Die Datei `CNAME` im Repo setzt das bereits – der Eintrag sollte automatisch erscheinen.)
5. Nach erfolgreicher DNS-Prüfung **„Enforce HTTPS"** aktivieren.

### Schritt 2 – DNS beim Domain-Anbieter eintragen

Im DNS-Verwaltungsbereich des Anbieters, bei dem `phonetastic.at` gekauft wurde:

**Für die Hauptdomain (phonetastic.at) – vier A-Records:**

| Typ | Name/Host | Wert |
|-----|-----------|------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

**Für www (www.phonetastic.at) – ein CNAME-Record:**

| Typ | Name/Host | Wert |
|-----|-----------|------|
| CNAME | `www` | `<github-benutzername>.github.io.` |

> Den Benutzernamen aus der eigenen Repo-URL übernehmen (der Teil zwischen
> `github.com/` und dem Repo-Namen) und den Punkt am Ende mitschreiben.
> Beim letzten Push meldete GitHub den Umzug des Repos nach
> `sesolarwien/Bot-sesolarwien` – dann lautet der Wert `sesolarwien.github.io.`
> Die vier A-Records oben sind davon unabhängig und bleiben gleich.

> DNS-Änderungen brauchen typischerweise 15 Minuten bis 24 Stunden, bis sie
> überall greifen. Danach prüft GitHub die Domain automatisch und stellt ein
> kostenloses SSL-Zertifikat aus (https).

### Schritt 3 – Prüfen

- `https://phonetastic.at` aufrufen
- In den Pages-Settings muss „DNS check successful" stehen
- Erst danach lässt sich **Enforce HTTPS** einschalten

### Empfehlung: auf `main` mergen

Für den Dauerbetrieb die Änderungen in den `main`-Branch mergen und GitHub Pages
von `main` / `root` ausliefern lassen. Dann bleibt die Seite unabhängig vom
Feature-Branch online.

---

## Nach dem Livegang bei Google eintragen

1. **Google Search Console** → Property `phonetastic.at` anlegen, Domain per
   DNS-TXT-Eintrag verifizieren, danach `https://phonetastic.at/sitemap.xml` einreichen.
2. **Google Business Profil** anlegen (wichtiger als die Website für Laufkundschaft):
   Adresse Quellenstraße 111, Kategorie „Handyreparatur", Öffnungszeiten, Fotos.

---

## Noch anzupassen (Platzhalter)

| Platzhalter | ändern auf |
|---|---|
| `01 234 56 78` / `+43123456780` | echte Telefonnummer |
| `info@phonetastic.at` | E-Mail-Postfach zur Domain einrichten |
| Preise (49/35/39 €) | echte Preise |
| Öffnungszeiten | echte Zeiten |
| Impressum / Datenschutz (Footer) | Pflichtseiten – in Österreich gesetzlich erforderlich |

## Lokal testen

```bash
python3 -m http.server 8000   # dann http://localhost:8000
```

## Logo

Das PHONETASTIC-Logo ist als CSS/HTML nachgebaut (Klasse `.brand`) – scharf auf
allen Bildschirmen, ohne zusätzliche Bilddatei.
