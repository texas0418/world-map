'use strict';
(() => {
const $ = id => document.getElementById(id), KEY = 'wm-edits-v1';
let E = { added: [], hide: {}, hideNew: false, countries: [], edits: {} }, cities = null, geo = null, tab = 's', dropAt = null, dropMode = false;
try { E = Object.assign(E, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
const save = () => { if (WM.readOnly) return; try { localStorage.setItem(KEY, JSON.stringify(E)); } catch (e) {} };
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function decode(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map(a => { let X = 0, Y = 0; return a.map(([dx, dy]) => [(X += dx) * sx + tx, (Y += dy) * sy + ty]); });
  const ring = r => { const o = []; for (const i of r) { const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); o.push(...(o.length ? a.slice(1) : a)); } return o; };
  return topo.objects.countries.geometries.map(g => ({ id: g.id, name: g.properties.name, polys: (g.type === 'MultiPolygon' ? g.arcs : [g.arcs]).map(p => p.map(ring)) }));
}
function inRing(x, y, r) { let a = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [x1, y1] = r[i], [x2, y2] = r[j]; if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) a = !a; } return a; }
const inPolys = (x, y, polys) => polys.some(p => inRing(x, y, p[0]) && !p.slice(1).some(h => inRing(x, y, h)));
function nearest(x, y, items, polysOf, limit) {
  let best = null, bd = limit * limit; const c = Math.cos(y * Math.PI / 180);
  for (const it of items) for (const p of polysOf(it)) for (const r of p) for (const [u, v] of r) { const d = ((u - x) * c) ** 2 + (v - y) ** 2; if (d < bd) { bd = d; best = it; } }
  return best;
}
function locate(lat, lon) {
  geo = geo || decode(WM.topo);
  const c = geo.find(g => inPolys(lon, lat, g.polys)) || nearest(lon, lat, geo, g => g.polys, .6);
  let state = null;
  if (c && c.id === '840' && WM.states) {
    const names = Object.keys(WM.states);
    state = names.find(n => inPolys(lon, lat, WM.states[n])) || nearest(lon, lat, names, n => WM.states[n], .6);
  }
  return { country: c && c.id, state };
}
async function loadCities() { if (!cities) { cities = await fetch('assets/cities.json?v=1').then(r => r.json()); cities.forEach(c => c.k = norm(c[0])); } return cities; }
function nearestCity(lat, lon) {
  let b = null, bd = Infinity; const k = Math.cos(lat * Math.PI / 180);
  for (const c of cities) { const d = ((c[5] - lon) * k) ** 2 + (c[4] - lat) ** 2; if (d < bd) { bd = d; b = c; } }
  return b;
}
const cityLabel = c => [c[1], c[2] || c[3]].filter(Boolean).join(', ');

function effective() {
  const out = { visitedCountries: [...WM.base.visitedCountries], places: [] };
  if (WM.base.visitedStates) out.visitedStates = [...WM.base.visitedStates];
  const baseNames = new Set(WM.base.places.map(p => p.name));
  const all = [...WM.base.places, ...E.added.filter(p => !baseNames.has(p.name))];
  for (const p of all) {
    if (E.hide[p.name] && cities) { const c = nearestCity(p.lat, p.lon); out.places.push({ name: cityLabel(c), lat: c[4], lon: c[5] }); continue; }
    const q = { ...p, ...(E.edits[p.name] || {}) }; for (const k in q) if (q[k] === '' || q[k] == null) delete q[k]; out.places.push(q);
  }
  const addC = id => { if (id && !out.visitedCountries.includes(id)) out.visitedCountries.push(id); };
  E.countries.forEach(addC);
  for (const p of E.added) {
    if (baseNames.has(p.name) || (E.edits[p.name] || {}).status === 'want') continue;
    const at = locate(p.lat, p.lon); addC(at.country);
    if (at.state && out.visitedStates && !out.visitedStates.includes(at.state)) out.visitedStates.push(at.state);
  }
  if (out.visitedStates) out.visitedStates.sort();
  if (WM.base.theme) out.theme = WM.base.theme;
  if (E.theme) out.theme = E.theme;
  const seen = new Set(); out.places = out.places.filter(p => { const k = p.name + p.lat + p.lon; if (seen.has(k)) return false; seen.add(k); return true; });
  return out;
}
function commit() { save(); WM.applyData(effective()); renderYours(); renderSaveNote(); if (tab === 'p') renderPrivacy(); }
const onMap = (name, lat, lon) => effective().places.some(p => { const d = Math.max(Math.abs(p.lat - lat), Math.abs(p.lon - lon)); return d < .02 || (d < 1 && norm(p.name.split(',')[0]) === norm(name.split(',')[0])); });

async function addPin(name, lat, lon, region) {
  name = name.trim(); if (!name) return false;
  const taken = n => E.added.some(p => p.name === n) || WM.base.places.some(p => p.name === n);
  if (taken(name)) { if (!region) return false; name = name + ', ' + region; if (taken(name)) return false; }
  E.added.push({ name, lat, lon });
  if (E.hideNew) { await loadCities(); E.hide[name] = true; }
  return true;
}
function renderSaveNote() { $('dl').disabled = !E.added.length && !Object.keys(E.hide).length && !E.countries.length && !Object.keys(E.edits).length && !E.theme; }
function renderYours() {
  const y = $('yours'); y.textContent = ''; $('yoursH').hidden = !E.added.length;
  for (const p of [...E.added].reverse()) {
    const r = el('div', 'row'), d = el('div', '', p.name), at = locate(p.lat, p.lon);
    d.append(el('small', '', E.hide[p.name] ? 'Exact location hidden' : (at.state || (geo.find(g => g.id === at.country) || {}).name || 'Location saved')));
    const u = el('button', 'act', 'Undo'); u.onclick = () => { E.added = E.added.filter(a => a !== p); delete E.hide[p.name]; commit(); renderResults(); };
    r.append(d, u); y.append(r);
  }
}
async function renderResults() {
  const box = $('res'), v = norm($('q').value); box.textContent = '';
  if (v.length < 2) return;
  await loadCities();
  const hits = []; for (const c of cities) { if (c.k.startsWith(v)) hits.push(c); if (hits.length >= 8) break; }
  if (hits.length < 8) for (const c of cities) { if (!c.k.startsWith(v) && c.k.includes(v)) hits.push(c); if (hits.length >= 8) break; }
  if (!hits.length) { box.append(el('p', 'row', 'No city found. Use Drop Pin below.')); return; }
  for (const c of hits) {
    const r = el('div', 'row'), d = el('div', '', c[1]); d.append(el('small', '', [c[2], c[3]].filter(Boolean).join(', ')));
    const has = onMap(c[1], c[4], c[5]), b = el('button', 'act' + (has ? '' : ' go'), has ? 'On Your Map' : 'Add Pin'); b.disabled = has;
    b.onclick = async () => { if (await addPin(c[1], c[4], c[5], c[2] || c[3])) { commit(); $('q').value = ''; box.textContent = ''; } };
    r.append(d, b);
    if (!has) { const w = el('button', 'act', 'Want'); w.setAttribute('aria-label', 'Add ' + c[1] + ' to want to go'); w.onclick = async () => { if (await addPin(c[1], c[4], c[5], c[2] || c[3])) { const a = E.added[E.added.length - 1]; E.edits[a.name] = { ...(E.edits[a.name] || {}), status: 'want' }; commit(); $('q').value = ''; box.textContent = ''; } }; r.append(w); }
    box.append(r);
  }
}
function setTab(t) {
  tab = t; document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.t === t));
  for (const k of 'sipd') $(k).hidden = k !== t;
  if (t === 'p') renderPrivacy();
  if (t === 'd' && WM.renderPins) WM.renderPins();
}
async function renderPrivacy() {
  await loadCities(); const box = $('plist'), v = norm($('pq').value); box.textContent = '';
  $('hideAll').setAttribute('aria-checked', E.hideNew);
  const baseNames = new Set(WM.base.places.map(p => p.name));
  const all = [...WM.base.places, ...E.added.filter(p => !baseNames.has(p.name))];
  const show = all.filter(p => !v || norm(p.name).includes(v)).slice(0, 40);
  for (const p of show) {
    const on = !!E.hide[p.name], r = el('div', 'row'), d = el('div', '', p.name); d.append(el('small', '', 'Visitors see: ' + (on ? cityLabel(nearestCity(p.lat, p.lon)) : p.name)));
    const s = el('button', 'sw'); s.setAttribute('role', 'switch'); s.setAttribute('aria-checked', on); s.setAttribute('aria-label', 'Hide exact location of ' + p.name);
    s.onclick = () => { on ? delete E.hide[p.name] : E.hide[p.name] = true; commit(); };
    r.append(d, s); box.append(r);
  }
  if (all.length > show.length && !v) box.append(el('p', '', 'Showing the first 40. Search to find the rest.'));
}
async function unzipKml(buf) {
  const v = new DataView(buf); let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('This KMZ file looks damaged.');
  let o = v.getUint32(e + 16, true); const n = v.getUint16(e + 10, true);
  for (let i = 0; i < n; i++) {
    const method = v.getUint16(o + 10, true), size = v.getUint32(o + 20, true), nl = v.getUint16(o + 28, true), xl = v.getUint16(o + 30, true), cl = v.getUint16(o + 32, true), at = v.getUint32(o + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buf, o + 46, nl));
    if (name.toLowerCase().endsWith('.kml')) {
      const start = at + 30 + v.getUint16(at + 26, true) + v.getUint16(at + 28, true), data = new Uint8Array(buf, start, size);
      if (method === 0) return new TextDecoder().decode(data);
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open KMZ files. Export the map as KML.');
      return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }
    o += 46 + nl + xl + cl;
  }
  throw new Error('No map data was found in this file.');
}
const ADDR = /^\d+[\w-]*\s+.*\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|boulevard|way|hwy|highway|pl|place|cir|circle|ter|terrace|pkwy|parkway|trl|trail)\b/i;
const COORD = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
function parseKml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml'); if (doc.querySelector('parsererror')) throw new Error('This file could not be read as a map.');
  const out = [], seen = new Set();
  for (const pm of doc.getElementsByTagName('Placemark')) {
    const pt = pm.getElementsByTagName('Point')[0]; if (!pt) continue;
    const co = (pt.getElementsByTagName('coordinates')[0] || {}).textContent; if (!co) continue;
    const [lon, lat] = co.trim().split(',').map(Number); if (!isFinite(lat) || !isFinite(lon)) continue;
    const nm = pm.getElementsByTagName('name')[0], name = ((nm && nm.textContent) || '').trim() || 'Unnamed Place';
    const fp = pm.parentElement, fn = fp && fp.tagName === 'Folder' && fp.getElementsByTagName('name')[0];
    const k = norm(name); if (seen.has(k)) continue; seen.add(k);
    const short = name.split(',')[0].trim();
    out.push({ name, lat: +lat.toFixed(4), lon: +lon.toFixed(4), folder: fn ? fn.textContent.trim() : '', risky: ADDR.test(name) ? 'Looks like a street address. Left out unless you check it.' : COORD.test(name) ? 'Has coordinates but no name. Left out unless you check it.' : '', short });
  }
  return out;
}
async function importFile(file) {
  const box = $('imp'); box.textContent = ''; geo = geo || decode(WM.topo);
  let rows;
  try { rows = parseKml(/\.kml$/i.test(file.name) ? await file.text() : await unzipKml(await file.arrayBuffer())); }
  catch (err) { box.append(el('p', 'warn', err.message)); return; }
  if (!rows.length) { box.append(el('p', 'warn', 'No places with a location were found. Routes and lines are ignored.')); return; }
  const cn = new Map(geo.map(g => [norm(g.name), g.id])); ['united states', 'england', 'scotland', 'wales'].forEach((n, i) => cn.set(n, i ? '826' : '840'));
  for (const r of rows) { r.countryId = cn.get(norm(r.name)) || null; r.dup = r.countryId ? effective().visitedCountries.includes(r.countryId) : onMap(r.name, r.lat, r.lon); r.pick = !r.dup && !r.risky; }
  box.append(el('h3', '', `${file.name}: ${rows.length} Places Found`));
  const go = el('button', 'act go'); const cnt = () => { const n = rows.filter(r => r.pick).length; go.textContent = `Add ${n} ${n === 1 ? 'Place' : 'Places'}`; go.disabled = !n; };
  for (const r of rows) {
    const row = el('label', 'row' + (r.risky ? ' warn' : '')), d = el('div', '', r.name);
    d.append(el('small', '', r.risky || (r.dup ? 'Already on your map' : r.countryId ? 'Country: colors it, adds no pin' : r.folder ? 'Layer: ' + r.folder : 'New pin')));
    const c = el('input'); c.type = 'checkbox'; c.checked = r.pick; c.disabled = r.dup; c.setAttribute('aria-label', 'Add ' + r.name); c.onchange = () => { r.pick = c.checked; cnt(); };
    row.append(d, c); box.append(row);
  }
  cnt();
  go.onclick = async () => {
    let n = 0;
    for (const r of rows.filter(x => x.pick)) { if (r.countryId) { if (!E.countries.includes(r.countryId)) { E.countries.push(r.countryId); n++; } } else if (await addPin(r.risky ? r.name : r.short, r.lat, r.lon, r.risky ? '' : (r.name.split(',')[1] || '').trim())) n++; }
    commit(); box.textContent = ''; box.append(el('p', '', `Added ${n}. Routes and lines were ignored.`)); $('file').value = '';
  };
  const f = el('div', 'save'); f.append(el('span', '', 'Routes and lines are ignored.'), go); box.append(f);
}
function openPanel(v) { $('ed').hidden = !v; if (v) { loadCities(); if (tab === 's') $('q').focus(); } }
function startDrop() { $('statsOpen').hidden = true; dropMode = true; openPanel(false); $('addOpen').hidden = true; $('dropMsg').hidden = false; WM.setMode(true); }
function endDrop(reopen) { $('statsOpen').hidden = false; dropMode = false; $('dropMsg').hidden = true; $('addOpen').hidden = false; if (reopen) openPanel(true); }
function boot() {
  WM.locate = locate; WM.countryName = id => (geo.find(g => g.id === id) || {}).name || '';
  $('addOpen').addEventListener('click', () => { WM.closeStats && WM.closeStats(); });
  WM.closePanel = () => { if (dropMode) { endDrop(true); return true; } if (WM.closeStats && WM.closeStats()) return true; if (!$('ed').hidden) { openPanel(false); return true; } return false; };
  WM.onMapTap = (x, y) => {
    if (!dropMode) return false; if (!WM.isFlat() || !WM.isSettled()) return true;
    const [lon, lat] = WM.unproject(x, y); dropAt = { lat: +lat.toFixed(4), lon: +lon.toFixed(4) }; endDrop(true); setTab('s'); $('namef').hidden = false;
    loadCities().then(() => { const c = nearestCity(dropAt.lat, dropAt.lon); $('pinName').value = c ? c[1] : ''; $('pinName').focus(); $('pinName').select(); }); return true;
  };
  $('addOpen').onclick = () => openPanel($('ed').hidden); $('edClose').onclick = () => { openPanel(false); $('addOpen').focus(); };
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.t));
  $('q').oninput = renderResults; $('pq').oninput = renderPrivacy; $('drop').onclick = startDrop; $('dropX').onclick = () => endDrop(true);
  $('namef').onsubmit = async e => { e.preventDefault(); if (dropAt && await addPin($('pinName').value, dropAt.lat, dropAt.lon)) { dropAt = null; $('namef').hidden = true; commit(); } };
  $('file').onchange = e => { if (e.target.files[0]) importFile(e.target.files[0]); };
  $('hideAll').onclick = () => { E.hideNew = !E.hideNew; save(); $('hideAll').setAttribute('aria-checked', E.hideNew); };
  $('dl').onclick = async () => { await loadCities(); const a = el('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(effective(), null, 0)], { type: 'application/json' })); a.download = 'places.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  WM.ed = { E: () => E, commit, all: () => { const n = new Set(WM.base.places.map(p => p.name)); return [...WM.base.places, ...E.added.filter(p => !n.has(p.name))]; }, setTab };
  if (WM.readOnly) { E = { added: [], hide: {}, hideNew: false, countries: [], edits: {} }; window.__wmEffective = effective; return; }
  const hasHide = Object.keys(E.hide).length;
  (hasHide ? loadCities() : Promise.resolve()).then(() => { if (E.added.length || hasHide || E.countries.length || Object.keys(E.edits).length) WM.applyData(effective()); renderYours(); renderSaveNote(); });
  window.__wmEffective = effective;
}
window.WM ? boot() : addEventListener('wm-ready', boot, { once: true });
})();
