// ============================================================================
//  Workflow 9 — Echter Postversand über die EchtPost-API
// ============================================================================
//
//  Schickt deine geeigneten Häuser als personalisierte Postkarten direkt über
//  die EchtPost-API in Druck + Versand (echte Briefmarke, auch nach Österreich).
//
//  ⚠️ WICHTIG — SICHERHEITSBREMSE:
//     Standard ist ein PROBELAUF (dry-run): zeigt nur, WAS gesendet würde,
//     ruft die API NICHT auf, kostet NICHTS.
//     Erst mit dem Zusatz  --send  geht echte Post raus (kostet Geld!).
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/09-send-echtpost.mjs 1230            # Probelauf fuer PLZ 1230
//    node workflows/09-send-echtpost.mjs 1230 --send     # ECHT senden (kostet!)
//
//  Vorher EINMALIG einrichten:
//    1. Account auf echtpost.de + Guthaben aufladen
//    2. Eine Postkarten-VORLAGE anlegen mit Platzhaltern (siehe unten),
//       die Template-ID notieren
//    3. API-Schlüssel erstellen (Einstellungen -> "API-Schlüssel")
//    4. Bilder öffentlich hosten (siehe IMAGE_BASE_URL unten)
//    5. In .env eintragen:
//         ECHTPOST_API_KEY=...
//         ECHTPOST_TEMPLATE_ID=...
//         IMAGE_BASE_URL=https://sesolarwien.github.io/Bot-/mailing
//
//  Platzhalter, die deine EchtPost-Vorlage nutzen sollte (Merge-Variablen):
//    {{front_image}}  Vorderseite (Dachbild)   {{qr_image}}   QR-Code
//    {{kwp}}  {{savings}}  {{payback}}  {{street}}  Werte fuer die Rueckseite
// ============================================================================

try { await import('dotenv/config'); } catch {}
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const STORE = join(OUTPUT_DIR, 'prospects.json');

const API_KEY = process.env.ECHTPOST_API_KEY;
const TEMPLATE_ID = process.env.ECHTPOST_TEMPLATE_ID;
const IMAGE_BASE = (process.env.IMAGE_BASE_URL || 'https://sesolarwien.github.io/Bot-/mailing').replace(/\/$/, '');
const MICROSITE_BASE = (process.env.MICROSITE_BASE_URL || 'https://solar-wien.at').replace(/\/$/, '');
const ENDPOINT = 'https://api.echtpost.de/v2/cards/from_template';

async function main() {
  const args = process.argv.slice(2);
  const send = args.includes('--send');
  const plz = (args.find(a => /^\d{4}$/.test(a)) || '').trim();

  let list = JSON.parse(await readFile(STORE, 'utf8'));
  let targets = list.filter(p => p.roof_suitable);
  if (plz) targets = targets.filter(p => String(p.zip) === plz);
  if (targets.length === 0) { console.error('❌ Keine geeigneten Haeuser (ggf. PLZ pruefen).'); process.exit(1); }

  // Empfaengerliste mit individuellen Variablen bauen.
  const recipients = targets.map(p => {
    const street = p.street ? `${p.street}${p.house_number ? ' ' + p.house_number : ''}` : (p.address||'').split(',')[0];
    return {
      // Adressfelder (an "Hauseigentuemer" ohne Namen -> DSGVO-einfach)
      firstname: '',
      lastname: p.owner_name || 'An die Hauseigentümer:innen',
      street,
      zipcode: String(p.zip || ''),
      city: p.city || 'Wien',
      country: 'AT',
      // Individuelle Merge-Variablen fuer die Vorlage:
      front_image: `${IMAGE_BASE}/${p.slug}-vorderseite.png`,
      qr_image:    `${IMAGE_BASE}/${p.slug}-qr.png`,
      kwp:         fmt(p.system_size_kwp),
      savings:     fmt(p.annual_savings_eur),
      payback:     p.payback_years != null ? String(p.payback_years).replace('.', ',') : '',
      microsite:   p.microsite_url || `${MICROSITE_BASE}/${p.slug}.html`,
    };
  });

  const estLow = (recipients.length * 1.54).toFixed(2);
  const estHigh = (recipients.length * 2.74).toFixed(2);

  console.log(`\n📮 EchtPost-Versand ${plz ? '(PLZ ' + plz + ') ' : ''}— ${recipients.length} Postkarte(n)`);
  console.log(`   Geschaetzte Kosten: ca. € ${estLow}–${estHigh} (je nach Menge)\n`);

  // ---------------- PROBELAUF (Standard) ----------------
  if (!send) {
    console.log('🧪 PROBELAUF — es wird NICHTS gesendet und NICHTS berechnet.');
    console.log('   Beispiel-Empfaenger (erste 2):');
    recipients.slice(0, 2).forEach(r => {
      console.log(`   · ${r.lastname}, ${r.street}, ${r.zipcode} ${r.city}`);
      console.log(`     Dachbild: ${r.front_image}`);
      console.log(`     QR:       ${r.qr_image}  | ${r.kwp} kWp · € ${r.savings}/J · ${r.payback} J`);
    });
    console.log(`\n   Zum ECHTEN Senden:  node workflows/09-send-echtpost.mjs ${plz || '<plz>'} --send`);
    return;
  }

  // ---------------- ECHTER VERSAND ----------------
  if (!API_KEY || !TEMPLATE_ID) {
    console.error('❌ ECHTPOST_API_KEY und/oder ECHTPOST_TEMPLATE_ID fehlen in der .env.');
    process.exit(1);
  }
  console.log('🚀 ECHTER VERSAND wird ausgeloest ...');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: TEMPLATE_ID, recipients }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`❌ EchtPost-Fehler (HTTP ${res.status}):`, JSON.stringify(data));
    process.exit(1);
  }
  console.log(`✅ Versand beauftragt. Antwort:`, JSON.stringify(data));
}

function fmt(n){ return n == null ? '' : new Intl.NumberFormat('de-AT').format(Math.round(n)); }

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
