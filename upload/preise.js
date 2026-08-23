/* ============================================================
   PHONETASTIC – PREISE
   ============================================================

   >>> HIER UND NUR HIER WERDEN DIE PREISE GEAENDERT. <<<

   So funktioniert es:

   'iPhone 13': { display: 120, akku: 80, ... }
                            ^^^        ^^
                     Einfach die Zahl ueberschreiben. Fertig.

   Regeln:
   - Nur die Zahl aendern, alles andere so lassen
   - Zahlen OHNE Euro-Zeichen und OHNE Komma:  120   richtig
                                               120 € falsch
                                               120,- falsch
   - Kein Komma nach der Zahl vergessen, wenn noch etwas folgt
   - null  = zeigt "auf Anfrage" statt einem Preis an
   - Auf der Website erscheint vor jedem Preis ein "ab", weil der
     Endpreis von der gewaehlten Ersatzteil-Qualitaet abhaengt

   Neues Modell anlegen: eine bestehende Zeile kopieren, den Namen
   in den Anfuehrungszeichen aendern und die Preise anpassen.

   Alle Preise verstehen sich INKLUSIVE Arbeitszeit.
   ============================================================ */

const REPARATUR_LABELS = {
  display:      { name: 'Display-Tausch',        icon: '📱', dauer: '30–60 Min' },
  akku:         { name: 'Akku-Tausch',           icon: '🔋', dauer: '20–30 Min' },
  ladebuchse:   { name: 'Ladebuchse',            icon: '🔌', dauer: '45–60 Min' },
  kamera:       { name: 'Kamera',                icon: '📷', dauer: '30–45 Min' },
  rueckglas:    { name: 'Rückglas',              icon: '🪟', dauer: '60–90 Min' },
  lautsprecher: { name: 'Lautsprecher / Mikro',  icon: '🔊', dauer: '30–45 Min' },
  wasser:       { name: 'Wasserschaden',         icon: '💧', dauer: '1–3 Tage' },
  software:     { name: 'Software-Reparatur',    icon: '💾', dauer: '30–60 Min' },
  tastatur:     { name: 'Tastatur-Tausch',       icon: '⌨️', dauer: '1–2 Tage' },
  luefter:      { name: 'Lüfter &amp; Reinigung',    icon: '🌀', dauer: '1 Tag' }
};

/* Geraetegruppen, fuer die die Geraete-Retter-Praemie gilt.
   Stand 2026: Handys und Tablets sind ausdruecklich AUSGENOMMEN. */
const PRAEMIE_GRUPPEN = ['Laptop / Notebook'];

/* Reparaturarten, die bei Handys und Tablets angeboten werden.
   Preise gibt es derzeit nur fuer Display und Akku. */
const H = (display, akku) => ({
  display: display, akku: akku,
  ladebuchse: null, kamera: null, rueckglas: null,
  lautsprecher: null, wasser: null, software: null
});

/* Dasselbe fuer Laptops (andere Reparaturarten). */
const L = (display, akku) => ({
  display: display, akku: akku,
  ladebuchse: null, lautsprecher: null, wasser: null,
  software: null, tastatur: null, luefter: null
});

