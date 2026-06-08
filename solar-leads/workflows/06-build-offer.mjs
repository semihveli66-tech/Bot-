// ============================================================================
//  Workflow 6 — Angebot / Verkaufsunterlage für Solarfirmen
// ============================================================================
//
//  Erzeugt ein professionelles, druckfertiges Angebot (A4), das du einer
//  Solarfirma vorlegst. Es zieht echte Beispielhäuser aus output/prospects.json
//  (mit Satelliten-Vorschau) und enthält einen QR-Code zur Live-Demo.
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/06-build-offer.mjs
//
//  Ergebnis: output/angebot.html  -> im Browser oeffnen -> Drucken -> Als PDF.
//
//  Konfig (optional, in .env):
//    MICROSITE_BASE_URL  Live-Demo-Adresse (QR-Ziel), z.B. GitHub-Pages-URL
//    SENDER_NAME         dein Firmenname
//    PRICE_PER_APPOINTMENT  Preis pro Termin (Standard 120)
// ============================================================================

try { await import('dotenv/config'); } catch {}
import QRCode from 'qrcode';
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const STORE = join(OUTPUT_DIR, 'prospects.json');

const DEMO_URL = (process.env.MICROSITE_BASE_URL || 'https://solar-wien.at').replace(/\/$/, '') + '/';
const BRAND = process.env.SENDER_NAME || 'Solar Wien';
const PRICE = num(process.env.PRICE_PER_APPOINTMENT, 120);

async function main() {
  let list = JSON.parse(await readFile(STORE, 'utf8'));
  // Schöne Beispielhäuser: geeignet + realistische Hausgröße (<= 12 kWp).
  const examples = list
    .filter(p => p.roof_suitable && (p.system_size_kwp || 0) <= 12)
    .slice(0, 3);

  const qr = await QRCode.toDataURL(DEMO_URL, { margin: 1, width: 320 });
  const html = await renderOffer(examples, qr);
  const out = join(OUTPUT_DIR, 'angebot.html');
  await writeFile(out, html);
  console.log(`📄 Angebot erstellt: output/angebot.html`);
  console.log('   Oeffnen -> Drucken -> "Als PDF sichern" (A4).');
}

