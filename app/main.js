'use strict';
const $ = id => document.getElementById(id);
const rad = d => d * Math.PI / 180, TAU = Math.PI * 2;
const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const mill = p => 1.25 * Math.log(Math.tan(Math.PI / 4 + .4 * Math.max(Math.min(p, 1.56), -1.56)));
const glc = $('gl'), bg = $('bg'), fg = $('fg'), bgx = bg.getContext('2d'), fx = fg.getContext('2d');
const gl = glc.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true });
const COUNTRIES = 195, MAP_TOP = 2.0, MAP_BOTTOM = -1.55, FLAT_MAX = 24, GLOBE_MAX = 2.5;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let W = 0, H = 0, dpr = 1, gx = 0, gy = 0, R = 0, S = 0, fcx = 0, fcy = 0;
let tr = 0, target = 0, e = 0, lam = rad(-45), tilt = rad(22), z = 1, tz = 1, ax = 0, ay = 0, px = 0, py = 0;
const lite = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 900 || /(^|[#&])lite=1/.test(location.hash);
let pins = [], u = {}, indexCount = 0, stars = null, ready = false;

const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function layout() {
  W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
  for (const c of [glc, bg, fg]) { c.width = W * dpr; c.height = H * dpr; }
  gl.viewport(0, 0, glc.width, glc.height);
  if (W >= H) { R = Math.min(H * .44, W * .3); gx = W * .34; gy = H / 2; }
  else { R = W * .44; gx = W / 2; gy = H * .36; }
  S = Math.min(W / TAU, H / (MAP_TOP - MAP_BOTTOM));
  fcx = W / 2; fcy = H / 2 + (MAP_TOP + MAP_BOTTOM) / 2 * S;
  makeStars(); clampPan();
}
function makeStars() {
  const c = document.createElement('canvas'); c.width = bg.width; c.height = bg.height;
  const x = c.getContext('2d'); x.fillStyle = '#04080f'; x.fillRect(0, 0, c.width, c.height);
  let s = 12345; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const n = Math.round(W * H / 3800);
  for (let i = 0; i < n; i++) {
    x.globalAlpha = .2 + rnd() * .7; x.fillStyle = '#fff';
    x.beginPath(); x.arc(rnd() * c.width, rnd() * c.height, (.4 + rnd() * rnd() * 1.1) * dpr, 0, TAU); x.fill();
  }
  stars = c;
}
function clampPan() {
  const mw = TAU * S * z;
  const mx = Math.max(0, (mw - W) / 2); px = Math.max(-mx, Math.min(mx, px));
  const hi = S * z * MAP_TOP - fcy, lo = H - fcy + S * z * MAP_BOTTOM;
  py = lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, py));
}
function zoomTo(nz, x, y) {
  const k = nz / z; px = x - fcx - (x - fcx - px) * k; py = y - fcy - (y - fcy - py) * k; z = nz; clampPan();
}
function setZoom(nz, x = W / 2, y = H / 2) {
  tz = Math.max(1, Math.min(target ? FLAT_MAX : GLOBE_MAX, nz)); ax = x; ay = y;
}
function project(lon, lat, my) {
  const l = lon - wrap(lam) * (1 - e), f = tilt * (1 - e), cp = Math.cos(lat), sp = Math.sin(lat), cl = Math.cos(l);
  const c = Math.sin(f) * sp + Math.cos(f) * cp * cl;
  const X = cp * Math.sin(l), Y = Math.cos(f) * sp - Math.sin(f) * cp * cl;
  const qx = gx + R * z * X, qy = gy - R * z * Y;
  const rx = fcx + px + S * z * lon, ry = fcy + py - S * z * my;
  return [qx + (rx - qx) * e, qy + (ry - qy) * e, c >= 0 || e > .5];
}

