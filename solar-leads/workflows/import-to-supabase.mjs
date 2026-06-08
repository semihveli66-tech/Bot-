// ============================================================================
//  Hilfs-Skript — Lokale Haeuser nach Supabase hochladen
// ============================================================================
//
//  Wann brauchst du das?
//    Workflow 1 speichert jedes geprüfte Haus lokal in output/prospects.json.
//    Wenn deine Umgebung Supabase erreichen darf (z.B. dein eigener Rechner
//    oder eine Umgebung mit freigeschaltetem *.supabase.co), kannst du mit
//    diesem Skript ALLE gesammelten Häuser auf einmal hochladen.
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/import-to-supabase.mjs
//
//  Voraussetzung: SUPABASE_URL und SUPABASE_SERVICE_KEY in der .env.
// ============================================================================

try { await import('dotenv/config'); } catch {}
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_STORE = join(__dirname, '..', 'output', 'prospects.json');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY fehlen in der .env.');
    process.exit(1);
  }

  let list;
  try {
    list = JSON.parse(await readFile(LOCAL_STORE, 'utf8'));
  } catch {
    console.error('❌ Keine output/prospects.json gefunden. Erst Workflow 1 laufen lassen.');
    process.exit(1);
  }
  if (!Array.isArray(list) || list.length === 0) {
    console.log('ℹ️  Keine Häuser zum Hochladen.');
    return;
  }

  // Das lokale Feld "saved_at" gibt es in der DB-Tabelle nicht — entfernen.
  const rows = list.map(({ saved_at, ...rest }) => rest);

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log(`⬆️  Lade ${rows.length} Haus/Haeuser nach Supabase ...`);
  const { data, error } = await supabase
    .from('prospects')
    .upsert(rows, { onConflict: 'slug' })
    .select('id');

  if (error) {
    console.error('❌ Supabase-Fehler:', error.message);
    process.exit(1);
  }
  console.log(`✅ Fertig. ${data.length} Datensätze gespeichert/aktualisiert.`);
}

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
