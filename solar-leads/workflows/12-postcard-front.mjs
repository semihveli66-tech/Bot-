// ============================================================================
//  Workflow 12 — Kombi-Vorderseite (Dachbild + Werte + QR) als EIN Bild
// ============================================================================
//
//  Erzeugt EIN fertiges Postkarten-Vorderseiten-Bild pro Haus:
//    - das gerenderte Dach mit Solar (Hintergrund)
//    - Headline + Eckdaten (kWp, Ersparnis, Amortisation)
//    - ein scannbarer QR-Code zur persönlichen Microsite
//
//  Ideal zum MANUELLEN Hochladen bei POKAmax/„Karte schreiben" — der Empfänger
//  kann den QR direkt von der gedruckten Karte scannen.
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/12-postcard-front.mjs <slug>     # ein Haus
//    node workflows/12-postcard-front.mjs 1230        # alle einer PLZ
//
//  Voraussetzung: <slug>-rendered.png (oder <slug>.png) vorhanden.
//  Ergebnis: output/<slug>-front.png  (A6 quer, 300 dpi)
// ============================================================================

try { await import('dotenv/config'); } catch {}
import Jimp from 'jimp';
import QRCode from 'qrcode';
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const STORE = join(OUTPUT_DIR, 'prospects.json');
const BASE_URL = (process.env.MICROSITE_BASE_URL || 'https://solar-wien.at').replace(/\/$/, '');
const BRAND = process.env.SENDER_NAME || 'Solar Wien';

const W = 1748, H = 1240; // A6 quer @ 300 dpi

async function main() {
  const filter = (process.argv[2] || '').trim();
  let list = JSON.parse(await readFile(STORE, 'utf8'));
  let targets = list.filter(p => p.roof_suitable);
  if (/^\d{4}$/.test(filter)) targets = targets.filter(p => String(p.zip) === filter);
  else if (filter) targets = targets.filter(p => p.slug === filter);
  if (targets.length === 0) { console.error('❌ Keine passenden Haeuser.'); process.exit(1); }

  const fBig = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const fMed = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

  for (const p of targets) {
    try {
      const src = (await exists(`${p.slug}-rendered.png`)) ? `${p.slug}-rendered.png`
                : (await exists(`${p.slug}.png`)) ? `${p.slug}.png` : null;
      if (!src) { console.warn(`  ⚠️  ${p.slug}: kein Bild.`); continue; }

      // Hintergrund: Dachbild auf A6-quer zuschneiden/fuellen.
      const img = await Jimp.read(join(OUTPUT_DIR, src));
      img.cover(W, H);

      // Dunkler Verlauf unten fuer Lesbarkeit.
      darkenBottom(img, 0.55);

      // Marke oben links.
      img.print(fMed, 60, 50, BRAND);

      // Texte unten.
      const kwp = nf(p.system_size_kwp);
      const save = nf(p.annual_savings_eur);
      const pay = p.payback_years != null ? String(p.payback_years).replace('.', ',') : '-';
      img.print(fBig, 60, H - 330, 'Ihr Dach. Mit Solar.');
      img.print(fMed, 62, H - 235, `${kwp} kWp   |   ${save} EUR/Jahr sparen   |   ${pay} Jahre`);
      img.print(fMed, 62, H - 180, 'Kostenlose Beratung - einfach QR scannen:');

      // QR-Code zur Microsite, unten rechts auf weisser Karte.
      const url = p.microsite_url || `${BASE_URL}/${p.slug}.html`;
      const qrBuf = await QRCode.toBuffer(url, { width: 300, margin: 1 });
      const qr = await Jimp.read(qrBuf);
      const pad = 18;
      const card = new Jimp(qr.bitmap.width + pad * 2, qr.bitmap.height + pad * 2, 0xffffffff);
      card.composite(qr, pad, pad);
      img.composite(card, W - card.bitmap.width - 60, H - card.bitmap.height - 60);

      const out = join(OUTPUT_DIR, `${p.slug}-front.png`);
      await img.writeAsync(out);
      console.log(`  ✅ output/${p.slug}-front.png`);
    } catch (e) {
      console.warn(`  ⚠️  ${p.slug}: ${e.message}`);
    }
  }
  console.log('\n✅ Fertig. Dieses Bild bei POKAmax als Vorderseite hochladen.');
}

// Unteren Bildbereich abdunkeln (weicher Verlauf).
function darkenBottom(img, frac) {
  const gh = Math.round(H * frac);
  const d = img.bitmap.data;
  for (let y = H - gh; y < H; y++) {
    const t = (y - (H - gh)) / gh;        // 0 oben -> 1 unten
    const a = Math.min(0.82, t * 0.95);
    for (let x = 0; x < W; x++) {
      const i = (W * y + x) << 2;
      d[i]   = Math.round(d[i]   * (1 - a));
      d[i+1] = Math.round(d[i+1] * (1 - a));
      d[i+2] = Math.round(d[i+2] * (1 - a));
    }
  }
}

async function exists(name){ try { await access(join(OUTPUT_DIR, name)); return true; } catch { return false; } }
function nf(n){ return n == null ? '-' : new Intl.NumberFormat('de-DE').format(Math.round(n)); }

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
