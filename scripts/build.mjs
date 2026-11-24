// Build dist/: self-contained pages, no network after the first load.
//   dist/michigan.html   the long Michigan guide (scripts/build-michigan.mjs makes the fragment)
//   dist/index.html      home page: every state, with its community college trades page
//   dist/sitemap.xml, dist/robots.txt
// Run: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const SITE = 'https://skilledtrades-usa.com';
mkdirSync(out, { recursive: true });
mkdirSync(join(root, 'build'), { recursive: true });

execFileSync(process.execPath, [join(root, 'scripts', 'build-michigan.mjs')], { stdio: 'inherit' });

const A11Y_CSS = readFileSync(join(root, 'shared', 'a11y.css'), 'utf8');
const A11Y_JS = readFileSync(join(root, 'shared', 'a11y.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const SKIP = '<a class="skip-link" href="#main">Skip to main content</a>\n';

// Skip link + shared accessibility layer, inserted the same way the science site does it.
function a11y(html) {
  if (html.includes('class="skip-link"')) return html;
  const at = {};
  const re = /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<(header|main|h1)\b[^>]*>/gi;
  for (let m; (m = re.exec(html)); ) if (m[1] && !at[m[1].toLowerCase()]) at[m[1].toLowerCase()] = m;
  const t = at.main || at.h1;
  if (!t) return html;
  let tag = t[0];
  if (!/\sid=/.test(tag)) tag = tag.replace(/>$/, ' id="main">');
  if (!/\stabindex=/.test(tag)) tag = tag.replace(/>$/, ' tabindex="-1">');
  if (!/\sid="main"/.test(tag)) return html;
  html = html.slice(0, t.index) + tag + html.slice(t.index + t[0].length);
  const body = /<body\b[^>]*>/i.exec(html);
  if (body) html = html.slice(0, body.index + body[0].length) + '\n' + SKIP + html.slice(body.index + body[0].length);
  const tail = '<style id="a11y-shared">\n' + A11Y_CSS + '</style>\n<script>\n' + A11Y_JS + '</script>\n';
  const end = html.lastIndexOf('</body>');
  return end >= 0 ? html.slice(0, end) + tail + html.slice(end) : html + '\n' + tail;
}

// ---- Michigan ----
const frag = readFileSync(join(root, 'build', 'michigan.fragment.html'), 'utf8');
writeFileSync(join(out, 'michigan.html'), a11y(frag));

// ---- Home ----
// Reuse the Michigan page's look (its main style block), then fill src/home.html with the data and scripts.
const styles = [...frag.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
const pageStyle = styles.find((s) => !s.includes('id="retro-page"')) || '';
const retroSnippet = readFileSync(join(root, 'shared', 'retro-snippet.html'), 'utf8').split('\r').join('');
const retroSwitch = readFileSync(join(root, 'shared', 'retro-switch.html'), 'utf8').trim();
const colleges = JSON.parse(readFileSync(join(root, 'data', 'colleges.json'), 'utf8'))
  .map((c) => Object.fromEntries(Object.entries(c).filter(([k, v]) => v != null && v !== '' && k !== 'notes' && k !== 'verified')));
const occ = JSON.parse(readFileSync(join(root, 'data', 'michigan', 'occupations.json'), 'utf8'));
const safe = (v) => JSON.stringify(v).replace(/<\//g, '<\\/');
const js = (f) => readFileSync(join(root, 'src', f), 'utf8').replace(/<\/script/gi, '<\\/script');
const fill = {
  __RETRO_SNIPPET__: retroSnippet, __PAGE_STYLE__: pageStyle, __HOME_CSS__: readFileSync(join(root, 'src', 'home.css'), 'utf8'),
  __RETRO_SWITCH__: retroSwitch, __COLLEGES__: safe(colleges), __OCC__: safe(occ), __QUIZ_JS__: js('quiz.js'), __HOME_JS__: js('home.js'),
};
let home = readFileSync(join(root, 'src', 'home.html'), 'utf8');
for (const [k, v] of Object.entries(fill)) home = home.split(k).join(v);
writeFileSync(join(out, 'index.html'), a11y(home));

// ---- sitemap / robots ----
const urls = ['', 'michigan.html'].map((p) => `<url><loc>${SITE}/${p}</loc></url>`).join('');
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('built dist/: index.html michigan.html', colleges.length + 1, 'states');
