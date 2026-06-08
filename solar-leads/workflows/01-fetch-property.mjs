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
  electricityPrice:   num(process.env.ELECTRICITY_PRICE_EUR, 0.25),
  feedInTariff:       num(process.env.FEED_IN_TARIFF_EUR, 0.07),
  selfConsumption:    num(process.env.SELF_CONSUMPTION_RATE, 0.30),
  panelWatts:         num(process.env.PANEL_WATTS, 400),
};

// Schwellenwerte fuer die Dach-Eignung (Oesterreich = Nordhalbkugel -> Sueden ist optimal)
const SUITABILITY = {
  // Azimut: 180° = exakt Sueden. Wir akzeptieren Suedost bis Suedwest.
  minAzimuth: 110,   // ca. Ost-Suedost
  maxAzimuth: 250,   // ca. West-Suedwest
  idealAzimuth: 180, // Sueden
  minRoofAreaM2: 20, // Mindest-Dachflaeche, damit sich eine Anlage lohnt
  minSunshineHours: 1000, // Mindest-Sonnenstunden/Jahr am besten Punkt
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
//  Schritt 2 — Satellitenbild via Google Maps Static API
// ----------------------------------------------------------------------------
async function downloadSatellite(lat, lng, slug) {
  const url = new URL('https://maps.googleapis.com/maps/api/staticmap');
  url.searchParams.set('center', `${lat},${lng}`);
  url.searchParams.set('zoom', '20');          // sehr nah -> Dachdetails sichtbar
  url.searchParams.set('size', '640x640');     // max. ohne "scale"
  url.searchParams.set('scale', '2');          // verdoppelt die Aufloesung (1280x1280)
  url.searchParams.set('maptype', 'satellite');
  url.searchParams.set('key', GOOGLE_MAPS_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Maps Static API Fehler: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  await mkdir(OUTPUT_DIR, { recursive: true });
  const path = join(OUTPUT_DIR, `${slug}.png`);
  await writeFile(path, buf);
  // TODO (spaeter): Bild stattdessen nach Cloudflare R2 hochladen und URL zurueckgeben.
  return path;
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

  // Sued-orientierte Flaeche aufsummieren (Azimut zwischen min und max).
  const southSegs = segments.filter(s =>
    s.azimuthDegrees >= SUITABILITY.minAzimuth && s.azimuthDegrees <= SUITABILITY.maxAzimuth
  );
  const southFacingAreaM2 = sum(southSegs.map(s => s.stats?.areaMeters2 || 0));

  // Bestes Segment = groesste Sued-Flaeche (oder groesstes ueberhaupt).
  const ranked = (southSegs.length ? southSegs : segments)
    .slice()
    .sort((a, b) => (b.stats?.areaMeters2 || 0) - (a.stats?.areaMeters2 || 0));
  const best = ranked[0];

  // Panel-Leistung, die Google annimmt (sonst unser .env-Wert).
  const panelWatts = p.panelCapacityWatts || ECON.panelWatts;

  const roof = {
    available: true,
    roofAreaM2: round(roofAreaM2, 1),
    southFacingAreaM2: round(southFacingAreaM2, 1),
    bestAzimuth: best ? round(best.azimuthDegrees, 0) : null,
    bestPitch: best ? round(best.pitchDegrees, 0) : null,
    maxPanelCount: p.maxArrayPanelsCount ?? null,
    maxArrayAreaM2: p.maxArrayAreaMeters2 != null ? round(p.maxArrayAreaMeters2, 1) : null,
    maxSunshineHours: p.maxSunshineHoursPerYear != null ? round(p.maxSunshineHoursPerYear, 0) : null,
    panelWatts,
    configs: p.solarPanelConfigs || [],
  };

  // --- Eignung bewerten -----------------------------------------------------
  // Score 0–100 aus drei Faktoren: Ausrichtung, Flaeche, Sonnenstunden.
  let score = 0;

  // (a) Ausrichtung: je naeher an Sued (180°), desto besser.
  const hasSouth = southFacingAreaM2 > 0 && roof.bestAzimuth != null;
  if (hasSouth) {
    const off = Math.abs(roof.bestAzimuth - SUITABILITY.idealAzimuth); // 0 = perfekt
    score += Math.max(0, 40 - (off / 70) * 40); // bis 40 Punkte
  }

  // (b) Flaeche: bis 60 m² Sued-Flaeche skaliert auf 35 Punkte.
  score += Math.min(35, (southFacingAreaM2 / 60) * 35);

  // (c) Sonnenstunden: ab minSunshineHours skaliert auf 25 Punkte.
  if (roof.maxSunshineHours != null) {
    const s = (roof.maxSunshineHours - SUITABILITY.minSunshineHours) / 600;
    score += Math.max(0, Math.min(25, s * 25));
  }

  roof.score = Math.round(score);

  // Harte Mindestkriterien fuer "geeignet":
  roof.suitable = Boolean(
    hasSouth &&
    southFacingAreaM2 >= SUITABILITY.minRoofAreaM2 &&
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

  // Anlagengroesse: Panel-Anzahl * Wattzahl pro Panel -> kWp.
  const panelWatts = roof.panelWatts || ECON.panelWatts;
  const systemSizeKwp = roof.maxPanelCount
    ? round((roof.maxPanelCount * panelWatts) / 1000, 1)
    : round((roof.maxArrayAreaM2 || roof.southFacingAreaM2 || 0) * 0.2, 1); // ~0.2 kWp/m² Faustregel

  // Jahresertrag: bevorzugt aus der besten Solar-API-Konfiguration,
  // sonst Faustregel ~1000 kWh pro kWp/Jahr (Wien).
  let yearlyEnergyKwh = null;
  if (roof.configs?.length) {
    const best = roof.configs.reduce((a, b) =>
      (b.yearlyEnergyDcKwh || 0) > (a.yearlyEnergyDcKwh || 0) ? b : a
    );
    yearlyEnergyKwh = best.yearlyEnergyDcKwh || null;
  }
  if (yearlyEnergyKwh == null) {
    yearlyEnergyKwh = systemSizeKwp * 1000;
  }
  yearlyEnergyKwh = round(yearlyEnergyKwh, 0);

  // Kosten = Groesse * Kosten pro kWp.
  const installCostEur = round(systemSizeKwp * ECON.costPerKwp, 0);

  // Ersparnis:
  //   selbst verbrauchter Strom spart den vollen Strompreis,
  //   eingespeister Ueberschuss bringt die Einspeiseverguetung.
  const selfKwh = yearlyEnergyKwh * ECON.selfConsumption;
  const feedKwh = yearlyEnergyKwh * (1 - ECON.selfConsumption);
  const annualSavingsEur = round(
    selfKwh * ECON.electricityPrice + feedKwh * ECON.feedInTariff, 0
  );

  const paybackYears = annualSavingsEur > 0
    ? round(installCostEur / annualSavingsEur, 1)
    : null;

  return { systemSizeKwp, installCostEur, yearlyEnergyKwh, annualSavingsEur, paybackYears };
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
//  Schritt 7 — In Supabase speichern (oder nur anzeigen)
// ----------------------------------------------------------------------------
async function saveProspect(record) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('\nℹ️  Supabase nicht konfiguriert — Datensatz wird nur angezeigt:\n');
    console.log(JSON.stringify(record, (k, v) => (k === 'solar_api_raw' ? '[…]' : v), 2));
    return;
  }
  // Erst hier importieren, damit das Skript ohne Supabase-Paket lauffaehig bleibt.
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // "upsert" auf slug: gleiche Adresse aktualisiert den bestehenden Datensatz.
  const { data, error } = await supabase
    .from('prospects')
    .upsert(record, { onConflict: 'slug' })
    .select('id, slug, status')
    .single();

  if (error) {
    console.error('❌ Supabase-Fehler:', error.message);
    return;
  }
  console.log(`\n💾 In Supabase gespeichert (id: ${data.id})`);
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
  console.log(`  Sued-Flaeche        : ${roof.southFacingAreaM2} m²`);
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
