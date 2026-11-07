(() => {
'use strict';
const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const STATUSES = [
  { key: 'visited', label: 'Gittim', emoji: '✅', def: '#10b981', palette: ['#10b981', '#22c55e', '#14b8a6', '#06b6d4', '#84cc16', '#0ea5e9', '#16a34a', '#65a30d'] },
  { key: 'memory', label: 'Anım var', emoji: '💜', def: '#8b5cf6', palette: ['#8b5cf6', '#ec4899', '#f43f5e', '#a855f7', '#d946ef', '#e11d48', '#6366f1', '#c026d3'] },
  { key: 'wish', label: 'Gitmek istiyorum', emoji: '⭐', def: '#f59e0b', palette: ['#f59e0b', '#f97316', '#eab308', '#ef4444', '#fb923c', '#facc15', '#3b82f6', '#d97706'] }
];
const SMAP = Object.fromEntries(STATUSES.map(s => [s.key, s]));
const DATA = window.AZ_RAYONS;
const byId = Object.fromEntries(DATA.map(r => [r.id, r]));

// ---------- state ----------
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let marks = load('azmap.marks', {});
let colors = Object.assign(Object.fromEntries(STATUSES.map(s => [s.key, s.def])), load('azmap.colors', {}));
let filter = 'all', query = '', selected = null, modalId = null, modalStatus = null;
const col = k => colors[k];

// ---------- projection & paths ----------
const COS = Math.cos(40.3 * Math.PI / 180), K = 1000;
let minLon = 180, maxLat = -90, minLat = 90, maxLon = -180;
const walk = (c, f) => typeof c[0] === 'number' ? f(c) : c.forEach(x => walk(x, f));
DATA.forEach(r => walk(r.g.c, p => { minLon = Math.min(minLon, p[0]); maxLon = Math.max(maxLon, p[0]); minLat = Math.min(minLat, p[1]); maxLat = Math.max(maxLat, p[1]); }));
const px = p => ((p[0] - minLon) * COS * K), py = p => ((maxLat - p[1]) * K);
const BW = (maxLon - minLon) * COS * K, BH = (maxLat - minLat) * K;
const ring = r => 'M' + r.map(p => px(p).toFixed(1) + ' ' + py(p).toFixed(1)).join('L') + 'Z';
DATA.forEach(r => {
  const polys = r.g.t === 'Polygon' ? [r.g.c] : r.g.c;
  r.d = polys.map(po => po.map(ring).join('')).join('');
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  polys.forEach(po => po[0].forEach(p => { x0 = Math.min(x0, px(p)); x1 = Math.max(x1, px(p)); y0 = Math.min(y0, py(p)); y1 = Math.max(y1, py(p)); }));
  r.bb = [x0, y0, x1, y1];
  let best = 0; r.cent = [(x0 + x1) / 2, (y0 + y1) / 2];
  polys.forEach(po => { const rg = po[0]; let s = 0, cx = 0, cy = 0;
    for (let i = 0; i < rg.length; i++) { const A = rg[i], B = rg[(i + 1) % rg.length], f = px(A) * py(B) - px(B) * py(A); s += f; cx += (px(A) + px(B)) * f; cy += (py(A) + py(B)) * f; }
    s /= 2; if (s && Math.abs(s) > best) { best = Math.abs(s); r.cent = [cx / (6 * s), cy / (6 * s)]; } });
});

// ---------- map render ----------
const svg = $('#map'), wrap = $('#mapWrap');
const g = document.createElementNS(NS, 'g'); svg.appendChild(g);
DATA.forEach(r => {
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', r.d); p.dataset.id = r.id; r.el = p; g.appendChild(p);
});
const lg = document.createElementNS(NS, 'g'); lg.setAttribute('class', 'labels'); svg.appendChild(lg);
DATA.forEach(r => { const t = document.createElementNS(NS, 'text'); t.textContent = r.name; t.setAttribute('x', r.cent[0].toFixed(1)); t.setAttribute('y', r.cent[1].toFixed(1)); t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle'); t.classList.toggle('city', r.type === 'Şəhər'); r.lb = t; lg.appendChild(t); });
function updateLabels() {
  const sc = (svg.clientWidth || 800) / view.w;
  DATA.forEach(r => { const city = r.type === 'Şəhər';
    r.lb.style.display = '';
    r.lb.setAttribute('font-size', ((city ? 11 : 8.5) / sc).toFixed(1)); r.lb.setAttribute('stroke-width', (3.5 / sc).toFixed(2)); });
}
let view = { cx: BW / 2, cy: BH / 2, w: BW };
function fit() {
  const W = svg.clientWidth || 800, H = svg.clientHeight || 600;
  view = { cx: BW / 2, cy: BH / 2, w: Math.max(BW * 1.06, BH * 1.06 * W / H) };
  applyView();
}
function applyView() {
  const W = svg.clientWidth || 800, H = svg.clientHeight || 600, h = view.w * H / W;
  svg.setAttribute('viewBox', `${view.cx - view.w / 2} ${view.cy - h / 2} ${view.w} ${h}`);
  updateLabels();
}
function zoomAt(f, sx, sy) {
  const r = svg.getBoundingClientRect(), W = r.width, H = r.height, h = view.w * H / W;
  sx = sx ?? W / 2; sy = sy ?? H / 2;
  const ux = view.cx - view.w / 2 + sx / W * view.w, uy = view.cy - h / 2 + sy / H * h;
  const nw = Math.min(Math.max(view.w / f, BW * 0.05), BW * 1.6), k = nw / view.w;
  view = { w: nw, cx: ux - (ux - view.cx) * k, cy: uy - (uy - view.cy) * k };
  applyView();
}
function focusOn(r) {
  const [x0, y0, x1, y1] = r.bb, W = svg.clientWidth, H = svg.clientHeight;
  const w = Math.max((x1 - x0) * 3.2, 450), hNeed = (y1 - y0) * 3.2;
  view = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(w, hNeed * W / H) };
  applyView();
}

// pan / pinch
const ptrs = new Map(); let moved = 0, pinch0 = 0;
svg.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 1) moved = 0; if (ptrs.size === 2) pinch0 = dist(); });
const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
window.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const prev = ptrs.get(e.pointerId), dx = e.clientX - prev[0], dy = e.clientY - prev[1];
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 1) {
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 6) { const r = svg.getBoundingClientRect(); view.cx -= dx / r.width * view.w; view.cy -= dy / r.width * view.w; applyView(); }
  } else if (ptrs.size === 2) {
    moved = 99; const d = dist(), pts = [...ptrs.values()], r = svg.getBoundingClientRect();
    zoomAt(d / pinch0, (pts[0][0] + pts[1][0]) / 2 - r.left, (pts[0][1] + pts[1][1]) / 2 - r.top); pinch0 = d;
  }
});
['pointerup', 'pointercancel'].forEach(t => window.addEventListener(t, e => ptrs.delete(e.pointerId)));
svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
$('#zIn').onclick = () => zoomAt(1.4); $('#zOut').onclick = () => zoomAt(1 / 1.4); $('#zReset').onclick = fit;
window.addEventListener('resize', applyView);

