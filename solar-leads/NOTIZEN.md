# 📌 Notizen & Verbesserungen — Solar-Lead-System

Gesammelte Erkenntnisse und nächste Verbesserungen. Lebendiges Dokument.

---

## ⚖️ 1. Rechtssicherheit (DSGVO / Österreich) — WICHTIG

**Grundsatz:** Adressierte Postwerbung darf auf **„berechtigtes Interesse"**
(Art. 6 (1) f DSGVO, Erwägungsgrund 47) gestützt werden — der rechtlich
einfachste Werbekanal (anders als E-Mail/Telefon = brauchen Einwilligung).

**Pflichten (unabhängig vom Versanddienst):**
- Adressen nur aus rechtmäßiger Quelle (OSM/öffentliche Daten; Eigentümer aus Grundbuch nur mit Sorgfalt)
- Informationspflicht (Art. 14) erfüllen
- **Robinsonliste** (WKO) prüfen + Widerspruch/Opt-out respektieren
- Absender + Opt-out auf jeder Karte (✅ bereits drauf)

**Beim Druck-/Versanddienst (POKAmax, EchtPost, Lettershop):**
- **Auftragsverarbeitungsvertrag (AVV)** abschließen — sie verarbeiten Adressen
  in unserem Auftrag. EU-Anbieter (DE) ist DSGVO-mäßig besser als US-Dienst.

**Vor großem Versand:** einmal von österr. DSGVO-Anwalt absegnen lassen.

### Haftung vermeiden (Punkt "Genauigkeit/Vertrauen")
Nie etwas Verbindliches versprechen — nur **einladen** (wie die US-Anbieter):
- Render-Bild beschriften: **„So könnte Ihr Dach mit Solar aussehen —
  unverbindliche Visualisierung"**
- ROI immer als **„Schätzwerte — finale Auslegung durch den Installateur"**
- Nie „Sie sparen X €", sondern **„bis zu / typischerweise"**
- CTA = **kostenlose, unverbindliche Beratung** (echte Zahlen macht der Installateur vor Ort)

---

## 💼 2. Zwei Geschäftsmodelle (man kann beides anbieten)

**Modell A — Termin-/Lead-Agentur (Originalplan)**
- Wir fahren die Kampagnen selbst, erzeugen qualifizierte Termine,
  **verkaufen Termine** an Installateure (Pay-per-Termin / Provision).
- + höhere Marge pro Abschluss  − wir tragen Kosten + Conversion-Risiko, mehr Operations.

**Modell B — System als Service vermieten (wie reworked.ai)**
- Wir bieten Installateuren unser **System** an. Sie wählen einen Bezirk,
  unser System verschickt die personalisierten Postkarten **unter ihrer Marke**,
  Termine gehen direkt an sie. Abrechnung pro Haus / Monatspaket.
- + planbarer/wiederkehrender Umsatz, weniger Risiko/Operations für uns,
  leichteres „Ja" (Tool statt unbewiesener Leads)  − weniger Wert pro Einheit.

**Empfehlung:** Mit A starten, um Conversion zu beweisen → dann B als
skalierbares, wiederkehrendes Modell (oder beides parallel anbieten).

---

## 🖼️ 3. Bild-Qualität verbessern (für morgen geplant)

Reihenfolge nach Wirkung:
1. **Straßenansicht / Schrägluftbild** statt Top-Down (Google Street View Static
   API; emotional am stärksten: „Das ist MEIN Haus mit Solar") → neuer Workflow
2. **Präzise Dach-Maske** aus Solar-API-Polygonen → Panels sitzen exakt (Inpainting)
3. **Hochskalieren** (Real-ESRGAN) + **Referenzbild** echter Anlagen → realistischer Look
4. **Hybrid:** geometrisch korrekte Lage + KI für Fotorealismus
5. Profi-Liga: 3D-Modell aus Höhendaten + echte 3D-Panels (mehr Aufwand)

US-Anbieter rendern das Dach NICHT fotorealistisch → hier sind wir voraus.

---

## 🧪 4. Test-Plan (billig herausfinden, ob es funktioniert)

Bevor groß investiert wird — zwei Dinge beweisen (~200–400 €, 2 Wochen):
1. **Verkaufs-Test:** mit 5 lokalen Installateuren reden, Demo zeigen.
   Sagt einer „Ja, dafür zahle ich X €"? → starkes Signal.
2. **Conversion-Test:** 50–100 echte Karten in 1 Bezirk. Messen: QR-Scans, Buchungen.

Benchmarks (US): Antwortquote **3–5 %**, Abschluss **3,2× besser als Online-Ads**,
Kosten ~2,7–4,5 $/Haus.

---

## ✅ Status (Stand der Technik)
Komplett gebaut: W1 Analyse · W2 Adressen sammeln · W3 KI-Render ·
W4 Microsite · W5 Postkarte · W6 Angebot · W7 Video · W8 Mailing-Export ·
W9 Versand (EchtPost + POKAmax) · W10 PDF. Live-Demo auf GitHub Pages.
Offen: Versanddienst-Freischaltung, Eigentümer-Namen (optional), Dashboard.
