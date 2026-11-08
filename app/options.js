'use strict';
(() => {
const $ = id => document.getElementById(id), rad = d => d * Math.PI / 180;
let replay = null, lights = null, dnOn = false, dnTimer = 0, regions = null, audio = null, chordT = 0;
const sw = (b, on) => b.setAttribute('aria-checked', on);
function panel(v) { $('op').hidden = !v; if (v) { $('ed').hidden = true; $('st').hidden = true; refreshNotes(); } }
function refreshNotes() {
  const pl = WM.current.places.filter(p => p.status !== 'want'), dated = pl.filter(p => p.date).length, trips = new Set(pl.map(p => p.trip).filter(Boolean));
  $('rpNote').textContent = dated ? `${dated} of ${pl.length} pins have dates. The rest follow in list order.` : 'No dates yet, so pins light up in list order. Add dates under Add Places, Pins.';
  $('arcNote').textContent = trips.size ? `${trips.size} ${trips.size === 1 ? 'trip' : 'trips'} found` : 'No trip names yet. Add them under Add Places, Pins.';
}
function sunVector(t) {
  const n = t / 86400000 + 2440587.5 - 2451545, L = rad(280.46 + .9856474 * n), g = rad(357.528 + .9856003 * n), lamb = L + rad(1.915) * Math.sin(g) + rad(.02) * Math.sin(2 * g), eps = rad(23.439 - 4e-7 * n);
  const dec = Math.asin(Math.sin(eps) * Math.sin(lamb)), ra = Math.atan2(Math.cos(eps) * Math.sin(lamb), Math.cos(lamb)), gmst = rad((18.697374558 + 24.06570982441908 * n) * 15), lon = ra - gmst;
  return [Math.cos(dec) * Math.cos(lon), Math.cos(dec) * Math.sin(lon), Math.sin(dec)];
}
async function setDn(on) {
  dnOn = on; sw($('swDn'), on);
  if (on && !lights) { lights = new Image(); lights.src = 'assets/lights-4k.jpg?v=1'; await lights.decode(); WM.setLights(lights); }
  WM.setDayNight(dnOn ? 1 : 0, sunVector(Date.now())); clearInterval(dnTimer); if (dnOn) dnTimer = setInterval(() => WM.setDayNight(1, sunVector(Date.now())), 60000);
}
function startReplay() {
  const P = WM.current.places.filter(p => p.status !== 'want'), idx = new Map(P.map((p, i) => [p.name, i]));
  const order = P.slice().sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || idx.get(a.name) - idx.get(b.name)), rank = new Map(order.map((p, i) => [p.name, i]));
  WM.setRanks(rank); replay = { n: 0, order, rate: Math.max(3, order.length / 40) }; WM.view.maxRank = 0; panel(false); $('rpMsg').hidden = false; $('rpSub').textContent = ''; document.body.classList.add('replay');
}
function stopReplay() { replay = null; WM.view.maxRank = null; $('rpMsg').hidden = true; document.body.classList.remove('replay'); }
function musicOn(on) {
  sw($('swMu'), on);
  if (!on) { if (audio) { const a = audio; a.out.gain.setTargetAtTime(0, a.ctx.currentTime, .4); setTimeout(() => a.ctx.close(), 1800); audio = null; } return; }
  const ctx = new (window.AudioContext || window.webkitAudioContext)(), out = ctx.createGain(), lp = ctx.createBiquadFilter(), dl = ctx.createDelay(1.5), fb = ctx.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 900; dl.delayTime.value = .9; fb.gain.value = .35; out.gain.value = .0001; out.gain.setTargetAtTime(.11, ctx.currentTime, 1.5);
  lp.connect(out); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(out); out.connect(ctx.destination); audio = { ctx, out, lp }; chord(); }
const CH = [[146.83, 220, 293.66, 369.99], [123.47, 185, 246.94, 293.66], [98, 196, 246.94, 293.66], [110, 164.81, 220, 277.18]];
function chord() {
  if (!audio) return; const { ctx, lp } = audio, t = ctx.currentTime, f = CH[chordT++ % CH.length];
  for (const hz of f) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = hz; o.detune.value = Math.random() * 8 - 4; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + 3); g.gain.linearRampToValueAtTime(0, t + 10); o.connect(g); g.connect(lp); o.start(t); o.stop(t + 10.2); }
  setTimeout(chord, 8000);
}
const inRing = (x, y, r) => { let a = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [x1, y1] = r[i], [x2, y2] = r[j]; if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) a = !a; } return a; };
function regionsFor(d) {
  const V = new Set(d.visitedCountries), rs = regions.filter(r => V.has(r.c)), gold = new Set(), P = d.places.filter(p => p.status !== 'want');
  for (const p of P) for (const r of rs) { const [a, b, c, e] = r.b; if (p.lon < a || p.lon > c || p.lat < b || p.lat > e) continue; if (r.p.some(q => inRing(p.lon, p.lat, q[0]))) { gold.add(r); break; } }
  const hit = new Set([...gold].map(r => r.c));
  const scoped = rs.filter(r => hit.has(r.c));
  return { countries: hit, gold: [...gold].map(r => r.p), all: scoped.map(r => r.p) };
}
async function setRegions(on) {
  sw($('swReg'), on);
  if (on) { if (!regions) { regions = await fetch('assets/regions.json?v=1').then(r => r.json()); regions.forEach(r => { const pts = r.p.flat(2); r.b = [Math.min(...pts.map(q => q[0])), Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[0])), Math.max(...pts.map(q => q[1]))]; }); } WM.view.regions = regionsFor(WM.current); } else WM.view.regions = null;
  WM.refresh();
}
function setTheme(k, keep) { const t = WM.THEMES[k] || WM.THEMES.gold; WM.setColors(t); $('opTheme').value = WM.THEMES[k] ? k : 'gold'; if (keep && WM.ed) { const E = WM.ed.E(); E.theme = k === 'gold' ? undefined : k; WM.ed.commit(); } }
function poster() {
  const btn = $('opPoster'); btn.disabled = true; btn.textContent = 'Working';
  requestAnimationFrame(() => {
    WM.poster((bg, gl, fg, { W, H }) => {
      const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2; const x = c.getContext('2d'); x.drawImage(bg, 0, 0); x.drawImage(gl, 0, 0); x.drawImage(fg, 0, 0); x.scale(2, 2);
      const d = WM.current, nP = d.places.filter(p => p.status !== 'want').length, nS = (d.visitedStates || []).filter(n => n !== 'District of Columbia').length, gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
      x.fillStyle = '#04080fd8'; x.fillRect(40, H - 164, 470, 124); x.fillStyle = '#f1e6cf'; x.font = '600 40px "Iowan Old Style",Georgia,serif'; x.fillText(document.querySelector('#panel h1').textContent, 62, H - 112);
      x.fillStyle = gold; x.font = '500 26px "Iowan Old Style",Georgia,serif'; x.fillText(`${d.visitedCountries.length} Countries  ·  ${nS} States  ·  ${nP} Places`, 62, H - 66);
      c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'my-world-travels.png'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); window.__posterBytes = b.size; btn.disabled = false; btn.textContent = 'Download'; }, 'image/png');
    });
  });
}
async function share() {
  const d = WM.current, slim = { visitedCountries: d.visitedCountries, places: d.places.map(({ name, lat, lon, note, date, category, trip, status }) => ({ name, lat, lon, note, date, category, trip, status })) }; if (d.visitedStates) slim.visitedStates = d.visitedStates; if (d.theme) slim.theme = d.theme;
  const z = await new Response(new Blob([JSON.stringify(slim)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  let s = ''; new Uint8Array(z).forEach(b => s += String.fromCharCode(b));
  const url = location.origin + location.pathname + '#share=' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const o = $('shareOut'); o.value = url; o.hidden = false; o.select(); window.__shareUrl = url;
  try { await navigator.clipboard.writeText(url); $('opShare').textContent = 'Copied'; } catch (e) { $('opShare').textContent = 'Select and Copy'; }
  setTimeout(() => $('opShare').textContent = 'Copy Link', 2500);
}
function boot() {
  const th = $('opTheme'); for (const k in WM.THEMES) th.append(new Option(WM.THEMES[k].name, k));
  const cat = $('opCat'); cat.append(new Option('All', '')); cat.append(new Option('Want to Go', 'want')); Object.keys(WM.CATS || {}).forEach(c => cat.append(new Option(c, c)));
  $('optOpen').onclick = () => panel($('op').hidden); $('opClose').onclick = () => { panel(false); $('optOpen').focus(); };
  $('addOpen').addEventListener('click', () => $('op').hidden = true); $('statsOpen').addEventListener('click', () => $('op').hidden = true);
  const prev = WM.closePanel; WM.closePanel = () => { if (replay) { stopReplay(); return true; } if (!$('op').hidden) { panel(false); return true; } return prev ? prev() : false; };
  $('rpGo').onclick = startReplay; $('rpStop').onclick = stopReplay;
  $('swDn').onclick = () => setDn($('swDn').getAttribute('aria-checked') !== 'true'); $('swArc').onclick = () => { WM.view.arcs = !WM.view.arcs; sw($('swArc'), WM.view.arcs); };
  $('swReg').onclick = () => setRegions($('swReg').getAttribute('aria-checked') !== 'true'); $('swMu').onclick = () => musicOn($('swMu').getAttribute('aria-checked') !== 'true');
  th.onchange = () => setTheme(th.value, true); cat.onchange = () => { WM.view.filter = cat.value || null; }; $('opPoster').onclick = poster; $('opShare').onclick = share;
  WM.sunVector = sunVector;
  WM.onFrame = dt => { if (!replay) return; replay.n += dt * replay.rate; WM.view.maxRank = replay.n; const i = Math.min(replay.order.length - 1, Math.floor(replay.n)), p = replay.order[i]; if (p) { $('rpName').textContent = p.name; $('rpSub').textContent = `${i + 1} of ${replay.order.length}${p.date ? ', ' + p.date : ''}`; } if (replay.n >= replay.order.length + 3 * replay.rate) stopReplay(); };
  addEventListener('wm-data', () => { if (WM.view.regions && regions) { const n = regionsFor(WM.current); WM.view.regions = n; } });
  if (WM.current.theme) setTheme(WM.current.theme);
  const E = WM.ed && WM.ed.E(); if (E && E.theme) setTheme(E.theme);
  if (WM.readOnly) { $('rpGo').disabled = false; }
}
window.WM && WM.ed ? boot() : addEventListener('wm-ready', () => setTimeout(() => setTimeout(boot)), { once: true });
})();
