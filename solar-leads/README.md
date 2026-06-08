# ☀️ Solar-Lead-System Österreich (Start: Wien)

Findet Einfamilienhäuser **ohne** Solaranlage, rendert per KI photorealistische
Solarpanele auf ihr **echtes** Dach, und schickt dem Eigentümer eine
personalisierte Postkarte mit QR-Code → personalisierte Microsite mit
ROI-Rechner. Qualifizierte Termine werden an lokale Installateure verkauft.

> Dieser Ordner enthält **Schritt 1** des Systems: Datenbankschema + den
> ersten Workflow (Adresse → Satellitenbild + Dacheignung) + `.env.example`.

---

## Das große Bild — die Pipeline

| Stufe | Was passiert | Werkzeug | Status |
|------|---------------|----------|--------|
| 1. Adressen sammeln | Einfamilienhäuser in Wien finden | Herold / Google Maps | später |
| 2. **Dach prüfen** | Satellitenbild + Eignung (Süd, Fläche, Ertrag) | **Google Solar API** | ✅ **hier** |
| 3. Rendern | KI setzt Panels aufs echte Dach | Flux Kontext (fal.ai) | später |
| 4. Microsite | Personalisierte Seite + ROI-Rechner | Next.js / Vercel | später |
| 5. Postkarte | Druck + Versand mit QR-Code | Post.at | später |
| 6. Verkauf | Termin an Installateur | Dashboard | später |

**Tech-Stack:** Supabase + PostGIS · Next.js/Vercel · Google Maps & Solar API ·
Flux Kontext (fal.ai) · Post.at · Cloudflare R2.

---

## Was in diesem Ordner liegt

```
solar-leads/
├── db/
│   └── schema.sql                 # Datenbank-Tabelle "prospects" (mit PostGIS)
├── workflows/
│   └── 01-fetch-property.mjs      # Workflow 1: Adresse -> Dacheignung
├── .env.example                   # Alle benötigten Schlüssel (kopieren -> .env)
├── package.json
└── README.md                      # diese Datei
```

---

## In 5 Schritten zum ersten Lauf

### Schritt 1 — Google-Schlüssel besorgen (~10 Min.)
1. Gehe auf <https://console.cloud.google.com> und lege ein Projekt an.
2. Unter **APIs & Services → Library** diese drei APIs aktivieren:
   - **Maps Static API** (Satellitenbild)
   - **Solar API** (Dachdaten)
   - **Geocoding API** (Adresse → Koordinaten)
3. Unter **APIs & Services → Credentials** einen **API key** erstellen.
4. **Wichtig:** Unter **Billing** eine Zahlungsmethode hinterlegen — sonst
   antworten die APIs mit einem Fehler. (Google hat ein großzügiges
   Gratis-Kontingent; für Tests entstehen praktisch keine Kosten.)

### Schritt 2 — Datenbank anlegen (~5 Min.)
1. Auf <https://supabase.com> ein Projekt erstellen.
2. **SQL Editor → New query** öffnen.
3. Den **gesamten Inhalt** von `db/schema.sql` reinkopieren und **Run** klicken.
   → Das legt die Tabelle `prospects` an, aktiviert PostGIS und die Trigger.
4. (Optional, aber empfohlen) Unter **Project Settings → API** kopierst du
   `Project URL` und den `service_role`-Schlüssel für die `.env`.

> Du kannst den Workflow **auch ohne Supabase** testen — dann wird das Ergebnis
> nur in der Konsole angezeigt statt gespeichert.

### Schritt 3 — Schlüssel eintragen
```bash
cd solar-leads
cp .env.example .env
```
Öffne `.env` und trage mindestens `GOOGLE_MAPS_API_KEY` ein.
(Supabase & R2 optional für den ersten Test.)

### Schritt 4 — Pakete installieren
```bash
npm install
```

### Schritt 5 — Loslegen 🚀
```bash
node workflows/01-fetch-property.mjs "Mariahilfer Straße 12, 1060 Wien"
```

Du bekommst eine Ausgabe wie diese:

