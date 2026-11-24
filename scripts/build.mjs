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
// Reuse the Michigan page's look: its retro style block and its main style block.
const styles = [...frag.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
const retroStyle = styles.find((s) => s.includes('id="retro-page"')) || '';
const pageStyle = styles.find((s) => !s.includes('id="retro-page"')) || '';
const retroSnippet = readFileSync(join(root, 'shared', 'retro-snippet.html'), 'utf8').split('\r').join('');
const retroSwitch = readFileSync(join(root, 'shared', 'retro-switch.html'), 'utf8').trim();

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colleges = JSON.parse(readFileSync(join(root, 'data', 'colleges.json'), 'utf8'));
colleges.sort((a, b) => a.state.localeCompare(b.state));

const items = colleges.map((c) => {
  const isMI = false;
  const progs = (c.programs || []).slice(0, 6).map(esc).join(', ');
  return `<li class="st"><h3>${esc(c.state)}</h3>
<p><a href="${esc(c.trades_page_url)}" rel="noopener">${esc(c.college)}</a>${c.city ? ' &middot; ' + esc(c.city) : ''}</p>
${progs ? `<p class="sub">${progs}</p>` : ''}</li>`;
}).join('\n');

const homeStyle = `<style>
.states{list-style:none;margin:1rem 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:.8rem}
.st{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:.8rem 1rem}
.st h3{margin:0 0 .3rem;font-size:1.05rem}.st p{margin:.2rem 0}.st .sub{color:var(--muted);font-size:.9rem}
.feature{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:1rem 1.2rem;margin:1rem 0}
</style>`;

const home = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Skilled Trades USA: community college trades programs by state</title>
${retroSnippet}
<meta name="description" content="A free guide to skilled-trades careers, with a community college trades program to start from in every state. No ads, no tracking.">
${pageStyle}
${homeStyle}
</head>
<body>
<div class="wrap">
${retroSwitch}
<p class="kicker">Careers &middot; United States</p>
<h1>Skilled Trades USA</h1>
<p class="lede">Hands-on careers that do not depend on a screen. Pick your state to find a community college with trades programs such as welding, electrical, HVAC, plumbing, machining and construction. Free, no ads, no tracking.</p>
<div class="feature"><strong>Michigan:</strong> the full guide has 306 occupations with worker counts, wages and growth, fifteen trades in depth, and what Washtenaw Community College offers. <a href="michigan.html">Read the Michigan guide</a>.</div>
<h2 id="states">Every state</h2>
<p>One college per state to start from. Each link goes to the college's own trades-program page. Other colleges in your state may offer more, so also ask your school counselor and your state's apprenticeship office.</p>
<ul class="states">
${items}
</ul>
<footer>
<p>College pages were checked when the list was built; programs change, so confirm with the college. Michigan figures are from the U.S. Bureau of Labor Statistics. Free to use, MIT licensed.</p>
</footer>
</div>
</body>
</html>
`;
writeFileSync(join(out, 'index.html'), a11y(home));

// ---- sitemap / robots ----
const urls = ['', 'michigan.html'].map((p) => `<url><loc>${SITE}/${p}</loc></url>`).join('');
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log('built dist/: index.html michigan.html', colleges.length, 'states');
