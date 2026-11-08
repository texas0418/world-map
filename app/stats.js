'use strict';
(() => {
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
let continents = {};
const SHORT = { 'United States of America': 'United States' };
const fmt = (v, pos, neg) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? pos : neg}`;
function compute(d) {
  const P = d.places.filter(p => p.status !== 'want'), ext = P.length ? { North: P.reduce((a, p) => p.lat > a.lat ? p : a), South: P.reduce((a, p) => p.lat < a.lat ? p : a), East: P.reduce((a, p) => p.lon > a.lon ? p : a), West: P.reduce((a, p) => p.lon < a.lon ? p : a) } : null;
  const nC = d.visitedCountries.length, nS = (d.visitedStates || []).filter(n => n !== 'District of Columbia').length;
  const cont = new Set(d.visitedCountries.map(i => continents[i]).filter(Boolean));
  const any = f => P.some(f), hemi = any(p => p.lat > 0) && any(p => p.lat < 0) && any(p => p.lon > 0) && any(p => p.lon < 0);
  const nearN = P.length ? Math.max(...P.map(p => p.lat)) : 0, nearS = P.length ? Math.min(...P.map(p => p.lat)) : 0;
  const needC = cont.has('Oceania') || cont.has('Antarctica') ? '' : 'Australia or Antarctica', left = n => `${Math.max(0, n)} to go`;
  const B = [
    ['Arctic Circle', nearN >= 66.5, 'Above 66.5°N'],
    ['All Four Hemispheres', hemi, 'North, south, east, west'],
    ['Five Continents', cont.size >= 5, `${cont.size} of 7`],
    ['Six Continents', cont.size >= 6, cont.size >= 6 ? `${cont.size} of 7` : (cont.size === 5 ? needC : left(6 - cont.size))],
    ['All Seven Continents', cont.size >= 7, cont.size >= 7 ? '7 of 7' : left(7 - cont.size)],
    ['Twenty Countries', nC >= 20, nC >= 20 ? `${nC} reached` : left(20 - nC)],
    ['Fifty Countries', nC >= 50, nC >= 50 ? `${nC} reached` : left(50 - nC)]
  ];
  if (d.visitedStates) B.push(['Halfway Across America', nS >= 25, nS >= 25 ? '25 states or more' : left(25 - nS)], ['Every State', nS >= 50, nS >= 50 ? '50 of 50' : left(50 - nS)]);
  B.push(['Antarctic Circle', nearS <= -66.5, 'Below 66.5°S']);
  return { ext, nC, nS, cont: cont.size, B };
}
function render() {
  const d = WM.current, s = compute(d), box = $('stBody'); box.textContent = '';
  if (s.ext) {
    box.append(el('h3', '', 'Your Farthest Points'));
    const g = el('div', 'ext');
    for (const k of ['North', 'South', 'East', 'West']) {
      const p = s.ext[k], at = WM.locate(p.lat, p.lon), cn = WM.countryName(at.country), lab = k === 'North' || k === 'South' ? fmt(p.lat, 'N', 'S') : fmt(p.lon, 'E', 'W');
      const c = el('div'); c.append(el('small', '', k), el('b', '', p.name), el('span', '', [SHORT[cn] || cn, lab].filter(Boolean).join(', '))); g.append(c);
    }
    box.append(g);
  }
  box.append(el('h3', '', 'How Much You Have Seen'));
  const bar = (l, n, of) => { const b = el('div', 'bar'), p = el('p'); p.append(el('span', '', l), el('b', '', `${n} of ${of}`)); const i = el('i'); i.style.setProperty('--w', Math.min(100, n / of * 100).toFixed(1) + '%'); b.append(p, i); box.append(b); };
  bar('Countries', s.nC, WM.COUNTRIES); if (d.visitedStates) bar('US States', s.nS, 50); bar('Continents', s.cont, 7);
  const list = (t, on) => { const it = s.B.filter(b => b[1] === on); if (!it.length) return; box.append(el('h3', '', t)); const g = el('div', 'bad'); for (const [n, , note] of it) { const c = el('div', 'bdg' + (on ? '' : ' off')); c.append(el('b', '', n), el('small', '', note)); g.append(c); } box.append(g); };
  list('Badges Earned', true); list('Still Locked', false);
  window.__stats = s;
}
function open(v) { $('st').hidden = !v; if (v) { $('ed').hidden = true; render(); } }
function boot() {
  fetch('assets/continents.json?v=1').then(r => r.json()).then(j => { continents = j; if (!$('st').hidden) render(); }).catch(() => {});
  WM.closeStats = () => { if ($('st').hidden) return false; open(false); return true; };
  $('statsOpen').onclick = () => open($('st').hidden); $('stClose').onclick = () => { open(false); $('statsOpen').focus(); };
  addEventListener('wm-data', () => { if (!$('st').hidden) render(); });
  WM.openStats = open;
}
window.WM && WM.locate ? boot() : addEventListener('wm-ready', () => setTimeout(boot), { once: true });
})();
