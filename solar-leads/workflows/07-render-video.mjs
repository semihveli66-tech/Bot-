// ============================================================================
//  Workflow 7 — Video-Render: kinematischer Flyover des Dachs mit Solar
// ============================================================================
//
//  Macht aus dem (gerenderten) Dachbild ein kurzes, kinoreifes Video — als
//  Vogelperspektive-Flyover (Standard) oder Straßenansicht. Ideal fuer die
//  Microsite-Hero und Social Media.
//
//  ⚠️ Laeuft auf DEINEM MAC (fal.ai/Veo ist in der Cloud-Umgebung blockiert).
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/07-render-video.mjs                       # alle, Vogelperspektive
//    node workflows/07-render-video.mjs <slug>                # ein Haus
//    node workflows/07-render-video.mjs <slug> street         # Straßenansicht
//
//  Voraussetzung: FAL_KEY in .env.  Ergebnis: output/<slug>-video.mp4
//  Kosten: je nach Modell ~1-3 $/Video. Dauer: 1-3 Minuten pro Video.
//
//  Modell ist konfigurierbar (.env VEO_MODEL), Standard ein Veo-3-Endpoint.
// ============================================================================

try { await import('dotenv/config'); } catch {}
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const STORE = join(OUTPUT_DIR, 'prospects.json');

const FAL_KEY = process.env.FAL_KEY;
const MODEL = process.env.VEO_MODEL || 'fal-ai/veo3/fast/image-to-video';

const PROMPTS = {
  aerial:
    'Cinematic aerial drone shot slowly descending and gently orbiting over a ' +
    'suburban single-family house in Vienna, revealing the rooftop solar panels ' +
    'glinting in warm golden-hour light, smooth stabilized camera motion, soft ' +
    'haze, photorealistic, 4K. No text.',
  street:
    'Cinematic street-level dolly shot slowly approaching a suburban single-family ' +
    'house in Vienna, then tilting up to reveal the rooftop solar panels in warm ' +
    'afternoon light, smooth stabilized motion, shallow depth of field, ' +
    'photorealistic, 4K. No text.',
};

async function main() {
  if (!FAL_KEY) {
    console.error('❌ FAL_KEY fehlt in der .env (https://fal.ai -> API Keys).');
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const mode = (args.find(a => a === 'aerial' || a === 'street')) || 'aerial';
  const onlySlug = args.find(a => a !== 'aerial' && a !== 'street');

  let list = JSON.parse(await readFile(STORE, 'utf8'));
  let targets = list.filter(p => p.roof_suitable);
  if (onlySlug) targets = targets.filter(p => p.slug === onlySlug);
  if (targets.length === 0) { console.error('❌ Keine geeigneten Haeuser gefunden.'); process.exit(1); }

  console.log(`🎬 Erzeuge ${targets.length} Video(s) — Modus: ${mode}\n`);
  for (const p of targets) {
    try {
      console.log(`→ ${p.slug}`);
      const img = await imageDataUri(`${p.slug}-rendered.png`) || await imageDataUri(`${p.slug}.png`);
      if (!img) { console.warn('  ⚠️  Kein Bild — uebersprungen.'); continue; }

      const videoUrl = await falVideo(img, PROMPTS[mode]);
      const dest = join(OUTPUT_DIR, `${p.slug}-video.mp4`);
      await download(videoUrl, dest);
      console.log(`  ✅ Video: output/${p.slug}-video.mp4`);
      p.video_url = dest;
      p.video_mode = mode;
    } catch (e) {
      console.warn(`  ⚠️  Video fehlgeschlagen: ${e.message}`);
    }
  }
  await writeFile(STORE, JSON.stringify(list, null, 2));
  console.log('\n✅ Fertig. Videos liegen in output/.');
}

// ----------------------------------------------------------------------------
//  fal.ai Queue-API (fuer laengere Jobs wie Video)
// ----------------------------------------------------------------------------
async function falVideo(imageDataUri, prompt) {
  // 1) Job einreichen
  const submit = await fetch(`https://queue.fal.run/${MODEL}`, {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_url: imageDataUri, aspect_ratio: '16:9' }),
  });
  const sub = await submit.json().catch(() => ({}));
  if (!submit.ok) throw new Error(sub?.detail || `Submit HTTP ${submit.status}`);
  const statusUrl = sub.status_url;
  const responseUrl = sub.response_url;
  if (!statusUrl) throw new Error('Keine status_url von fal erhalten.');

  // 2) Pollen bis fertig (max ~5 Min)
  for (let i = 0; i < 100; i++) {
    await sleep(3000);
    const st = await fetch(statusUrl, { headers: { 'Authorization': `Key ${FAL_KEY}` } });
    const sj = await st.json().catch(() => ({}));
    if (sj.status === 'COMPLETED') break;
    if (sj.status === 'FAILED' || sj.error) throw new Error('fal-Job fehlgeschlagen.');
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  // 3) Ergebnis holen
  const res = await fetch(responseUrl, { headers: { 'Authorization': `Key ${FAL_KEY}` } });
  const data = await res.json().catch(() => ({}));
  const url = data?.video?.url || data?.video_url || data?.videos?.[0]?.url;
  if (!url) throw new Error('Keine Video-URL in der fal-Antwort.');
  return url;
}

async function imageDataUri(filename) {
  try { await access(join(OUTPUT_DIR, filename)); }
  catch { return null; }
  const buf = await readFile(join(OUTPUT_DIR, filename));
  return `data:image/png;base64,${buf.toString('base64')}`;
}
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
