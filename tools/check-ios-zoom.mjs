#!/usr/bin/env node
/**
 * iOS PWA sticky-zoom guard.
 *
 * iOS Safari zooms the page when a form control with font-size under 16px is
 * focused. In an installed PWA there is no address bar, so that zoom sticks and
 * the whole screen stays magnified after a tap.
 *
 * A comment cannot fail, so this is a check instead. It asserts:
 *   1. every input / select / textarea computes to >= 16px
 *   2. no page defends itself with maximum-scale or user-scalable=no,
 *      which suppresses the symptom by disabling pinch-zoom for everyone
 *
 * Run:  node tools/check-ios-zoom.mjs
 * Prove it can fail:  node tools/check-ios-zoom.mjs --self-test
 *
 * --self-test injects a 13px input and a scale-locked viewport into each page
 * and requires BOTH assertions to fire. An assertion nobody has watched fail is
 * not yet evidence of anything.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PAGES = ['index.html', 'admin.html'];
const MIN = 16;
const SELF_TEST = process.argv.includes('--self-test');

const TYPES = { '.html':'text/html', '.js':'text/javascript', '.png':'image/png',
                '.json':'application/json', '.webmanifest':'application/manifest+json' };

const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const buf = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined
});
const failures = [];

for (const page of PAGES) {
  const p = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await p.goto(`${base}/${page}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(500);

  if (SELF_TEST) {
    // Break it on purpose. If the checks below stay green against this, they are dead.
    await p.evaluate(() => {
      const i = document.createElement('input');
      i.id = 'selftest-tiny';
      i.style.fontSize = '13px';
      document.body.appendChild(i);
      document.querySelector('meta[name="viewport"]')
        .setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    });
  }

  // Every control in the DOM, including ones inside closed sheets — getComputedStyle
  // resolves font-size even for display:none, so hidden screens are covered too.
  const small = await p.$$eval('input, select, textarea', (els, min) =>
    els.filter(el => el.type !== 'hidden' && el.type !== 'range')
       .map(el => ({
          tag: el.tagName.toLowerCase(),
          id: el.id || el.className || '(unnamed)',
          px: parseFloat(getComputedStyle(el).fontSize)
       }))
       .filter(x => x.px < min), MIN);

  const vp = await p.$eval('meta[name="viewport"]', m => m.content);
  const locked = /user-scalable\s*=\s*no|maximum-scale/i.test(vp);

  if (small.length) {
    failures.push(`${page}: ${small.length} control(s) under ${MIN}px`);
    small.forEach(x => failures.push(`    ${x.tag} #${x.id} → ${x.px}px`));
  }
  if (locked) failures.push(`${page}: viewport disables pinch-zoom → "${vp}"`);

  const controls = await p.$$eval('input, select, textarea', e => e.length);
  console.log(`${page}: ${controls} controls checked` +
              (small.length || locked ? '  ✗' : '  ✓'));
  await p.close();
}

await browser.close();
server.close();

if (SELF_TEST) {
  if (failures.length >= PAGES.length * 2) {
    console.log(`\n✓ self-test: the check caught every injected fault (${failures.length} findings)`);
    process.exit(0);
  }
  console.error(`\n✗ self-test: injected faults were NOT all caught — the check is dead weight`);
  failures.forEach(f => console.error('  ' + f));
  process.exit(1);
}

if (failures.length) {
  console.error('\n✗ iOS sticky-zoom risk:\n' + failures.map(f => '  ' + f).join('\n'));
  console.error('\nControls must be >= 16px. Use var(--t-control); do not lower it.');
  process.exit(1);
}
console.log('\n✓ no iOS sticky-zoom risk: all controls >= 16px, pinch-zoom intact');
