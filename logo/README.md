# Profilbild für Instagram

Vier Varianten, alle 1080 × 1080 px. Instagram schneidet das Quadrat rund
zu und zeigt es klein an: 150 px im Profil am Rechner, 110 px in der App,
56 px im Feed, 32 px bei Kommentaren. Alles Wichtige bleibt deshalb im
inneren Kreis, und jedes Zeichen wurde bis 32 px geprüft.

| Datei | Variante | Bemerkung |
|---|---|---|
| `phonetastic-profilbild-a-monogramm.png` | **A** – P auf Dunkel | Bleibt bis 32 px klar erkennbar |
| `phonetastic-profilbild-b-wortmarke.png` | **B** – PHONE / TASTIC | Bis 56 px lesbar, bei 32 px nur noch ein Fleck |
| `phonetastic-profilbild-c-handy.png` | **C** – P im Handy | Bis 32 px erkennbar, sagt zusätzlich, worum es geht |
| `phonetastic-profilbild-d-hell.png` | **D** – P auf Weiß | Heller Grund passend zur Einladung; auf weißem Hintergrund ist der Kreisrand unsichtbar |
| `phonetastic-profilbild-vergleich.png` | Übersicht | Alle vier in allen Größen nebeneinander |

## Neu erzeugen / ändern

```bash
cd logo
node render.js                                    # erzeugt die vier PNG
python3 mitte.py phonetastic-profilbild-[abcd]*.png  # prüft Mitte und Kreisrand
```

`mitte.py` sucht im fertigen Bild die farbigen Pixel und meldet, wie weit
das Zeichen von der Mitte abweicht und wie nah es dem Kreisrand kommt.
Das misst die tatsächliche Fläche des Zeichens – ein Buchstabe wie „P"
sitzt in seinem Schriftkasten nicht mittig und muss nachgerückt werden
(siehe `transform` bei `.mono` in `logo.html`).

Die Vorschau in Originalgrößen liegt in `vorschau.html`.
