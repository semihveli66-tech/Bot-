// ============================================================================
//  Workflow 9 (POKAmax) — Echter Postversand über die POKAmax-API
// ============================================================================
//
//  Schickt pro Haus EINE fertige Postkarten-PDF (Vorder- + Rückseite, mit
//  Dachbild, QR, Werten) an POKAmax -> Druck + Versand, auch nach Österreich.
//
//  ⚠️ SICHERHEITSBREMSE: Standard = PROBELAUF (dry-run). Es wird NICHTS
//     gesendet und NICHTS berechnet. Echter Versand nur mit  --send.
//
//  Ablauf:
//    1. node workflows/05-build-postcard.mjs 1230     (Postkarten-HTML)
//    2. node workflows/10-postcard-pdf.mjs 1230        (-> PDFs)
//    3. node workflows/09-send-pokamax.mjs 1230        (Probelauf)
//    4. node workflows/09-send-pokamax.mjs 1230 --send (ECHT senden)
//
//  .env:
//    POKAMAX_API_URL   Endpoint aus deinem POKAmax-PARTNER-Konto
//    POKAMAX_API_KEY   Partner-/API-Schlüssel
//
//  ──────────────────────────────────────────────────────────────────────────
//  HINWEIS für deinen Mac-Claude:
//  Die EXAKTEN Feldnamen + die Endpoint-URL stehen in der POKAmax-Partner-API-
//  Doku (pokamax.com/de/partner/api, nach Login). Die Funktion sendToPokamax()
//  unten ist klar markiert — dort ggf. Feldnamen an die Doku anpassen.
//  ──────────────────────────────────────────────────────────────────────────
// ============================================================================

try { await import('dotenv/config'); } catch {}
import { readFile, access } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const CARDS_DIR = join(OUTPUT_DIR, 'postcards');
const STORE = join(OUTPUT_DIR, 'prospects.json');

const API_URL = process.env.POKAMAX_API_URL;   // aus dem POKAmax-Partner-Konto
const API_KEY = process.env.POKAMAX_API_KEY;

async function main() {
  const args = process.argv.slice(2);
  const send = args.includes('--send');
  const plz = (args.find(a => /^\d{4}$/.test(a)) || '').trim();

  let list = JSON.parse(await readFile(STORE, 'utf8'));
  let targets = list.filter(p => p.roof_suitable);
  if (plz) targets = targets.filter(p => String(p.zip) === plz);
  if (targets.length === 0) { console.error('❌ Keine geeigneten Haeuser (ggf. PLZ pruefen).'); process.exit(1); }

  // Empfaenger + PDF-Pfad zusammenstellen.
  const jobs = [];
  for (const p of targets) {
    const street = p.street ? `${p.street}${p.house_number ? ' ' + p.house_number : ''}` : (p.address||'').split(',')[0];
    const pdfPath = join(CARDS_DIR, `${p.slug}.pdf`);
    jobs.push({
      slug: p.slug,
      hasPdf: await exists(pdfPath),
      pdfPath,
      recipient: {
        name: p.owner_name || 'An die Hauseigentümer:innen',
        street, zip: String(p.zip || ''), city: p.city || 'Wien', country: 'AT',
      },
    });
  }

  const missing = jobs.filter(j => !j.hasPdf);
  const est = (jobs.length * 1.2).toFixed(2);
  console.log(`\n📮 POKAmax-Versand ${plz ? '(PLZ ' + plz + ') ' : ''}— ${jobs.length} Postkarte(n)`);
  console.log(`   Geschaetzte Kosten: ca. € ${est} (Richtwert ~1,20 €/Karte)`);
  if (missing.length) {
    console.log(`   ⚠️  ${missing.length} ohne PDF — erst Workflow 10 laufen lassen:`);
    console.log(`       node workflows/10-postcard-pdf.mjs ${plz || ''}`);
  }

  // ---------------- PROBELAUF (Standard) ----------------
  if (!send) {
    console.log('\n🧪 PROBELAUF — es wird NICHTS gesendet und NICHTS berechnet.');
    jobs.slice(0, 3).forEach(j => {
      console.log(`   · ${j.recipient.name}, ${j.recipient.street}, ${j.recipient.zip} ${j.recipient.city}` +
                  `  [PDF: ${j.hasPdf ? 'ok' : 'FEHLT'}]`);
    });
    console.log(`\n   Zum ECHTEN Senden:  node workflows/09-send-pokamax.mjs ${plz || '<plz>'} --send`);
    return;
  }

  // ---------------- ECHTER VERSAND ----------------
  if (!API_URL || !API_KEY) {
    console.error('❌ POKAMAX_API_URL und/oder POKAMAX_API_KEY fehlen in der .env.');
    process.exit(1);
  }
  let ok = 0, fail = 0;
  for (const j of jobs) {
    if (!j.hasPdf) { console.warn(`  ⚠️  ${j.slug}: kein PDF — uebersprungen.`); fail++; continue; }
    try {
      await sendToPokamax(j.recipient, j.pdfPath);
      console.log(`  ✅ ${j.slug} beauftragt`);
      ok++;
    } catch (e) {
      console.warn(`  ⚠️  ${j.slug}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\n✅ Fertig. ${ok} beauftragt, ${fail} Fehler.`);
}

// ──────────────────────────────────────────────────────────────────────────
//  >>> HIER ggf. an die POKAmax-Partner-Doku anpassen (Endpoint + Feldnamen) <<<
//  Modell "Vollständiges Design": ein PDF je Karte + Empfaengeradresse.
// ──────────────────────────────────────────────────────────────────────────
async function sendToPokamax(recipient, pdfPath) {
  const pdf = await readFile(pdfPath);
  const form = new FormData();
  // Authentifizierung (laut Partner-Doku evtl. Header statt Feld):
  form.append('api_key', API_KEY);
  // Empfaengeradresse:
  form.append('recipient_name', recipient.name);
  form.append('recipient_street', recipient.street);
  form.append('recipient_zip', recipient.zip);
  form.append('recipient_city', recipient.city);
  form.append('recipient_country', recipient.country);
  // Die fertige Karte als PDF (alle Seiten in einem Dokument):
  form.append('pdf', new Blob([pdf], { type: 'application/pdf' }), basename(pdfPath));

  const res = await fetch(API_URL, { method: 'POST', body: form });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

async function exists(f){ try { await access(f); return true; } catch { return false; } }

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