const VS = `#version 300 es
in vec2 a; uniform float e,lam,f0,R,S; uniform vec2 gc,fc,res; out vec2 uv; out vec2 n;
const float PI=3.14159265;
void main(){
  float l=a.x-lam,p=a.y,cp=cos(p),sp=sin(p),cl=cos(l);
  float c=sin(f0)*sp+cos(f0)*cp*cl;
  vec2 g=vec2(cp*sin(l),cos(f0)*sp-sin(f0)*cp*cl);
  vec2 q=gc+vec2(g.x,-g.y)*R;
  float pc=clamp(p,-1.56,1.56);
  vec2 r=fc+vec2(a.x,-1.25*log(tan(PI/4.+.4*pc)))*S;
  vec2 o=mix(q,r,e);
  gl_Position=vec4(o.x/res.x*2.-1.,1.-o.y/res.y*2.,-c*(1.-e)*.9,1.);
  uv=vec2((a.x+PI)/(2.*PI),(PI/2.-a.y)/PI); n=g;
}`;
const FS = `#version 300 es
precision highp float; in vec2 uv; in vec2 n; uniform sampler2D ter,msk; uniform float e,relief; out vec4 o;
void main(){
  float t=texture(ter,uv).r;
  vec3 m=texture(msk,uv).rgb;
  float k=clamp(1.+(t-.67)*4.6*relief,.34,1.32);
  vec3 sea=mix(vec3(.015,.05,.11),vec3(.06,.17,.29),smoothstep(.28,.44,t));
  vec3 land=vec3(.17,.25,.33)*k;
  vec3 gold=vec3(.86,.58,.21)*k;
  vec3 c=mix(sea,mix(land,gold,m.g),m.r);
  c=mix(c,mix(vec3(.5,.62,.74),vec3(1.,.93,.74),m.g),m.b*.55);
  vec3 N=vec3(n,sqrt(max(0.,1.-dot(n,n))));
  float d=max(dot(N,normalize(vec3(-.35,.45,.82))),0.);
  c*=mix(.5+.72*d,1.,e);
  o=vec4(c,1.);
}`;
function program() {
  const mk = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(h)); return h; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  gl.useProgram(p);
  for (const n of ['e', 'lam', 'f0', 'R', 'S', 'gc', 'fc', 'res', 'ter', 'msk', 'relief']) u[n] = gl.getUniformLocation(p, n);
}
function grid() {
  const NX = 360, NY = 180, v = new Float32Array((NX + 1) * (NY + 1) * 2), idx = new Uint16Array(NX * NY * 6);
  let i = 0;
  for (let y = 0; y <= NY; y++) for (let x = 0; x <= NX; x++) { v[i++] = -Math.PI + TAU * x / NX; v[i++] = Math.PI / 2 - Math.PI * y / NY; }
  i = 0;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const a = y * (NX + 1) + x, b = a + 1, c = a + NX + 1, d = c + 1; idx[i++] = a; idx[i++] = c; idx[i++] = b; idx[i++] = b; idx[i++] = c; idx[i++] = d; }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  indexCount = idx.length;
}
function texture(unit, src) {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const af = gl.getExtension('EXT_texture_filter_anisotropic');
  if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(af.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return t;
}
function countryMask(topo, visited, states, visitedStates) {
  const size = Math.min(lite ? 4096 : 8192, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const c = document.createElement('canvas'); c.width = size; c.height = size / 2;
  const x = c.getContext('2d', { willReadFrequently: true }), k = size / 360;
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map(a => { let X = 0, Y = 0; return a.map(([dx, dy]) => [(X += dx) * sx + tx, (Y += dy) * sy + ty]); });
  const ring = r => { const o = []; for (const i of r) { const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); o.push(...(o.length ? a.slice(1) : a)); } return o; };
  const trace = r => {
    const un = [r[0].slice()]; let off = 0;
    for (let i = 1; i < r.length; i++) { const d = r[i][0] - r[i - 1][0]; if (d > 180) off -= 360; else if (d < -180) off += 360; un.push([r[i][0] + off, r[i][1]]); }
    const polar = Math.abs(un[un.length - 1][0] - un[0][0]) > 180;
    if (polar) { const south = un.reduce((s, p) => s + p[1], 0) < 0 ? -90 : 90; un.push([un[un.length - 1][0], south], [un[0][0], south]); }
    const lo = un.map(p => p[0]), shifts = [0]; if (Math.max(...lo) > 180) shifts.push(-360); if (Math.min(...lo) < -180) shifts.push(360);
    for (const s of shifts) { un.forEach((p, i) => { const X = (p[0] + s + 180) * k, Y = (90 - p[1]) * k; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); }
  };
  const geo = topo.objects.countries.geometries.map(g => ({ id: g.id, rings: (g.type === 'MultiPolygon' ? g.arcs.flat() : g.arcs).map(ring) }));
  for (const v of [false, true]) { x.beginPath(); for (const g of geo) if ((visited.has(g.id) && !(states && g.id === '840')) === v) g.rings.forEach(trace); x.fillStyle = v ? 'rgb(255,255,0)' : 'rgb(255,0,0)'; x.fill(); }
  if (states) { x.beginPath(); for (const n of visitedStates) (states[n] || []).forEach(p => p.forEach(trace)); x.fillStyle = 'rgb(255,255,0)'; x.fill(); }
  x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgb(0,0,255)'; x.lineWidth = size / 4096;
  x.beginPath(); for (const g of geo) g.rings.forEach(trace); if (states) for (const n in states) states[n].forEach(p => p.forEach(trace)); x.stroke();
  return c;
}

function drawBg() {
  bgx.setTransform(1, 0, 0, 1, 0, 0); bgx.globalAlpha = 1;
  if (e >= 1) { bgx.fillStyle = '#04080f'; bgx.fillRect(0, 0, bg.width, bg.height); return; }
  bgx.drawImage(stars, 0, 0);
  bgx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = R * z, g = bgx.createRadialGradient(gx, gy, r * .92, gx, gy, r * 1.14);
  g.addColorStop(0, `rgba(110,178,232,${.5 * (1 - e)})`); g.addColorStop(1, 'rgba(110,178,232,0)');
  bgx.fillStyle = g; bgx.fillRect(0, 0, W, H);
}
function drawPins() {
  fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, W, H);
  const base = Math.max(2.2, Math.min(W, H) * .0032), labels = [], showNames = e >= 1 && z >= 3;
  const fs = Math.max(13, Math.min(W, H) * .016);
  for (const p of pins) {
    const [x, y, v] = project(p.lon, p.lat, p.my); p.x = x; p.y = y; p.v = v;
    if (!v || x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    fx.globalAlpha = .28; fx.fillStyle = '#ffd98a'; fx.beginPath(); fx.arc(x, y, base * 3, 0, TAU); fx.fill();
    fx.globalAlpha = 1; fx.fillStyle = '#fff6dc'; fx.beginPath(); fx.arc(x, y, base, 0, TAU); fx.fill();
    if (showNames) labels.push(p);
  }
  if (!labels.length) return;
  fx.font = `600 ${fs}px -apple-system,Arial,sans-serif`; fx.textBaseline = 'middle'; fx.lineJoin = 'round';
  const used = [];
  for (const p of labels) {
    const w = fx.measureText(p.name).width, b = [p.x + base * 2.4, p.y - fs * .7, w + 4, fs * 1.4];
    if (used.some(a => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3])) continue;
    used.push(b); fx.lineWidth = fs * .28; fx.strokeStyle = '#04080f'; fx.strokeText(p.name, b[0], p.y); fx.fillStyle = '#fff'; fx.fillText(p.name, b[0], p.y);
  }
}
let last = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
  if (tr !== target) { tr = target > tr ? Math.min(target, tr + dt / 1.2) : Math.max(target, tr - dt / 1.2); }
  e = ease(tr);
  if (Math.abs(tz - z) > .0005) zoomTo(z + (tz - z) * (1 - Math.exp(-dt * 11)), ax, ay);
  if (tr === 0 && target === 0 && !drag && !reduced && spin) lam -= dt * rad(4.5);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniform1f(u.e, e); gl.uniform1f(u.lam, wrap(lam) * (1 - e)); gl.uniform1f(u.f0, tilt * (1 - e));
  gl.uniform1f(u.R, R * z); gl.uniform1f(u.S, S * z); gl.uniform2f(u.gc, gx, gy); gl.uniform2f(u.fc, fcx + px, fcy + py); gl.uniform2f(u.res, W, H);
  const fade = Math.max(0, Math.min(1, (z - 6) / 14)); gl.uniform1f(u.relief, 1 - fade * .75);
  gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
  drawBg(); drawPins();
  requestAnimationFrame(frame);
}
function setMode(flat) {
  target = flat ? 1 : 0; document.body.classList.toggle('flat', flat); $('back').hidden = !flat; hideTip();
  tz = 1; ax = W / 2; ay = H / 2;
}
const tip = $('tip');
function hideTip() { tip.hidden = true; }
function nearest(x, y, r) { let b = null, d = r * r; for (const p of pins) { if (!p.v) continue; const q = (p.x - x) ** 2 + (p.y - y) ** 2; if (q < d) { d = q; b = p; } } return b; }
function showTip(p) { tip.textContent = p.name; if (p.note) { const s = document.createElement('small'); s.textContent = p.note; tip.append(s); } tip.style.left = p.x + 'px'; tip.style.top = p.y + 'px'; tip.hidden = false; }

