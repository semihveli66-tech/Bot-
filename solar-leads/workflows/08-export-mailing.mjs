// ============================================================================
//  Workflow 8 — Mailing-Export (druckfertiges Paket für den Postversand)
// ============================================================================
//
//  Erzeugt aus deinen geeigneten Häusern ein komplettes Versand-Paket, das du
//  bei JEDEM Druck-&-Versanddienst hochladen kannst (EchtPost, POKAmax,
//  druck.at-Lettershop ...):
//
//    output/mailing/mailing-liste.csv     <- Empfänger + alle Postkarten-Daten
//    output/mailing/<slug>-vorderseite.png <- Dachbild (mit Solar) pro Haus
//    output/mailing/<slug>-qr.png          <- QR-Code zur Microsite pro Haus
//
//  Damit kann ein Lettershop personalisierte Postkarten drucken + frankieren +
//  versenden — ohne dass du eine API programmierst.
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/08-export-mailing.mjs
//
//  Konfig (optional, .env): MICROSITE_BASE_URL (für die QR-Ziele)
// ============================================================================

try { await import('dotenv/config'); } catch {}
import QRCode from 'qrcode';
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const MAIL_DIR = join(OUTPUT_DIR, 'mailing');
const STORE = join(OUTPUT_DIR, 'prospects.json');
const BASE_URL = (process.env.MICROSITE_BASE_URL || 'https://solar-wien.at').replace(/\/$/, '');

async function main() {
  // Optionaler Bezirks-Filter: nur Haeuser einer PLZ exportieren (saubere Kampagne).
  //   node workflows/08-export-mailing.mjs 1230
  const plzFilter = (process.argv[2] || '').trim();

  let list = JSON.parse(await readFile(STORE, 'utf8'));
  let targets = list.filter(p => p.roof_suitable);
  if (/^\d{4}$/.test(plzFilter)) {
    targets = targets.filter(p => String(p.zip) === plzFilter);
    console.log(`📍 Filter: nur PLZ ${plzFilter}`);
  }
  if (targets.length === 0) { console.error('❌ Keine geeigneten Haeuser (ggf. PLZ pruefen).'); process.exit(1); }

  await mkdir(MAIL_DIR, { recursive: true });

  const rows = [[
    'empfaenger','strasse_hausnummer','plz','ort','land',
    'anlage_kwp','ersparnis_eur_jahr','amortisation_jahre',
    'microsite_url','vorderseite_bild','qr_bild',
  ]];

  let withImage = 0;
  for (const p of targets) {
    const street = p.street ? `${p.street}${p.house_number ? ' ' + p.house_number : ''}` : (p.address||'').split(',')[0];

    // Vorderseiten-Bild (gerendert bevorzugt) ins Mailing-Verzeichnis kopieren.
    const frontSrc = (await exists(join(OUTPUT_DIR, `${p.slug}-rendered.png`)))
      ? join(OUTPUT_DIR, `${p.slug}-rendered.png`)
      : (await exists(join(OUTPUT_DIR, `${p.slug}.png`)) ? join(OUTPUT_DIR, `${p.slug}.png`) : null);
    const frontName = `${p.slug}-vorderseite.png`;
    if (frontSrc) { await copyFile(frontSrc, join(MAIL_DIR, frontName)); withImage++; }

    // QR-Code zur Microsite erzeugen.
    const url = p.microsite_url || `${BASE_URL}/${p.slug}.html`;
    const qrName = `${p.slug}-qr.png`;
    await QRCode.toFile(join(MAIL_DIR, qrName), url, { margin: 1, width: 600 });

    rows.push([
      p.owner_name || 'An die Hauseigentümer:innen',
      street, p.zip || '', p.city || 'Wien', 'Österreich',
      fmt(p.system_size_kwp), fmt(p.annual_savings_eur),
      p.payback_years != null ? String(p.payback_years).replace('.', ',') : '',
      url, frontSrc ? frontName : '', qrName,
    ]);
  }

  const csv = rows.map(r => r.map(csvCell).join(';')).join('\r\n');
  await writeFile(join(MAIL_DIR, 'mailing-liste.csv'), '﻿' + csv, 'utf8'); // BOM für Excel

  console.log(`\n✅ Mailing-Export fertig: output/mailing/`);
  console.log(`   · ${targets.length} Empfaenger in mailing-liste.csv`);
  console.log(`   · ${withImage} Vorderseiten-Bilder + ${targets.length} QR-Codes`);
  console.log(`\n   Naechster Schritt: Ordner output/mailing/ bei einem Druck-&-Versanddienst`);
  console.log(`   hochladen (EchtPost, POKAmax oder druck.at-Lettershop).`);
}

async function exists(f){ try { await access(f); return true; } catch { return false; } }
function fmt(n){ return n == null ? '' : new Intl.NumberFormat('de-AT').format(Math.round(n)); }
function csvCell(v){
  const s = String(v ?? '');
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
