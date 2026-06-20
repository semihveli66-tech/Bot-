// ============================================================================
//  Workflow 11 — Straßenansicht: Haus von vorne + Solar-Render
// ============================================================================
//
//  Holt ein Street-View-Bild des Hauses (Haus von schräg vorne — emotional viel
//  stärker als die Vogelperspektive) und rendert optional Solarpanele aufs
//  sichtbare Dach.
//
//  Zwei Teile:
//   - Bild holen (Google Street View) -> laeuft ueberall, auch in der Cloud
//   - Rendern (fal.ai) -> nur mit --render UND auf dem Mac (Firewall)
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/11-streetview.mjs 1230            # Street-View-Bilder holen (PLZ)
//    node workflows/11-streetview.mjs <slug>          # nur ein Haus
//    node workflows/11-streetview.mjs 1230 --render   # zusaetzlich Panels rendern (Mac, FAL_KEY)
//
//  Voraussetzung: in Google Cloud die "Street View Static API" aktivieren!
//  Ergebnis: output/<slug>-streetview.png  (+ -streetview-rendered.png mit --render)
// ============================================================================

try { await import('dotenv/config'); } catch {}
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const STORE = join(OUTPUT_DIR, 'prospects.json');

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const FAL_KEY = process.env.FAL_KEY;
const FAL_MODEL = process.env.FLUX_MODEL || 'fal-ai/flux-pro/kontext/max';

const PROMPT = process.env.STREETVIEW_PROMPT ||
  'Add photorealistic black monocrystalline solar panels onto the visible roof ' +
  'of this house in this street-level photo. Neat rows following the roof slope, ' +
  'thin silver frames, realistic reflections and lighting matching the photo. ' +
  'Keep everything else exactly the same: the facade, windows, garden, street, ' +
  'sky, cars and neighbouring houses. Photorealistic, high detail.';

async function main() {
  if (!GOOGLE_KEY) { console.error('❌ GOOGLE_MAPS_API_KEY fehlt.'); process.exit(1); }
  const args = process.argv.slice(2);
  const render = args.includes('--render');
  const filter = args.find(a => a !== '--render') || '';

  let list = JSON.parse(await readFile(STORE, 'utf8'));
  let targets = list.filter(p => p.roof_suitable && p.latitude && p.longitude);
  if (/^\d{4}$/.test(filter)) targets = targets.filter(p => String(p.zip) === filter);
  else if (filter) targets = targets.filter(p => p.slug === filter);
  if (targets.length === 0) { console.error('❌ Keine passenden Haeuser.'); process.exit(1); }

  console.log(`🏠 Street View fuer ${targets.length} Haus/Haeuser ...\n`);
  let found = 0, none = 0;
  for (const p of targets) {
    try {
      const meta = await streetviewMeta(p.latitude, p.longitude);
      if (meta.status !== 'OK') {
        console.log(`  ⛔ ${p.slug}: keine Street-View-Abdeckung (${meta.status})`);
        none++;
        continue;
      }
      // Kamera Richtung Haus drehen (vom Aufnahmepunkt zum Haus).
      const heading = bearing(meta.location.lat, meta.location.lng, p.latitude, p.longitude);
      const imgPath = join(OUTPUT_DIR, `${p.slug}-streetview.png`);
      await fetchStreetview(p.latitude, p.longitude, heading, imgPath);
      console.log(`  ✅ ${p.slug}: Street View gespeichert`);
      found++;

      if (render) {
        if (!FAL_KEY) { console.warn('     ⚠️  --render, aber FAL_KEY fehlt — uebersprungen.'); continue; }
        const url = await falRender(imgPath);
        await download(url, join(OUTPUT_DIR, `${p.slug}-streetview-rendered.png`));
        console.log(`     🎨 mit Solar gerendert`);
        p.streetview_rendered = true;
      }
    } catch (e) {
      console.warn(`  ⚠️  ${p.slug}: ${e.message}`);
    }
  }
  if (render) await writeFile(STORE, JSON.stringify(list, null, 2));
  console.log(`\n✅ Fertig. ${found} mit Street View, ${none} ohne Abdeckung.`);
  if (none > found) console.log('   Hinweis: AT-Abdeckung ist lückenhaft — Satellit bleibt der Fallback.');
}

// ----------------------------------------------------------------------------
//  Street View: Abdeckung pruefen (kostenlos) + Bild holen
// ----------------------------------------------------------------------------
async function streetviewMeta(lat, lng) {
  const url = new URL('https://maps.googleapis.com/maps/api/streetview/metadata');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('key', GOOGLE_KEY);
  const res = await fetch(url);
  const data = await res.json();
  return data; // { status, location:{lat,lng}, pano_id, date }
}

async function fetchStreetview(lat, lng, heading, dest) {
  const url = new URL('https://maps.googleapis.com/maps/api/streetview');
  url.searchParams.set('size', '640x640');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('heading', String(Math.round(heading)));
  url.searchParams.set('fov', '80');     // Blickwinkel
  url.searchParams.set('pitch', '12');   // leicht nach oben -> Dach sichtbar
  url.searchParams.set('source', 'outdoor');
  url.searchParams.set('key', GOOGLE_KEY);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Street View HTTP ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

// Kompass-Richtung von Punkt A nach Punkt B (Grad).
function bearing(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ----------------------------------------------------------------------------
//  fal.ai Rendern (nur auf dem Mac)
// ----------------------------------------------------------------------------
async function falRender(imgPath) {
  const buf = await readFile(imgPath);
  const dataUri = `data:image/png;base64,${buf.toString('base64')}`;
  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: PROMPT, image_url: dataUri, guidance_scale: 3.5, num_images: 1, output_format: 'png' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || `fal HTTP ${res.status}`);
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error('keine Bild-URL von fal');
  return url;
}
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
