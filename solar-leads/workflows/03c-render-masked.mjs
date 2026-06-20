// ============================================================================
//  Workflow 3c — Präziser Render mit Dach-Maske (Inpainting)
// ============================================================================
//
//  Der Qualitätssprung: Wir erzeugen aus den Google-Solar-Dachpolygonen eine
//  exakte MASKE (weiß = Süd-Dach, schwarz = Rest) und sagen der KI per
//  Inpainting "male NUR hier Panels, lass alles andere unangetastet".
//  -> Panels sitzen exakt aufs Dach, kein Verrutschen auf Boden/Nachbarn.
//
//  Zwei Teile:
//   - Maske bauen (Google Solar + Bildrechnung) -> laeuft ueberall, auch Cloud
//   - Rendern (fal.ai Flux Fill) -> nur mit --render UND auf dem Mac (Firewall)
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/03c-render-masked.mjs 1230          # nur Masken bauen (testen)
//    node workflows/03c-render-masked.mjs <slug>        # ein Haus
//    node workflows/03c-render-masked.mjs 1230 --render # + Panels rendern (Mac, FAL_KEY)
//
//  Voraussetzung: Satellitenbild (<slug>.png) aus Workflow 1 muss da sein.
//  Ergebnis: output/<slug>-mask.png  (+ -rendered.png mit --render)
//            output/<slug>-maskcheck.png  (Kontrollbild: Maske über Satellit)
// ============================================================================

try { await import('dotenv/config'); } catch {}
import Jimp from 'jimp';
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const STORE = join(OUTPUT_DIR, 'prospects.json');

const GOOGLE_KEY = process.env.GOOGLE_SOLAR_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const FAL_KEY = process.env.FAL_KEY;
// Flux Kontext rendert ZUVERLAESSIG sichtbare Panels (besser als Fill bei kleinen Flaechen);
// die Maske beschraenkt sie danach aufs Dach.
const FAL_MODEL = process.env.FLUX_MODEL || 'fal-ai/flux-pro/kontext/max';

// Bild-Geometrie — MUSS exakt zu Workflow 1 (downloadSatellite) passen!
const ZOOM = 19, TILE = 256, IMG = 1280;
const CROP = 640;            // 3x3=768 -> zentral 640 ausgeschnitten -> auf 1280 skaliert
const SCALE = IMG / CROP;    // 2.0

const PROMPT = process.env.RENDER_PROMPT ||
  'Add many photorealistic black monocrystalline solar panels in neat rectangular ' +
  'rows onto the pitched roof of the central house, following the roof slope. Thin ' +
  'silver frames, realistic reflections and shadows, top-down aerial satellite view, ' +
  'high detail.';

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

  console.log(`🎯 Dach-Maske fuer ${targets.length} Haus/Haeuser ...\n`);
  for (const p of targets) {
    try {
      const satPath = join(OUTPUT_DIR, `${p.slug}.png`);
      await access(satPath); // Satellit muss da sein

      const segs = await fetchSouthSegments(p.latitude, p.longitude);
      if (!segs.length) { console.warn(`  ⚠️  ${p.slug}: keine Sued-Segmente.`); continue; }

      const maskPath = join(OUTPUT_DIR, `${p.slug}-mask.png`);
      await buildMask(p, segs, maskPath, satPath);
      console.log(`  ✅ ${p.slug}: Maske + Kontrollbild erstellt`);

      if (render) {
        if (!FAL_KEY) { console.warn('     ⚠️  --render, aber FAL_KEY fehlt — uebersprungen.'); continue; }
        // 1) Panels aufs ganze Bild rendern (Kontext = zuverlaessig sichtbar)
        const fullUrl = await falKontext(satPath);
        const fullPath = join(OUTPUT_DIR, `${p.slug}-rendered-full.png`);
        await download(fullUrl, fullPath);
        // 2) Per Maske auf das erkannte Dach beschraenken
        await composite(satPath, fullPath, maskPath, join(OUTPUT_DIR, `${p.slug}-rendered.png`));
        console.log('     🎨 Panels gerendert + per Maske aufs Dach beschraenkt');
      }
    } catch (e) {
      console.warn(`  ⚠️  ${p.slug}: ${e.message}`);
    }
  }
  console.log('\n✅ Fertig. Prüfe output/<slug>-maskcheck.png (Maske muss aufs Dach passen).');
}

// ----------------------------------------------------------------------------
//  Sued-Dachsegmente von der Solar API holen
// ----------------------------------------------------------------------------
async function fetchSouthSegments(lat, lng) {
  const url = new URL('https://solar.googleapis.com/v1/buildingInsights:findClosest');
  url.searchParams.set('location.latitude', String(lat));
  url.searchParams.set('location.longitude', String(lng));
  url.searchParams.set('requiredQuality', 'HIGH');
  url.searchParams.set('key', GOOGLE_KEY);
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) return [];
  return (data.solarPotential?.roofSegmentStats || [])
    .filter(s => s.azimuthDegrees >= 110 && s.azimuthDegrees <= 250 && s.boundingBox)
    .sort((a, b) => (b.stats?.areaMeters2 || 0) - (a.stats?.areaMeters2 || 0))
    .slice(0, 3);
}

