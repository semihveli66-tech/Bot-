// ============================================================================
//  Process-Addresses — gesammelte Adressen durch die Pipeline schicken
// ============================================================================
//
//  Nimmt die von Workflow 2 gesammelten Adressen (output/addresses-<plz>.json)
//  und laesst fuer JEDE Adresse Workflow 1 laufen (Satellitenbild + Solar-API +
//  ROI + speichern). Danach kannst du wie gewohnt rendern, Microsites und
//  Postkarten bauen.
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/process-addresses.mjs 1230          # alle Adressen aus 1230
//    node workflows/process-addresses.mjs 1230 10       # nur die ersten 10
//
//  Danach (wie gewohnt):
//    node workflows/03-render-panels.mjs
//    node workflows/04-build-microsite.mjs
//    node workflows/05-build-postcard.mjs
// ============================================================================

try { await import('dotenv/config'); } catch {}
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const W1 = join(__dirname, '01-fetch-property.mjs');

async function main() {
  const plz = (process.argv[2] || '').trim();
  const limit = parseInt(process.argv[3] || '0', 10);
  if (!/^\d{4}$/.test(plz)) {
    console.error('❌ Bitte PLZ angeben: node workflows/process-addresses.mjs 1230');
    process.exit(1);
  }

  let list;
  try {
    list = JSON.parse(await readFile(join(OUTPUT_DIR, `addresses-${plz}.json`), 'utf8'));
  } catch {
    console.error(`❌ output/addresses-${plz}.json fehlt. Erst Workflow 2 laufen lassen:`);
    console.error(`   node workflows/02-collect-addresses.mjs ${plz}`);
    process.exit(1);
  }
  if (limit > 0) list = list.slice(0, limit);

  console.log(`🏃 Verarbeite ${list.length} Adressen aus PLZ ${plz} ...\n`);
  let ok = 0, fail = 0;
  for (let i = 0; i < list.length; i++) {
    const addr = list[i].address;
    process.stdout.write(`[${i + 1}/${list.length}] ${addr} ... `);
    // Workflow 1 als eigenen Prozess starten (nutzt denselben Code wie bei Einzeladressen).
    const r = spawnSync('node', [W1, addr], { encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    if (r.status === 0 && /Fertig\. Status/.test(out)) {
      const suitable = /QUALIFIED/.test(out);
      console.log(suitable ? 'geeignet ✅' : 'ungeeignet ⛔');
      ok++;
    } else {
      const reason = (out.match(/❌ Fehler: (.*)/) || [])[1] || 'unbekannt';
      console.log(`Fehler: ${reason}`);
      fail++;
    }
    // Kleine Pause, um die APIs nicht zu ueberlasten.
    sleepBlocking(400);
  }

  console.log(`\n✅ Fertig. ${ok} verarbeitet, ${fail} Fehler.`);
  console.log('   Alle Haeuser stehen jetzt in output/prospects.json (+ Supabase).');
  console.log('   Weiter mit: 03-render-panels -> 04-build-microsite -> 05-build-postcard');
}

// Einfache blockierende Pause zwischen den Anfragen.
function sleepBlocking(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* warten */ }
}

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