async function renderOffer(examples, qr) {
  const cards = [];
  for (const p of examples) {
    const img = await imageDataUri(`${p.slug}-rendered.png`) || await imageDataUri(`${p.slug}.png`);
    const street = p.street ? `${p.street}${p.house_number ? ' ' + p.house_number : ''}` : (p.address||'').split(',')[0];
    cards.push(`
      <div class="ex">
        ${img ? `<img src="${img}" alt="">` : `<div class="ph"></div>`}
        <div class="ex-b">
          <div class="ex-a">${escapeHtml(street)}</div>
          <div class="ex-s"><b>${nf(p.system_size_kwp)} kWp</b> · € ${nf(p.annual_savings_eur)}/J. gespart · ${String(p.payback_years??'').replace('.',',')} J. amortisiert</div>
        </div>
      </div>`);
  }

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Angebot — Exklusive Solar-Termine</title>
<style>
  :root{ --green:#15803d; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc; --sun:#f59e0b; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5}
  .page{width:210mm;min-height:297mm;background:#fff;margin:10mm auto;padding:18mm 16mm;
    box-shadow:0 6px 30px rgba(2,6,23,.15);position:relative}
  h1{font-size:30px;margin:0 0 6px;line-height:1.1}
  h2{font-size:17px;margin:26px 0 10px;color:var(--green)}
  .sub{color:var(--muted);font-size:15px;margin:0 0 6px}
  .brand{display:inline-block;background:var(--green);color:#fff;font-weight:800;padding:5px 12px;border-radius:6px;font-size:14px;margin-bottom:18px}
  p{font-size:13.5px}
  .lead{font-size:15px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0}
  .box{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:#fff}
  .box h3{margin:0 0 4px;font-size:14px}
  .box p{margin:0;font-size:12.5px;color:#334155}
  .steps{counter-reset:s;margin:8px 0}
  .step{display:flex;gap:12px;margin:9px 0}
  .step .n{counter-increment:s;flex:0 0 26px;height:26px;border-radius:50%;background:var(--green);color:#fff;
    display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
  .step .n::before{content:counter(s)}
  .step .t{font-size:13px}
  .step .t b{display:block}
  table.cmp{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}
  table.cmp th,table.cmp td{border:1px solid var(--line);padding:7px 9px;text-align:left}
  table.cmp th{background:#f1f5f9}
  table.cmp td.good{color:var(--green);font-weight:700}
  .examples{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:8px}
  .ex{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
  .ex img,.ex .ph{width:100%;height:70px;object-fit:cover;display:block;background:#0b1220}
  .ex-b{padding:8px 10px}
  .ex-a{font-weight:700;font-size:12px}
  .ex-s{font-size:10.5px;color:var(--muted);margin-top:2px}
  .price{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:8px}
  .pcard{border:1px solid var(--line);border-radius:12px;padding:14px;text-align:center}
  .pcard.hl{border:2px solid var(--green);background:#f0fdf4}
  .pcard .pt{font-size:13px;font-weight:700}
  .pcard .pv{font-size:22px;font-weight:800;color:var(--green);margin:4px 0}
  .pcard .pd{font-size:11px;color:var(--muted)}
  .cta{display:flex;align-items:center;gap:16px;background:var(--ink);color:#fff;border-radius:14px;padding:18px 20px;margin-top:22px}
  .cta img{width:78px;height:78px;border-radius:8px;background:#fff;padding:4px}
  .cta .ct h3{margin:0 0 4px;font-size:16px}
  .cta .ct p{margin:0;font-size:12.5px;opacity:.85}
  .foot{margin-top:18px;font-size:10.5px;color:var(--muted);border-top:1px solid var(--line);padding-top:10px}
  @media print{ @page{size:A4;margin:0} body{background:#fff} .page{margin:0;box-shadow:none} }
</style>
</head>
<body>
<div class="page">
  <div class="brand">☀ ${escapeHtml(BRAND)}</div>
  <h1>Exklusive, qualifizierte Solar-Termine</h1>
  <p class="sub lead">Der Hausbesitzer hat sein eigenes Dach mit Solaranlage gesehen — bevor Sie anrufen.</p>

  <h2>Das Problem mit klassischen Leads</h2>
  <p>Portale wie die üblichen Lead-Börsen verkaufen denselben Kontakt an 3–5 Firmen gleichzeitig.
  Sie zahlen 75–200 € für einen Namen, der parallel von der Konkurrenz angerufen wird — Abschlussraten leiden, Margen schrumpfen.</p>

  <h2>Unsere Lösung — so funktioniert's</h2>
  <div class="steps">
    <div class="step"><div class="n"></div><div class="t"><b>Echte Dachvermessung</b>Wir analysieren jedes Haus mit echten Google-Solar-Vermessungsdaten: Fläche, Ausrichtung, Ertrag.</div></div>
    <div class="step"><div class="n"></div><div class="t"><b>Photorealistische Visualisierung</b>KI rendert die Solaranlage auf das echte Dach des Hausbesitzers.</div></div>
    <div class="step"><div class="n"></div><div class="t"><b>Personalisierte Postkarte + Microsite</b>Der Eigentümer erhält eine Postkarte mit seinem eigenen Dach und QR-Code zum persönlichen Spar-Rechner.</div></div>
    <div class="step"><div class="n"></div><div class="t"><b>Qualifizierter Termin — exklusiv für Sie</b>Interessenten buchen direkt. Sie bekommen den Kontakt exklusiv, vorqualifiziert, mit allen Eckdaten.</div></div>
  </div>

  <h2>Warum das besser ist</h2>
  <table class="cmp">
    <tr><th>&nbsp;</th><th>Klassische Lead-Portale</th><th>${escapeHtml(BRAND)}</th></tr>
    <tr><td>Exklusivität</td><td>an 3–5 Firmen verkauft</td><td class="good">exklusiv an Sie</td></tr>
    <tr><td>Erstkontakt</td><td>anonymes Online-Formular</td><td class="good">das eigene Dach auf einer Postkarte</td></tr>
    <tr><td>Vorqualifikation</td><td>kaum</td><td class="good">Dach geprüft + Ertrag berechnet</td></tr>
    <tr><td>Abschlussrate</td><td>niedrig (geteilt)</td><td class="good">deutlich höher (visuell + physisch)</td></tr>
  </table>

  <h2>Echte Beispiele aus Wien</h2>
  <div class="examples">
    ${cards.join('') || '<p>Beispiele werden nach dem ersten Durchlauf eingefügt.</p>'}
  </div>

  <h2>Konditionen</h2>
  <div class="price">
    <div class="pcard hl">
      <div class="pt">Pro Termin</div>
      <div class="pv">€ ${nf(PRICE)}</div>
      <div class="pd">exklusiv & vorqualifiziert<br>(empfohlen für den Start)</div>
    </div>
    <div class="pcard">
      <div class="pt">Erfolgsprovision</div>
      <div class="pv">% </div>
      <div class="pd">Anteil der Anlagensumme<br>nur bei Abschluss</div>
    </div>
    <div class="pcard">
      <div class="pt">Monatspaket</div>
      <div class="pv">fix</div>
      <div class="pd">feste Anzahl exklusiver<br>Leads/Monat in Ihrer Region</div>
    </div>
  </div>

  <div class="cta">
    <img src="${qr}" alt="QR zur Live-Demo">
    <div class="ct">
      <h3>Live-Demo ansehen</h3>
      <p>QR scannen oder ${escapeHtml(DEMO_URL)} öffnen — echte Wiener Häuser mit Solar-Visualisierung und Spar-Rechner.</p>
    </div>
  </div>

  <div class="foot">
    ${escapeHtml(BRAND)} · Schätzwerte auf Basis von Google-Solar-Vermessungsdaten; die finale Auslegung erfolgt durch den Installateur vor Ort.
    Eigentümeransprache DSGVO-konform mit Opt-out. Dieses Dokument ist ein unverbindliches Angebot.
  </div>
</div>
</body>
</html>`;
}

async function imageDataUri(filename) {
  try { await access(join(OUTPUT_DIR, filename)); }
  catch { return null; }
  const buf = await readFile(join(OUTPUT_DIR, filename));
  return `data:image/png;base64,${buf.toString('base64')}`;
}
function nf(n){ return n == null ? '–' : new Intl.NumberFormat('de-AT').format(Math.round(n)); }
function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
