# Einladung zur Neueröffnung

Grafiken zur Eröffnung am **Samstag, 12.09.2026, ab 8:00 Uhr**, gestaltet
als Einladung: weißer Grund, feiner Doppelrahmen im Neon-Verlauf,
Einladungssatz in Serifenschrift. Der Schriftzug PHONETASTIC steht im
Neon-Verlauf grün → blau, alle Informationen darunter in Schwarz.

## Fertige Dateien

Es gibt zwei Fassungen derselben Einladung.

**Schlicht auf Weiß** (`post-*.html`)

| Datei | Größe | Wofür |
|---|---|---|
| `phonetastic-eroeffnung-post.png` | 1080 × 1080 | Instagram- und Facebook-Beitrag, Google-Business-Beitrag |
| `phonetastic-eroeffnung-story.png` | 1080 × 1920 | Instagram-/Facebook-Story, WhatsApp-Status |
| `phonetastic-eroeffnung-flyer-a4.png` | 2480 × 3508 (300 dpi) | Aushang im Schaufenster, Flyer |
| `phonetastic-eroeffnung-flyer-a4.pdf` | A4 | Datei für die Druckerei |

**Kalligrafie-Stil auf Creme** (`elegant-*.html`) – große Schreibschrift,
Band mit Schere, Abschlusssatz

| Datei | Größe | Wofür |
|---|---|---|
| `phonetastic-einladung-post.png` | 1080 × 1080 | Instagram- und Facebook-Beitrag |
| `phonetastic-einladung-story.png` | 1080 × 1920 | Story, WhatsApp-Status |
| `phonetastic-einladung-flyer-a4.png` | 2480 × 3508 (300 dpi) | Aushang, Flyer |
| `phonetastic-einladung-flyer-a4.pdf` | A4 | Datei für die Druckerei |

Schriften der Kalligrafie-Fassung: Great Vibes (Schreibschrift) und
Cormorant Garamond (Serifen-Kursive), beide SIL Open Font License,
als Base64 in `fonts-einladung.css` eingebettet.

Der QR-Code auf dem Flyer führt auf `https://phonetastic.at` (geprüft:
aus dem fertigen Bild wieder auslesbar).

## Neu erzeugen / ändern

Texte und Größen stehen in den HTML-Dateien, die gemeinsame Optik in
`post.css` (weiße Fassung) und `elegant.css` (Kalligrafie-Fassung).
Die Grundschrift kommt aus `../fonts.css`.

```bash
cd post
node render.js   # erzeugt alle sechs PNG und prüft auf Überläufe
node pdf.js      # erzeugt die beiden A4-PDF
```

`render.js` meldet, wenn Inhalt über die Leinwand hinausragt oder Text
abgeschnitten wird – nach jeder Textänderung einmal laufen lassen.

Den QR-Code neu bauen (nur nötig, wenn sich die Adresse ändert):

```bash
python3 -c "import segno; segno.make('https://phonetastic.at', error='m').save('qr.svg', scale=10, border=2, dark='#0b1220', light='#ffffff')"
```

## Texte zum Mitposten

### Instagram / Facebook – im Ton der Einladung

> ✨ Wir laden Sie herzlich zur Eröffnung ein!
>
> **Samstag, 12. September 2026, ab 8:00 Uhr**
> PHONETASTIC · Quellenstraße 111, 1100 Wien · beim Reumannplatz
>
> Bei uns finden Sie **Reparaturen** für Handy, Tablet und Laptop –
> Display, Akku, Ladebuchse, Rückglas, Kamera, Wasserschaden, Software
> und Datenrettung – sowie **Zubehör aller Art**: Hüllen, Panzerglas,
> Kabel, Ladegeräte, Powerbanks, Kopfhörer, Lautsprecher, Halterungen,
> Adapter und Speicherkarten.
>
> Diagnose gratis · viele Reparaturen in 30 Minuten · 12 Monate Garantie
>
> Mo – Sa 08:00 – 19:30 · Sonntag geschlossen
> 0660 651 12 62 · phonetastic.at
>
> Wir freuen uns auf Ihren Besuch!
>
> #phonetastic #handyreparatur #favoriten #reumannplatz #wien1100
> #displaytausch #akkutausch #handyzubehör #tabletreparatur
> #laptopreparatur #neueröffnung #wien

### Instagram / Facebook – lockere Fassung

> 🎉 NEUERÖFFNUNG – wir sind ab Samstag für euch da!
>
> Ab **Samstag, 12.09.2026, 8:00 Uhr** findet ihr PHONETASTIC in der
> **Quellenstraße 111, 1100 Wien** – direkt beim Reumannplatz.
>
> 🔧 REPARATUR für Handy, Tablet und Laptop
> Display, Akku, Ladebuchse, Rückglas, Kamera, Wasserschaden,
> Software und Datenrettung
>
> 🎧 ZUBEHÖR aller Art
> Hüllen, Panzerglas, Kabel, Ladegeräte, Powerbanks, Kopfhörer,
> Lautsprecher, Halterungen, Adapter, Speicherkarten
>
> ✅ Diagnose immer gratis
> ✅ Viele Reparaturen in 30 Minuten
> ✅ 12 Monate Garantie auf Ersatzteil und Arbeit
>
> 🕗 Mo – Sa 08:00 – 19:30 · Sonntag geschlossen
> 📞 0660 651 12 62
> 🌐 phonetastic.at
>
> Kommt vorbei – wir freuen uns auf euch!
>
> #phonetastic #handyreparatur #favoriten #reumannplatz #wien1100
> #displaytausch #akkutausch #handyzubehör #tabletreparatur
> #laptopreparatur #neueröffnung #wien

### WhatsApp-Status / kurze Version

> 🎉 Morgen geht's los! Ab Samstag, 12.09., 8:00 Uhr:
> PHONETASTIC, Quellenstraße 111, 1100 Wien (beim Reumannplatz).
> Reparatur für Handy, Tablet & Laptop + Zubehör aller Art.
> Diagnose gratis, 12 Monate Garantie. 📞 0660 651 12 62

### Google-Business-Beitrag

> Wir eröffnen am Samstag, 12.09.2026, um 8:00 Uhr in der Quellenstraße
> 111 beim Reumannplatz. Bei PHONETASTIC bekommst du Reparaturen für
> Handy, Tablet und Laptop – Display, Akku, Ladebuchse, Rückglas,
> Kamera, Wasserschaden – und Zubehör aller Art: Hüllen, Panzerglas,
> Kabel, Ladegeräte, Powerbanks, Kopfhörer, Halterungen und
> Speicherkarten. Diagnose gratis, 12 Monate Garantie.
