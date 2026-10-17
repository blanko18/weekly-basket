// Builds www/ for the Android app from src/app.html:
//  - swaps Google Fonts for bundled font files, so the app looks right offline
//  - adds the Capacitor runtime + Share/Filesystem/App plugin scripts (no bundler needed)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = join(dirname(new URL(import.meta.url).pathname), '..');
const nm = join(root, 'node_modules');
const www = join(root, 'www');
rmSync(www, { recursive: true, force: true });
mkdirSync(join(www, 'vendor'), { recursive: true });
mkdirSync(join(www, 'fonts'), { recursive: true });

// Capacitor runtime and plugins (each package ships an IIFE build, named in its "unpkg" field)
const pkgs = [
  ['@capacitor/core', 'capacitor.js'],
  ['@capacitor/app', 'app.js'],
  ['@capacitor/filesystem', 'filesystem.js'],
  ['@capacitor/share', 'share.js'],
];
const scripts = [];
for (const [pkg, out] of pkgs) {
  const pj = JSON.parse(readFileSync(join(nm, pkg, 'package.json'), 'utf8'));
  const candidates = [pj.unpkg, typeof pj.browser === 'string' ? pj.browser : null,
    pkg === '@capacitor/core' ? 'dist/capacitor.js' : 'dist/plugin.js'].filter(Boolean);
  const src = candidates.map(r => join(nm, pkg, r)).find(existsSync);
  // The app also falls back to the plugins the native bridge exposes, so a missing file is not fatal.
  if (!src) { console.warn(`No browser build found for ${pkg}, relying on the native bridge`); continue; }
  copyFileSync(src, join(www, 'vendor', out));
  scripts.push(`<script src="vendor/${out}"></script>`);
}

// Offline receipt reader (Tesseract): script, worker, LSTM cores and English data
const tdir = join(www, 'vendor', 'tesseract');
mkdirSync(join(tdir, 'core'), { recursive: true });
mkdirSync(join(tdir, 'lang'), { recursive: true });
copyFileSync(join(nm, 'tesseract.js', 'dist', 'tesseract.min.js'), join(tdir, 'tesseract.min.js'));
copyFileSync(join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(tdir, 'worker.min.js'));
const coreDir = [join(nm, 'tesseract.js-core'), join(nm, 'tesseract.js', 'node_modules', 'tesseract.js-core')].find(existsSync);
if (!coreDir) throw new Error('tesseract.js-core is not installed');
let cores = 0;
for (const f of readdirSync(coreDir)) {
  if (/^tesseract-core.*lstm\.wasm(\.js)?$/.test(f)) { copyFileSync(join(coreDir, f), join(tdir, 'core', f)); cores++; }
}
if (!cores) throw new Error('No tesseract LSTM core files found in ' + coreDir);
// Stored uncompressed: Android's packager silently un-gzips and renames .gz assets, which would break the path.
writeFileSync(join(tdir, 'lang', 'eng.traineddata'), gunzipSync(readFileSync(join(nm, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'))));
console.log('receipt reader bundled:', cores, 'core files');

// Fonts
const fonts = [
  ['Figtree', 'figtree', 'figtree', [400, 500, 600, 700]],
  ['Bricolage Grotesque', 'bricolage-grotesque', 'bricolage-grotesque', [600, 800]],
  ['IBM Plex Mono', 'ibm-plex-mono', 'ibm-plex-mono', [400, 500]],
];
let css = '';
for (const [family, pkg, stem, weights] of fonts) {
  for (const w of weights) {
    const file = `${stem}-latin-${w}-normal.woff2`;
    const src = join(nm, '@fontsource', pkg, 'files', file);
    if (!existsSync(src)) { console.warn(`font not found, skipping: ${file}`); continue; }
    copyFileSync(src, join(www, 'fonts', file));
    css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(${file}) format('woff2')}\n`;
  }
}
writeFileSync(join(www, 'fonts', 'fonts.css'), css);

// Page
let html = readFileSync(join(root, 'src', 'app.html'), 'utf8');
html = html
  .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts/fonts.css">');
const i = html.indexOf('<script>');
if (i < 0) throw new Error('app script not found in src/app.html');
html = html.slice(0, i) + '<script>window.WB_LOCAL_OCR=true</script>\n' + scripts.join('\n') + '\n' + html.slice(i);
writeFileSync(join(www, 'index.html'), html);
console.log('www ready:', scripts.length, 'runtime scripts,', css.split('\n').filter(Boolean).length, 'font files');