// click / double click (works for mouse and touch)
let lastTap = { id: null, t: 0 };
svg.addEventListener('click', e => {
  if (moved > 6) return;
  const id = e.target.dataset && e.target.dataset.id;
  if (!id) { select(null); return; }
  const now = Date.now(), dbl = lastTap.id === id && now - lastTap.t < 380;
  lastTap = { id, t: now };
  select(id); if (dbl) openModal(id);
});
const tip = $('#tip');
svg.addEventListener('pointermove', e => {
  const id = e.target.dataset && e.target.dataset.id;
  if (!id || e.pointerType === 'touch') { tip.hidden = true; return; }
  const r = wrap.getBoundingClientRect(), d = byId[id], s = marks[id] && SMAP[marks[id].s];
  tip.textContent = d.name + (s ? ' · ' + s.label : ''); tip.hidden = false;
  tip.style.left = e.clientX - r.left + 'px'; tip.style.top = e.clientY - r.top + 'px';
});
svg.addEventListener('pointerleave', () => tip.hidden = true);

// ---------- selection & marks ----------
function select(id, zoom) {
  selected = id;
  if (id && zoom) focusOn(byId[id]);
  paint(); renderList();
}
function setMark(id, s, note) {
  if (!s && !note) delete marks[id]; else marks[id] = { s, n: note || '', t: Date.now() };
  if (marks[id] && !marks[id].s) delete marks[id];
  save('azmap.marks', marks); paint(); renderList(); renderStats();
}
function paint() {
  const q = norm(query);
  DATA.forEach(r => {
    const m = marks[r.id], el = r.el;
    el.style.fill = m ? col(m.s) : '';
    const okF = filter === 'all' || (filter === 'none' ? !m : m && m.s === filter);
    const okQ = !q || norm(r.name).includes(q);
    el.classList.toggle('dim', !(okF && okQ));
    el.classList.toggle('sel', r.id === selected);
  });
  if (selected) g.appendChild(byId[selected].el);
  updateLabels();
  const card = $('#selCard'); card.hidden = !selected;
  if (selected) {
    const r = byId[selected], m = marks[selected];
    $('#selName').textContent = r.name;
    $('#selStatus').textContent = m ? SMAP[m.s].emoji + ' ' + SMAP[m.s].label : r.type + ' · işaretlenmedi';
  }
}
$('#selEdit').onclick = () => selected && openModal(selected);
$('#selClear').onclick = () => { if (selected) { const n = byId[selected].name; setMark(selected, null); toast(n + ' temizlendi'); } };

