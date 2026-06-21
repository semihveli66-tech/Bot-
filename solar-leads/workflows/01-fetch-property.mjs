// ============================================================================
//  Workflow 1 — Adresse -> Satellitenbild + Dacheignung
// ============================================================================
//
//  Was dieses Skript macht (in Worten):
//    1. Du gibst eine Wiener Adresse ein.
//    2. Es wandelt die Adresse in GPS-Koordinaten um (Google Geocoding API).
//    3. Es lädt ein Satelliten-Luftbild des Hauses (Google Maps Static API)
//       und speichert es (lokal in ./output, optional spaeter in R2).
//    4. Es fragt die Google Solar API: Wie gross/geeignet ist das Dach?
//       (Flaeche, Ausrichtung, Sonnenstunden, mögliche Panel-Anzahl, Ertrag)
//    5. Es prueft die Eignung (Sued-Ausrichtung + genug Flaeche) und
//       berechnet grob Kosten, Ersparnis und Amortisation.
//    6. Es speichert alles in der Supabase-Tabelle "prospects"
//       (oder gibt es nur aus, falls Supabase noch nicht konfiguriert ist).
//
//  So startest du es (im Ordner solar-leads/):
//    npm install
//    cp .env.example .env        # und Keys eintragen
//    node workflows/01-fetch-property.mjs "Mariahilfer Straße 12, 1060 Wien"
//
//  Du brauchst zwingend nur:  GOOGLE_MAPS_API_KEY
//  (Supabase ist optional — ohne wird das Ergebnis nur angezeigt.)
// ============================================================================

// .env laden — falls "dotenv" noch nicht installiert ist, einfach ueberspringen
// (Schluessel koennen auch direkt als Umgebungsvariablen gesetzt sein).
try { await import('dotenv/config'); } catch { /* npm install noch ausstehend */ }

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

// ----------------------------------------------------------------------------
//  Konfiguration aus der .env-Datei (mit sinnvollen Standardwerten)
// ----------------------------------------------------------------------------
const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_SOLAR_KEY = process.env.GOOGLE_SOLAR_API_KEY || GOOGLE_MAPS_KEY;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Wirtschaftlichkeits-Annahmen (siehe .env.example fuer Erklaerungen)
const ECON = {
  costPerKwp:         num(process.env.COST_PER_KWP_EUR, 1400),
  electricityPrice:   num(process.env.ELECTRICITY_PRICE_EUR, 0.28),
  feedInTariff:       num(process.env.FEED_IN_TARIFF_EUR, 0.07),
  selfConsumption:    num(process.env.SELF_CONSUMPTION_RATE, 0.30),
  panelWatts:         num(process.env.PANEL_WATTS, 400),
  // NEU: realistische Begrenzung fuer Einfamilienhaeuser.
  maxHomeKwp:         num(process.env.MAX_HOME_KWP, 10),         // typ. Anlage 5-12 kWp
  annualConsumption:  num(process.env.ANNUAL_CONSUMPTION_KWH, 4500), // 4-Pers.-Haushalt
};

// Schwellenwerte fuer die Dach-Eignung (Oesterreich = Nordhalbkugel -> Sueden ist optimal)
const SUITABILITY = {
  // Azimut: 180° = exakt Sueden (Score-Optimum).
  idealAzimuth: 180,
  // NUTZBAR: Ost (ca. 90°) bis West (ca. 270°) — auch Ost/West-Daecher lohnen sich
  // (nur ~10–20 % weniger Ertrag als Sued). Nur reine NORD-Daecher fallen raus.
  usableMinAzimuth: 80,
  usableMaxAzimuth: 280,
  minRoofAreaM2: 20,      // Mindest nutzbare Dachflaeche
  minSunshineHours: 800,  // Mindest-Sonnenstunden/Jahr am besten Punkt
};


