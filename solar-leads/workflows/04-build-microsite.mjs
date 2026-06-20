// ============================================================================
//  Workflow 4 — Microsite-Generator
// ============================================================================
//
//  Macht aus einem geprüften Haus (aus output/prospects.json) eine fertige,
//  eigenständige HTML-Seite mit:
//    - echtem Satellitenbild (direkt in die Datei eingebettet)
//    - interaktivem ROI-Rechner (Strompreis/Eigenverbrauch live verstellbar)
//    - Stat-Kacheln, QR-Bereich und Buchungs-Button
//
//  So startest du es (im Ordner solar-leads/):
//    node workflows/04-build-microsite.mjs                  # baut Seiten fuer ALLE Haeuser
//    node workflows/04-build-microsite.mjs <slug>           # nur ein bestimmtes Haus
//
//  Ergebnis: output/sites/<slug>.html  -> einfach im Browser oeffnen.
//  Die Seite ist "self-contained": ein einziges File, laeuft ueberall.
// ============================================================================

try { await import('dotenv/config'); } catch {}
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const SITES_DIR = join(OUTPUT_DIR, 'sites');
const STORE = join(OUTPUT_DIR, 'prospects.json');

// Wirtschaftlichkeits-Annahmen (Startwerte des Rechners) — wie in .env / Workflow 1.
const ECON = {
  costPerKwp:       num(process.env.COST_PER_KWP_EUR, 1400),
  electricityPrice: num(process.env.ELECTRICITY_PRICE_EUR, 0.28),
  feedInTariff:     num(process.env.FEED_IN_TARIFF_EUR, 0.07),
  selfConsumption:  num(process.env.SELF_CONSUMPTION_RATE, 0.30),
  annualConsumption: num(process.env.ANNUAL_CONSUMPTION_KWH, 4500),
  // Batteriespeicher-Annahmen (AT 2025)
  batteryKwh:          num(process.env.BATTERY_KWH, 8),            // typ. Heimspeicher
  batteryCostPerKwh:   num(process.env.BATTERY_COST_PER_KWH, 800), // €/kWh schluesselfertig
  selfWithBattery:     num(process.env.SELF_CONSUMPTION_BATTERY, 0.65), // 55-70 % mit Speicher
};

// Termin-Buchung: kostenloser Formular-Dienst Web3Forms (kein eigener Server nötig).
//   1. Auf https://web3forms.com deine E-Mail eingeben -> Access Key bekommen
//   2. In .env:  WEB3FORMS_KEY=...   CONTACT_EMAIL=deine@mail.at
// Ohne Key öffnet das Formular als Rückfall das E-Mail-Programm (mailto).
const FORM = {
  accessKey:    process.env.WEB3FORMS_KEY || '',
  contactEmail: process.env.CONTACT_EMAIL || '',
  calcomUrl:    process.env.CALCOM_URL || '',   // optional: direkter Buchungskalender
};

async function main() {
  const onlySlug = process.argv[2];

  let list;
  try {
    list = JSON.parse(await readFile(STORE, 'utf8'));
  } catch {
    console.error('❌ output/prospects.json nicht gefunden. Erst Workflow 1 laufen lassen.');
    process.exit(1);
  }

  let targets = Array.isArray(list) ? list : [];
  if (onlySlug) targets = targets.filter(p => p.slug === onlySlug);
  // Nur geeignete Haeuser bekommen eine Microsite.
  targets = targets.filter(p => p.roof_suitable);

  if (targets.length === 0) {
    console.error('❌ Keine passenden (geeigneten) Haeuser gefunden.');
    process.exit(1);
  }

  await mkdir(SITES_DIR, { recursive: true });

  for (const p of targets) {
    const html = await renderSite(p);
    const out = join(SITES_DIR, `${p.slug}.html`);
    await writeFile(out, html);
    console.log(`🌐 Microsite erstellt: output/sites/${p.slug}.html`);
  }
  console.log(`\n✅ Fertig: ${targets.length} Microsite(s).`);
}