const ptrs = new Map(); let drag = null, spin = true, pinch = 0, lastTap = 0;
glc.addEventListener('pointerdown', ev => {
  glc.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
  drag = { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, moved: false }; pinch = 0;
});
glc.addEventListener('pointermove', ev => {
  if (!ptrs.has(ev.pointerId)) { if (ev.pointerType === 'mouse' && target && e >= 1) { const p = nearest(ev.clientX, ev.clientY, 16); p ? showTip(p) : hideTip(); } return; }
  ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (pinch) { const nz = Math.max(1, Math.min(target ? FLAT_MAX : GLOBE_MAX, z * d / pinch)); zoomTo(nz, mx, my); tz = nz; }
    pinch = d; if (drag) drag.moved = true; return;
  }
  if (!drag) return;
  const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY;
  if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 6) drag.moved = true;
  if (!drag.moved) return;
  if (target) { px += dx; py += dy; clampPan(); }
  else { lam -= dx / (R * z); tilt = Math.max(rad(-80), Math.min(rad(80), tilt + dy / (R * z))); }
});
const endPtr = ev => {
  ptrs.delete(ev.pointerId);
  if (ptrs.size) { pinch = 0; return; }
  const d = drag; drag = null;
  if (!d || d.moved || ev.type === 'pointercancel') return;
  if (window.WM && WM.onMapTap && WM.onMapTap(ev.clientX, ev.clientY)) return;
  if (!target) { setMode(true); return; }
  if (tr < 1) return;
  const now = performance.now();
  if (now - lastTap < 320) { setZoom(tz * 2, ev.clientX, ev.clientY); lastTap = 0; return; }
  lastTap = now;
  const p = nearest(ev.clientX, ev.clientY, ev.pointerType === 'touch' ? 26 : 16); p ? showTip(p) : hideTip();
};
glc.addEventListener('pointerup', endPtr); glc.addEventListener('pointercancel', endPtr);
glc.addEventListener('wheel', ev => { ev.preventDefault(); setZoom(tz * Math.exp(-ev.deltaY * .0022), ev.clientX, ev.clientY); hideTip(); }, { passive: false });
$('zin').onclick = () => setZoom(tz * 1.8); $('zout').onclick = () => setZoom(tz / 1.8); $('back').onclick = () => setMode(false);
if (!document.fullscreenEnabled) $('fs').hidden = true;
$('fs').onclick = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };
addEventListener('keydown', ev => {
  const k = ev.key, step = 60;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
  if (k === 'Escape' && window.WM && WM.closePanel && WM.closePanel()) return;
  if (ev.target.tagName === 'BUTTON' && (k === 'Enter' || k === ' ')) return;
  if (k === 'Enter' || k === ' ') { ev.preventDefault(); setMode(!target); }
  else if (k === 'Escape') setMode(false);
  else if (k === '+' || k === '=') setZoom(tz * 1.8);
  else if (k === '-' || k === '_') setZoom(tz / 1.8);
  else if (k.startsWith('Arrow')) {
    ev.preventDefault(); const dx = k === 'ArrowLeft' ? step : k === 'ArrowRight' ? -step : 0, dy = k === 'ArrowUp' ? step : k === 'ArrowDown' ? -step : 0;
    if (target) { px += dx; py += dy; clampPan(); } else { lam -= dx / (R * z); tilt = Math.max(rad(-80), Math.min(rad(80), tilt + dy / (R * z))); }
  } else if (k === 'f') $('fs').click();
});
addEventListener('resize', () => { layout(); });

