// ============================================================================
//  Workflow 5 — Postkarten-Generator (Vorder- + Rückseite, druckfertig)
// ============================================================================
//
//  Erzeugt pro geeignetem Haus eine personalisierte Postkarte im Format A6
//  quer (148 x 105 mm) mit:
//    - VORDERSEITE: das echte Dach mit gerenderter Solaranlage + Headline
//    - RÜCKSEITE:   persönliche Eckdaten, ECHTER QR-Code zur Microsite,
//                   Empfängeradresse, Absender + Opt-out-Hinweis
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/05-build-postcard.mjs                 # alle geeigneten Haeuser
//    node workflows/05-build-postcard.mjs <slug>          # nur ein Haus
//
//  Ergebnis: output/postcards/<slug>.html
//    -> im Browser oeffnen, dann "Drucken -> Als PDF sichern" (A6 quer)
//       und dieses PDF an Post.at / die Druckerei geben.
//
//  Konfig (optional, in .env):
//    MICROSITE_BASE_URL  Basis-Adresse fuer den QR-Code (Standard solar-wien.at)
//    SENDER_NAME/STREET/ZIP/CITY  dein Absender (erscheint klein auf der Karte)
// ============================================================================

try { await import('dotenv/config'); } catch {}
import QRCode from 'qrcode';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const CARDS_DIR = join(OUTPUT_DIR, 'postcards');
const STORE = join(OUTPUT_DIR, 'prospects.json');

const BASE_URL = (process.env.MICROSITE_BASE_URL || 'https://solar-wien.at').replace(/\/$/, '');
const SENDER = {
  name:   process.env.SENDER_NAME   || 'Solar Wien GmbH',
  street: process.env.SENDER_STREET || 'Musterstraße 1',
  zip:    process.env.SENDER_ZIP    || '1010',
  city:   process.env.SENDER_CITY   || 'Wien',
};

async function main() {
  const onlySlug = process.argv[2];
  let list = JSON.parse(await readFile(STORE, 'utf8'));
  let targets = list.filter(p => p.roof_suitable);
  if (onlySlug) targets = targets.filter(p => p.slug === onlySlug);

  if (targets.length === 0) {
    console.error('❌ Keine geeigneten Haeuser gefunden (erst Workflow 1 laufen lassen).');
    process.exit(1);
  }

  await mkdir(CARDS_DIR, { recursive: true });
  for (const p of targets) {
    const html = await renderPostcard(p);
    const out = join(CARDS_DIR, `${p.slug}.html`);
    await writeFile(out, html);
    console.log(`📮 Postkarte erstellt: output/postcards/${p.slug}.html`);
  }
  console.log(`\n✅ Fertig: ${targets.length} Postkarte(n).`);
  console.log('   Oeffnen -> Drucken -> "Als PDF sichern" (A6 quer) -> an Post.at geben.');
}

