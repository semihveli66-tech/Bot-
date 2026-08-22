/* ============================================================
   PHONETASTIC – PREISE
   ============================================================

   >>> HIER UND NUR HIER WERDEN DIE PREISE GEAENDERT. <<<

   So funktioniert es:

   'iPhone 13': { display: 109, akku: 59, ladebuchse: 69, ... }
                            ^^^        ^^
                     Einfach die Zahl ueberschreiben. Fertig.

   Regeln:
   - Nur die Zahl aendern, alles andere so lassen
   - Zahlen OHNE Euro-Zeichen und OHNE Komma:  109   richtig
                                               109 € falsch
                                               109,- falsch
   - Kein Komma nach der Zahl vergessen, wenn noch etwas folgt
   - null  = zeigt "auf Anfrage" statt einem Preis an
   - Eine Reparaturart ganz weglassen = sie erscheint bei dem
     Geraet nicht in der Liste

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

const PREISE = {
  'Apple': {
    'iPhone SE (2020/2022)': { display: 59,  akku: 39, ladebuchse: 49, kamera: 59,  rueckglas: 49,  lautsprecher: 49, wasser: 49, software: 39 },
    'iPhone X':              { display: 79,  akku: 45, ladebuchse: 55, kamera: 69,  rueckglas: 69,  lautsprecher: 55, wasser: 49, software: 39 },
    'iPhone XR':             { display: 79,  akku: 45, ladebuchse: 55, kamera: 69,  rueckglas: 69,  lautsprecher: 55, wasser: 49, software: 39 },
    'iPhone XS':             { display: 89,  akku: 45, ladebuchse: 55, kamera: 69,  rueckglas: 79,  lautsprecher: 55, wasser: 49, software: 39 },
    'iPhone XS Max':         { display: 99,  akku: 49, ladebuchse: 59, kamera: 79,  rueckglas: 89,  lautsprecher: 59, wasser: 49, software: 39 },
    'iPhone 11':             { display: 79,  akku: 49, ladebuchse: 59, kamera: 79,  rueckglas: 79,  lautsprecher: 59, wasser: 49, software: 39 },
    'iPhone 11 Pro':         { display: 109, akku: 49, ladebuchse: 59, kamera: 89,  rueckglas: 89,  lautsprecher: 59, wasser: 49, software: 39 },
    'iPhone 11 Pro Max':     { display: 129, akku: 55, ladebuchse: 65, kamera: 99,  rueckglas: 99,  lautsprecher: 65, wasser: 49, software: 39 },
    'iPhone 12 / 12 Pro':    { display: 99,  akku: 55, ladebuchse: 65, kamera: 89,  rueckglas: 99,  lautsprecher: 65, wasser: 49, software: 39 },
    'iPhone 12 mini':        { display: 99,  akku: 55, ladebuchse: 65, kamera: 89,  rueckglas: 89,  lautsprecher: 65, wasser: 49, software: 39 },
    'iPhone 12 Pro Max':     { display: 129, akku: 59, ladebuchse: 69, kamera: 99,  rueckglas: 109, lautsprecher: 69, wasser: 49, software: 39 },
    'iPhone 13':             { display: 109, akku: 59, ladebuchse: 69, kamera: 99,  rueckglas: 99,  lautsprecher: 69, wasser: 49, software: 39 },
    'iPhone 13 mini':        { display: 109, akku: 59, ladebuchse: 69, kamera: 99,  rueckglas: 99,  lautsprecher: 69, wasser: 49, software: 39 },
    'iPhone 13 Pro':         { display: 149, akku: 65, ladebuchse: 75, kamera: 119, rueckglas: 119, lautsprecher: 75, wasser: 59, software: 39 },
    'iPhone 13 Pro Max':     { display: 169, akku: 69, ladebuchse: 79, kamera: 129, rueckglas: 129, lautsprecher: 79, wasser: 59, software: 39 },
    'iPhone 14':             { display: 119, akku: 65, ladebuchse: 75, kamera: 109, rueckglas: 109, lautsprecher: 75, wasser: 59, software: 39 },
    'iPhone 14 Plus':        { display: 139, akku: 69, ladebuchse: 79, kamera: 119, rueckglas: 119, lautsprecher: 79, wasser: 59, software: 39 },
    'iPhone 14 Pro':         { display: 189, akku: 75, ladebuchse: 85, kamera: 139, rueckglas: 139, lautsprecher: 85, wasser: 59, software: 39 },
    'iPhone 14 Pro Max':     { display: 209, akku: 79, ladebuchse: 89, kamera: 149, rueckglas: 149, lautsprecher: 89, wasser: 59, software: 39 },
    'iPhone 15':             { display: 149, akku: 75, ladebuchse: 85, kamera: 129, rueckglas: 119, lautsprecher: 85, wasser: 59, software: 39 },
    'iPhone 15 Plus':        { display: 169, akku: 79, ladebuchse: 89, kamera: 139, rueckglas: 129, lautsprecher: 89, wasser: 59, software: 39 },
    'iPhone 15 Pro':         { display: 219, akku: 85, ladebuchse: 95, kamera: 159, rueckglas: 149, lautsprecher: 95, wasser: 69, software: 39 },
    'iPhone 15 Pro Max':     { display: 239, akku: 89, ladebuchse: 99, kamera: 169, rueckglas: 159, lautsprecher: 99, wasser: 69, software: 39 },
    'iPhone 16':             { display: 179, akku: 85, ladebuchse: 95, kamera: 149, rueckglas: 139, lautsprecher: 95, wasser: 69, software: 39 },
    'iPhone 16 Pro':         { display: 249, akku: 89, ladebuchse: 99, kamera: 179, rueckglas: 159, lautsprecher: 99, wasser: 69, software: 39 },
    'iPhone 16 Pro Max':     { display: 269, akku: 95, ladebuchse: 105, kamera: 189, rueckglas: 169, lautsprecher: 105, wasser: 69, software: 39 },
    'iPhone 17':             { display: 189, akku: 89, ladebuchse: 99, kamera: 169, rueckglas: 139, lautsprecher: 99, wasser: 69, software: 39 },
    'iPhone 17 Pro':         { display: 189, akku: 89, ladebuchse: 129, kamera: 209, rueckglas: 139, lautsprecher: 119, wasser: 69, software: 39 },
    'iPhone 17 Pro Max':     { display: 289, akku: 99, ladebuchse: 135, kamera: 219, rueckglas: 159, lautsprecher: 125, wasser: 79, software: 39 }
  },

  'Samsung': {
    'Galaxy A13 / A14':      { display: 79,  akku: 49, ladebuchse: 55, kamera: 65, rueckglas: 55, lautsprecher: 55, wasser: 49, software: 39 },
    'Galaxy A15 / A16':      { display: 89,  akku: 49, ladebuchse: 55, kamera: 69, rueckglas: 59, lautsprecher: 55, wasser: 49, software: 39 },
    'Galaxy A34 / A35':      { display: 119, akku: 55, ladebuchse: 59, kamera: 79, rueckglas: 69, lautsprecher: 59, wasser: 49, software: 39 },
    'Galaxy A54 / A55':      { display: 139, akku: 59, ladebuchse: 65, kamera: 89, rueckglas: 79, lautsprecher: 65, wasser: 49, software: 39 },
    'Galaxy S20 / S20 FE':   { display: 149, akku: 65, ladebuchse: 69, kamera: 99, rueckglas: 79, lautsprecher: 69, wasser: 59, software: 39 },
    'Galaxy S21':            { display: 169, akku: 69, ladebuchse: 75, kamera: 109, rueckglas: 89, lautsprecher: 75, wasser: 59, software: 39 },
    'Galaxy S22':            { display: 189, akku: 75, ladebuchse: 79, kamera: 119, rueckglas: 99, lautsprecher: 79, wasser: 59, software: 39 },
    'Galaxy S23':            { display: 209, akku: 79, ladebuchse: 85, kamera: 129, rueckglas: 109, lautsprecher: 85, wasser: 69, software: 39 },
    'Galaxy S24':            { display: 239, akku: 85, ladebuchse: 89, kamera: 139, rueckglas: 119, lautsprecher: 89, wasser: 69, software: 39 },
    'Galaxy S24 Ultra':      { display: 289, akku: 95, ladebuchse: 99, kamera: 169, rueckglas: 139, lautsprecher: 99, wasser: 79, software: 39 },
    'Galaxy S25':            { display: 259, akku: 89, ladebuchse: 95, kamera: 149, rueckglas: 129, lautsprecher: 95, wasser: 79, software: 39 },
    'Galaxy Z Flip (alle)':  { display: null, akku: 99, ladebuchse: 109, kamera: 149, rueckglas: 149, lautsprecher: 99, wasser: 89, software: 39 },
    'Galaxy Z Fold (alle)':  { display: null, akku: 119, ladebuchse: 119, kamera: 169, rueckglas: 169, lautsprecher: 109, wasser: 89, software: 39 }
  },

  'Xiaomi': {
    'Redmi Note 11 / 12':    { display: 69, akku: 45, ladebuchse: 49, kamera: 59, rueckglas: 49, lautsprecher: 49, wasser: 49, software: 39 },
    'Redmi Note 13 / 14':    { display: 79, akku: 49, ladebuchse: 55, kamera: 65, rueckglas: 55, lautsprecher: 55, wasser: 49, software: 39 },
    'Xiaomi 13 / 14':        { display: 149, akku: 65, ladebuchse: 69, kamera: 99, rueckglas: 79, lautsprecher: 69, wasser: 59, software: 39 },
    'Poco (alle Modelle)':   { display: 79, akku: 49, ladebuchse: 55, kamera: 65, rueckglas: 55, lautsprecher: 55, wasser: 49, software: 39 }
  },

  'Huawei': {
    'P30 / P40 Serie':       { display: 99,  akku: 55, ladebuchse: 59, kamera: 79, rueckglas: 69, lautsprecher: 59, wasser: 49, software: 39 },
    'Mate Serie':            { display: 129, akku: 65, ladebuchse: 69, kamera: 89, rueckglas: 79, lautsprecher: 69, wasser: 59, software: 39 },
    'Nova Serie':            { display: 89,  akku: 49, ladebuchse: 55, kamera: 69, rueckglas: 59, lautsprecher: 55, wasser: 49, software: 39 }
  },

  'Google': {
    'Pixel 6 / 7':           { display: 139, akku: 65, ladebuchse: 69, kamera: 99,  rueckglas: 79, lautsprecher: 69, wasser: 59, software: 39 },
    'Pixel 8 / 9':           { display: 179, akku: 75, ladebuchse: 79, kamera: 119, rueckglas: 89, lautsprecher: 79, wasser: 69, software: 39 }
  },

  /* Tablets: NICHT von der Geraete-Retter-Praemie gedeckt (seit 2026 ausgenommen). */
  'Tablet / iPad': {
    'iPad (9./10. Generation)':   { display: 129, akku: 99,  ladebuchse: 89, lautsprecher: 79, wasser: 89, software: 49 },
    'iPad Air':                   { display: 199, akku: 119, ladebuchse: 99, lautsprecher: 89, wasser: 99, software: 49 },
    'iPad Pro 11"':               { display: 299, akku: 149, ladebuchse: 119, lautsprecher: 99, wasser: 119, software: 49 },
    'iPad Pro 12,9"':             { display: 379, akku: 169, ladebuchse: 129, lautsprecher: 109, wasser: 129, software: 49 },
    'iPad mini':                  { display: 149, akku: 109, ladebuchse: 89, lautsprecher: 79, wasser: 89, software: 49 },
    'Samsung Galaxy Tab A':       { display: 119, akku: 89,  ladebuchse: 79, lautsprecher: 69, wasser: 79, software: 49 },
    'Samsung Galaxy Tab S':       { display: 219, akku: 119, ladebuchse: 99, lautsprecher: 89, wasser: 99, software: 49 },
    'Android-Tablet (sonstige)':  { display: 109, akku: 79,  ladebuchse: 69, lautsprecher: 59, wasser: 69, software: 49 }
  },

  /* Laptops: einzige Geraetegruppe hier, die unter die
     Geraete-Retter-Praemie faellt (50 %, max. 130 EUR). */
  'Laptop / Notebook': {
    'Apple MacBook Air':                 { display: 349, akku: 149, ladebuchse: 129, lautsprecher: 99,  wasser: 129, software: 79, tastatur: 179, luefter: 99 },
    'Apple MacBook Pro':                 { display: 429, akku: 179, ladebuchse: 149, lautsprecher: 119, wasser: 149, software: 79, tastatur: 199, luefter: 109 },
    'Lenovo ThinkPad':                   { display: 189, akku: 119, ladebuchse: 99,  lautsprecher: 89,  wasser: 99,  software: 59, tastatur: 99,  luefter: 89 },
    'Lenovo IdeaPad / Yoga':             { display: 149, akku: 99,  ladebuchse: 89,  lautsprecher: 79,  wasser: 89,  software: 59, tastatur: 89,  luefter: 79 },
    'HP EliteBook / ProBook':            { display: 189, akku: 119, ladebuchse: 99,  lautsprecher: 89,  wasser: 99,  software: 59, tastatur: 99,  luefter: 89 },
    'HP Pavilion / Envy':                { display: 149, akku: 99,  ladebuchse: 89,  lautsprecher: 79,  wasser: 89,  software: 59, tastatur: 89,  luefter: 79 },
    'Dell Latitude / XPS':               { display: 229, akku: 139, ladebuchse: 109, lautsprecher: 99,  wasser: 109, software: 59, tastatur: 109, luefter: 89 },
    'Dell Inspiron / Vostro':            { display: 149, akku: 99,  ladebuchse: 89,  lautsprecher: 79,  wasser: 89,  software: 59, tastatur: 89,  luefter: 79 },
    'Acer Aspire / Swift':               { display: 139, akku: 95,  ladebuchse: 85,  lautsprecher: 75,  wasser: 89,  software: 59, tastatur: 85,  luefter: 75 },
    'Acer Predator / Nitro (Gaming)':    { display: 229, akku: 139, ladebuchse: 109, lautsprecher: 95,  wasser: 119, software: 69, tastatur: 119, luefter: 95 },
    'Asus VivoBook / ZenBook':           { display: 149, akku: 99,  ladebuchse: 89,  lautsprecher: 79,  wasser: 89,  software: 59, tastatur: 89,  luefter: 79 },
    'Asus ROG / TUF (Gaming)':           { display: 249, akku: 149, ladebuchse: 119, lautsprecher: 99,  wasser: 129, software: 69, tastatur: 129, luefter: 99 },
    'MSI (Gaming)':                      { display: 249, akku: 149, ladebuchse: 119, lautsprecher: 99,  wasser: 129, software: 69, tastatur: 129, luefter: 99 },
    'Razer (Gaming)':                    { display: 289, akku: 169, ladebuchse: 129, lautsprecher: 109, wasser: 139, software: 69, tastatur: 149, luefter: 109 },
    'Microsoft Surface':                 { display: 349, akku: 199, ladebuchse: 139, lautsprecher: 109, wasser: 149, software: 69, tastatur: null, luefter: 109 },
    'Samsung Galaxy Book':               { display: 199, akku: 119, ladebuchse: 99,  lautsprecher: 89,  wasser: 99,  software: 59, tastatur: 99,  luefter: 89 },
    'Chromebook (alle Marken)':          { display: 129, akku: 89,  ladebuchse: 79,  lautsprecher: 69,  wasser: 79,  software: 49, tastatur: 79,  luefter: 69 },
    'Anderes Notebook':                  { display: null, akku: null, ladebuchse: null, lautsprecher: null, wasser: 89, software: 59, tastatur: null, luefter: 79 }
  },

  'OnePlus / Oppo / Motorola': {
    'OnePlus (alle Modelle)':  { display: 129, akku: 59, ladebuchse: 65, kamera: 89, rueckglas: 69, lautsprecher: 65, wasser: 59, software: 39 },
    'Oppo (alle Modelle)':     { display: 99,  akku: 55, ladebuchse: 59, kamera: 79, rueckglas: 59, lautsprecher: 59, wasser: 49, software: 39 },
    'Motorola (alle Modelle)': { display: 89,  akku: 49, ladebuchse: 55, kamera: 69, rueckglas: 59, lautsprecher: 55, wasser: 49, software: 39 }
  }
};