const PREISE = {
  'Apple': {
    'iPhone SE (2020/2022)': H(null, null),
    'iPhone X':              H(null, null),
    'iPhone XR':             H(null, null),
    'iPhone XS':             H(null, null),
    'iPhone XS Max':         H(null, null),
    'iPhone 11':             H(110, 70),
    'iPhone 11 Pro':         H(null, null),
    'iPhone 11 Pro Max':     H(null, null),
    'iPhone 12':             H(120, 80),
    'iPhone 12 mini':        H(null, null),
    'iPhone 12 Pro':         H(null, null),
    'iPhone 12 Pro Max':     H(null, null),
    'iPhone 13':             H(120, 80),
    'iPhone 13 mini':        H(null, null),
    'iPhone 13 Pro':         H(null, null),
    'iPhone 13 Pro Max':     H(180, 89),
    'iPhone 14':             H(110, 89),
    'iPhone 14 Plus':        H(null, null),
    'iPhone 14 Pro':         H(null, null),
    'iPhone 14 Pro Max':     H(null, null),
    'iPhone 15':             H(280, 100),
    'iPhone 15 Plus':        H(null, null),
    'iPhone 15 Pro':         H(null, null),
    'iPhone 15 Pro Max':     H(360, 110),
    'iPhone 16':             H(239, 129),
    'iPhone 16 Plus':        H(null, null),
    'iPhone 16 Pro':         H(null, null),
    'iPhone 16 Pro Max':     H(410, 110),
    'iPhone 17':             H(null, null),
    'iPhone 17 Pro':         H(null, null),
    'iPhone 17 Pro Max':     H(null, null)
  },

  'Samsung': {
    'Galaxy A13':            H(null, null),
    'Galaxy A14':            H(null, null),
    'Galaxy A15':            H(null, null),
    'Galaxy A52':            H(170, 60),
    'Galaxy A53':            H(165, 60),
    'Galaxy A54':            H(155, 60),
    'Galaxy A55':            H(null, null),
    'Galaxy S20 / S20 FE':   H(null, null),
    'Galaxy S21':            H(220, 80),
    'Galaxy S22':            H(270, 80),
    'Galaxy S23':            H(270, 80),
    'Galaxy S23 Ultra':      H(380, 80),
    'Galaxy S24':            H(290, 80),
    'Galaxy S24 Ultra':      H(360, 80),
    'Galaxy S25':            H(null, null),
    'Galaxy Z Flip (alle)':  H(null, null),
    'Galaxy Z Fold (alle)':  H(null, null)
  },

  'Xiaomi': {
    'Redmi Note 11 / 12':    H(null, null),
    'Redmi Note 13 / 14':    H(null, null),
    'Xiaomi 13 / 14':        H(null, null),
    'Poco (alle Modelle)':   H(null, null)
  },

  'Huawei': {
    'P30 / P40 Serie':       H(null, null),
    'Mate Serie':            H(null, null),
    'Nova Serie':            H(null, null)
  },

  'Google': {
    'Pixel 6 / 7':           H(null, null),
    'Pixel 8 / 9':           H(null, null)
  },

  'OnePlus / Oppo / Motorola': {
    'OnePlus (alle Modelle)':  H(null, null),
    'Oppo (alle Modelle)':     H(null, null),
    'Motorola (alle Modelle)': H(null, null)
  },

  /* Tablets: NICHT von der Geraete-Retter-Praemie gedeckt. */
  'Tablet / iPad': {
    'iPad (9./10. Generation)':  H(null, null),
    'iPad Air':                  H(null, null),
    'iPad Pro 11"':              H(null, null),
    'iPad Pro 12,9"':            H(null, null),
    'iPad mini':                 H(null, null),
    'Samsung Galaxy Tab A':      H(null, null),
    'Samsung Galaxy Tab S':      H(null, null),
    'Android-Tablet (sonstige)': H(null, null)
  },

  /* Laptops: einzige Geraetegruppe hier, die unter die
     Geraete-Retter-Praemie faellt (50 %, max. 130 EUR). */
  'Laptop / Notebook': {
    'Apple MacBook Air':              L(null, null),
    'Apple MacBook Pro':              L(null, null),
    'Lenovo ThinkPad':                L(null, null),
    'Lenovo IdeaPad / Yoga':          L(null, null),
    'HP EliteBook / ProBook':         L(null, null),
    'HP Pavilion / Envy':             L(null, null),
    'Dell Latitude / XPS':            L(null, null),
    'Dell Inspiron / Vostro':         L(null, null),
    'Acer Aspire / Swift':            L(null, null),
    'Acer Predator / Nitro (Gaming)': L(null, null),
    'Asus VivoBook / ZenBook':        L(null, null),
    'Asus ROG / TUF (Gaming)':        L(null, null),
    'MSI (Gaming)':                   L(null, null),
    'Razer (Gaming)':                 L(null, null),
    'Microsoft Surface':              L(null, null),
    'Samsung Galaxy Book':            L(null, null),
    'Chromebook (alle Marken)':       L(null, null),
    'Anderes Notebook':               L(null, null)
  }
};