// ----------------------------------------------------------------------------
//  Hauptablauf
// ----------------------------------------------------------------------------
async function main() {
  const address = process.argv.slice(2).join(' ').trim();
  if (!address) {
    console.error('❌ Bitte eine Adresse angeben, z.B.:');
    console.error('   node workflows/01-fetch-property.mjs "Mariahilfer Straße 12, 1060 Wien"');
    process.exit(1);
  }
  if (!GOOGLE_MAPS_KEY) {
    console.error('❌ GOOGLE_MAPS_API_KEY fehlt. Bitte in der .env-Datei eintragen.');
    process.exit(1);
  }

  console.log(`\n🏠 Verarbeite Adresse: ${address}\n`);

  // Schritt 1: Adresse -> Koordinaten
  const geo = await geocode(address);
  console.log(`📍 Koordinaten: ${geo.lat}, ${geo.lng}  (${geo.formatted})`);

  // Schritt 2: Satellitenbild herunterladen
  const slug = makeSlug(geo.formatted || address);
  const imagePath = await downloadSatellite(geo.lat, geo.lng, slug);
  console.log(`🛰️  Satellitenbild gespeichert: ${imagePath}`);

  // Schritt 3: Solar-API abfragen
  const solar = await fetchSolarInsights(geo.lat, geo.lng);

  // Schritt 4: Dach auswerten + Eignung pruefen
  const roof = analyzeRoof(solar);
  printRoof(roof);

  // Schritt 5: Wirtschaftlichkeit berechnen
  const econ = computeEconomics(roof);
  printEconomics(econ);

  // Schritt 6: Adresse aufschluesseln (PLZ, Stadt ...)
  const parts = parseAustrianAddress(geo, address);

  // Datensatz zusammenbauen
  const record = {
    slug,
    address: geo.formatted || address,
    street: parts.street,
    house_number: parts.houseNumber,
    zip: parts.zip,
    city: parts.city || 'Wien',
    state: parts.state,
    country: 'AT',
    latitude: geo.lat,
    longitude: geo.lng,
    status: roof.suitable ? 'qualified' : 'disqualified',
    building_type: 'Einfamilienhaus',
    roof_area_m2: roof.roofAreaM2,
    south_facing_area_m2: roof.southFacingAreaM2,
    best_roof_azimuth: roof.bestAzimuth,
    best_roof_pitch: roof.bestPitch,
    max_panel_count: roof.maxPanelCount,
    max_array_area_m2: roof.maxArrayAreaM2,
    annual_sunshine_hours: roof.maxSunshineHours,
    yearly_energy_kwh: econ.yearlyEnergyKwh,
    has_existing_solar: false, // wird spaeter per Bild-KI gesetzt
    roof_suitable: roof.suitable,
    suitability_score: roof.score,
    system_size_kwp: econ.systemSizeKwp,
    install_cost_eur: econ.installCostEur,
    annual_savings_eur: econ.annualSavingsEur,
    payback_years: econ.paybackYears,
    satellite_image_url: imagePath, // spaeter: R2-URL
    solar_api_raw: solar.raw || null,
  };

  // Schritt 7: Speichern (oder nur anzeigen)
  await saveProspect(record);

  console.log(`\n✅ Fertig. Status: ${record.status.toUpperCase()}\n`);
}


