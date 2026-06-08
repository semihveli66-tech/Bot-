// ============================================================================
//  Workflow 3b — Lokaler Render (ohne KI): Panels passgenau aufs Dachsegment
// ============================================================================
//
//  Erzeugt das "Dach mit Solar"-Bild OHNE externen KI-Dienst (fal.ai) — laeuft
//  also auch in der Cloud-Umgebung. Es holt die exakte Dach-Geometrie von der
//  Google Solar API (welche Segmente zeigen nach Sueden, wo liegen sie im Bild)
//  und zeichnet dort ein realistisches Solarpanel-Raster aufs Satellitenbild.
//
//  -> Sofortiger Vorher/Nachher-Effekt fuer Microsite & Postkarte.
//  (Fuer den vollen Fotorealismus spaeter Workflow 03 mit fal.ai auf dem Mac.)
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/03b-render-local.mjs                 # alle geeigneten Haeuser
//    node workflows/03b-render-local.mjs <slug>          # nur ein Haus
//
//  Voraussetzung: GOOGLE_MAPS_API_KEY in .env.
//  Ergebnis: output/<slug>-rendered.png
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

// Muss zu Workflow 1 (downloadSatellite) passen!
const MAP = { zoom: 20, scale: 2, size: 640 }; // -> Bild 1280x1280
const IMG = MAP.size * MAP.scale;
const SCALE_FACTOR = Math.pow(2, MAP.zoom) * MAP.scale;

async function main() {
  if (!GOOGLE_KEY) { console.error('❌ GOOGLE_MAPS_API_KEY fehlt.'); process.exit(1); }

  const onlySlug = process.argv[2];
  let list = JSON.parse(await readFile(STORE, 'utf8'));
  let targets = list.filter(p => p.roof_suitable && p.latitude && p.longitude);
  if (onlySlug) targets = targets.filter(p => p.slug === onlySlug);
  if (targets.length === 0) { console.error('❌ Keine geeigneten Haeuser gefunden.'); process.exit(1); }

  console.log(`🎨 Lokaler Render fuer ${targets.length} Haus/Haeuser ...\n`);
  for (const p of targets) {
    try {
      console.log(`→ ${p.slug}`);
      const satPath = join(OUTPUT_DIR, `${p.slug}.png`);
      await access(satPath);

      const segments = await fetchSouthSegments(p.latitude, p.longitude);
      if (!segments.length) { console.warn('  ⚠️  Keine Sued-Segmente — uebersprungen.'); continue; }

      const out = join(OUTPUT_DIR, `${p.slug}-rendered.png`);
      await drawPanels(satPath, p, segments, out);
      console.log(`  ✅ gerendert: output/${p.slug}-rendered.png`);
      p.rendered_image_url = out;
      p.status = 'rendered';
    } catch (e) {
      console.warn(`  ⚠️  Fehlgeschlagen: ${e.message}`);
    }
  }
  await writeFile(STORE, JSON.stringify(list, null, 2));
  console.log('\n✅ Fertig. Jetzt Microsites/Postkarten neu bauen (W4/W5).');
}

// ----------------------------------------------------------------------------
//  Sued-Dachsegmente von der Solar API holen (mit Geometrie)
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
  const segs = (data.solarPotential?.roofSegmentStats || [])
    .filter(s => s.azimuthDegrees >= 110 && s.azimuthDegrees <= 250 && s.boundingBox)
    .sort((a, b) => (b.stats?.areaMeters2 || 0) - (a.stats?.areaMeters2 || 0));
  // Die groessten 1-2 Sued-Flaechen belegen (wie eine echte Anlage).
  return segs.slice(0, 2);
}

// ----------------------------------------------------------------------------
//  Slippy-Map-Projektion: lat/lng -> Pixel im Satellitenbild
// ----------------------------------------------------------------------------
function project(lat, lng) {
  const siny = Math.min(Math.max(Math.sin(lat * Math.PI / 180), -0.9999), 0.9999);
  return {
    x: 256 * (0.5 + lng / 360),
    y: 256 * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)),
  };
}
function toPixel(lat, lng, center) {
  const p = project(lat, lng), c = project(center.lat, center.lng);
  return {
    x: IMG / 2 + (p.x - c.x) * SCALE_FACTOR,
    y: IMG / 2 + (p.y - c.y) * SCALE_FACTOR,
  };
}