```
🏠 Verarbeite Adresse: Mariahilfer Straße 12, 1060 Wien
📍 Koordinaten: 48.1985, 16.3490 (Mariahilfer Straße 12, 1060 Wien, Österreich)
🛰️  Satellitenbild gespeichert: output/mariahilfer-strasse-12-1060-wien.png

— Dachanalyse —
  Gesamte Dachflaeche : 142.6 m²
  Sued-Flaeche        : 71.3 m²
  Beste Ausrichtung   : 176°  (180° = Sueden)
  Dachneigung         : 28°
  Sonnenstunden/Jahr  : 1180
  Max. Panels         : 24
  Eignungs-Score      : 87/100
  -> Geeignet?        : JA ✅

— Wirtschaftlichkeit (Schaetzung) —
  Anlagengroesse      : 9.6 kWp
  Jahresertrag        : 9420 kWh
  Investition         : € 13.440
  Ersparnis/Jahr      : € 1.366
  Amortisation        : 9.8 Jahre
```

Das Satellitenbild liegt danach im Ordner `output/`.

---

## Wie der Workflow entscheidet, ob ein Dach geeignet ist

Österreich liegt auf der **Nordhalbkugel** → ein **nach Süden** geneigtes Dach
bekommt am meisten Sonne. Das Skript prüft drei Dinge (aus der Google Solar API):

1. **Ausrichtung (Azimut):** Bestes Dachsegment sollte zwischen
   Südost und Südwest zeigen (110°–250°, ideal 180°).
2. **Fläche:** Mindestens ~20 m² Süd-Fläche, damit sich eine Anlage lohnt.
3. **Sonnenstunden:** Mindestens ~1000 Sonnenstunden/Jahr am besten Punkt.

Daraus ergibt sich ein **Eignungs-Score (0–100)**. Alle Schwellenwerte stehen
oben im Skript (`SUITABILITY`) und in `.env` (Wirtschaftlichkeit) — du kannst
sie jederzeit anpassen.

> **Bestehende Anlage erkennen:** Die Solar API sagt nicht zuverlässig, ob schon
> Panels montiert sind. Das Feld `has_existing_solar` setzen wir später per
> Bild-KI (Vision) anhand des Satellitenbilds. Für die ersten Tests prüfst du
> das Bild im `output/`-Ordner kurz selbst.

---

## Kosten pro geprüftem Haus (Schritt 1)

| API-Aufruf | Kosten |
|------------|--------|
| Geocoding | ~ $0,005 |
| Maps Static (Satellitenbild) | ~ $0,002 |
| Solar API (Building Insights) | ~ $0,01 |
| **Summe** | **~ $0,017 pro Haus** |

(Google gewährt monatliche Gratis-Kontingente — für Tests zahlst du faktisch nichts.)

---

## Nächste Schritte (kommende Workflows)
- **02 – Adressen-Quelle:** Einfamilienhäuser in Wiener Bezirken sammeln (Herold/Maps).
- **03 – KI-Rendering:** Flux Kontext (fal.ai) setzt Panels aufs echte Dach.
- **04 – Microsite:** Next.js-Vorlage mit ROI-Rechner, pro Haus deployed.
- **05 – Postkarte:** Post.at-Versand mit personalisiertem QR-Code.
- **06 – Eigentümer:** Grundbuch/Herold-Zuordnung (datenschutzkonform).

---

## Rechtlicher Hinweis (Österreich/EU)
Beim Anschreiben von Privatpersonen gelten **DSGVO** und das österreichische
**TKG/Postwerbe-Recht**. Adressierte Postwurfsendungen an Hauseigentümer sind
grundsätzlich zulässig, aber: Eigentümerdaten nur aus rechtmäßigen Quellen
(z.B. öffentliches Grundbuch), ein berechtigtes Interesse dokumentieren,
Widerspruchsmöglichkeit (Robinsonliste/„Bitte keine Werbung“) respektieren und
auf jeder Postkarte einen klaren Absender + Opt-out angeben. Im Zweifel vorab
juristisch prüfen lassen.