// ----------------------------------------------------------------------------
//  Schritt 1 — Geocoding: Adresse -> Koordinaten
// ----------------------------------------------------------------------------
async function geocode(address) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'at');       // Oesterreich bevorzugen
  url.searchParams.set('language', 'de');
  url.searchParams.set('key', GOOGLE_MAPS_KEY);

  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Geocoding fehlgeschlagen (${data.status}): ${data.error_message || 'Adresse nicht gefunden'}`);
  }
  const r = data.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address,
    components: r.address_components,
  };
}


// ----------------------------------------------------------------------------
//  Schritt 2 — Satellitenbild via Google Maps Tiles (kein Static API Key nötig)
// ----------------------------------------------------------------------------
async function downloadSatellite(lat, lng, slug) {
  const zoom = 19;
  const { tx, ty } = latLngToTile(lat, lng, zoom);

  // 3×3 Tiles (je 256px) -> 768×768 -> auf 1280×1280 skaliert
  const TILE = 256;
  const { createCanvas, loadImage } = await import('canvas').catch(() => null) || {};

  // Fallback: Python-basiertes Stitching wenn node-canvas fehlt
  const { execFileSync } = await import('node:child_process');
  const outPath = join(OUTPUT_DIR, `${slug}.png`);
  await mkdir(OUTPUT_DIR, { recursive: true });

  const script = `
import math, io, urllib.request
from PIL import Image

def tile(x,y,z):
    url=f"https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req,timeout=15) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGB")

tx,ty,zoom=${tx},${ty},${zoom}
canvas=Image.new("RGB",(${TILE}*3,${TILE}*3))
for dy in range(-1,2):
    for dx in range(-1,2):
        canvas.paste(tile(tx+dx,ty+dy,zoom),((dx+1)*${TILE},(dy+1)*${TILE}))
