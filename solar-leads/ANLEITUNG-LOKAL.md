# 💻 Das Projekt auf deinem eigenen Computer einrichten

Diese Anleitung führt dich **von null** dazu, das komplette Solar-System auf
deinem PC oder Mac laufen zu lassen — inklusive KI-Rendering und Supabase
(beides ist in der Cloud-Umgebung durch eine Firewall blockiert, auf deinem
Rechner aber frei).

> Keine Sorge, wenn du noch nie ein Terminal benutzt hast — jeder Schritt ist
> erklärt. Du kopierst Befehle und drückst Enter.

---

## Überblick: Was du gleich tust
1. **Node.js installieren** (die Software, die unsere Skripte ausführt)
2. **Den Code herunterladen**
3. **Schlüssel eintragen** (`.env`)
4. **Pakete installieren** (`npm install`)
5. **Workflows starten** 🚀

---

## Schritt 1 — Node.js installieren

Node.js ist das Programm, das unsere `.mjs`-Skripte ausführt.

### Windows
1. Geh auf **https://nodejs.org**
2. Klick auf den großen Button **„LTS"** (empfohlene Version) → lädt eine `.msi`-Datei
3. Datei öffnen, immer auf **„Weiter / Next"** klicken, fertig
4. Zum Prüfen: drück die **Windows-Taste**, tippe **„cmd"**, öffne die **Eingabeaufforderung**, tippe:
   ```
   node --version
   ```
   Wenn eine Nummer wie `v22.x.x` erscheint → geschafft. ✅

### Mac
1. Geh auf **https://nodejs.org**
2. Klick auf **„LTS"** → lädt eine `.pkg`-Datei
3. Datei öffnen, durchklicken, fertig
4. Zum Prüfen: öffne **„Terminal"** (Cmd+Leertaste → „Terminal" tippen), dann:
   ```
   node --version
   ```
   Nummer erscheint → geschafft. ✅

---

## Schritt 2 — Den Code herunterladen

Du hast zwei Möglichkeiten:

### Variante A — Als ZIP (am einfachsten, ohne Git)
1. Geh zu deinem GitHub-Repository im Browser
2. Wechsle oben links auf den Branch **`claude/modest-hopper-6U1Xe`**
3. Grüner Button **„Code" → „Download ZIP"**
4. ZIP entpacken (Rechtsklick → „Alle extrahieren")
5. Im entpackten Ordner findest du den Unterordner **`solar-leads`**

### Variante B — Mit Git (falls du Git hast)
```bash
git clone <DEINE-REPO-URL>
cd <repo-ordner>
git checkout claude/modest-hopper-6U1Xe
cd solar-leads
```

---

## Schritt 3 — Ins Projekt wechseln (Terminal)

Du musst dem Terminal sagen, dass es im Ordner `solar-leads` arbeiten soll.

- **Windows (Eingabeaufforderung):**
  ```
  cd C:\Pfad\zu\solar-leads
  ```
  💡 Trick: Tippe `cd ` (mit Leerzeichen), dann **zieh den Ordner `solar-leads`**
  ins Terminal-Fenster — der Pfad wird automatisch eingefügt. Enter drücken.

- **Mac (Terminal):**
  ```
  cd /Pfad/zu/solar-leads
  ```
  💡 Trick: `cd ` tippen, dann den Ordner ins Terminal ziehen, Enter.

---

## Schritt 4 — Schlüssel eintragen (`.env`)

1. Kopiere die Vorlage zur echten Datei:
   - **Mac/Linux:** `cp .env.example .env`
   - **Windows:** `copy .env.example .env`
2. Öffne die neue Datei `.env` mit einem Texteditor (Editor/TextEdit reicht).
3. Trage deine Schlüssel ein (du hast die meisten schon):

   ```
   GOOGLE_MAPS_API_KEY=AIza...        (dein Google-Schlüssel)
   SUPABASE_URL=https://....supabase.co
   SUPABASE_SERVICE_KEY=eyJ...        (dein service_role-Schlüssel)
   FAL_KEY=...                        (NEU: von https://fal.ai → API Keys)
   ```

   👉 **Den `FAL_KEY`** holst du dir neu: auf **https://fal.ai** anmelden →
   **„API Keys"** → Schlüssel kopieren → einfügen. (Kostet ein paar Cent
   pro gerendertem Bild; zum Start gibt es oft ein Gratis-Guthaben.)

4. Speichern.

---

## Schritt 5 — Pakete installieren

Einmalig im Ordner `solar-leads`:
```
npm install
```
Das lädt die nötigen Bausteine (Supabase-Client, dotenv). Dauert ~10 Sekunden.

---

## Schritt 6 — Die Workflows starten 🚀

Jetzt läuft alles bei dir — **ohne Firewall**. Die übliche Reihenfolge:

```bash
# 1) Ein Haus prüfen (Adresse -> Satellitenbild + Dachanalyse + ROI)
#    Speichert lokal UND direkt in deine Supabase-Datenbank.
node workflows/01-fetch-property.mjs "Khekgasse 20, 1230 Wien"

# 2) Solarpanele aufs Dach rendern (KI, via fal.ai)
node workflows/03-render-panels.mjs

# 3) Microsites bauen (mit Vorher/Nachher-Slider, da jetzt Render-Bild da ist)
node workflows/04-build-microsite.mjs

# 4) (Optional) Alle lokal gesammelten Haeuser nach Supabase hochladen
node workflows/import-to-supabase.mjs
```

Die fertigen Microsites liegen unter **`output/sites/<adresse>.html`** —
einfach doppelklicken, sie öffnen sich im Browser.

---

## Häufige Fragen / Probleme

**„node wird nicht erkannt"** → Node.js ist nicht installiert oder das Terminal
muss neu geöffnet werden (schließen und wieder öffnen).

**„GOOGLE_MAPS_API_KEY fehlt"** → Du bist im falschen Ordner oder die `.env`
heißt versehentlich `.env.txt`. Sie muss exakt `.env` heißen und im Ordner
`solar-leads` liegen.

**Supabase „Host not in allowlist"** → Das passiert NUR in der Cloud-Umgebung.
Auf deinem Rechner gibt es das nicht — dort speichert es direkt.

**fal.ai-Fehler 401/403** → Der `FAL_KEY` fehlt oder ist falsch kopiert.

---

## Was läuft wo?

| | Cloud (hier) | Dein Rechner |
|---|---|---|
| Dachanalyse (Google) | ✅ | ✅ |
| Microsites bauen | ✅ | ✅ |
| KI-Rendering (fal.ai) | ❌ Firewall | ✅ |
| Supabase speichern | ❌ Firewall | ✅ |

Auf deinem Rechner funktioniert **alles** — darum ist das der beste Ort für den
kompletten Durchlauf.
