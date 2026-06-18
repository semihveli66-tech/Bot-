// ============================================================================
//  Workflow 2 — Adressen automatisch sammeln (OpenStreetMap / Overpass)
// ============================================================================
//
//  Holt automatisch Einfamilienhaus-Adressen eines Wiener Bezirks (per PLZ)
//  aus OpenStreetMap — kostenlos, legal, mit Koordinaten. So musst du nicht
//  mehr jede Adresse einzeln eintippen.
//
//  ⚠️ Overpass ist in der Cloud-Umgebung blockiert — laeuft auf deinem MAC.
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/02-collect-addresses.mjs 1230            # alle Einfamilienhaeuser in 1230
//    node workflows/02-collect-addresses.mjs 1230 50         # max. 50
//    node workflows/02-collect-addresses.mjs 1230 50 broad   # auch Reihen-/Doppelhaeuser etc.
//
//  Ergebnis: output/addresses-<plz>.json  (Liste mit Adresse + Koordinaten)
//  Danach:   node workflows/process-addresses.mjs 1230       # ganze Pipeline drueberlaufen
// ============================================================================

try { await import('dotenv/config'); } catch {}
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

async function main() {
  const plz = (process.argv[2] || '').trim();
  const limit = parseInt(process.argv[3] || '0', 10);
  const broad = (process.argv[4] || '').toLowerCase() === 'broad';

  if (!/^\d{4}$/.test(plz)) {
    console.error('❌ Bitte eine 4-stellige PLZ angeben, z.B.:');
    console.error('   node workflows/02-collect-addresses.mjs 1230');
    process.exit(1);
  }

  // Gebaeudetypen: standard = Einfamilienhaeuser; "broad" = auch Reihen-/Doppelhaeuser.
  const types = broad
    ? 'house|detached|semidetached_house|terrace|residential'
    : 'house|detached|semidetached_house';

  // Overpass-Abfrage: Gebaeude mit Adresse in dieser PLZ.
  const query = `
    [out:json][timeout:120];
    (
      way["building"~"^(${types})$"]["addr:postcode"="${plz}"]["addr:housenumber"];
      node["building"~"^(${types})$"]["addr:postcode"="${plz}"]["addr:housenumber"];
      relation["building"~"^(${types})$"]["addr:postcode"="${plz}"]["addr:housenumber"];
    );
    out center tags;`;

  console.log(`🔎 Suche Einfamilienhaeuser in PLZ ${plz} ${broad ? '(breit)' : ''}...`);

  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) {
    console.error(`❌ Overpass-Fehler: HTTP ${res.status} (evtl. ueberlastet — kurz warten & erneut).`);
    process.exit(1);
  }
  const data = await res.json();

  // Adressen extrahieren + deduplizieren.
  const seen = new Set();
  let list = [];
  for (const el of data.elements || []) {
    const t = el.tags || {};
    const street = t['addr:street'];
    const hnr = t['addr:housenumber'];
    if (!street || !hnr) continue;

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    const key = `${street} ${hnr}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    list.push({
      address: `${street} ${hnr}, ${plz} ${t['addr:city'] || 'Wien'}`,
      street, house_number: hnr, zip: plz,
      city: t['addr:city'] || 'Wien',
      latitude: lat, longitude: lng,
    });
  }

  list.sort((a, b) => a.address.localeCompare(b.address, 'de'));
  if (limit > 0) list = list.slice(0, limit);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const out = join(OUTPUT_DIR, `addresses-${plz}.json`);
  await writeFile(out, JSON.stringify(list, null, 2));

  console.log(`\n✅ ${list.length} Adressen gefunden -> output/addresses-${plz}.json`);
  console.log('   Beispiele:');
  list.slice(0, 5).forEach(a => console.log('   · ' + a.address));
  console.log(`\n   Naechster Schritt:`);
  console.log(`   node workflows/process-addresses.mjs ${plz}`);
}

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
