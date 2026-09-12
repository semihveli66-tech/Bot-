# PHONETASTIC – Website (phonetastic.at)

Responsive Website für **PHONETASTIC**, Handy-Reparatur und Zubehör-Shop in
Wien-Favoriten, Quellenstraße 111 (Ecke Favoritenstraße, beim Reumannplatz).

## Dateien

```
Arbeitsstand (hier wird bearbeitet):

index.html       # Startseite
css/style.css    # Design inkl. Neon-Logo (Grün → Blau)
js/preise.js     # >>> ALLE PREISE – hier werden sie geändert <<<
js/main.js       # Navigation, Preisrechner, FAQ, Kontaktformular
kontakt.php      # nimmt Formular-Anfragen entgegen und mailt sie weiter
robots.txt       # Suchmaschinen-Freigabe + Sitemap-Verweis
sitemap.xml      # Sitemap für Google

Fertig zum Hochladen (aus dem Arbeitsstand erzeugt):

upload/          # dieselbe Seite ohne Unterordner, siehe Abschnitt Hosting
```

---

## Kontaktformular: wohin gehen die Anfragen?

Es sind drei Adressen im Spiel:

| Adresse | Rolle |
|---|---|
| `info@phonetastic.at` | steht auf der Website, hier schreiben Kunden direkt hin (Weiterleitung aufs Outlook-Postfach) |
| `noreply@phonetastic.at` | Absender, mit dem der Server die Formular-Mails verschickt |
| `phonetastic1@outlook.com` | Empfänger der Formular-Anfragen, eingestellt in `kontakt.php` |

Das Formular schickt die Anfrage an `kontakt.php`, das Skript mailt sie an das
Outlook-Postfach – bewusst direkt und nicht über die Weiterleitung, damit ein
Zwischenschritt weniger schiefgehen kann. Antwortet man auf diese Mail, geht
die Antwort direkt an den Kunden (Reply-To ist dessen Adresse).

### Damit das funktioniert – zwei Voraussetzungen

1. **Hosting mit PHP.** Bei All-Inkl ist PHP enthalten – dort läuft es sofort.
   Auf GitHub Pages funktioniert es **nicht**, weil dort nur statische Dateien
   ausgeliefert werden. In dem Fall greift automatisch die Notlösung: Es öffnet
   sich das E-Mail-Programm des Besuchers.

2. **Absender-Postfach anlegen.** Im All-Inkl-KAS unter *E-Mail* die Adresse
   `noreply@phonetastic.at` anlegen. Mails müssen von der eigenen Domain kommen,
   sonst stuft Outlook sie als Spam ein oder lehnt sie ab.
   Wer eine andere Adresse verwenden will, ändert oben in `kontakt.php`
   die Zeile `$ABSENDER`.

### Empfängeradresse ändern

In `kontakt.php` ganz oben:

```php
$EMPFAENGER = 'phonetastic1@outlook.com';
```

### Schutz vor Spam

Das Formular enthält ein unsichtbares Feld („Honeypot"). Bots füllen es aus,
Menschen sehen es nicht – solche Einsendungen werden verworfen. Zusätzlich
werden Zeilenumbrüche aus allen Feldern entfernt, damit niemand fremde
Mail-Empfänger einschleusen kann.

---

## Preise ändern

Alle Preise stehen in **`js/preise.js`** (auf dem Server: `preise.js`). Dort einfach die Zahl überschreiben:

```js
'iPhone 13': { display: 109, akku: 59, ... }
```

Nur die Zahl ändern – ohne Euro-Zeichen, ohne Komma. `null` zeigt
„auf Anfrage" an. Die Datei enthält oben eine ausführliche Anleitung.

---

## Hosting: All-Inkl

Die Seite liegt bei All-Inkl, wo auch die Domain registriert ist. Deshalb sind
keine DNS-Änderungen nötig – die Domain zeigt bereits auf den richtigen Server.

### Dateien auf den Server bringen

Hochgeladen wird das Paket aus dem Ordner `upload/`. Dort sind CSS und
`main.js` in `index.html` eingebettet, damit keine Unterordner angelegt werden
müssen:

```
index.html      preise.js      kontakt.php      robots.txt      sitemap.xml
```

Alle fünf Dateien kommen flach in das Verzeichnis der Domain (über
[webftp.all-inkl.com](https://webftp.all-inkl.com) oder FileZilla). Eine
eventuell vorhandene `index.htm` von All-Inkl löschen, sonst wird sie
statt der eigenen Startseite ausgeliefert.

### Einstellungen im KAS

| Bereich | Einstellung |
|---|---|
| FTP | eigener FTP-Nutzer nötig – die KAS-Zugangsdaten funktionieren dafür nicht |
| Domain → SSL-Schutz | Reiter **Let's Encrypt**, Zertifikat beziehen und binden. Das Server-Zertifikat (`kasserver.com`) reicht nicht, es löst eine Browser-Warnung aus. |
| Domain | **SSL erzwingen** erst einschalten, wenn das Zertifikat gebunden ist – sonst schlägt schon die Domain-Prüfung von Let's Encrypt fehl |
| E-Mail | Postfach `noreply@phonetastic.at` (Absender) und `info@phonetastic.at` (Weiterleitung aufs Outlook-Postfach) |

### Änderungen später

Nur die geänderte Datei neu hochladen. Für Preise genügt `preise.js` – die
lässt sich im WebFTP direkt im Browser bearbeiten.

---

## Nach dem Livegang bei Google eintragen

1. **Google Search Console** → Property `phonetastic.at` anlegen, per
   DNS-TXT-Eintrag verifizieren, danach `https://phonetastic.at/sitemap.xml` einreichen.
2. **Google Business Profil** anlegen – für Laufkundschaft wichtiger als die
   Website selbst: Adresse Quellenstraße 111, Kategorie „Handyreparatur",
   Öffnungszeiten, Fotos.

---

## Noch offen

| Punkt | Status |
|---|---|
| Preise | Platzhalter aus Marktpreisen – noch durch die echten ersetzen |
| Öffnungszeiten | derzeit Mo–Fr 09:00–18:30, Sa 09:00–13:00 |
| Impressum / Datenschutz | fehlen noch – in Österreich gesetzlich erforderlich |

## Lokal testen

```bash
python3 -m http.server 8000   # dann http://localhost:8000
```

## Logo

Das PHONETASTIC-Logo ist als CSS/HTML nachgebaut (Klasse `.brand`) – scharf auf
allen Bildschirmen, ohne zusätzliche Bilddatei.
