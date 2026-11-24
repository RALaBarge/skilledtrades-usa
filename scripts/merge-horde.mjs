// Merge the crawl output (state sweeps, union passes, funding sweeps) into data/states/<slug>.json
// and data/national-resources.json. Only rows seen on a fetched page (verified true) are kept.
// Run: node scripts/merge-horde.mjs <horde-dir>
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const horde = process.argv[2];
if (!horde) { console.error('usage: node scripts/merge-horde.mjs <horde-dir>'); process.exit(1); }

const STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
const byName = Object.fromEntries(Object.entries(STATES).map(([a, n]) => [n.toLowerCase(), a]));
const code = (s) => { if (!s) return null; const t = String(s).trim(); if (STATES[t.toUpperCase()]) return t.toUpperCase(); return byName[t.toLowerCase()] || null; };
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const read = (f) => (existsSync(join(horde, f)) ? JSON.parse(readFileSync(join(horde, f), 'utf8')) : null);
const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
const aggregator = (u) => /(linemancentral|unionlocator|unionfacts|electriciandb|americanautoworker|zoominfo|yelp|facebook|indeed|glassdoor|mapquest|yellowpages|manta|bbb|labor411|helmetstohardhats|allevents|apprentice|unionlabel|sparkshift|trampherebro|clevelandtradeschools|ziprecruiter|linkedin|instagram|youtube|nlrb|dol)./i.test(u);
const searchy = (u) => /[?&](s|q|query|search|keys?|keyword)=|\/search/i.test(u);
const clean = (o, drop = []) => Object.fromEntries(Object.entries(o).filter(([k, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length) && !drop.includes(k)));

const out = Object.fromEntries(Object.keys(STATES).map((a) => [a, { state: STATES[a], colleges: [], unions: [], licensing: [], funding: [] }]));
const seen = new Set();
const once = (a, kind, ...k) => { const key = a + '|' + kind + '|' + k.join('|').toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; };
const stats = { colleges: 0, unions: 0, licensing: 0, funding: 0, dropped: 0 };

// state sweeps
for (const a of Object.keys(STATES)) {
  const d = read(`state_${a}.json`);
  if (!d) continue;
  for (const c of d.colleges || []) {
    if (c.verified === false || !isHttp(c.trades_url) || searchy(c.trades_url) || !c.name) { stats.dropped++; continue; }
    if (!once(a, 'c', c.name)) continue;
    out[a].colleges.push(clean(c, ['verified', 'notes']));
  }
  for (const o of d.orgs || []) {
    if (o.verified === false || !isHttp(o.url) || !o.name) { stats.dropped++; continue; }
    if (!once(a, 'u', o.url, o.name)) continue;
    out[a].unions.push(clean(o, ['verified']));
  }
  for (const l of d.licensing || []) {
    if (l.verified === false || !isHttp(l.url) || !l.name) { stats.dropped++; continue; }
    if (!once(a, 'l', l.url)) continue;
    out[a].licensing.push(clean(l, ['verified']));
  }
}

// union passes (finder-directory rows)
const gapFiles = readdirSync(horde).filter((n) => /^union_gap_out_\d+\.json$/.test(n));
for (const f of ['union_ibew_ua.json', 'union_other.json', 'union_carp_iron_smart.json', 'union_councils.json', ...gapFiles]) {
  const d = read(f);
  if (!d) continue;
  for (const r of d.rows || []) {
    const a = code(r.state);
    if (!a || r.verified !== true || !isHttp(r.url) || !r.name || aggregator(r.url)) { stats.dropped++; continue; }
    if (!once(a, 'u', r.url, r.name)) continue;
    out[a].unions.push(clean(r, ['verified', 'state', 'finder_url', 'note']));
  }
}

// IPEDS-based school gap fill (rows carry their own state code)
for (const f of readdirSync(horde).filter((n) => /^ipeds_out_\d+\.json$/.test(n))) {
  const d = read(f);
  for (const c of d.colleges || []) {
    const a = code(c.state);
    if (!a || c.verified === false || !isHttp(c.trades_url) || searchy(c.trades_url) || !c.name) { stats.dropped++; continue; }
    if (!once(a, 'c', c.name) || !once(a, 'cu', c.trades_url)) continue;
    out[a].colleges.push(clean(c, ['verified', 'notes', 'state', 'unitid']));
  }
}

// Browserbox retry output (rows carry their own state code)
for (const f of readdirSync(horde).filter((n) => /^retry_[A-Z]\.json$/.test(n))) {
  const d = read(f);
  for (const [list, bucket, kk] of [['colleges', 'colleges', 'name'], ['orgs', 'unions', 'url'], ['licensing', 'licensing', 'url']]) {
    for (const r of d[list] || []) {
      const a = code(r.state);
      const url = list === 'colleges' ? r.trades_url : r.url;
      if (!a || r.verified === false || !isHttp(url) || !r.name || (list === 'colleges' && searchy(url))) { stats.dropped++; continue; }
      if (!once(a, list === 'colleges' ? 'c' : list === 'orgs' ? 'u' : 'l', list === 'orgs' ? r.url : kk === 'name' ? r.name : r.url, list === 'orgs' ? r.name : '')) continue;
      out[a][bucket].push(clean(r, ['verified', 'notes', 'state']));
    }
  }
}

// funding
const fed = [];
const retryFunding = readdirSync(horde).filter((n) => /^retry_[A-Z]\.json$/.test(n)).flatMap((n) => (read(n).funding || []));
const fundingSets = readdirSync(horde).filter((n) => /^funding_F\d+\.json$/.test(n)).map((n) => read(n).items || []).concat([retryFunding]);
const allFunding = fundingSets.flat().sort((x, y) => (y.override ? 1 : 0) - (x.override ? 1 : 0));
for (const items of [allFunding]) {
  for (const it of items) {
    if (it.verified === false || !isHttp(it.url) || !it.name) { stats.dropped++; continue; }
    const scope = it.scope ? String(it.scope) : it.state ? 'state:' + (STATES[String(it.state).toUpperCase()] || it.state) : '';
    const m = /^state:(.+)$/.exec(scope);
    const row = clean(it, ['verified', 'scope', 'override']);
    if (m) {
      const a = code(m[1]);
      if (!a) { stats.dropped++; continue; }
      if (!once(a, 'f', it.url)) continue;
      out[a].funding.push(row);
    } else if (!fed.some((x) => x.url === it.url)) fed.push(row);
  }
}

mkdirSync(join(root, 'data', 'states'), { recursive: true });
for (const [a, v] of Object.entries(out)) {
  writeFileSync(join(root, 'data', 'states', slug(v.state) + '.json'), JSON.stringify({ code: a, ...v }, null, 1) + '\n');
  stats.colleges += v.colleges.length; stats.unions += v.unions.length; stats.licensing += v.licensing.length; stats.funding += v.funding.length;
}
writeFileSync(join(root, 'data', 'national-resources.json'), JSON.stringify(fed, null, 1) + '\n');
stats.national = fed.length;
console.log(stats);
for (const [a, v] of Object.entries(out)) console.log(a, v.colleges.length, v.unions.length, v.licensing.length, v.funding.length);