// ---------- list / filters ----------
const norm = s => s.toLocaleLowerCase('az').replace(/[əǝ]/g, 'e').replace(/[ıi̇]/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u').trim();
function renderFilters() {
  const items = [{ key: 'all', label: 'Tümü' }, ...STATUSES, { key: 'none', label: 'İşaretsiz' }];
  $('#filters').innerHTML = items.map(i => `<button class="chip ${filter === i.key ? 'on' : ''}" data-f="${i.key}">${i.key in SMAP ? `<span class="dot" style="background:${col(i.key)}"></span>` : ''}${i.label}</button>`).join('');
}
$('#filters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; renderFilters(); paint(); renderList(); } });
$('#search').addEventListener('input', e => { query = e.target.value; paint(); renderList(); });
function renderList() {
  const q = norm(query);
  const rows = DATA.filter(r => (!q || norm(r.name).includes(q)) && (filter === 'all' || (filter === 'none' ? !marks[r.id] : marks[r.id] && marks[r.id].s === filter)))
    .sort((a, b) => a.name.localeCompare(b.name, 'az'));
  const L = $('#list'), st = L.scrollTop;
  L.innerHTML = rows.map(r => { const m = marks[r.id];
    return `<li data-id="${r.id}" class="${r.id === selected ? 'sel' : ''}"><span class="dot" style="background:${m ? col(m.s) : ''}"></span>${r.name}<small>${m ? SMAP[m.s].label : r.type}</small></li>`; }).join('') || '<li class="muted">Sonuç yok</li>';
  L.scrollTop = st;
}
$('#list').addEventListener('click', e => {
  const li = e.target.closest('li[data-id]'); if (!li) return;
  const id = li.dataset.id, now = Date.now(), dbl = lastTap.id === id && now - lastTap.t < 380;
  lastTap = { id, t: now }; select(id, true); if (dbl) openModal(id);
});

// ---------- stats ----------
function renderStats() {
  const total = DATA.length, cnt = Object.fromEntries(STATUSES.map(s => [s.key, 0]));
  Object.values(marks).forEach(m => cnt[m.s]++);
  const marked = Object.keys(marks).length, pct = Math.round(cnt.visited / total * 100);
  $('#ringPct').textContent = pct + '%'; $('#ringSub').textContent = `${cnt.visited} / ${total} gidildi`;
  const fg = $('#ringFg'); fg.style.strokeDashoffset = 326.7 * (1 - cnt.visited / total); fg.style.stroke = col('visited');
  $('#statGrid').innerHTML = STATUSES.map(s => `<div class="stat" style="--c:${col(s.key)}"><b>${cnt[s.key]}</b><span>${s.label}</span></div>`).join('') +
    `<div class="stat" style="--c:var(--landline)"><b>${total - marked}</b><span>İşaretsiz</span></div>`;
  const rec = Object.entries(marks).sort((a, b) => b[1].t - a[1].t).slice(0, 6);
  $('#recent').innerHTML = rec.map(([id, m]) => `<li data-id="${id}"><span class="dot" style="background:${col(m.s)}"></span>${byId[id].name}<small>${SMAP[m.s].label}</small></li>`).join('') || '<li class="muted">Henüz işaret yok</li>';
  $('#subtitle').textContent = `${cnt.visited} gidildi · ${cnt.wish} hedef · ${total} bölge`;
}
$('#recent').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (li) select(li.dataset.id, true); });

