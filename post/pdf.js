const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

const JOBS = [
  { file: 'post-flyer-a4.html',    out: 'phonetastic-eroeffnung-flyer-a4.pdf' },
  { file: 'elegant-flyer-a4.html', out: 'phonetastic-einladung-flyer-a4.pdf' },
];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const job of JOBS) {
    const p = await b.newPage({ viewport: { width: 1240, height: 1754 } });
    await p.goto('file://' + path.join(__dirname, job.file));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    await p.pdf({
      path: path.join(__dirname, job.out),
      width: '1240px', height: '1754px', printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await p.close();
    console.log(job.file + ' → ' + job.out);
  }
  await b.close();
})();
