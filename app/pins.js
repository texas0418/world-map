'use strict';
(() => {
const $ = id => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CATS = { Work: '#6fc8f0', 'Film Shoot': '#ff8fb1', 'Road Trip': '#ffa45c', Food: '#ffe066', Family: '#9be38b', Other: '#c9b6ff' };
let dbp = null, current = null, viewing = null, withPhotos = new Set();
const db = () => dbp = dbp || new Promise((res, rej) => { const q = indexedDB.open('wm-photos', 1); q.onupgradeneeded = () => q.result.createObjectStore('p', { keyPath: 'id', autoIncrement: true }).createIndex('pin', 'pin'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
const store = async m => (await db()).transaction('p', m).objectStore('p');
const wait = r => new Promise((a, b) => { r.onsuccess = () => a(r.result); r.onerror = () => b(r.error); });
const photosOf = async pin => wait((await store('readonly')).index('pin').getAll(pin));
async function shrink(file) {
  const b = await createImageBitmap(file), k = Math.min(1, 2400 / Math.max(b.width, b.height)), c = document.createElement('canvas'); c.width = Math.round(b.width * k); c.height = Math.round(b.height * k);
  c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); b.close && b.close();
  return new Promise(r => c.toBlob(r, 'image/jpeg', .86));
}
function renderList() {
  const box = $('dlist'), v = norm($('dq').value.trim()); box.textContent = '';
  const all = WM.ed.all(), show = all.filter(p => !v || norm(p.name).includes(v)).slice(0, 40), E = WM.ed.E();
  for (const p of show) {
    const q = { ...p, ...(E.edits[p.name] || {}) }, r = el('div', 'row'), d = el('div', '', p.name);
    d.append(el('small', '', [q.status === 'want' ? 'Want to Go' : '', q.date, q.category, q.trip, q.note, withPhotos.has(p.name) ? 'Photos' : ''].filter(Boolean).join(' · ') || 'No details yet'));
    const b = el('button', 'act', 'Edit'); b.setAttribute('aria-label', 'Edit ' + p.name); b.onclick = () => openForm(p.name); r.append(d, b); box.append(r);
  }
  if (all.length > show.length && !v) box.append(el('p', '', 'Showing the first 40. Search to find the rest.'));
}
async function renderThumbs() {
  const t = $('thumbs'); t.textContent = ''; if (!current) return;
  for (const ph of await photosOf(current)) { const i = el('img'); i.src = URL.createObjectURL(ph.blob); i.alt = current; t.append(i); }
}
function openForm(name) {
  current = name; const p = WM.ed.all().find(x => x.name === name) || {}, q = { ...p, ...(WM.ed.E().edits[name] || {}) };
  $('pinfH').textContent = name; $('fNote').value = q.note || ''; $('fCat').value = q.category || ''; $('fDate').value = q.date || ''; $('fTrip').value = q.trip || ''; $('fWant').checked = q.status === 'want'; $('fPh').value = '';
  $('pinf').hidden = false; $('dlist').hidden = true; $('dq').hidden = true; renderThumbs();
}
function closeForm() { current = null; $('pinf').hidden = true; $('dlist').hidden = false; $('dq').hidden = false; renderList(); }
async function viewer(pin, i) {
  const ph = await photosOf(pin); if (!ph.length) return; viewing = { ph, i: (i + ph.length) % ph.length, pin };
  const v = viewing.ph[viewing.i]; if ($('lbImg').src.startsWith('blob:')) URL.revokeObjectURL($('lbImg').src); $('lbImg').src = URL.createObjectURL(v.blob); $('lbImg').alt = 'Photo from ' + pin; $('lbName').textContent = `${pin}, ${viewing.i + 1} of ${ph.length}`; $('lb').hidden = false;
}
function boot() {
  WM.view.cats = CATS; WM.CATS = CATS; WM.renderPins = () => { if (!current) renderList(); };
  const f = $('fCat'); f.append(new Option('None', '')); Object.keys(CATS).forEach(c => f.append(new Option(c, c)));
  $('dq').oninput = renderList; $('fCancel').onclick = closeForm;
  $('pinf').onsubmit = e => {
    e.preventDefault(); const E = WM.ed.E(), d = $('fDate').value.trim();
    if (d && !/^\d{4}(-(0[1-9]|1[0-2]))?$/.test(d)) { $('fDate').focus(); $('fDate').setCustomValidity('Use a year, or year and month, such as 2024-06'); $('fDate').reportValidity(); return; }
    E.edits[current] = { note: $('fNote').value.trim(), category: $('fCat').value, date: d, trip: $('fTrip').value.trim(), status: $('fWant').checked ? 'want' : '' };
    WM.ed.commit(); closeForm();
  };
  $('fDate').oninput = e => e.target.setCustomValidity('');
  $('fPh').onchange = async e => { const pin = current; for (const file of e.target.files) { try { const blob = await shrink(file); await wait((await store('readwrite')).add({ pin, blob })); withPhotos.add(pin); } catch (err) { console.error(err); } } e.target.value = ''; renderThumbs(); };
  WM.onPinTap = p => { if (withPhotos.has(p.name)) viewer(p.name, 0); };
  $('lbClose').onclick = () => $('lb').hidden = true; $('lbNext').onclick = () => viewer(viewing.pin, viewing.i + 1); $('lbPrev').onclick = () => viewer(viewing.pin, viewing.i - 1);
  addEventListener('keydown', e => { if ($('lb').hidden) return; if (e.key === 'ArrowRight') $('lbNext').click(); else if (e.key === 'ArrowLeft') $('lbPrev').click(); e.stopImmediatePropagation(); if (e.key === 'Escape') $('lb').hidden = true; }, true);
  if (!WM.readOnly) db().then(async () => { for (const r of await wait((await store('readonly')).getAll())) withPhotos.add(r.pin); }).catch(() => {});
}
window.WM && WM.ed ? boot() : addEventListener('wm-ready', () => setTimeout(boot), { once: true });
})();