async function renderPostcard(p) {
  // Vorderseite: gerendertes Bild bevorzugen, sonst Satellit.
  const front = await imageDataUri(`${p.slug}-rendered.png`) || await imageDataUri(`${p.slug}.png`);

  // QR-Code auf die Microsite des Hauses.
  const url = p.microsite_url || `${BASE_URL}/${p.slug}.html`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: 'M' });

  const streetTitle = p.street
    ? `${p.street}${p.house_number ? ' ' + p.house_number : ''}`
    : (p.address || '').split(',')[0];
  const owner = p.owner_name || 'An die Hauseigentümer:innen';

  // Eckdaten kurz & knackig.
  const kwp = nf(p.system_size_kwp);
  const save = p.annual_savings_eur ? nf(p.annual_savings_eur) : '–';
  const pay = p.payback_years != null ? String(p.payback_years).replace('.', ',') : '–';

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Postkarte · ${escapeHtml(streetTitle)}</title>
<style>
  /* A6 quer = 148 x 105 mm */
  :root{ --green:#15803d; --ink:#0f172a; --muted:#64748b; --line:#cbd5e1; --sun:#f59e0b; }
  *{box-sizing:border-box}
  body{margin:0;background:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink)}
  .sheet{width:148mm;height:105mm;background:#fff;margin:10mm auto;position:relative;overflow:hidden;
    box-shadow:0 6px 24px rgba(2,6,23,.25)}
  .label{max-width:148mm;margin:14mm auto 2mm;color:#475569;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}

  /* ---------- VORDERSEITE ---------- */
  .front img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .front .noimg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0b1220;color:#64748b}
  .front .veil{position:absolute;left:0;right:0;bottom:0;height:55%;
    background:linear-gradient(to top,rgba(8,15,30,.92),rgba(8,15,30,.55) 55%,transparent)}
  .front .txt{position:absolute;left:9mm;right:9mm;bottom:8mm;color:#fff}
  .front .kicker{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;margin-bottom:3mm}
  .front h1{margin:0;font-size:30px;line-height:1.05;text-shadow:0 2px 12px rgba(0,0,0,.4)}
  .front .addr{margin-top:2mm;font-size:14px;opacity:.95}
  .front .brand{position:absolute;top:7mm;left:9mm;color:#fff;font-weight:800;font-size:14px;
    background:rgba(21,128,61,.85);padding:4px 10px;border-radius:6px}

  /* ---------- RÜCKSEITE ---------- */
  .back{display:flex;padding:8mm}
  .back .left{flex:1;padding-right:7mm;border-right:1px dashed var(--line);display:flex;flex-direction:column}
  .back .right{flex:0 0 56mm;padding-left:7mm;display:flex;flex-direction:column}
  .back h2{margin:0 0 3mm;font-size:18px;line-height:1.15}
  .back .lead{font-size:12px;color:#334155;margin:0 0 4mm}
  .stats{display:flex;gap:3mm;margin-bottom:4mm}
  .stat{flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:5px 6px;text-align:center}
  .stat .v{font-size:15px;font-weight:800;color:var(--green)}
  .stat .l{font-size:8.5px;color:#3f6212;margin-top:1px;line-height:1.1}
  .cta{margin-top:auto;display:flex;align-items:center;gap:3mm;background:var(--ink);color:#fff;border-radius:8px;padding:6px 9px}
  .cta .sun{font-size:18px}
  .cta b{font-size:12px}
  .cta span{font-size:9.5px;opacity:.8;display:block}
  .sender{font-size:8px;color:var(--muted);margin-top:3mm;line-height:1.3}

  .stamp{align-self:flex-end;width:18mm;height:22mm;border:1px dashed var(--line);border-radius:3px;
    display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:8px;text-align:center;margin-bottom:4mm}
  .qr{display:flex;flex-direction:column;align-items:center;margin-bottom:4mm}
  .qr img{width:30mm;height:30mm}
  .qr .scan{font-size:9px;color:#334155;font-weight:700;margin-top:1mm;text-align:center}
  .recipient{margin-top:auto;font-size:13px;line-height:1.5}
  .recipient .to{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:1mm}

  @media print{
    @page{ size:148mm 105mm; margin:0; }
    body{background:#fff}
    .sheet{margin:0;box-shadow:none;page-break-after:always}
    .label{display:none}
  }
</style>
</head>
<body>

  <!-- VORDERSEITE -->
  <div class="label">Vorderseite</div>
  <div class="sheet front">
    ${front ? `<img src="${front}" alt="Ihr Dach mit Solaranlage">` : `<div class="noimg">Kein Bild — erst Workflow 01/03 ausführen</div>`}
    <div class="brand">☀ ${escapeHtml(SENDER.name)}</div>
    <div class="veil"></div>
    <div class="txt">
      <div class="kicker">Ihr Zuhause · ${escapeHtml(p.zip || '')} ${escapeHtml(p.city || 'Wien')}</div>
      <h1>Ihr Dach.<br>Mit Solar.</h1>
      <div class="addr">${escapeHtml(streetTitle)}</div>
    </div>
  </div>

  <!-- RÜCKSEITE -->
  <div class="label">Rückseite</div>
  <div class="sheet back">
    <div class="left">
      <h2>So viel Strom steckt in Ihrem Dach</h2>
      <p class="lead">Wir haben Ihr Dach mit echten Vermessungsdaten analysiert — und sehen großes Potenzial:</p>
      <div class="stats">
        <div class="stat"><div class="v">${kwp} kWp</div><div class="l">mögliche Anlage</div></div>
        <div class="stat"><div class="v">€ ${save}</div><div class="l">Ersparnis/Jahr</div></div>
        <div class="stat"><div class="v">${pay} J.</div><div class="l">amortisiert</div></div>
      </div>
      <div class="cta">
        <div class="sun">☀️</div>
        <div><b>Scannen & Ihr Dach mit Solar sehen</b><span>Persönliche Visualisierung + Spar-Rechner</span></div>
      </div>
      <div class="sender">
        Absender: ${escapeHtml(SENDER.name)}, ${escapeHtml(SENDER.street)}, ${escapeHtml(SENDER.zip)} ${escapeHtml(SENDER.city)}.
        Sie möchten keine Post mehr? Kurze Nachricht genügt — wir nehmen Sie sofort heraus.
      </div>
    </div>
    <div class="right">
      <div class="stamp">Brief­marke</div>
      <div class="qr">
        <img src="${qr}" alt="QR-Code zur persönlichen Microsite">
        <div class="scan">▲ einfach scannen</div>
      </div>
      <div class="recipient">
        <div class="to">An</div>
        ${escapeHtml(owner)}<br>
        ${escapeHtml(streetTitle)}<br>
        ${escapeHtml(p.zip || '')} ${escapeHtml(p.city || 'Wien')}
      </div>
    </div>
  </div>

</body>
</html>`;
}

// ----------------------------------------------------------------------------
//  Hilfsfunktionen
// ----------------------------------------------------------------------------
async function imageDataUri(filename) {
  const candidate = join(OUTPUT_DIR, filename);
  try {
    await access(candidate);
    const buf = await readFile(candidate);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
function nf(n){ return n == null ? '–' : new Intl.NumberFormat('de-AT').format(Math.round(n)); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