// ----------------------------------------------------------------------------
//  Panels aufs Dach zeichnen
// ----------------------------------------------------------------------------
async function drawPanels(satPath, p, segments, outPath) {
  const img = await Jimp.read(satPath);
  const center = { lat: p.latitude, lng: p.longitude };
  const mPerPx = (156543.03392 * Math.cos(p.latitude * Math.PI / 180)) / SCALE_FACTOR;

  // Modulgroesse ~1.7m x 1.0m
  const cellW = Math.max(10, Math.round(1.7 / mPerPx));
  const cellH = Math.max(7,  Math.round(1.0 / mPerPx));

  for (const seg of segments) {
    const a = toPixel(seg.boundingBox.sw.latitude, seg.boundingBox.sw.longitude, center);
    const b = toPixel(seg.boundingBox.ne.latitude, seg.boundingBox.ne.longitude, center);
    let x0 = Math.round(Math.min(a.x, b.x)), x1 = Math.round(Math.max(a.x, b.x));
    let y0 = Math.round(Math.min(a.y, b.y)), y1 = Math.round(Math.max(a.y, b.y));

    // Etwas Rand lassen (Dachkante), damit es montiert wirkt.
    const insetX = Math.round((x1 - x0) * 0.14), insetY = Math.round((y1 - y0) * 0.14);
    x0 += insetX; x1 -= insetX; y0 += insetY; y1 -= insetY;
    x0 = clamp(x0, 0, IMG - 1); x1 = clamp(x1, 0, IMG - 1);
    y0 = clamp(y0, 0, IMG - 1); y1 = clamp(y1, 0, IMG - 1);
    if (x1 - x0 < cellW || y1 - y0 < cellH) continue;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const lx = (x - x0) % cellW;
        const ly = (y - y0) % cellH;
        const onFrame = (x <= x0 + 1) || (x >= x1 - 1) || (y <= y0 + 1) || (y >= y1 - 1);
        const moduleGap = (lx < 1) || (ly < 1);
        let r, g, bl, alpha = 0.98;
        if (onFrame) {                 // heller Montagerahmen aussen
          r = 200; g = 205; bl = 212;
        } else if (moduleGap) {        // dunkle Fugen zwischen Modulen
          r = 6; g = 8; bl = 14;
        } else {
          // echte Module wirken fast schwarz mit leichtem Blaustich + Glanz oben
          const t = ly / cellH;        // 0 oben -> 1 unten
          r = Math.round(16 + 16 * (1 - t));
          g = Math.round(20 + 22 * (1 - t));
          bl = Math.round(32 + 38 * (1 - t));
          // feine Zell-Linien innerhalb eines Moduls (3x6 Zellen)
          const cw = cellW / 3, ch = cellH / 6;
          if ((lx % cw) < 0.8 || (ly % ch) < 0.8) { r -= 6; g -= 6; bl -= 8; }
        }
        blend(img, x, y, Math.max(0,r), Math.max(0,g), Math.max(0,bl), alpha);
      }
    }
  }

  await img.writeAsync(outPath);
}

function blend(img, x, y, r, g, b, alpha) {
  const idx = (img.bitmap.width * y + x) << 2;
  const d = img.bitmap.data;
  d[idx]   = Math.round(r * alpha + d[idx]   * (1 - alpha));
  d[idx+1] = Math.round(g * alpha + d[idx+1] * (1 - alpha));
  d[idx+2] = Math.round(b * alpha + d[idx+2] * (1 - alpha));
  d[idx+3] = 255;
}
function clamp(v, a, b){ return Math.min(Math.max(v, a), b); }
async function imageExists(f){ try { await access(f); return true; } catch { return false; } }

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