// ----------------------------------------------------------------------------
//  Eine Microsite erzeugen
// ----------------------------------------------------------------------------
async function renderSite(p) {
  // Bilder als Base64 einbetten (so ist die HTML-Datei eigenstaendig).
  const img = await imageDataUri(p, `${p.slug}.png`);            // Satellit (leeres Dach)
  const rendered = await imageDataUri(p, `${p.slug}-rendered.png`); // KI: Dach mit Solar

  // Werte fuer den Rechner.
  const kwp = p.system_size_kwp || 0;
  const yearlyKwh = p.yearly_energy_kwh || Math.round(kwp * 1000);
  const cost = p.install_cost_eur || Math.round(kwp * ECON.costPerKwp);
  const streetTitle = p.street
    ? `${p.street}${p.house_number ? ' ' + p.house_number : ''}`
    : (p.address || '').split(',')[0];

  // Hinweis: Der Rechner unten nutzt dieselbe Logik wie Workflow 1, nur im Browser.
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ihr Solar-Potenzial · ${escapeHtml(streetTitle)}</title>
<style>
  :root{
    --green:#16a34a; --green-d:#15803d; --ink:#0f172a; --muted:#64748b;
    --bg:#f8fafc; --card:#ffffff; --line:#e2e8f0; --sun:#f59e0b;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5}
  .wrap{max-width:920px;margin:0 auto;padding:0 20px}
  header.hero{position:relative;color:#fff;text-align:center;padding:64px 20px 120px;
    background:linear-gradient(135deg,#0f766e,#15803d 60%,#166534)}
  header.hero .badge{display:inline-block;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);
    padding:6px 14px;border-radius:999px;font-size:13px;letter-spacing:.04em;margin-bottom:18px}
  header.hero h1{margin:0 0 10px;font-size:30px;line-height:1.2}
  header.hero p{margin:0;opacity:.92;font-size:17px}
  .photo{margin:-90px auto 0;max-width:760px;background:var(--card);border-radius:18px;overflow:hidden;
    box-shadow:0 20px 50px rgba(2,6,23,.18);border:1px solid var(--line)}
  .photo .imgbox{position:relative;aspect-ratio:1/1;background:#0b1220}
  .photo img{width:100%;height:100%;object-fit:cover;display:block}
  .photo .cap{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 16px;font-size:13px;color:var(--muted)}
  .photo .cap b{color:var(--ink)}
  /* Vorher/Nachher-Schieberegler */
  .ba{position:absolute;inset:0;overflow:hidden;user-select:none}
  .ba img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
  .ba-before{position:absolute;inset:0;width:50%;overflow:hidden;border-right:2px solid #fff}
  .ba-before img{position:absolute;left:0;top:0;height:100%;width:auto;max-width:none}
  .ba-handle{position:absolute;top:0;bottom:0;left:50%;width:40px;transform:translateX(-50%);
    cursor:ew-resize;display:flex;align-items:center;justify-content:center}
  .ba-handle span{background:#fff;color:#0f172a;border-radius:999px;width:38px;height:38px;
    display:flex;align-items:center;justify-content:center;font-weight:800;box-shadow:0 4px 12px rgba(0,0,0,.35)}
  .ba-lbl{position:absolute;bottom:14px;font-size:12px;font-weight:700;color:#fff;
    background:rgba(15,23,42,.6);padding:4px 10px;border-radius:999px}
  .ba-lbl-l{left:14px}
  .ba-lbl-r{right:14px}
  .tag-suit{position:absolute;top:14px;left:14px;background:var(--green);color:#fff;font-weight:700;z-index:3;
    font-size:13px;padding:6px 12px;border-radius:999px;box-shadow:0 4px 12px rgba(22,163,74,.4)}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:34px 0}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;text-align:center}
  .stat .v{font-size:24px;font-weight:800}
  .stat .v.green{color:var(--green-d)}
  .stat .l{font-size:12.5px;color:var(--muted);margin-top:4px}
  section.calc{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px;margin:24px 0}
  section.calc h2{margin:0 0 4px;font-size:20px}
  section.calc .sub{color:var(--muted);font-size:14px;margin-bottom:20px}
  .row{display:flex;align-items:center;gap:14px;margin:16px 0}
  .row label{flex:0 0 220px;font-size:14px;color:#334155}
  .row input[type=range]{flex:1;accent-color:var(--green)}
  .row .out{flex:0 0 90px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
  .batt{display:flex;align-items:center;gap:14px;margin:20px 0 4px;padding:14px 16px;
    background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px}
  .batt-txt b{display:block;font-size:14.5px}
  .batt-txt span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}
  .switch{position:relative;display:inline-block;width:48px;height:28px;flex:0 0 48px}
  .switch input{opacity:0;width:0;height:0}
  .slider-sw{position:absolute;cursor:pointer;inset:0;background:#cbd5e1;border-radius:999px;transition:.2s}
  .slider-sw:before{content:"";position:absolute;height:22px;width:22px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
  .switch input:checked + .slider-sw{background:var(--green)}
  .switch input:checked + .slider-sw:before{transform:translateX(20px)}
  .result{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:22px;
    background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1px solid #bbf7d0;border-radius:14px;padding:20px}
  .result .b{text-align:center}
  .result .b .v{font-size:22px;font-weight:800;color:var(--green-d)}
  .result .b .l{font-size:12.5px;color:#3f6212;margin-top:2px}
  .cta{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between;
    background:var(--ink);color:#fff;border-radius:18px;padding:26px;margin:24px 0 50px}
  .cta .txt h3{margin:0 0 6px;font-size:19px}
  .cta .txt p{margin:0;opacity:.8;font-size:14px}
  .cta a.btn{background:var(--sun);color:#1f2937;font-weight:800;text-decoration:none;
    padding:14px 26px;border-radius:12px;white-space:nowrap}
  .qr{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:0 0 40px}
  .qr .ph{width:84px;height:84px;border:2px dashed var(--line);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px;text-align:center}
  .qr .t{font-size:13px;color:var(--muted)}
  /* Termin-Buchung */
  .book{background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px;margin:24px 0}
  .book h2{margin:0 0 4px;font-size:21px}
  .book .bsub{color:var(--muted);font-size:14px;margin:0 0 18px}
  .frow{display:flex;gap:12px;margin-bottom:12px}
  .book input[type=text],.book input[type=tel],.book input[type=email],.book select,.book input:not([type]){
    flex:1;width:100%;padding:13px 14px;border:1px solid var(--line);border-radius:10px;font-size:15px;font-family:inherit;background:#fff}
  .book .chk{display:flex;align-items:center;gap:9px;font-size:14px;color:#334155;margin:4px 0 16px;cursor:pointer}
  .book .chk input{width:18px;height:18px;accent-color:var(--green)}
  .book button{width:100%;background:var(--green);color:#fff;font-weight:800;font-size:16px;border:0;
    border-radius:12px;padding:15px;cursor:pointer}
  .book button:hover{background:var(--green-d)}
  .book .calalt{display:block;text-align:center;margin-top:12px;font-size:14px;color:var(--green-d)}
  .book .fnote{font-size:11.5px;color:var(--muted);margin-top:12px;text-align:center}
  .bookok{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;border-radius:14px;padding:22px;text-align:center;font-size:16px;font-weight:700;margin:24px 0}
  @media(max-width:560px){.frow{flex-direction:column}}
  footer{color:var(--muted);font-size:12px;text-align:center;padding:0 20px 40px}
  @media(max-width:680px){.stats{grid-template-columns:repeat(2,1fr)}.result{grid-template-columns:1fr}.row label{flex-basis:140px}header.hero h1{font-size:24px}}
</style>
</head>
<body>
  <header class="hero">
    <div class="badge">☀️ Ihr persönliches Solar-Potenzial</div>
    <h1>So viel Strom kann Ihr Dach erzeugen</h1>
    <p>${escapeHtml(streetTitle)} · ${escapeHtml(p.zip || '')} ${escapeHtml(p.city || 'Wien')}</p>
  </header>

  <div class="wrap">
    <div class="photo">
      <div class="imgbox">
        ${photoBlock(img, rendered)}
        <div class="tag-suit">✓ Dach geeignet · Score ${p.suitability_score ?? '–'}/100</div>
      </div>
      <div class="cap"><span>${rendered ? 'Schieberegler bewegen: Ihr Dach vorher ↔ mit Solaranlage' : 'Echtes Satellitenbild Ihres Hauses'}</span><b>Dachausrichtung ${fmtAz(p.best_roof_azimuth)} · ${p.annual_sunshine_hours ?? '–'} Sonnenstunden/Jahr</b></div>
    </div>

    <div class="stats">
      <div class="stat"><div class="v">${nf(p.system_size_kwp)} kWp</div><div class="l">Anlagengröße</div></div>
      <div class="stat"><div class="v">${nf(yearlyKwh)} kWh</div><div class="l">Stromertrag / Jahr</div></div>
      <div class="stat"><div class="v">€ ${nf(cost)}</div><div class="l">Investition</div></div>
      <div class="stat"><div class="v green">€ ${nf(p.annual_savings_eur)}</div><div class="l">Ersparnis / Jahr</div></div>
    </div>

    <section class="calc">
      <h2>Ihr persönlicher Spar-Rechner</h2>
      <div class="sub">Bewegen Sie die Regler — alle Werte aktualisieren sich sofort.</div>

      <div class="row">
        <label>Strompreis (€/kWh)</label>
        <input id="price" type="range" min="0.15" max="0.45" step="0.01" value="${ECON.electricityPrice}">
        <div class="out" id="priceOut"></div>
      </div>
      <div class="row">
        <label>Eigenverbrauch (%)</label>
        <input id="self" type="range" min="20" max="80" step="5" value="${Math.round(ECON.selfConsumption*100)}">
        <div class="out" id="selfOut"></div>
      </div>
      <div class="row">
        <label>Einspeise­vergütung (€/kWh)</label>
        <input id="feed" type="range" min="0.03" max="0.15" step="0.01" value="${ECON.feedInTariff}">
        <div class="out" id="feedOut"></div>
      </div>

      <div class="batt">
        <label class="switch">
          <input type="checkbox" id="batt">
          <span class="slider-sw"></span>
        </label>
        <div class="batt-txt">
          <b>🔋 Mit Batteriespeicher (${nf(ECON.batteryKwh)} kWh)</b>
          <span>Mehr Strom selbst nutzen statt günstig einspeisen — deutlich mehr Ersparnis. Aufpreis ca. € ${nf(ECON.batteryKwh*ECON.batteryCostPerKwh)}.</span>
        </div>
      </div>

      <div class="result">
        <div class="b"><div class="v" id="rSave">–</div><div class="l">Ersparnis pro Jahr</div></div>
        <div class="b"><div class="v" id="rPay">–</div><div class="l">Amortisation</div></div>
        <div class="b"><div class="v" id="r20">–</div><div class="l">Ersparnis über 20 Jahre</div></div>
      </div>
    </section>

    <section class="book" id="termin">
      <h2>Kostenlose Solar-Beratung sichern</h2>
      <p class="bsub">Ein geprüfter lokaler Solar-Partner prüft Ihr Dach und erstellt Ihr persönliches Angebot — kostenlos & unverbindlich.</p>
      <form id="bookform">
        <div class="frow">
          <input type="text" name="name" placeholder="Ihr Name" required>
          <input type="tel" name="telefon" placeholder="Telefonnummer" required>
        </div>
        <div class="frow">
          <input type="email" name="email" placeholder="E-Mail (optional)">
          <select name="wunschzeit">
            <option value="">Wann passt es Ihnen? (optional)</option>
            <option>Vormittag</option>
            <option>Nachmittag</option>
            <option>Abend</option>
            <option>egal</option>
          </select>
        </div>
        <label class="chk"><input type="checkbox" name="eigentuemer" value="ja" required> Ich bin Eigentümer:in dieses Hauses</label>

        <input type="hidden" name="access_key" value="${FORM.accessKey}">
        <input type="hidden" name="subject" value="Solar-Terminanfrage: ${escapeHtml(streetTitle)}">
        <input type="hidden" name="adresse" value="${escapeHtml(streetTitle)}, ${escapeHtml(p.zip || '')} ${escapeHtml(p.city || 'Wien')}">
        <input type="hidden" name="anlage_kwp" value="${nf(p.system_size_kwp)} kWp">
        <input type="hidden" name="ersparnis_jahr" value="${p.annual_savings_eur != null ? '€ ' + nf(p.annual_savings_eur) : ''}">
        <input type="hidden" name="amortisation" value="${p.payback_years != null ? String(p.payback_years).replace('.', ',') + ' Jahre' : ''}">

        <button type="submit">Kostenlose Beratung anfragen →</button>
        ${FORM.calcomUrl ? `<a class="calalt" href="${FORM.calcomUrl}" target="_blank">…oder direkt einen Termin im Kalender wählen →</a>` : ''}
        <div class="fnote">Wir vermitteln Sie an einen geprüften lokalen Solar-Partner. Ihre Daten werden nur dafür genutzt; Sie können jederzeit widersprechen.</div>
      </form>
      <div class="bookok" id="bookok" hidden>✅ Danke! Ein geprüfter Solar-Partner meldet sich in Kürze bei Ihnen.</div>
    </section>

    <div class="qr">
      <div class="ph">QR-Code</div>
      <div class="t">Diesen QR-Code drucken wir auf Ihre Postkarte — er führt direkt hierher.</div>
    </div>
  </div>

  <footer>
    Schätzwerte auf Basis von Google-Solar-Daten · keine verbindliche Zusage.<br>
    Absender / Datenschutz: hier Ihre Firmenangaben einfügen.
  </footer>

<script>
  // Vorher/Nachher-Schieberegler (nur wenn vorhanden).
  (function(){
    var ba = document.getElementById('ba');
    if(!ba) return;
    var before = document.getElementById('baBefore');
    var handle = document.getElementById('baHandle');
    var innerImg = before.querySelector('img');
    function fit(){ innerImg.style.width = ba.clientWidth + 'px'; }
    function setPos(x){
      var r = ba.getBoundingClientRect();
      var pct = Math.max(0, Math.min(100, ((x - r.left)/r.width)*100));
      before.style.width = pct + '%';
      handle.style.left = pct + '%';
    }
    fit(); window.addEventListener('resize', fit);
    var dragging = false;
    function down(){ dragging = true; }
    function up(){ dragging = false; }
    function move(e){ if(!dragging) return; var x = (e.touches?e.touches[0].clientX:e.clientX); setPos(x); }
    handle.addEventListener('mousedown', down);
    handle.addEventListener('touchstart', down, {passive:true});
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, {passive:true});
    ba.addEventListener('click', function(e){ setPos(e.clientX); });
  })();

  // Dieselbe ROI-Logik wie im Backend (Workflow 1), nur live im Browser.
  var YEARLY_KWH = ${yearlyKwh};
  var COST = ${cost};
  var CONSUMPTION = ${ECON.annualConsumption};           // Haushaltsverbrauch kWh/Jahr
  var BATTERY_COST = ${ECON.batteryKwh * ECON.batteryCostPerKwh};
  var BATTERY_SELF = ${ECON.selfWithBattery};            // Eigenverbrauch mit Speicher
  function eur(n){return '€ ' + new Intl.NumberFormat('de-AT').format(Math.round(n));}
  function calc(){
    var price = +document.getElementById('price').value;
    var self  = +document.getElementById('self').value/100;
    var feed  = +document.getElementById('feed').value;
    var batt  = document.getElementById('batt').checked;

    // Mit Speicher: hoeherer Eigenverbrauch + Aufpreis. Slider wird "ausgegraut".
    var effSelf = batt ? Math.max(self, BATTERY_SELF) : self;
    var cost    = batt ? COST + BATTERY_COST : COST;
    document.getElementById('self').disabled = batt;

    document.getElementById('priceOut').textContent = price.toFixed(2).replace('.',',');
    document.getElementById('selfOut').textContent  = Math.round(effSelf*100) + ' %';
    document.getElementById('feedOut').textContent  = feed.toFixed(2).replace('.',',');

    // WICHTIG: Eigenverbrauch durch echten Haushaltsverbrauch deckeln (wie im Backend).
    var selfKwh = Math.min(YEARLY_KWH*effSelf, CONSUMPTION);
    var feedKwh = Math.max(0, YEARLY_KWH - selfKwh);
    var save = selfKwh*price + feedKwh*feed;
    var pay  = save>0 ? (cost/save) : 0;

    document.getElementById('rSave').textContent = eur(save);
    document.getElementById('rPay').textContent  = pay>0 ? pay.toFixed(1).replace('.',',') + ' Jahre' : '–';
    document.getElementById('r20').textContent   = eur(save*20 - (batt?BATTERY_COST:0));
  }
  ['price','self','feed','batt'].forEach(function(id){
    document.getElementById(id).addEventListener('input', calc);
    document.getElementById(id).addEventListener('change', calc);
  });
  calc();

  // Termin-Buchung absenden (Web3Forms; ohne Key -> mailto-Rückfall).
  (function(){
    var f = document.getElementById('bookform');
    if (!f) return;
    var KEY = ${JSON.stringify(FORM.accessKey)};
    var MAIL = ${JSON.stringify(FORM.contactEmail)};
    f.addEventListener('submit', async function(e){
      e.preventDefault();
      var btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Wird gesendet…';
      try {
        if (KEY) {
          var res = await fetch('https://api.web3forms.com/submit', { method:'POST', body: new FormData(f) });
          var j = await res.json();
          if (!j.success) throw new Error('web3forms');
        } else if (MAIL) {
          var lines = [];
          new FormData(f).forEach(function(v,k){ if(k!=='access_key'&&k!=='subject'&&v) lines.push(k+': '+v); });
          window.location.href = 'mailto:'+MAIL+'?subject='+encodeURIComponent('Solar-Terminanfrage')+'&body='+encodeURIComponent(lines.join('\n'));
        } else {
          throw new Error('kein Empfänger konfiguriert');
        }
        f.hidden = true;
        document.getElementById('bookok').hidden = false;
      } catch(err) {
        btn.disabled = false; btn.textContent = 'Kostenlose Beratung anfragen →';
        alert('Senden hat leider nicht geklappt. Bitte später erneut versuchen.');
      }
    });
  })();
</script>
</body>
</html>`;
}

// ----------------------------------------------------------------------------
//  Hilfsfunktionen
// ----------------------------------------------------------------------------
async function imageDataUri(p, filename) {
  const candidate = join(OUTPUT_DIR, filename);
  try {
    await access(candidate);
    const buf = await readFile(candidate);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Vorher/Nachher-Schieberegler, wenn ein Render-Bild da ist — sonst nur Satellit.
function photoBlock(img, rendered) {
  if (!img) return `<div style="color:#64748b;display:flex;height:100%;align-items:center;justify-content:center">Satellitenbild nicht gefunden</div>`;
  if (!rendered) return `<img src="${img}" alt="Satellitenbild Ihres Dachs">`;
  return `
    <div class="ba" id="ba">
      <img class="ba-after" src="${rendered}" alt="Dach mit Solaranlage">
      <div class="ba-before" id="baBefore"><img src="${img}" alt="Dach ohne Solaranlage"></div>
      <div class="ba-handle" id="baHandle"><span>‹ ›</span></div>
      <div class="ba-lbl ba-lbl-l">Vorher</div>
      <div class="ba-lbl ba-lbl-r">Mit Solar</div>
    </div>`;
}

function fmtAz(a){
  if (a == null) return '–';
  if (a >= 157 && a <= 202) return 'Süd';
  if (a > 112 && a < 157) return 'Südost';
  if (a > 202 && a < 247) return 'Südwest';
  return a + '°';
}
function nf(n){ return n == null ? '–' : new Intl.NumberFormat('de-AT').format(Math.round(n)); }
function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

main().catch(err => { console.error('❌ Fehler:', err.message); process.exit(1); });
