# Skilled Trades USA

Free guide to skilled-trades careers, with a community college trades program to start from in every state.
Static site: every page is one self-contained HTML file (CSS, fonts, JS and data inline), so it needs no network after the first load. Hosted on Cloudflare.

- `data/colleges.json`: one college per state, with the trades-program page and what it lists.
- `data/michigan/`: the Michigan guide's source (306 occupations, fifteen trades in depth, Washtenaw CC).
- `research/michigan/`: BLS pulls and WCC notes behind the Michigan guide.
- `scripts/build.mjs`: builds `dist/` (home page, Michigan guide, sitemap, robots). Run `node scripts/build.mjs`.

`skilledtradesmichigan.com` will 301 to `/michigan.html`.

MIT licensed.