// ---------- settings ----------
function renderColors() {
  $('#colorSettings').innerHTML = STATUSES.map(s => `<div class="color-row"><strong><span class="dot" style="background:${col(s.key)}"></span> ${s.label}</strong>
    <div class="swatches">${s.palette.map(c => `<button class="sw ${c === col(s.key) ? 'on' : ''}" style="background:${c}" data-k="${s.key}" data-c="${c}" aria-label="${c}"></button>`).join('')}
    <input type="color" value="${col(s.key)}" data-k="${s.key}" aria-label="Özel renk"></div></div>`).join('');
}
function setColor(k, c) { colors[k] = c; save('azmap.colors', colors); paint(); renderFilters(); renderList(); renderStats(); }
$('#colorSettings').addEventListener('click', e => { const b = e.target.closest('.sw'); if (b) { setColor(b.dataset.k, b.dataset.c); renderColors(); } });
$('#colorSettings').addEventListener('input', e => { if (e.target.type === 'color') setColor(e.target.dataset.k, e.target.value); });
$('#colorSettings').addEventListener('change', renderColors);
$('#btnReset').onclick = () => { if (confirm('Tüm işaretler silinecek. Emin misin?')) { marks = {}; save('azmap.marks', marks); selected = null; paint(); renderList(); renderStats(); toast('Tüm işaretler sıfırlandı'); } };
$('#btnExport').onclick = () => download(new Blob([JSON.stringify({ marks, colors }, null, 1)], { type: 'application/json' }), 'azerbaycan-haritam.json');
$('#fileImport').onchange = async e => {
  try { const d = JSON.parse(await e.target.files[0].text()); marks = d.marks || {}; colors = Object.assign(colors, d.colors || {});
    save('azmap.marks', marks); save('azmap.colors', colors); renderAll(); toast('İçe aktarıldı'); } catch { toast('Geçersiz dosya'); }
};

