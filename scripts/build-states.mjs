// Build dist/states/<slug>.html from data/states/*.json (see merge-horde.mjs). Static, no JS.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const a = (href, text, cls) => `<a href="${esc(href)}" rel="noopener"${cls ? ` class="${cls}"` : ''}>${esc(text)}</a>`;
export const slugOf = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const UNION_ORDER = ['building trades council', 'JATC / training center', 'apprenticeship program', 'pre-apprenticeship', 'union local', 'contractor association', 'nonprofit'];

export function buildStates({ root, out, pageStyle, homeCss, retroSnippet, retroSwitch, a11y, site }) {
  const dir = join(root, 'data', 'states');
  const national = JSON.parse(readFileSync(join(root, 'data', 'national-resources.json'), 'utf8'));
  mkdirSync(join(out, 'states'), { recursive: true });
  const made = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const s = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (s.state === 'Michigan') continue; // Michigan has its own long guide
    if (!s.colleges.length && !s.unions.length && !s.licensing.length && !s.funding.length) continue;
    const slug = slugOf(s.state);
    const colleges = s.colleges.slice().sort((x, y) => x.name.localeCompare(y.name));
    const collegeHtml = colleges.map((c) => {
      const progs = (c.programs || []).slice(0, 8).map((p) => `<li>${esc(p)}</li>`).join('');
      return `<li class="card"><h3>${esc(c.name)}</h3><p class="meta">${esc([c.city, c.type].filter(Boolean).join(' · '))}</p>${progs ? `<ul class="chips">${progs}</ul>` : ''}<p class="actions">${a(c.trades_url, 'See trades programs', 'btn')}${c.home_url ? a(c.home_url, 'College website', 'btn alt') : ''}</p></li>`;
    }).join('');
    const groups = {};
    for (const u of s.unions) (groups[u.kind || 'other'] ||= []).push(u);
    const kinds = Object.keys(groups).sort((x, y) => (UNION_ORDER.indexOf(x) + 99) % 99 - (UNION_ORDER.indexOf(y) + 99) % 99);
    const unionHtml = kinds.map((k) => {
      const rows = groups[k].slice().sort((x, y) => x.name.localeCompare(y.name));
      const li = rows.map((u) => `<li>${a(u.url, u.name)}${u.city ? ` <span class="meta">(${esc(u.city)})</span>` : ''}${/map.carpenters.org/.test(u.url) ? ' <span class="note">(listing: opens its regional council’s page)</span>' : ''}${u.description ? `<br><span class="note">${esc(u.description.slice(0, 220))}</span>` : ''}</li>`).join('');
      return `<details${rows.length <= 8 ? ' open' : ''}><summary>${esc(k[0].toUpperCase() + k.slice(1))} (${rows.length})</summary><ul class="plain">${li}</ul></details>`;
    }).join('');
    const licHtml = s.licensing.map((l) => `<li class="card"><h3>${a(l.url, l.name)}</h3>${l.trades && l.trades.length ? `<p class="meta">${esc(l.trades.join(', '))}</p>` : ''}${l.description ? `<p>${esc(l.description)}</p>` : ''}</li>`).join('');
    const fundHtml = s.funding.map((f) => `<li class="card"><h3>${esc(f.name)}</h3>${f.provider ? `<p class="meta">${esc(f.provider)}</p>` : ''}<p>${esc(f.provides || '')}</p>${f.amount ? `<p class="note">${esc(f.amount)}</p>` : ''}<p>${a(f.url, 'Official page', 'btn alt')}</p></li>`).join('');
    const title = `${s.state}: trades colleges, apprenticeships and help paying | Skilled Trades USA`;
    const body = `<div class="wrap">
${retroSwitch}
<p class="kicker"><a href="../">Skilled Trades USA</a> &rsaquo; ${esc(s.state)}</p>
<h1 id="main">${esc(s.state)}</h1>
<p class="lede">Colleges with trades programs, unions and apprenticeship programs, state licensing boards, and help paying for training. Every link below was opened and checked when this list was built, and some may have changed since. If a link is dead or something is missing, it is a gap in our list, not a sign the program is gone.</p>
${colleges.length ? `<section class="blk"><h2>Colleges with trades programs (${colleges.length})</h2><ul class="plain">${collegeHtml}</ul></section>` : ''}
${s.unions.length ? `<section class="blk"><h2>Unions, apprenticeships and trade groups</h2><p class="note">Apprenticeships are paid jobs that teach a trade. Ask each program how to apply and when it takes applications.</p>${unionHtml}</section>` : ''}
${s.licensing.length ? `<section class="blk"><h2>Licensing and regulation</h2><ul class="plain">${licHtml}</ul></section>` : ''}
${s.funding.length ? `<section class="blk"><h2>Help paying for training in ${esc(s.state)}</h2><ul class="plain">${fundHtml}</ul><p class="note">Federal programs are listed on the <a href="../#funding">home page</a>.</p></section>` : ''}
<p class="note"><a href="../">&larr; All states</a></p>
</div>`;
    const html = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>${esc(title)}</title>\n<link rel="canonical" href="${site}/states/${slug}.html">\n${retroSnippet}\n<meta name="description" content="${esc(`Trades colleges, unions, apprenticeships, licensing boards and funding for ${s.state}. Free, no ads.`)}">\n${pageStyle}\n<style>\n${homeCss}\nul.plain{list-style:none;padding:0;margin:0}ul.plain>li{margin:.5rem 0}details{margin:.8rem 0}summary{cursor:pointer;font-weight:600}\n</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
    writeFileSync(join(out, 'states', slug + '.html'), a11y(html));
    made.push(slug);
  }
  return made;
}
