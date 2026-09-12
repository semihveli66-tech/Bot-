const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

// Ob das Zeichen mittig sitzt und im Kreis bleibt, misst mitte.py an
// den fertigen Bildern – zuverlässiger als die Rahmen der Elemente,
// weil dort auch runde und leere Kästen mitgezählt würden.
const VARIANTEN = [
  { id: 'a', out: 'phonetastic-profilbild-a-monogramm.png' },
  { id: 'b', out: 'phonetastic-profilbild-b-wortmarke.png' },
  { id: 'c', out: 'phonetastic-profilbild-c-handy.png' },
  { id: 'd', out: 'phonetastic-profilbild-d-hell.png' },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  await page.goto('file://' + path.join(__dirname, 'logo.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  for (const v of VARIANTEN) {
    const el = await page.$('#' + v.id);

    await el.screenshot({ path: path.join(__dirname, v.out) });
    console.log('geschrieben: ' + v.out);
  }

  await browser.close();
})();