// ---------- modal ----------
function openModal(id) {
  modalId = id; const r = byId[id], m = marks[id]; modalStatus = m ? m.s : null;
  $('#mTitle').textContent = r.name; $('#mType').textContent = r.type; $('#mNote').value = m ? m.n : '';
  drawOpts(); $('#modal').hidden = false;
}
function drawOpts() {
  $('#mOpts').innerHTML = STATUSES.map(s => `<button class="opt ${modalStatus === s.key ? 'on' : ''}" style="--c:${col(s.key)}" data-s="${s.key}"><span class="dot" style="background:${col(s.key)}"></span>${s.emoji} ${s.label}</button>`).join('');
}
$('#mOpts').addEventListener('click', e => { const b = e.target.closest('.opt'); if (b) { modalStatus = modalStatus === b.dataset.s ? null : b.dataset.s; drawOpts(); } });
const closeModal = () => $('#modal').hidden = true;
$('#mClose').onclick = closeModal; $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
$('#mSave').onclick = () => { setMark(modalId, modalStatus, $('#mNote').value.trim()); closeModal(); toast(byId[modalId].name + ' kaydedildi'); };
$('#mClear').onclick = () => { setMark(modalId, null); closeModal(); };
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ---------- PNG export ----------
function exportPng() {
  const css = getComputedStyle(document.documentElement), land = css.getPropertyValue('--land').trim(), line = css.getPropertyValue('--landline').trim(), sea = css.getPropertyValue('--sea').trim(), ink = css.getPropertyValue('--ink').trim();
  const pad = 160, top = 330, bot = 330, vw = BW + pad * 2, vh = BH + top + bot;
  let body = `<rect x="0" y="0" width="${vw}" height="${vh}" fill="${sea}"/>`;
  DATA.forEach(r => { const m = marks[r.id]; body += `<path transform="translate(${pad} ${top})" d="${r.d}" fill="${m ? col(m.s) : land}" stroke="${line}" stroke-width="3" fill-rule="evenodd"/>`; });
  DATA.filter(r => r.type === 'Şəhər').forEach(r => { body += `<text x="${pad + r.cent[0]}" y="${top + r.cent[1]}" font-size="54" font-weight="700" text-anchor="middle" fill="${ink}" stroke="${sea}" stroke-width="12" paint-order="stroke" font-family="Arial,sans-serif">${r.name}</text>`; });
  const cnt = Object.fromEntries(STATUSES.map(s => [s.key, 0])); Object.values(marks).forEach(m => cnt[m.s]++);
  body += `<text x="${pad}" y="170" font-size="130" font-weight="800" fill="${ink}" font-family="Arial,sans-serif">Azerbaycan Haritam</text>`;
  body += `<text x="${pad}" y="260" font-size="70" fill="${ink}" opacity=".6" font-family="Arial,sans-serif">${cnt.visited} / ${DATA.length} bölge gidildi</text>`;
  STATUSES.forEach((s, i) => { const x = pad + i * 1500, y = vh - 150;
    body += `<rect x="${x}" y="${y - 60}" width="70" height="70" rx="18" fill="${col(s.key)}"/><text x="${x + 100}" y="${y}" font-size="68" fill="${ink}" font-family="Arial,sans-serif">${s.label} (${cnt[s.key]})</text>`; });
  body += `<text x="${vw - pad}" y="${vh - 40}" font-size="42" text-anchor="end" fill="${ink}" opacity=".45" font-family="Arial,sans-serif">Sınır verisi: GADM v1.0</text>`;
  const xml = `<svg xmlns="${NS}" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}">${body}</svg>`;
  const img = new Image(), W = 2000, H = Math.round(W * vh / vw);
  img.onload = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, 0, 0, W, H);
    c.toBlob(b => { const u = URL.createObjectURL(b); $('#pImg').src = u; $('#pDl').href = u; $('#pngModal').hidden = false; }, 'image/png'); };
  img.onerror = () => toast('PNG oluşturulamadı');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
}
$('#btnPng').onclick = exportPng;
$('#pClose').onclick = () => $('#pngModal').hidden = true;
$('#pngModal').addEventListener('click', e => { if (e.target.id === 'pngModal') e.target.hidden = true; });
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

// ---------- misc ----------
let tt; function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => el.hidden = true, 1800); }
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tab,.pane').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); $('#pane-' + b.dataset.tab).classList.add('active');
});
const setTheme = t => { document.documentElement.dataset.theme = t; save('azmap.theme', t); };
setTheme(load('azmap.theme', 'light'));
$('#btnTheme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
function renderAll() { renderFilters(); renderColors(); paint(); renderList(); renderStats(); }
renderAll(); fit();
window.addEventListener('load', fit);
if (window.ResizeObserver) new ResizeObserver(applyView).observe(svg);
})();
