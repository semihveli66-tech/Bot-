const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

const DIR = __dirname;

const JOBS = [
  // Schlichte Einladung auf Weiß
  { file: 'post-quadrat.html',  out: 'phonetastic-eroeffnung-post.png',  w: 1080, h: 1080, scale: 1 },
  { file: 'post-story.html',    out: 'phonetastic-eroeffnung-story.png', w: 1080, h: 1920, scale: 1 },
  { file: 'post-flyer-a4.html', out: 'phonetastic-eroeffnung-flyer-a4.png', w: 1240, h: 1754, scale: 2 },
  // Einladung im Kalligrafie-Stil auf Creme
  { file: 'elegant-quadrat.html',  out: 'phonetastic-einladung-post.png',  w: 1080, h: 1080, scale: 1 },
  { file: 'elegant-story.html',    out: 'phonetastic-einladung-story.png', w: 1080, h: 1920, scale: 1 },
  { file: 'elegant-flyer-a4.html', out: 'phonetastic-einladung-flyer-a4.png', w: 1240, h: 1754, scale: 2 },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  let problems = 0;

  for (const job of JOBS) {
    const ctx = await browser.newContext({
      viewport: { width: job.w, height: job.h },
      deviceScaleFactor: job.scale,
    });
    const page = await ctx.newPage();
    await page.goto('file://' + path.join(DIR, job.file));
    await page.waitForTimeout(500);
    await page.evaluate(() => document.fonts.ready);

    const report = await page.evaluate(() => {
      const stage = document.querySelector('.stage');
      const sr = stage.getBoundingClientRect();
      const inner = document.querySelector('.inner');
      const out = [];

      // Inhalt höher als die Leinwand?
      if (inner.scrollHeight > inner.clientHeight + 1) {
        out.push(`.inner Inhalt ${inner.scrollHeight}px > Platz ${inner.clientHeight}px`);
      }

      // Ragt irgendein Element über die Leinwand hinaus?
      document.querySelectorAll('.inner *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        const tag = el.className || el.tagName;
        if (r.right > sr.right + 1) out.push(`rechts raus: ${tag} (${Math.round(r.right)} > ${Math.round(sr.right)})`);
        if (r.left < sr.left - 1) out.push(`links raus: ${tag} (${Math.round(r.left)} < ${Math.round(sr.left)})`);
        if (r.bottom > sr.bottom + 1) out.push(`unten raus: ${tag} (${Math.round(r.bottom)} > ${Math.round(sr.bottom)})`);
        if (r.top < sr.top - 1) out.push(`oben raus: ${tag} (${Math.round(r.top)} < ${Math.round(sr.top)})`);
      });

      // Abgeschnittener oder überlaufender Text – auch in Elementen,
      // die selbst wieder Elemente enthalten (z. B. Zeilen mit <span>).
      document.querySelectorAll('.inner *').forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 1) {
          out.push(`zu breit: "${(el.textContent || '').trim().slice(0, 34)}" (${el.scrollWidth} > ${el.clientWidth})`);
        }
        // Bei zentriertem Text ohne Umbruch ragt der Inhalt über beide
        // Seiten hinaus; das misst nur der Textbereich selbst.
        if (el.firstChild && el.textContent.trim()) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const tr = range.getBoundingClientRect();
          if (tr.width && (tr.right > sr.right + 1 || tr.left < sr.left - 1)) {
            out.push(`Text aus der Leinwand: "${el.textContent.trim().slice(0, 34)}" (${Math.round(tr.left)} … ${Math.round(tr.right)})`);
          }
        }
      });

      const freeSpace = inner.clientHeight - inner.scrollHeight;
      return { out: [...new Set(out)], freeSpace };
    });

    await page.screenshot({ path: path.join(DIR, job.out) });
    await ctx.close();

    const status = report.out.length ? 'PROBLEME' : 'ok';
    console.log(`\n${job.file} → ${job.out} [${job.w}×${job.h} @${job.scale}x]  ${status}`);
    console.log(`  freier Platz vertikal: ${report.freeSpace}px`);
    report.out.forEach((p) => console.log('  ! ' + p));
    problems += report.out.length;
  }

  await browser.close();
  console.log(problems ? `\n=== ${problems} Problem(e) ===` : '\n=== alles sauber ===');
})();