w,h=canvas.size
crop=canvas.crop(((w-640)//2,(h-640)//2,(w+640)//2,(h+640)//2))
final=crop.resize((1280,1280),Image.LANCZOS)
final.save(r"${outPath.replace(/\\/g, '/')}")
print("ok")
`;

  const result = execFileSync('python3', ['-c', script], { encoding: 'utf8', timeout: 30000 });
  if (!result.includes('ok')) throw new Error('Tile-Download fehlgeschlagen');
  return outPath;
}

function latLngToTile(lat, lng, zoom) {
  const n = 2 ** zoom;
  const tx = Math.floor((lng + 180) / 360 * n);
  const ty = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return { tx, ty };
}


// ----------------------------------------------------------------------------
//  Schritt 3 — Google Solar API (Building Insights)
// ----------------------------------------------------------------------------
//  Doku: https://developers.google.com/maps/documentation/solar/building-insights
//  Liefert pro Gebaeude: Dachsegmente (Ausrichtung, Neigung, Flaeche,
//  Sonnenstunden), max. Panel-Anzahl und Ertragsschaetzungen.
// ----------------------------------------------------------------------------
async function fetchSolarInsights(lat, lng) {
  const url = new URL('https://solar.googleapis.com/v1/buildingInsights:findClosest');
  url.searchParams.set('location.latitude', String(lat));
  url.searchParams.set('location.longitude', String(lng));
  // "HIGH" = beste Datenqualitaet; faellt automatisch zurueck, wenn nicht verfuegbar.
  url.searchParams.set('requiredQuality', 'HIGH');
  url.searchParams.set('key', GOOGLE_SOLAR_KEY);

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    // Haeufigster Fall: Fuer diese Adresse gibt es (noch) keine Solar-Daten.
    const reason = data?.error?.message || `HTTP ${res.status}`;
    console.warn(`⚠️  Solar API: keine Daten fuer dieses Gebaeude (${reason}).`);
    console.warn('    -> Dach kann nicht automatisch bewertet werden. Manuell pruefen.');
    return { available: false, raw: data };
  }
  return { available: true, raw: data, potential: data.solarPotential };
}


// ----------------------------------------------------------------------------
//  Schritt 4 — Dachanalyse + Eignungspruefung
// ----------------------------------------------------------------------------
function analyzeRoof(solar) {
  if (!solar.available || !solar.potential) {
    return {
      available: false, suitable: false, score: 0,
      roofAreaM2: null, southFacingAreaM2: null, bestAzimuth: null,
      bestPitch: null, maxPanelCount: null, maxArrayAreaM2: null,
      maxSunshineHours: null, panelWatts: ECON.panelWatts,
    };
  }

  const p = solar.potential;
  const segments = p.roofSegmentStats || [];

  // Gesamte Dachflaeche
  const roofAreaM2 = p.wholeRoofStats?.areaMeters2 ?? sum(segments.map(s => s.stats?.areaMeters2 || 0));

  // Nutzbare Flaeche aufsummieren (Ost bis West — nur reine Nord-Daecher raus).
  const usableSegs = segments.filter(s =>
    s.azimuthDegrees >= SUITABILITY.usableMinAzimuth && s.azimuthDegrees <= SUITABILITY.usableMaxAzimuth
  );
  const usableAreaM2 = sum(usableSegs.map(s => s.stats?.areaMeters2 || 0));

  // Bestes Segment = groesste nutzbare Flaeche (oder groesstes ueberhaupt).
  const ranked = (usableSegs.length ? usableSegs : segments)
    .slice()
    .sort((a, b) => (b.stats?.areaMeters2 || 0) - (a.stats?.areaMeters2 || 0));
  const best = ranked[0];

  // Panel-Leistung, die Google annimmt (sonst unser .env-Wert).
  const panelWatts = p.panelCapacityWatts || ECON.panelWatts;

  const roof = {
    available: true,
    roofAreaM2: round(roofAreaM2, 1),
    southFacingAreaM2: round(usableAreaM2, 1), // nutzbare (Ost–Sued–West) Flaeche
    bestAzimuth: best ? round(best.azimuthDegrees, 0) : null,
    bestPitch: best ? round(best.pitchDegrees, 0) : null,
    maxPanelCount: p.maxArrayPanelsCount ?? null,
    maxArrayAreaM2: p.maxArrayAreaMeters2 != null ? round(p.maxArrayAreaMeters2, 1) : null,
    maxSunshineHours: p.maxSunshineHoursPerYear != null ? round(p.maxSunshineHoursPerYear, 0) : null,
    panelWatts,
    configs: p.solarPanelConfigs || [],
  };

  // --- Eignung bewerten -----------------------------------------------------
  // Score 0–100: Ausrichtung (45) + Flaeche (35) + Sonnenstunden (20).
  let score = 0;
  const hasUsable = usableAreaM2 > 0 && roof.bestAzimuth != null;

  // (a) Ausrichtung: Sued optimal, Ost/West noch gut, Nord schlecht.
  if (hasUsable) {
    const off = Math.abs(roof.bestAzimuth - SUITABILITY.idealAzimuth); // 0 = Sued
    score += Math.max(0, 45 * (1 - off / 120)); // Sued 45, Ost/West ~11, Nord 0
  }
  // (b) Flaeche: bis 60 m² nutzbare Flaeche -> 35 Punkte.
  score += Math.min(35, (usableAreaM2 / 60) * 35);
  // (c) Sonnenstunden -> 20 Punkte.
  if (roof.maxSunshineHours != null) {
    const s = (roof.maxSunshineHours - SUITABILITY.minSunshineHours) / 600;
    score += Math.max(0, Math.min(20, s * 20));
  }
  roof.score = Math.round(score);

  // Geeignet: genug nutzbare Flaeche + genug Sonne (Ost/West zaehlt mit).
  roof.suitable = Boolean(
    hasUsable &&
    usableAreaM2 >= SUITABILITY.minRoofAreaM2 &&
    (roof.maxSunshineHours == null || roof.maxSunshineHours >= SUITABILITY.minSunshineHours)
  );

  return roof;
}


// ----------------------------------------------------------------------------
//  Schritt 5 — Wirtschaftlichkeit (vereinfachter ROI)
// ----------------------------------------------------------------------------
function computeEconomics(roof) {
  if (!roof.available || !roof.suitable) {
    return {
      systemSizeKwp: null, installCostEur: null,
      yearlyEnergyKwh: null, annualSavingsEur: null, paybackYears: null,
    };
  }

  const panelWatts = roof.panelWatts || ECON.panelWatts;

  // (1) Was passt MAXIMAL aufs Dach? (Dachkapazitaet)
  const roofKwp = roof.maxPanelCount
    ? (roof.maxPanelCount * panelWatts) / 1000
    : (roof.maxArrayAreaM2 || roof.southFacingAreaM2 || 0) * 0.2;

  // (2) Spezifischer Ertrag (kWh pro kWp/Jahr) aus der besten Solar-API-Config.
  //     So koennen wir den Ertrag auf JEDE Anlagengroesse hochrechnen.
  let specificYield = 1000; // Faustregel Wien, falls keine Config da ist
  if (roof.configs?.length) {
    const best = roof.configs.reduce((a, b) =>
      (b.yearlyEnergyDcKwh || 0) > (a.yearlyEnergyDcKwh || 0) ? b : a
    );
    const bestKwp = (best.panelsCount * panelWatts) / 1000;
    if (bestKwp > 0 && best.yearlyEnergyDcKwh) specificYield = best.yearlyEnergyDcKwh / bestKwp;
  }

  // (3) REALISTISCH dimensionieren: nicht das ganze Dach vollpflastern, sondern
  //     auf Haushalts-Maß begrenzen (Standard 10 kWp), aber nie groesser als das Dach.
  const systemSizeKwp = round(Math.min(roofKwp, ECON.maxHomeKwp), 1);

  // (4) Jahresertrag der gewaehlten (begrenzten) Anlage.
  const yearlyEnergyKwh = round(systemSizeKwp * specificYield, 0);

  // (5) Kosten = Groesse * Kosten pro kWp.
  const installCostEur = round(systemSizeKwp * ECON.costPerKwp, 0);

  // (6) Ersparnis — WICHTIG: Eigenverbrauch durch echten Haushaltsverbrauch deckeln.
  //     Man kann nicht mehr Strom selbst nutzen, als man ueberhaupt verbraucht.
  const selfKwh = Math.min(yearlyEnergyKwh * ECON.selfConsumption, ECON.annualConsumption);
  const feedKwh = Math.max(0, yearlyEnergyKwh - selfKwh);
  const annualSavingsEur = round(
    selfKwh * ECON.electricityPrice + feedKwh * ECON.feedInTariff, 0
  );

  const paybackYears = annualSavingsEur > 0
    ? round(installCostEur / annualSavingsEur, 1)
    : null;

  return {
    systemSizeKwp, installCostEur, yearlyEnergyKwh, annualSavingsEur, paybackYears,
    roofKwp: round(roofKwp, 1), // Info: was max. aufs Dach passt
  };
}


// ----------------------------------------------------------------------------
//  Schritt 6 — Adresse in Bestandteile zerlegen (aus Google-Komponenten)
// ----------------------------------------------------------------------------
function parseAustrianAddress(geo, fallback) {
  const c = geo.components || [];
  const get = (type) => c.find(x => x.types.includes(type))?.long_name || null;
  return {
    street: get('route'),
    houseNumber: get('street_number'),
    zip: get('postal_code'),
    city: get('locality') || get('postal_town'),
    state: get('administrative_area_level_1'),
  };
}


// ----------------------------------------------------------------------------
//  Schritt 7 — Speichern
// ----------------------------------------------------------------------------
//  Wir speichern IMMER lokal (output/prospects.json) — das funktioniert ueberall,
//  auch wenn eine Firewall Supabase blockiert. Wenn Supabase erreichbar ist,
//  speichern wir zusaetzlich dorthin. Schlaegt das fehl (z.B. Allowlist), geht
//  trotzdem nichts verloren — die Daten liegen lokal und koennen spaeter mit
//  "import-to-supabase.mjs" hochgeladen werden.
// ----------------------------------------------------------------------------
const LOCAL_STORE = join(OUTPUT_DIR, 'prospects.json');

async function saveProspect(record) {
  // (a) Immer lokal speichern (upsert nach slug).
  await saveLocal(record);

  // (b) Zusaetzlich Supabase versuchen, falls konfiguriert.
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('ℹ️  Supabase nicht konfiguriert — nur lokal gespeichert.');
    return;
  }
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase
      .from('prospects')
      .upsert(record, { onConflict: 'slug' })
      .select('id, slug, status')
      .single();
    if (error) throw new Error(error.message);
    console.log(`💾 Zusaetzlich in Supabase gespeichert (id: ${data.id})`);
  } catch (e) {
    // Haeufig hier: "Host not in allowlist" (Firewall der Cloud-Umgebung).
    console.warn(`⚠️  Supabase nicht erreichbar (${e.message}) — Daten liegen sicher lokal.`);
  }
}

// Lokaler Speicher: liest die JSON-Liste, ersetzt/ergaenzt nach slug, schreibt zurueck.
async function saveLocal(record) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  let list = [];
  try {
    const { readFile } = await import('node:fs/promises');
    const txt = await readFile(LOCAL_STORE, 'utf8');
    list = JSON.parse(txt);
    if (!Array.isArray(list)) list = [];
  } catch { /* Datei existiert noch nicht — leere Liste */ }

  // Riesiges Rohdaten-Feld lokal weglassen, damit die Datei lesbar bleibt.
  const slim = { ...record };
  delete slim.solar_api_raw;
  slim.saved_at = new Date().toISOString();

  const idx = list.findIndex(r => r.slug === slim.slug);
  if (idx >= 0) list[idx] = slim; else list.push(slim);

  await writeFile(LOCAL_STORE, JSON.stringify(list, null, 2));
  console.log(`💾 Lokal gespeichert: output/prospects.json (${list.length} Haus/Haeuser gesamt)`);
}


// ----------------------------------------------------------------------------
//  Hilfsfunktionen
// ----------------------------------------------------------------------------
function printRoof(roof) {
  console.log('\n— Dachanalyse —');
  if (!roof.available) {
    console.log('  (keine Solar-API-Daten verfuegbar)');
    return;
  }
  console.log(`  Gesamte Dachflaeche : ${roof.roofAreaM2} m²`);
  console.log(`  Nutzbare Flaeche    : ${roof.southFacingAreaM2} m²`);
  console.log(`  Beste Ausrichtung   : ${roof.bestAzimuth}°  (180° = Sueden)`);
  console.log(`  Dachneigung         : ${roof.bestPitch}°`);
  console.log(`  Sonnenstunden/Jahr  : ${roof.maxSunshineHours}`);
  console.log(`  Max. Panels         : ${roof.maxPanelCount}`);
  console.log(`  Eignungs-Score      : ${roof.score}/100`);
  console.log(`  -> Geeignet?        : ${roof.suitable ? 'JA ✅' : 'NEIN ❌'}`);
}

function printEconomics(e) {
  if (e.systemSizeKwp == null) return;
  console.log('\n— Wirtschaftlichkeit (Schaetzung) —');
  console.log(`  Anlagengroesse      : ${e.systemSizeKwp} kWp`);
  console.log(`  Jahresertrag        : ${e.yearlyEnergyKwh} kWh`);
  console.log(`  Investition         : € ${fmt(e.installCostEur)}`);
  console.log(`  Ersparnis/Jahr      : € ${fmt(e.annualSavingsEur)}`);
  console.log(`  Amortisation        : ${e.paybackYears} Jahre`);
}

function makeSlug(s) {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function num(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function sum(arr) { return arr.reduce((a, b) => a + (b || 0), 0); }
function round(n, d) { const f = 10 ** d; return Math.round(n * f) / f; }
function fmt(n) { return new Intl.NumberFormat('de-AT').format(n); }


// Skript starten und Fehler sauber ausgeben.
main().catch(err => {
  console.error('\n❌ Fehler:', err.message);
  process.exit(1);
});
