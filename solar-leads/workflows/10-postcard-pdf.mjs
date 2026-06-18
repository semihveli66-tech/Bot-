// ============================================================================
//  Workflow 10 — Postkarten als druckfertige PDFs (für POKAmax / Druckereien)
// ============================================================================
//
//  Wandelt die HTML-Postkarten (Workflow 5) in echte PDF-Dateien um — eine
//  PDF pro Haus, mit Vorder- UND Rückseite (A6 quer). Genau dieses Format
//  braucht POKAmax im "Vollständiges Design"-Modus (1 PDF je Karte).
//
//  ⚠️ Laeuft auf deinem MAC. Beim ersten Mal laedt es einen kleinen Browser
//     (Chromium) herunter — das macht "npm install" automatisch.
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/10-postcard-pdf.mjs               # alle Postkarten
//    node workflows/10-postcard-pdf.mjs 1230          # nur PLZ 1230
//
//  Voraussetzung: vorher Workflow 5 (Postkarten) gebaut haben.
//  Ergebnis: output/postcards/<slug>.pdf
// ============================================================================

try { await import('dotenv/config'); } catch {}
import puppeteer from 'puppeteer';
import { readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const CARDS_DIR = join(OUTPUT_DIR, 'postcards');
const STORE = join(OUTPUT_DIR, 'prospects.json');

async function main() {
  const plz = (process.argv[2] || '').trim();

  let list = JSON.parse(await readFile(STORE, 'utf8'));
  let targets = list.filter(p => p.roof_suitable);
  if (/^\d{4}$/.test(plz)) targets = targets.filter(p => String(p.zip) === plz);
  if (targets.length === 0) { console.error('❌ Keine geeigneten Haeuser (ggf. PLZ pruefen).'); process.exit(1); }

  console.log(`📄 Erzeuge ${targets.length} Postkarten-PDF(s) ...\n`);
  const browser = await puppeteer.launch({ headless: 'new' });
  let ok = 0;
  for (const p of targets) {
    const htmlPath = join(CARDS_DIR, `${p.slug}.html`);
    if (!(await exists(htmlPath))) {
      console.warn(`  ⚠️  ${p.slug}: keine Postkarten-HTML (erst Workflow 5 laufen lassen).`);
      continue;
    }
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' });
    const pdfPath = join(CARDS_DIR, `${p.slug}.pdf`);
    await page.pdf({
      path: pdfPath,
      width: '148mm', height: '105mm',     // A6 quer
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await page.close();
    console.log(`  ✅ output/postcards/${p.slug}.pdf`);
    ok++;
  }
  await browser.close();
  console.log(`\n✅ Fertig: ${ok} PDF(s). Bereit fuer POKAmax (Workflow 9) oder eine Druckerei.`);
}

async function exists(f){ try { await access(f); return true; } catch { return false; } }

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