// ----------------------------------------------------------------------------
//  Bild-Projektion: lat/lng -> Pixel im 1280er Satellitenbild
//  (identisch zur Tile-Logik aus Workflow 1)
// ----------------------------------------------------------------------------
function fracTile(lat, lng) {
  const n = 2 ** ZOOM;
  const fx = (lng + 180) / 360 * n;
  const fy = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
  return { fx, fy };
}
function makeProjector(houseLat, houseLng) {
  const h = fracTile(houseLat, houseLng);
  const tx = Math.floor(h.fx), ty = Math.floor(h.fy);
  // 3x3-Canvas: Tile (tx-1) liegt bei Canvas-x 0; danach zentraler 640-Crop, dann x SCALE.
  return (lat, lng) => {
    const f = fracTile(lat, lng);
    const canvasX = (f.fx - (tx - 1)) * TILE;
    const canvasY = (f.fy - (ty - 1)) * TILE;
    return { x: (canvasX - (TILE * 3 - CROP) / 2) * SCALE, y: (canvasY - (TILE * 3 - CROP) / 2) * SCALE };
  };
}

// ----------------------------------------------------------------------------
//  Maske bauen + Kontrollbild
// ----------------------------------------------------------------------------
async function buildMask(p, segs, maskPath, satPath) {
  const project = makeProjector(p.latitude, p.longitude);
  const mask = new Jimp(IMG, IMG, 0x000000ff); // schwarz
  const white = Jimp.rgbaToInt(255, 255, 255, 255);

  for (const s of segs) {
    const a = project(s.boundingBox.sw.latitude, s.boundingBox.sw.longitude);
    const b = project(s.boundingBox.ne.latitude, s.boundingBox.ne.longitude);
    let x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    let y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    // leichten Rand lassen (Dachkante)
    const ix = (x1 - x0) * 0.08, iy = (y1 - y0) * 0.08;
    x0 += ix; x1 -= ix; y0 += iy; y1 -= iy;
    for (let y = Math.max(0, y0 | 0); y <= Math.min(IMG - 1, y1 | 0); y++)
      for (let x = Math.max(0, x0 | 0); x <= Math.min(IMG - 1, x1 | 0); x++)
        mask.setPixelColor(white, x, y);
  }
  await mask.writeAsync(maskPath);

  // Kontrollbild: Maske halbtransparent ueber den Satellit
  const sat = await Jimp.read(satPath);
  if (sat.bitmap.width !== IMG) sat.resize(IMG, IMG);
  mask.scan(0, 0, IMG, IMG, function (x, y, idx) {
    if (this.bitmap.data[idx] > 128) {
      const sidx = (IMG * y + x) << 2;
      sat.bitmap.data[sidx] = Math.min(255, sat.bitmap.data[sidx] + 70);     // R+
      sat.bitmap.data[sidx + 1] = Math.max(0, sat.bitmap.data[sidx + 1] - 20);
      sat.bitmap.data[sidx + 2] = Math.max(0, sat.bitmap.data[sidx + 2] - 20);
    }
  });
  await sat.writeAsync(join(OUTPUT_DIR, `${p.slug}-maskcheck.png`));
}

// ----------------------------------------------------------------------------
//  fal.ai Flux Kontext (ganzes Bild) — nur auf dem Mac
// ----------------------------------------------------------------------------
async function falKontext(satPath) {
  const img = `data:image/png;base64,${(await readFile(satPath)).toString('base64')}`;
  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: PROMPT, image_url: img, guidance_scale: 3.5, num_images: 1, output_format: 'png' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || `fal HTTP ${res.status}`);
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error('keine Bild-URL von fal');
  return url;
}

// ----------------------------------------------------------------------------
//  Composite: Panels NUR auf dem Dach behalten (weiche Masken-Kanten)
// ----------------------------------------------------------------------------
async function composite(origPath, fullPath, maskPath, outPath) {
  const orig = await Jimp.read(origPath);
  const full = await Jimp.read(fullPath);
  const mask = await Jimp.read(maskPath);
  for (const im of [orig, full, mask]) {
    if (im.bitmap.width !== IMG || im.bitmap.height !== IMG) im.resize(IMG, IMG);
  }
  mask.blur(6); // weiche Kanten -> nahtloser Uebergang

  const out = orig.clone();
  const od = out.bitmap.data, fd = full.bitmap.data, md = mask.bitmap.data;
  for (let i = 0; i < od.length; i += 4) {
    const m = md[i] / 255; // 0 (Original) .. 1 (Render mit Panels)
    od[i]     = Math.round(od[i]     * (1 - m) + fd[i]     * m);
    od[i + 1] = Math.round(od[i + 1] * (1 - m) + fd[i + 1] * m);
    od[i + 2] = Math.round(od[i + 2] * (1 - m) + fd[i + 2] * m);
  }
  await out.writeAsync(outPath);
}
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