async function start() {
  const t0 = performance.now();
  if (!gl) { $('load').textContent = 'This Browser Needs WebGL 2 to Show the Globe'; return; }
  const img = new Image(); img.src = lite ? 'assets/terrain-4k.jpg' : 'assets/terrain-8k.jpg';
  const [topo, data, states] = await Promise.all([fetch('assets/countries-50m.json').then(r => r.json()), fetch('data/places.json', { cache: 'no-cache' }).then(r => r.json()), fetch('assets/us-states.json?v=1').then(r => r.json()), img.decode()]);
  const T = {}, mark = n => { T[n] = Math.round(performance.now() - t0); }; mark('fetched');
  program(); grid(); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  texture(0, img); mark('terrainUpload');
  mark('maskDrawn'); window.__times = T;
  gl.uniform1i(u.ter, 0); gl.uniform1i(u.msk, 1);
  let maskTex = null;
  const applyData = d => {
    if (maskTex) gl.deleteTexture(maskTex);
    maskTex = texture(1, countryMask(topo, new Set(d.visitedCountries), d.visitedStates ? states : null, d.visitedStates || []));
    pins = d.places.map(p => { const lat = rad(p.lat); return { ...p, lon: rad(p.lon), lat, my: mill(lat) }; });
    const nC = d.visitedCountries.length, nS = (d.visitedStates || []).filter(n => n !== 'District of Columbia').length;
    $('nC').textContent = nC; $('lC').textContent = `Countries, ${Math.max(0, COUNTRIES - nC)} to Go`; $('nS').textContent = nS; $('lS').textContent = `States, ${50 - nS} to Go`; $('nP').textContent = pins.length;
  };
  window.WM = {
    topo, states, base: data, applyData, setMode, isFlat: () => target === 1, isSettled: () => tr === target,
    unproject(x, y) { const lon = (x - fcx - px) / (S * z), m = (fcy + py - y) / (S * z); return [lon * 180 / Math.PI, (Math.atan(Math.exp(m / 1.25)) - Math.PI / 4) / .4 * 180 / Math.PI]; }
  };
  applyData(data);
  window.dispatchEvent(new Event('wm-ready'));
  layout();
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has('spin')) spin = h.get('spin') !== '0';
  if (h.has('lam')) lam = rad(+h.get('lam'));
  if (h.get('flat') === '1') { setMode(true); tr = target = 1; e = 1; }
  if (h.has('z')) { z = tz = +h.get('z'); if (h.has('at')) { const [lo, la] = h.get('at').split(',').map(Number); px = -S * z * rad(lo); py = H / 2 - fcy + S * z * mill(rad(la)); clampPan(); } }
  window.__worldMap = () => ({ tr, e, z, px, py, target, pins: pins.length, onScreen: pins.filter(p => p.v && p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H).length });
  ready = true; window.__loadMs = Math.round(performance.now() - t0); $('load').classList.add('done'); requestAnimationFrame(frame);
}
start().catch(err => { console.error(err); $('load').textContent = 'The Map Could Not Load: ' + err.message; });
