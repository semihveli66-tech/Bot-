// ============================================================================
//  Workflow 3 — KI-Rendering: Solarpanele aufs echte Dach
// ============================================================================
//
//  Nimmt das echte Satellitenbild eines Hauses und lässt Flux Kontext (via
//  fal.ai) photorealistische Solarpanele auf das Dach rendern — ohne den Rest
//  des Bildes zu verändern. Das ist das "Wow"-Bild für Postkarte & Microsite.
//
//  ⚠️ WICHTIG: fal.ai ist in der Claude-Code-WEB-Umgebung durch die Firewall
//     blockiert. Dieses Skript läuft daher auf DEINEM EIGENEN RECHNER
//     (oder einer Umgebung, in der fal.ai erreichbar ist).
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/03-render-panels.mjs                 # rendert ALLE geeigneten Haeuser
//    node workflows/03-render-panels.mjs <slug>          # nur ein bestimmtes Haus
//
//  Voraussetzung: FAL_KEY in der .env (von https://fal.ai -> API Keys).
//  Ergebnis: output/<slug>-rendered.png  +  Eintrag in output/prospects.json.
// ============================================================================

try { await import('dotenv/config'); } catch {}
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const STORE = join(OUTPUT_DIR, 'prospects.json');

const FAL_KEY = process.env.FAL_KEY;

// Das Flux-Kontext-Modell bei fal.ai (Bild-zu-Bild-Bearbeitung).
const FAL_MODEL = 'fal-ai/flux-pro/kontext';

// Der Render-Auftrag an die KI. Klar formuliert: NUR Panels aufs Dach,
// sonst nichts veraendern.
const PROMPT =
  'Add realistic dark blue-black monocrystalline solar photovoltaic panels, ' +
  'neatly arranged in clean rectangular rows on the main south-facing roof ' +
  'surface of this house. Aerial top-down satellite view, photorealistic, ' +
  'panels precisely aligned with the roof edges and slope, matching the ' +
  'existing lighting, shadows and perspective. Do not change anything else ' +
  'in the image — keep the garden, neighbouring houses, streets and trees ' +
  'exactly the same.';

async function main() {
  if (!FAL_KEY) {
    console.error('❌ FAL_KEY fehlt in der .env. Hol ihn dir auf https://fal.ai -> API Keys.');
    process.exit(1);
  }

  const onlySlug = process.argv[2];
  let list = JSON.parse(await readFile(STORE, 'utf8'));
  let targets = list.filter(p => p.roof_suitable);
  if (onlySlug) targets = targets.filter(p => p.slug === onlySlug);

  if (targets.length === 0) {
    console.error('❌ Keine geeigneten Haeuser gefunden (erst Workflow 1 laufen lassen).');
    process.exit(1);
  }

  console.log(`🎨 Rendere Solarpanele fuer ${targets.length} Haus/Haeuser ...\n`);

  for (const p of targets) {
    try {
      console.log(`→ ${p.slug}`);
      const dataUri = await imageDataUri(p);
      if (!dataUri) { console.warn('  ⚠️  Satellitenbild fehlt — uebersprungen.'); continue; }

      const renderedUrl = await falRender(dataUri);
      const outPath = await downloadImage(renderedUrl, join(OUTPUT_DIR, `${p.slug}-rendered.png`));
      console.log(`  ✅ gerendert: output/${p.slug}-rendered.png`);

      // In der lokalen Liste vermerken.
      p.rendered_image_url = outPath;
      p.status = 'rendered';
    } catch (e) {
      console.warn(`  ⚠️  Render fehlgeschlagen: ${e.message}`);
    }
  }

  await writeFile(STORE, JSON.stringify(list, null, 2));
  console.log('\n✅ Fertig. Render-Bilder liegen in output/, Liste aktualisiert.');
  console.log('   Tipp: jetzt "node workflows/04-build-microsite.mjs" fuer die Microsites.');
}

// ----------------------------------------------------------------------------
//  fal.ai aufrufen (synchron) und Bild-URL zurueckgeben
// ----------------------------------------------------------------------------
async function falRender(imageDataUri) {
  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: PROMPT,
      image_url: imageDataUri,   // fal akzeptiert Daten-URIs direkt
      guidance_scale: 3.5,
      num_images: 1,
      output_format: 'png',
      safety_tolerance: '2',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `HTTP ${res.status}`);
  }
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error('Keine Bild-URL in der fal-Antwort.');
  return url;
}

// ----------------------------------------------------------------------------
//  Hilfsfunktionen
// ----------------------------------------------------------------------------
async function imageDataUri(p) {
  const candidate = join(OUTPUT_DIR, `${p.slug}.png`);
  try {
    await access(candidate);
    const buf = await readFile(candidate);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function downloadImage(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fehlgeschlagen: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return dest;
}

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
