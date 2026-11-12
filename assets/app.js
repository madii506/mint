// MINT. Mint a coin that hedges against stocks.
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const API = '/api/mint', reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = w => w ? w.slice(0, 4) + '…' + w.slice(-4) : '';
const nf = (n, d = 2) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const usd = n => n == null || isNaN(n) ? '—' : (n < 0 ? '-' : '') + '$' + (Math.abs(n) >= 1e9 ? nf(Math.abs(n) / 1e9, 2) + 'B' : Math.abs(n) >= 1e6 ? nf(Math.abs(n) / 1e6, 2) + 'M' : Math.abs(n) >= 1e4 ? nf(Math.abs(n) / 1e3, 1) + 'K' : nf(Math.abs(n), 2));
const pct = (x, d = 2) => x == null || isNaN(x) ? '—' : (x >= 0 ? '+' : '') + nf(x * 100, d) + '%';
const ago = s => { const d = Date.now() / 1000 - s; return d < 90 ? 'just now' : d < 5400 ? Math.round(d / 60) + 'm ago' : d < 129600 ? Math.round(d / 3600) + 'h ago' : Math.round(d / 86400) + 'd ago'; };
const ruleTxt = (side, sym) => (side === 'S' ? 'SHORT ' : 'LONG ') + (sym || 'NVDA');
async function api(a, q = {}, body) { const u = API + '?a=' + a + Object.entries(q).filter(([, v]) => v != null).map(([k, v]) => '&' + k + '=' + encodeURIComponent(v)).join('');
  const r = await fetch(u, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({ error: 'the engine did not answer' })); if (!r.ok || j.error) throw new Error(j.error || 'the engine did not answer'); return j; }
let toastT; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3800); };
let COINS = [], CONFIG = {}, WALLET = null, NV = null, lenis = null, CUR = 'NVDA', STK = [];
const FEATURED = ['NVDA', 'TSLA', 'AAPL', 'META', 'GOOGL', 'MSFT', 'AMZN', 'AMD', 'PLTR', 'COIN', 'MSTR', 'SPY', 'QQQ'];
// real company logos through the engine's cached proxy; a coloured letter badge when one is missing
const lg = (sym, cls = '') => `<img class="lg ${cls}" src="${API}?a=logo&v=2&s=${encodeURIComponent(sym)}" alt="" loading="lazy" decoding="async" data-lg="${esc(sym)}">`;
const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
document.addEventListener('error', e => { const i = e.target; if (!(i instanceof HTMLImageElement) || !i.dataset.lg) return; const b = document.createElement('span'), h = hue(i.dataset.lg); b.className = i.className + ' ph2'; b.textContent = i.dataset.lg.slice(0, 2); b.style.cssText = `background:hsl(${h} 35% 16%);color:hsl(${h} 80% 76%)`; i.replaceWith(b); }, true);
const stkOf = sym => STK.find(s => s.symbol === sym) || null;
// fill the mint form from any button: stock, side and leverage
function setForm(o) { if (o.stock) L.stock = o.stock; if (o.side) L.side = o.side; if (o.lev) L.lev = +o.lev;
  $$('#lStock button').forEach(x => x.classList.toggle('on', x.dataset.s === L.stock)); $$('#lSide button').forEach(x => x.classList.toggle('on', x.dataset.v === L.side)); $$('#lLev button').forEach(x => x.classList.toggle('on', +x.dataset.v === L.lev)); preview(); }
const stkPx = sym => { const x = STK.find(s => s.symbol === sym); return x ? x.mark : (NV && NV.symbol === sym ? NV.mark : null); };

// ---------------------------------------------------------------- background: faint circuit traces with pulses running along them
function startBg2d() { const c = $('#bg'), x = c.getContext('2d'); let W, H, traces = [], pulses = [];
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); traces = [];
    for (let i = 0; i < 26; i++) { const y = Math.round(Math.random() * H / 24) * 24, x0 = Math.random() * W, len = 120 + Math.random() * 380, turn = Math.random() < .5 ? 1 : -1, dy = (40 + Math.random() * 140) * turn;
      traces.push([[x0, y], [x0 + len * .6, y], [x0 + len * .6 + Math.abs(dy) * .6, y + dy], [x0 + len + Math.abs(dy), y + dy]]); } pulses = traces.map(() => ({ t: Math.random(), v: .04 + Math.random() * .08 })); };
  size(); addEventListener('resize', size);
  const at = (p, t) => { const L = []; let tot = 0; for (let i = 1; i < p.length; i++) { const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); L.push(l); tot += l; } let d = t * tot; for (let i = 1; i < p.length; i++) { if (d <= L[i - 1]) { const k = d / L[i - 1]; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k]; } d -= L[i - 1]; } return p[p.length - 1]; };
  let last = performance.now(); (function f(now) { requestAnimationFrame(f); const dt = Math.min(.05, (now - last) / 1000); last = now; x.clearRect(0, 0, W, H);
    x.lineWidth = 1; x.strokeStyle = 'rgba(92,242,184,.055)'; traces.forEach(p => { x.beginPath(); p.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.stroke(); x.fillStyle = 'rgba(92,242,184,.12)'; x.beginPath(); x.arc(p[3][0], p[3][1], 2, 0, 7); x.fill(); });
    if (!reduced) pulses.forEach((u, i) => { u.t += u.v * dt; if (u.t > 1) u.t = 0; const [px, py] = at(traces[i], u.t); x.fillStyle = 'rgba(92,242,184,.5)'; x.beginPath(); x.arc(px, py, 1.6, 0, 7); x.fill(); }); })(last); }

// ---------------------------------------------------------------- the hero card: one stock, live from Phoenix
function drawChart(cv, bars, opts = {}) { if (!cv || !bars || bars.length < 2) return; const d = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * d; cv.height = H * d; const x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
  const ys = bars.map(b => b[1]).concat(opts.entry ? [opts.entry] : []), lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * .12 || 1, Y = v => H - 18 - (v - lo + pad) / (hi - lo + 2 * pad) * (H - 30), X = i => i / (bars.length - 1) * W;
  const up = bars[bars.length - 1][1] >= bars[0][1], col = up ? '#5cf2b8' : '#ff6b6b', g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, up ? 'rgba(92,242,184,.22)' : 'rgba(255,107,107,.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.strokeStyle = '#172022'; x.lineWidth = 1; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, i * H / 4); x.lineTo(W, i * H / 4); x.stroke(); }
  const n = opts.progress == null ? bars.length : Math.max(2, Math.floor(bars.length * opts.progress));
  x.beginPath(); for (let i = 0; i < n; i++) i ? x.lineTo(X(i), Y(bars[i][1])) : x.moveTo(X(i), Y(bars[i][1])); x.lineTo(X(n - 1), H); x.lineTo(0, H); x.closePath(); x.fillStyle = g; x.fill();
  x.beginPath(); for (let i = 0; i < n; i++) i ? x.lineTo(X(i), Y(bars[i][1])) : x.moveTo(X(i), Y(bars[i][1])); x.strokeStyle = col; x.lineWidth = 2; x.lineJoin = 'round'; x.stroke();
  x.fillStyle = col; x.beginPath(); x.arc(X(n - 1), Y(bars[n - 1][1]), 3.5, 0, 7); x.fill();
  if (opts.entry) { x.setLineDash([5, 5]); x.strokeStyle = '#eef3f1'; x.globalAlpha = .55; x.beginPath(); x.moveTo(0, Y(opts.entry)); x.lineTo(W, Y(opts.entry)); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; x.fillStyle = '#eef3f1'; x.font = '11px JB, monospace'; x.fillText('entry ' + nf(opts.entry, 2), 6, Y(opts.entry) - 6); }
  x.fillStyle = '#4c5654'; x.font = '10px JB, monospace'; x.fillText(nf(hi, 2), W - 52, 12); x.fillText(nf(lo, 2), W - 52, H - 4); }
let chartDrawn = false;
async function loadNvda() { try { const n = NV = await api('stock', { s: CUR }), px = $('#px'); $('#tcSym').textContent = n.symbol; const tl = $('#tcLogo'); if (tl && tl.dataset.s !== n.symbol) { tl.dataset.s = n.symbol; tl.innerHTML = lg(n.symbol, 'md'); } $$('.cur').forEach(x => x.textContent = n.symbol); $('#tcName').textContent = (n.name && n.name !== n.symbol ? n.name + ' · ' : '') + 'perp on Phoenix'; const old = px.dataset.v ? +px.dataset.v : null; px.textContent = '$' + nf(n.mark, 2); px.dataset.v = n.mark;
    if (old != null && old !== n.mark && window.gsap) gsap.fromTo(px, { color: n.mark > old ? '#5cf2b8' : '#ff6b6b' }, { color: '#eef3f1', duration: 1.2 });
    $('#ch').innerHTML = `<span class="${n.ch24 >= 0 ? 'g' : 'r'}">${pct(n.ch24)}</span> 24h`; $('#vol').textContent = usd(n.volUsd); $('#oi').textContent = nf(n.oi, 0) + ' sh'; $('#fund').textContent = n.funding == null ? '—' : nf(n.funding * 100, 4) + '%';
    $('#earn').textContent = n.earnings ? new Date(n.earnings.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (n.earnings.time === 'amc' ? ' · after close' : '') : '—';
    $('#mktState').textContent = n.status === 'active' ? (n.afterHours ? n.symbol + ' · after hours on Phoenix' : 'stocks · live on Phoenix') : n.symbol + ' · ' + n.status; $('.pill .dot').classList.toggle('off', n.status !== 'active');
    if (!chartDrawn && window.gsap && !reduced) { chartDrawn = true; const o = { p: 0 }; gsap.to(o, { p: 1, duration: 1.6, ease: 'power3.out', onUpdate: () => drawChart($('#chart'), n.bars, { progress: o.p }) }); } else drawChart($('#chart'), n.bars);
    preview(); calc(); } catch (e) { $('#mktState').textContent = CUR + ' · ' + e.message; } }
// every stock Phoenix lists, live; the hero card switches between them and the launch form picks from them
async function loadStocks() { try { STK = await api('stocks'); } catch { STK = []; } const list = STK.length ? STK : FEATURED.map(symbol => ({ symbol }));
  const chip = (x, cls) => `<button type="button" data-s="${esc(x.symbol)}"${x.symbol === cls ? ' class="on"' : ''}>${lg(x.symbol)}${esc(x.symbol)}${x.ch24 != null ? `<small class="${x.ch24 >= 0 ? 'g' : 'r'}">${pct(x.ch24, 1)}</small>` : ''}</button>`;
  const feat = FEATURED.map(f => list.find(x => x.symbol === f)).filter(Boolean); $('#stk').innerHTML = feat.map(x => chip(x, CUR)).join('');
  const sorted = [...feat, ...list.filter(x => !FEATURED.includes(x.symbol))]; $('#lStock').innerHTML = sorted.map(x => chip(x, L.stock)).join(''); preview(); board(); tape(); heat(); movers(); pulse(); wall(); stack(); orbit(); mChips(); if (!radarDone) { radarDone = true; radar(); } if (WORLD && STK.length) WORLD.setBias((STK.filter(x => x.ch24 > 0).length / STK.length - .5) * 2); }
let radarDone = false;
// the stock board: every stock Phoenix lists, searchable, filterable, sortable, each row with a short and a long button
const GROUPS = { chips: 'NVDA AMD AVGO TSM MU INTC ARM ASML AMAT QCOM TXN MRVL SNDK SKHY CBRS', tech: 'AAPL MSFT META GOOGL AMZN NFLX ORCL IBM DELL TSLA BABA', ai: 'PLTR CRWV NBIS IREN NET CRWD ORCL MSFT NVDA SPCX', crypto: 'COIN MSTR HOOD CRCL', etf: 'SPY QQQ TLT' };
const BV = { f: 'all', s: 'vol' }; let WORLD = null;
const soonDays = x => x.earnings ? Math.round((new Date(x.earnings.date + 'T12:00:00Z') - Date.now()) / 864e5) : null;
const earn = e => { if (!e) return '<span class="dim">—</span>'; const d = new Date(e.date + 'T12:00:00Z'), days = Math.round((d - Date.now()) / 864e5); return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${e.time === 'amc' ? ' · after close' : e.time === 'bmo' ? ' · before open' : ''}${days >= 0 && days <= 14 ? ` <span class="soon">in ${days}d</span>` : ''}`; };
// the tape: every stock, scrolling
function tape() { if (!STK.length) return; const h = STK.map(x => `<span data-stock="${esc(x.symbol)}">${lg(x.symbol)}<b>${esc(x.symbol)}</b>$${nf(x.mark, 2)} <i class="${x.ch24 >= 0 ? 'g' : 'r'}" style="font-style:normal">${pct(x.ch24, 2)}</i></span>`).join(''); $('.tape-in').innerHTML = h + h; }
// the heatmap: sized by today's volume, coloured by today's move
let heatDone = false;
let HM = 'vol'; const hKey = x => HM === 'oi' ? (x.oi || 0) * (x.mark || 0) : HM === 'move' ? Math.abs(x.ch24 || 0) : (x.volUsd || 0);
function heat() { const H = $('#heat'); if (!STK.length) { H.innerHTML = '<p class="dim">Phoenix is not answering right now.</p>'; return; } const L = STK.slice().sort((a, b) => hKey(b) - hKey(a)), mx = Math.max(...L.map(x => Math.abs(x.ch24 || 0)), .02);
  H.innerHTML = L.map((x, i) => { const k = Math.min(1, Math.abs(x.ch24 || 0) / mx), up = (x.ch24 || 0) >= 0, c = up ? `rgba(92,242,184,${.08 + k * .5})` : `rgba(255,107,107,${.08 + k * .5})`, bg = `linear-gradient(${c},${c}),#090d0e`, w = i < 3 ? 'w4' : i < 7 ? 'w3' : i < 14 ? 'w2' : 'w1';
    return `<div class="ht ${w}" data-stock="${esc(x.symbol)}" style="background:${bg}"><div><div class="hd">${lg(x.symbol)}<b>${esc(x.symbol)}</b></div><small>${esc(x.name || '')}</small></div><span>${pct(x.ch24, 2)} · $${nf(x.mark, 2)}${HM === 'oi' ? ' · OI ' + usd((x.oi || 0) * (x.mark || 0)) : HM === 'vol' && i < 7 ? ' · vol ' + usd(x.volUsd) : ''}</span></div>`; }).join('');
  if (!heatDone && window.gsap && !reduced) { heatDone = true; gsap.from($$('.ht', H), { scale: .85, opacity: 0, duration: .8, ease: 'expo.out', stagger: .015, scrollTrigger: { trigger: H, start: 'top 85%' } }); } }
// the earnings radar: who reports in the next 45 days, on one line
let RR = 45; function radar() { const B = $('#radarBox'), now = Date.now(), span = RR * 864e5, L = STK.filter(x => x.earnings && x.earnings.date).map(x => ({ ...x, t: new Date(x.earnings.date + 'T21:00:00Z').getTime() })).filter(x => x.t >= now - 864e5 && x.t <= now + span).sort((a, b) => a.t - b.t);
  const pos = t => `calc(24px + (100% - 48px) * ${Math.max(0, Math.min(1, (t - now) / span)).toFixed(4)})`; let ticks = ''; const step = RR <= 7 ? 1 : RR <= 30 ? 7 : 15; for (let d = 0; d <= RR; d += step) ticks += `<span class="rd-tick" style="left:${pos(now + d * 864e5)}">${d ? '+' + d + 'd' : 'today'}</span>`;
  const days = []; L.forEach(x => { const d = days.find(g => g.date === x.earnings.date); d ? d.L.push(x) : days.push({ date: x.earnings.date, t: x.t, L: [x] }); });
  B.innerHTML = '<div class="rd-axis"></div><div class="rd-now"></div>' + ticks + (days.length ? days.map((g, i) => `<div class="rd-dot${g.t - now < 7 * 864e5 ? ' hot' : ''}" data-stock="${esc(g.L[0].symbol)}" style="left:${pos(g.t)}"><b style="bottom:${18 + (i % 3) * 40}px">${g.L.slice(0, 3).map(x => lg(x.symbol)).join('')}${g.L.length > 3 ? '<em>+' + (g.L.length - 3) + '</em>' : ''} <span class="dim">${new Date(g.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></b><i></i></div>`).join('') : `<p class="dim" style="padding:24px">No earnings in the next ${RR} days.</p>`);
  $('#soonList').innerHTML = L.slice(0, 8).map(x => { const d = Math.max(0, Math.round((x.t - now) / 864e5)); return `<div class="soon-c glass spot" data-stock="${esc(x.symbol)}">${lg(x.symbol, 'md')}<div class="sc-id"><b>${esc(x.symbol)}</b><small>${new Date(x.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${x.earnings.time === 'amc' ? ' · after close' : x.earnings.time === 'bmo' ? ' · before open' : ''}</small></div><span class="sc-d${d <= 7 ? ' hot' : ''}">${d === 0 ? 'today' : 'in ' + d + 'd'}</span><div class="sc-a"><button class="btn sm s" data-mint="${esc(x.symbol)}" data-side="S">short</button><button class="btn sm l" data-mint="${esc(x.symbol)}" data-side="L">long</button></div></div>`; }).join('');
  if (window.gsap && !reduced) gsap.from($$('.rd-dot', B), { y: 20, opacity: 0, duration: .9, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: B, start: 'top 85%' } }); }
document.addEventListener('click', e => { if (e.target.closest('button, a, input')) return; const b = e.target.closest('[data-stock]'); if (b) location.hash = '/s/' + b.dataset.stock; });
function board() { const B = $('#board'), q = ($('#sFind').value || '').trim().toUpperCase(), f = BV.f;
  const keep = x => (!q || x.symbol.includes(q) || String(x.name || '').toUpperCase().includes(q)) && (f === 'all' || (f === 'up' && x.ch24 > 0) || (f === 'down' && x.ch24 < 0) || (f === 'earn' && soonDays(x) != null && soonDays(x) >= 0 && soonDays(x) <= 14) || (GROUPS[f] && GROUPS[f].split(' ').includes(x.symbol)));
  const by = { vol: (a, b) => (b.volUsd || 0) - (a.volUsd || 0), move: (a, b) => Math.abs(b.ch24 || 0) - Math.abs(a.ch24 || 0), up: (a, b) => (b.ch24 || 0) - (a.ch24 || 0), down: (a, b) => (a.ch24 || 0) - (b.ch24 || 0), price: (a, b) => (b.mark || 0) - (a.mark || 0), az: (a, b) => a.symbol.localeCompare(b.symbol) }[BV.s];
  const list = STK.filter(keep).sort(by);
  $('#sCount').textContent = STK.length ? `${list.length} of ${STK.length} stocks` : '';
  B.innerHTML = '<div class="br th"><span>stock</span><span>price</span><span>24h</span><span>volume</span><span>next earnings</span><span style="text-align:right">mint a coin</span></div>' + (STK.length ? (list.length ? '' : '<div class="br"><span class="dim">No stock matches. Try another filter.</span></div>') + list.map(x => `<div class="br" data-stock="${esc(x.symbol)}"><span class="nm">${lg(x.symbol, 'md')}<span style="min-width:0"><b>${esc(x.symbol)}</b><small>${esc(x.name || '')}</small></span></span><span>$${nf(x.mark, 2)}</span><span class="${x.ch24 >= 0 ? 'g' : 'r'}">${pct(x.ch24, 2)}</span><span>${usd(x.volUsd)}</span><span>${earn(x.earnings)}</span><span class="acts"><button class="btn sm s" data-mint="${esc(x.symbol)}" data-side="S">short</button><button class="btn sm l" data-mint="${esc(x.symbol)}" data-side="L">long</button></span></div>`).join('') : '<div class="br"><span class="dim">Phoenix is not answering right now.</span></div>'); }
$('#sFind').addEventListener('input', board);
const chipGroup = (id, fn) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$(id + ' button').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset); });
chipGroup('#sFilter', d => { BV.f = d.f; board(); }); chipGroup('#sSort', d => { BV.s = d.s; board(); }); chipGroup('#hSize', d => { HM = d.v; heat(); });
chipGroup('#rRange', d => { RR = +d.v; radar(); }); chipGroup('#cFilter', d => { CF = d.v; drawCoins(); });
$('#cRefresh').onclick = () => { toast('reading the chain…'); loadCoins(1); };
// the pulse buttons jump into the board with a filter on
document.addEventListener('click', e => { const b = e.target.closest('[data-board]'); if (!b) return; const v = b.dataset.board; if (v === 'vol') { BV.f = 'all'; BV.s = 'vol'; } else { BV.f = v; BV.s = v === 'up' ? 'up' : v === 'down' ? 'down' : 'vol'; }
  $$('#sFilter button').forEach(x => x.classList.toggle('on', x.dataset.f === BV.f)); $$('#sSort button').forEach(x => x.classList.toggle('on', x.dataset.s === BV.s)); board(); go('stocks'); });
document.addEventListener('click', e => { const b = e.target.closest('[data-mint]'); if (!b) return; setForm({ stock: b.dataset.mint, side: b.dataset.side, lev: b.dataset.lev }); if (!page.hidden) closePage(); setTimeout(() => go('launch'), page.hidden ? 0 : 320); toast(`${b.dataset.side === 'L' ? 'long' : 'short'} ${b.dataset.mint}${b.dataset.lev ? ' ' + b.dataset.lev + 'x' : ''} is set. name your coin`); });
document.addEventListener('click', e => { const b = e.target.closest('[data-quick]'); if (!b) return; setForm({ stock: CUR, side: b.dataset.quick }); go('launch'); });
// the pulse: the whole market in five numbers, each one a button
const countTo = (el, v, fmt) => { if (!el) return; const old = +el.dataset.v || 0; el.dataset.v = v; if (!window.gsap || reduced || old === v) { el.textContent = fmt(v); return; } const o = { v: old }; gsap.to(o, { v, duration: 1.4, ease: 'expo.out', onUpdate: () => el.textContent = fmt(o.v) }); };
function pulse() { if (!STK.length) return; const up = STK.filter(x => x.ch24 > 0).sort((a, b) => b.ch24 - a.ch24), dn = STK.filter(x => x.ch24 < 0).sort((a, b) => a.ch24 - b.ch24), soon = STK.filter(x => { const d = soonDays(x); return d != null && d >= 0 && d <= 14; });
  countTo($('#pStocks'), STK.length, v => Math.round(v)); countTo($('#pVol'), STK.reduce((s, x) => s + (x.volUsd || 0), 0), v => usd(v)); countTo($('#pUp'), up.length, v => Math.round(v)); countTo($('#pDn'), dn.length, v => Math.round(v)); countTo($('#pEarn'), soon.length, v => Math.round(v));
  $('#pUpTop').innerHTML = up[0] ? `best ${lg(up[0].symbol, 'xs')}${esc(up[0].symbol)} ${pct(up[0].ch24, 1)}` : 'none yet'; $('#pDnTop').innerHTML = dn[0] ? `worst ${lg(dn[0].symbol, 'xs')}${esc(dn[0].symbol)} ${pct(dn[0].ch24, 1)}` : 'none yet'; $('#stackN').textContent = STK.length; }
// the logo wall: every company, two rows drifting in opposite directions
let wallDone = false; function wall() { if (wallDone || !STK.length) return; wallDone = true; const L = STK.slice().sort((a, b) => (b.volUsd || 0) - (a.volUsd || 0)), half = Math.ceil(L.length / 2);
  const tile = x => `<button class="wt" data-stock-btn="${esc(x.symbol)}">${lg(x.symbol, 'md')}<span><b>${esc(x.symbol)}</b><small class="${x.ch24 >= 0 ? 'g' : 'r'}">${pct(x.ch24, 1)}</small></span></button>`;
  [[L.slice(0, half), '#wall1'], [L.slice(half), '#wall2']].forEach(([l, id]) => { const h = l.map(tile).join(''); $(id).innerHTML = h + h; }); }
document.addEventListener('click', e => { const b = e.target.closest('[data-stock-btn]'); if (b) location.hash = '/s/' + b.dataset.stockBtn; });
function stack() { const L = STK.slice().sort((a, b) => (b.volUsd || 0) - (a.volUsd || 0)).slice(0, 7); if (L.length) $('#stack').innerHTML = L.map(x => lg(x.symbol, 'md')).join(''); }
let orbitDone = false; function orbit() { if (orbitDone || !STK.length) return; orbitDone = true; const L = STK.slice().sort((a, b) => (b.volUsd || 0) - (a.volUsd || 0)).slice(0, 24);
  $('#orbit').innerHTML = [L.slice(0, 10), L.slice(10, 24)].map((ring, k) => `<div class="ring r${k}">${ring.map((x, i) => `<span style="--a:${(i / ring.length * 360).toFixed(1)}deg">${lg(x.symbol, 'md')}</span>`).join('')}</div>`).join(''); }
function mChips() { const L = STK.slice().sort((a, b) => (b.volUsd || 0) - (a.volUsd || 0)).slice(0, 12); $('#mStk').innerHTML = L.map(x => `<button type="button" data-s="${esc(x.symbol)}"${x.symbol === CUR ? ' class="on"' : ''}>${lg(x.symbol)}${esc(x.symbol)}</button>`).join(''); }
$('#mStk').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; CUR = b.dataset.s; $$('#mStk button').forEach(x => x.classList.toggle('on', x === b)); $$('#stk button').forEach(x => x.classList.toggle('on', x.dataset.s === CUR)); chartDrawn = false; loadNvda(); });
const preset = (id, input) => chipGroup(id, d => { $(input).value = d.v; calc(); }); preset('#mHoldQ', '#mHold'); preset('#mDropQ', '#mDrop');
// top movers: the five flying and the five falling today
function movers() { const B = $('#movers'); if (!STK.length) { B.innerHTML = ''; return; } const L2 = STK.filter(x => x.ch24 != null).sort((a, b) => b.ch24 - a.ch24), up = L2.slice(0, 5), dn = L2.slice(-5).reverse();
  const row = x => `<div class="mv" data-stock="${esc(x.symbol)}">${lg(x.symbol, 'md')}<span class="mv-n"><b>${esc(x.symbol)}</b><small>${esc(x.name || '')}</small></span><span class="mv-p">$${nf(x.mark, 2)}</span><b class="${x.ch24 >= 0 ? 'g' : 'r'}">${pct(x.ch24, 2)}</b></div>`;
  B.innerHTML = `<div class="mv-col glass"><h4>flying today</h4>${up.map(row).join('')}</div><div class="mv-col glass"><h4>falling today</h4>${dn.map(row).join('')}</div>`; }
// hedge math: how much a short coin at Nx moves for a given drop, and how much collateral covers a holding
function calc() { const hold = Math.max(0, +$('#mHold').value || 0), drop = Math.min(90, Math.max(1, +$('#mDrop').value || 0)) / 100, lev = M.lev, sol = NV && NV.sol, need = hold / lev, wipe = Math.round(90 / lev);
  $('#mOut').innerHTML = `<span class="dim" style="font-size:12px">to cover a ${nf(drop * 100, 0)}% drop on $${nf(hold, 0)}</span><div class="big">$${nf(need, 0)} <span class="dim" style="font-size:18px">of collateral${sol ? ' · ' + nf(need / sol, 2) + ' SOL' : ''}</span></div>
    <div class="bar2"><i style="width:50%;background:var(--red)"></i><i style="width:50%;background:var(--g)"></i></div>
    <div class="kv"><span>your stock loses</span><b class="r">-$${nf(hold * drop, 0)}</b><span>a ${lev}x short on $${nf(need, 0)} gains</span><b class="g">+$${nf(need * lev * drop, 0)}</b><span>net</span><b>$${nf(need * lev * drop - hold * drop, 0)}</b><span>but if it rises about ${wipe}% first</span><b class="r">the short is wiped</b></div>`; }
const M = { lev: 5 }; ['#mHold', '#mDrop'].forEach(s => $(s).addEventListener('input', calc));
$('#mLev').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#mLev button').forEach(x => x.classList.toggle('on', x === b)); M.lev = +b.dataset.v; calc(); });
const openCur = () => { location.hash = '/s/' + CUR; }; $('#tcMore').onclick = openCur; $('#tcOpen').onclick = openCur; $('#tcOpen').onkeydown = e => { if (e.key === 'Enter') openCur(); };
$('#stk').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; CUR = b.dataset.s; $$('#stk button').forEach(x => x.classList.toggle('on', x === b)); chartDrawn = false; loadNvda(); });
$('#lStock').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; L.stock = b.dataset.s; $$('#lStock button').forEach(x => x.classList.toggle('on', x === b)); preview(); });
addEventListener('resize', () => NV && drawChart($('#chart'), NV.bars));

// ---------------------------------------------------------------- the flow: trades → creator fees → the position → SOL to holders
(function flow() { const c = $('#flow'), x = c.getContext('2d'); let W, H; const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = c.clientWidth; H = c.clientHeight; c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); }; size(); addEventListener('resize', size);
  const nodes = () => [[W * .1, H / 2, 'trades'], [W * .37, H / 2, 'creator fees'], [W * .63, H / 2, 'stock position'], [W * .9, H / 2, 'SOL to holders']];
  const P = Array.from({ length: 46 }, () => ({ s: Math.floor(Math.random() * 3), t: Math.random(), v: .25 + Math.random() * .35, o: (Math.random() - .5) * 26 })); let live = false, last = performance.now();
  new IntersectionObserver(e => live = e[0].isIntersecting).observe(c);
  (function f(now) { requestAnimationFrame(f); const dt = Math.min(.05, (now - last) / 1000); last = now; if (!live) return; x.clearRect(0, 0, W, H); const N = nodes();
    x.strokeStyle = '#172022'; x.lineWidth = 1; x.beginPath(); x.moveTo(N[0][0], H / 2); x.lineTo(N[3][0], H / 2); x.stroke();
    P.forEach(p => { if (!reduced) p.t += p.v * dt; if (p.t > 1) { p.t = 0; p.s = (p.s + 1) % 3; } const a = N[p.s], b = N[p.s + 1], e = p.t, px = a[0] + (b[0] - a[0]) * e, py = H / 2 + p.o * Math.sin(e * Math.PI); x.globalAlpha = Math.sin(e * Math.PI); x.fillStyle = p.s === 2 ? '#eef3f1' : '#5cf2b8'; x.beginPath(); x.arc(px, py, p.s === 2 ? 2.4 : 1.8, 0, 7); x.fill(); });
    x.globalAlpha = 1; N.forEach(([nx, ny, l], i) => { x.fillStyle = '#070b0c'; x.strokeStyle = i === 2 ? '#5cf2b8' : '#24302f'; x.lineWidth = 1.5; x.beginPath(); x.roundRect(nx - 20, ny - 20, 40, 40, 10); x.fill(); x.stroke(); x.fillStyle = i === 2 ? '#5cf2b8' : '#eef3f1'; x.beginPath(); x.arc(nx, ny, 5, 0, 7); x.fill();
      x.fillStyle = '#7d8a86'; x.font = '11px JB, monospace'; x.textAlign = 'center'; x.fillText(l, nx, ny + 40); }); })(last); })();

// ---------------------------------------------------------------- wallet
const prov = () => (window.phantom && window.phantom.solana) || window.solflare || window.backpack || window.solana || null;
let web3P = null; const web3 = () => web3P || (web3P = new Promise((ok, no) => { if (window.solanaWeb3) return ok(window.solanaWeb3); const s = document.createElement('script'); s.src = '/assets/web3.min.js'; s.onload = () => ok(window.solanaWeb3); s.onerror = () => no(new Error('could not load the signer')); document.head.appendChild(s); }));
const b64u8 = b => Uint8Array.from(atob(b), c => c.charCodeAt(0)), u8b64 = u => { let s = ''; u.forEach(c => s += String.fromCharCode(c)); return btoa(s); };
async function connect() { const p = prov(); if (!p) { toast('no Solana wallet found. open this page in Phantom, Solflare or Backpack'); return null; }
  try { const r = await p.connect(); WALLET = String((r && r.publicKey) || p.publicKey); } catch { toast('the wallet did not connect'); return null; } $('#connect').textContent = short(WALLET); routeRefresh(); return WALLET; }
$('#connect').onclick = () => WALLET ? (navigator.clipboard && navigator.clipboard.writeText(WALLET), toast('wallet copied')) : connect();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function confirm(sig) { for (let i = 0; i < 40; i++) { const s = await api('status', { sig }).catch(() => ({})); if (s.status === 'failed') throw new Error('the transaction failed on-chain: ' + (s.err || '')); if (s.status === 'confirmed' || s.status === 'finalized') return sig; await sleep(1500); } throw new Error('the transaction did not confirm in time. check your wallet'); }
// every transaction is signed in the wallet and sent through the engine; extra signers (the new coin's address) sign first
async function signSend(b64, extra) { const S = await web3(), tx = S.Transaction.from(b64u8(b64)), p = prov(); if (extra) tx.partialSign(extra); const s = await p.signTransaction(tx); return (await api('send', {}, { tx: u8b64(s.serialize()) })).sig; }

// ---------------------------------------------------------------- launch
const L = { side: 'S', lev: 5, img: 1, stock: 'NVDA' };
const segs = (id, key) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$(id + ' button').forEach(x => x.classList.toggle('on', x === b)); L[key] = key === 'side' ? b.dataset.v : +b.dataset.v; preview(); });
segs('#lSide', 'side'); segs('#lLev', 'lev'); segs('#lImg', 'img');
$('#lImg').innerHTML = Array.from({ length: 8 }, (_, i) => `<button type="button" data-v="${i + 1}"${i ? '' : ' class="on"'}><img src="/assets/coins/${i + 1}.png" alt=""></button>`).join('');
['#lName', '#lSym'].forEach(s => $(s).addEventListener('input', preview));
function preview() { const name = $('#lName').value.trim() || (L.stock === 'NVDA' ? 'nvidia hedge' : L.stock.toLowerCase() + ' hedge'), sym = ($('#lSym').value.trim() || 'HEDGE').replace(/^\$/, '').toUpperCase(), wipe = Math.round(90 / L.lev), px = stkPx(L.stock); $$('.sy').forEach(x => x.textContent = L.stock);
  $('#lPrev').innerHTML = `<div class="cc-top"><img src="/assets/coins/${L.img}.png" alt=""><div><b>$${esc(sym)}</b><small>${esc(name)}</small></div><span class="rule ${L.side}">${lg(L.stock, 'xs')}${ruleTxt(L.side, L.stock)} ${L.lev}x</span></div>
    <div class="cc-pos"><div><span>${esc(L.stock)} now</span><b>${px ? '$' + nf(px, 2) : '—'}</b></div><div><span>1 SOL buys</span><b>${NV && NV.sol ? '$' + nf(NV.sol * L.lev * .85, 0) : '—'}</b></div><div><span>exposure</span><b>${L.lev}x</b></div></div>
    <p class="dim" style="font-size:13px">${L.side === 'S' ? `Pays when ${esc(L.stock)} falls. Hold it next to your ${esc(L.stock)} as a hedge.` : `Pays when ${esc(L.stock)} rises. A leveraged bet on it.`}</p>`;
  $('#lLiq').textContent = `at ${L.lev}x, a move of about ${wipe}% ${L.side === 'S' ? 'up' : 'down'} in ${L.stock} can wipe the position.`; }
$('#launchForm').onsubmit = async e => { e.preventDefault(); const note = $('#lNote'), btn = $('#lGo'); if (!WALLET && !(await connect())) return;
  const name = $('#lName').value.trim(), symbol = $('#lSym').value.trim(); if (!name || !symbol) return toast('give the coin a name and a ticker');
  btn.disabled = true; note.className = 'note'; note.textContent = 'building the launch…';
  try { const S = await web3(), kp = S.Keypair.generate(), r = await api('launch', {}, { from: WALLET, mint: kp.publicKey.toBase58(), name, symbol, stock: L.stock, side: L.side, lev: L.lev, img: L.img, devBuy: +$('#lBuy').value });
    note.textContent = 'sign the launch in your wallet (1 of 2)'; const sig = await signSend(r.txs[0], kp); note.textContent = 'minting…'; await confirm(sig); note.textContent = 'building your first buy…'; const by = await api('buy', {}, { from: WALLET, mint: r.mint, sol: +$('#lBuy').value }); note.textContent = 'sign your first buy (2 of 2)'; await confirm(await signSend(by.txs[0]));
    note.className = 'note ok'; note.innerHTML = `launched. <a href="https://pump.fun/coin/${esc(r.mint)}" target="_blank" rel="noopener" style="text-decoration:underline">see it on pump.fun</a> · <a href="#/c/${esc(r.mint)}" style="text-decoration:underline">open its page</a>`; toast('your coin is live'); setTimeout(() => loadCoins(1), 4000); }
  catch (err) { note.className = 'note err'; note.textContent = /reject|cancel|denied/i.test(err.message) ? 'you did not sign. nothing happened.' : err.message; } finally { btn.disabled = false; } };

// ---------------------------------------------------------------- coins
const coinImg = c => c.coin && c.coin.icon ? `<img src="${esc(c.coin.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph'}))">` : '<span class="ph"></span>';
const posCells = p => p && p.open ? `<div><span>position</span><b>${nf(Math.abs(p.size), 3)} sh</b></div><div><span>P&amp;L</span><b class="${p.upnl >= 0 ? 'g' : 'r'}">${usd(p.upnl)}</b></div><div><span>return</span><b class="${p.ret >= 0 ? 'g' : 'r'}">${pct(p.ret, 1)}</b></div>` : `<div><span>position</span><b class="dim">not open</b></div><div><span>P&amp;L</span><b>—</b></div><div><span>return</span><b>—</b></div>`;
function card(c) { const sym = c.coin && c.coin.symbol ? c.coin.symbol : short(c.mint);
  return `<div class="coin-card" data-coin="${esc(c.mint)}"><div class="cc-top">${coinImg(c)}<div><b>$${esc(sym)}</b><small>${c.coin ? usd(c.coin.mcap) + ' mcap · ' + nf(c.coin.holders, 0) + ' holders' : 'just launched'}</small></div><span class="rule ${c.side}">${lg(c.sym || 'NVDA', 'xs')}${ruleTxt(c.side, c.sym)} ${c.lev}x</span></div>
    <div class="cc-pos">${posCells(c.pos)}</div><div class="cc-foot"><span>funded ${nf(c.funded, 3)} SOL</span><span>paid ${nf(c.paid, 3)} SOL</span><span>${ago(c.last)}</span></div></div>`; }
let CF = 'all'; function drawCoins(anim) { const G = $('#coinGrid'), L = COINS.filter(c => CF === 'all' || (CF === 'open' ? c.pos && c.pos.open : c.side === CF)); if (!COINS.length) return;
  G.innerHTML = L.length ? L.map(card).join('') : '<div class="empty"><span>No coin matches this filter yet.</span></div>'; if (anim && window.gsap && !reduced) gsap.from($$('.coin-card', G), { y: 30, opacity: 0, duration: .9, ease: 'expo.out', stagger: .05 }); }
async function loadCoins(fresh) { const G = $('#coinGrid'); try { const j = await api('coins', fresh ? { fresh: 1 } : {});
    if (!j.coins.length) { G.innerHTML = `<div class="empty"><img src="/favicon.png" alt=""><span>No MINT coin yet. The first one launched shows here, with its position live.</span><a class="btn sm" href="#launch" data-go="launch">launch the first</a></div>`; return; }
    COINS = j.coins; drawCoins(true); }
  catch (e) { G.innerHTML = `<div class="empty">The chain is not answering right now. ${esc(e.message)}</div>`; } }
document.addEventListener('click', e => { const c = e.target.closest('[data-coin]'); if (c) location.hash = '/c/' + c.dataset.coin; const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); } });
function go(id) { const el = id === 'top' ? 0 : document.getElementById(id); if (el == null) return; if (lenis) lenis.scrollTo(el, { offset: id === 'top' ? 0 : -80, duration: 1.4 }); else (el === 0 ? scrollTo(0, 0) : el.scrollIntoView({ behavior: 'smooth' })); }

// ---------------------------------------------------------------- a stock's page: live price, history, numbers, and one button per coin you can mint on it
let SPG = null, SPTF = '1w'; const NVS = {}; const SPLIST = () => STK.length ? STK.slice().sort((a, b) => (b.volUsd || 0) - (a.volUsd || 0)).map(x => x.symbol) : FEATURED;
function stepStock(d) { const L2 = SPLIST(), i = L2.indexOf(SPG); location.hash = '/s/' + L2[(i + d + L2.length) % L2.length]; }
function openPage() { page.hidden = false; requestAnimationFrame(() => page.classList.add('on')); if (lenis) lenis.stop(); document.documentElement.style.overflow = 'hidden'; }
async function showStock(sym) { const same = SPG === sym; SPG = sym; PAGE = null; openPage(); const B = $('#pageBody'), x = stkOf(sym) || { symbol: sym }; if (!same) { page.scrollTop = 0; B.innerHTML = stockHTML(x, null); }
  try { const n = await api('stock', { s: sym }); if (SPG !== sym) return; B.innerHTML = stockHTML({ ...x, ...n }, n); NVS[sym] = n.bars; drawChart($('#spChart'), n.bars); if (SPTF !== '1w') loadTf(sym, SPTF); if (window.gsap && !reduced && !same) gsap.from($$('.sp-acts .btn', B), { y: 14, opacity: 0, duration: .6, ease: 'expo.out', stagger: .04 }); }
  catch (e) { if (SPG === sym) B.insertAdjacentHTML('beforeend', `<p class="note err">${esc(e.message)}</p>`); } }
async function loadTf(sym, tf) { SPTF = tf; $$('#spTf button').forEach(b => b.classList.toggle('on', b.dataset.v === tf)); try { const j = await api('bars', { s: sym, tf }); if (SPG !== sym || SPTF !== tf) return; NVS[sym] = j.bars; drawChart($('#spChart'), j.bars); const a = j.bars[0], z = j.bars[j.bars.length - 1]; if (a && z) $('#spTfCh').innerHTML = `<span class="${z[1] >= a[1] ? 'g' : 'r'}">${pct(z[1] / a[1] - 1)}</span> over ${({ '1d': 'a day', '1w': 'a week', '1m': 'a month', '3m': '3 months' })[tf]}`; } catch (e) { toast(e.message); } }
function stockHTML(x, n) { const sym = x.symbol, up = (x.ch24 || 0) >= 0, mine = COINS.filter(c => (c.sym || 'NVDA') === sym), e = x.earnings, days = e ? Math.round((new Date(e.date + 'T12:00:00Z') - Date.now()) / 864e5) : null, hi = n && n.bars.length ? Math.max(...n.bars.map(b => b[1])) : null, lo = n && n.bars.length ? Math.min(...n.bars.map(b => b[1])) : null;
  const act = (side, lev) => `<button class="btn ${side === 'S' ? 's' : 'l'}" data-mint="${esc(sym)}" data-side="${side}" data-lev="${lev}">${side === 'S' ? 'short' : 'long'} ${lev}x<small>wiped ~${Math.round(90 / lev)}% ${side === 'S' ? 'up' : 'down'}</small></button>`;
  return `<div class="sp-head">${lg(sym, 'big')}<div class="sp-id"><b>${esc(sym)}</b><small>${esc(x.name && x.name !== sym ? x.name : 'stock')} · perp on Phoenix${n && n.afterHours ? ' · after hours' : ''}</small></div>
    <div class="tc-px"><b>${x.mark != null ? '$' + nf(x.mark, 2) : '—'}</b><span><span class="${up ? 'g' : 'r'}">${pct(x.ch24)}</span> 24h</span></div></div>
    <div class="sp-nav"><button class="btn sm ghost" data-step="-1" aria-label="previous stock">‹ prev</button><button class="btn sm ghost" data-step="1" aria-label="next stock">next ›</button><button class="btn sm ghost" data-hedge="${esc(sym)}">hedge math</button><button class="btn sm ghost" data-share="${esc(sym)}">copy link</button><a class="btn sm ghost" href="https://phoenix.trade" target="_blank" rel="noopener">Phoenix ↗</a></div>
    <div class="p-grid"><div class="card"><div class="sp-tf"><div class="seg" id="spTf">${['1d', '1w', '1m', '3m'].map(t => `<button type="button" data-v="${t}"${t === SPTF ? ' class="on"' : ''}>${t.toUpperCase()}</button>`).join('')}</div><span class="dim" id="spTfCh"></span></div><canvas id="spChart"></canvas></div>
      <div class="stat-grid"><div><span>24h volume</span><b>${usd(x.volUsd)}</b></div><div><span>open interest</span><b>${x.oi != null ? nf(x.oi, 0) + ' sh' : '—'}</b></div><div><span>OI value</span><b>${x.oi != null && x.mark ? usd(x.oi * x.mark) : '—'}</b></div><div><span>funding / h</span><b>${x.funding == null ? '—' : nf(x.funding * 100, 4) + '%'}</b></div><div><span>max leverage</span><b>${x.maxLev ? nf(x.maxLev, 0) + 'x' : '—'}</b></div><div><span>prev close</span><b>${n && n.prev ? '$' + nf(n.prev, 2) : '—'}</b></div><div><span>week high</span><b>${hi ? '$' + nf(hi, 2) : '—'}</b></div><div><span>week low</span><b>${lo ? '$' + nf(lo, 2) : '—'}</b></div><div><span>earnings</span><b>${e ? new Date(e.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (days >= 0 && days <= 30 ? ` <small class="soon">${days}d</small>` : '') : '—'}</b></div></div></div>
    <div class="sec-t">mint a coin on ${esc(sym)}</div><div class="sp-acts">${[2, 5, 10].map(l => act('S', l)).join('')}${[2, 5, 10].map(l => act('L', l)).join('')}</div>
    <p class="dim" style="font-size:12px;margin-top:10px">Short is the hedge: it pays when ${esc(sym)} falls. Long is the bet: it pays when ${esc(sym)} rises. The rule is locked into the coin at launch.</p>
    <div class="sec-t">MINT coins on ${esc(sym)}</div>${mine.length ? `<div class="coin-grid">${mine.map(card).join('')}</div>` : `<div class="empty"><span>No coin on ${esc(sym)} yet. The first one shows here.</span><button class="btn sm" data-mint="${esc(sym)}" data-side="S">mint the first</button></div>`}
    <div class="sec-t">more stocks</div><div class="stk wrap">${SPLIST().filter(s => s !== sym).slice(0, 18).map(s => { const y = stkOf(s); return `<button type="button" data-stock="${esc(s)}">${lg(s)}${esc(s)}${y && y.ch24 != null ? `<small class="${y.ch24 >= 0 ? 'g' : 'r'}">${pct(y.ch24, 1)}</small>` : ''}</button>`; }).join('')}</div>`; }
$('#pageBody').addEventListener('click', e => { if (!SPG) return; const t = e.target.closest('#spTf button'); if (t) return loadTf(SPG, t.dataset.v); const st = e.target.closest('[data-step]'); if (st) return stepStock(+st.dataset.step); const s2 = e.target.closest('.stk [data-stock]'); if (s2) { location.hash = '/s/' + s2.dataset.stock; return; }
  const h = e.target.closest('[data-hedge]'); if (h) { CUR = h.dataset.hedge; $$('#stk button').forEach(x => x.classList.toggle('on', x.dataset.s === CUR)); chartDrawn = false; loadNvda(); closePage(); setTimeout(() => go('math'), 320); return; }
  const sh = e.target.closest('[data-share]'); if (sh) { const u = location.origin + '/#/s/' + sh.dataset.share; navigator.clipboard && navigator.clipboard.writeText(u); toast('link copied'); } });
addEventListener('resize', () => { if (SPG && NVS[SPG]) drawChart($('#spChart'), NVS[SPG]); });

// ---------------------------------------------------------------- a coin's page and its creator's console
const page = $('#page'); let PAGE = null;
function route() { const m = /^#\/c\/([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(location.hash), st = /^#\/s\/([A-Z0-9.]{1,8})$/i.exec(location.hash); if (m) showCoin(m[1]); else if (st) showStock(st[1].toUpperCase()); else hidePage(); }
const routeRefresh = () => { if (PAGE) showCoin(PAGE, true); };
addEventListener('hashchange', route);
const closePage = () => { history.pushState('', '', location.pathname + location.search); hidePage(); }; $('#pageClose').onclick = closePage;
page.addEventListener('click', e => { if (e.target === page) $('#pageClose').click(); });
addEventListener('keydown', e => { if (page.hidden) return; if (e.key === 'Escape') closePage(); if (SPG && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) stepStock(e.key === 'ArrowRight' ? 1 : -1); });
function hidePage() { PAGE = null; SPG = null; if (page.hidden) return; page.classList.remove('on'); if (lenis) lenis.start(); setTimeout(() => page.hidden = true, 300); document.documentElement.style.overflow = ''; }
async function showCoin(m, quiet) { PAGE = m; SPG = null; openPage();
  const B = $('#pageBody'); if (!quiet) B.innerHTML = '<p class="dim" style="padding:60px 0;text-align:center">reading the coin, its position and its history…</p>';
  try { const c = await api('coin', { mint: m, fresh: quiet ? 1 : undefined }); if (PAGE !== m) return; renderCoin(c); } catch (e) { B.innerHTML = `<p class="note err" style="padding:60px 0">${esc(e.message)}</p>`; } }
function renderCoin(c) { const B = $('#pageBody'), p = c.pos || {}, sym = c.coin && c.coin.symbol ? c.coin.symbol : short(c.mint), mine = WALLET && WALLET === c.creator;
  B.innerHTML = `<div class="cc-top">${coinImg(c)}<div><b style="font-size:26px">$${esc(sym)}</b><small>${esc(c.coin ? c.coin.name : '')} · by ${short(c.creator)}</small></div><span class="rule ${c.side}">${lg(c.sym || 'NVDA', 'xs')}${ruleTxt(c.side, c.sym)} ${c.lev}x</span></div>
    <div class="row" style="margin-top:16px"><a class="btn sm" href="https://pump.fun/coin/${esc(c.mint)}" target="_blank" rel="noopener">buy on pump.fun</a><button class="btn sm ghost" data-copy="${esc(c.mint)}">copy CA</button><a class="btn sm ghost" href="https://solscan.io/tx/${esc(c.sig)}" target="_blank" rel="noopener">launch tx</a></div>
    <div class="p-grid"><div class="card"><div class="tc-top"><div><b>${esc(c.sym)} position</b><span>${p.open ? (p.size < 0 ? 'short ' : 'long ') + nf(Math.abs(p.size), 3) + ' shares · entry $' + nf(p.entry, 2) : 'not open yet'}</span></div><div class="tc-px"><b class="${p.upnl >= 0 ? 'g' : 'r'}">${p.open ? usd(p.upnl) : '—'}</b><span>${p.open ? pct(p.ret, 1) + ' on collateral' : ''}</span></div></div><canvas id="pChart"></canvas></div>
      <div class="stat-grid"><div><span>mcap</span><b>${c.coin ? usd(c.coin.mcap) : '—'}</b></div><div><span>holders</span><b>${c.coin ? nf(c.coin.holders, 0) : '—'}</b></div><div><span>collateral</span><b>${p.open ? usd(p.collUsd) : '—'}</b></div><div><span>funded</span><b>${nf(c.funded, 3)} SOL</b></div><div><span>paid to holders</span><b>${nf(c.paid, 3)} SOL</b></div><div><span>payouts</span><b>${nf(c.payouts, 0)}</b></div><div><span>rounds</span><b>${nf(c.rounds, 0)}</b></div><div><span>leverage now</span><b>${p.open && p.lev ? nf(p.lev, 1) + 'x' : '—'}</b></div><div><span>launched</span><b>${ago(c.at)}</b></div></div></div>
    <div id="console"></div><div class="sec-t">history</div><div class="hist">${c.history.length ? c.history.slice().reverse().map(h => `<div><span class="dim">${ago(h.at)}</span><span>${h.kind === 'fund' ? 'funded the position with ' + nf(h.sol, 3) + ' SOL' : h.kind === 'claim' ? 'claimed ' + nf(h.sol, 3) + ' SOL of creator fees' : h.kind === 'close' ? 'closed the position' : 'paid holders ' + nf(h.sol, 4) + ' SOL (' + h.to + ' wallets, batch ' + esc(h.part) + ')'}</span><a href="https://solscan.io/tx/${esc(h.sig)}" target="_blank" rel="noopener">tx</a></div>`).join('') : '<div><span></span><span class="dim">nothing yet. the creator funds the position from this page.</span><span></span></div>'}</div>`;
  api('stock', { s: c.sym }).then(n => drawChart($('#pChart'), n.bars, { entry: p.open ? p.entry : null })).catch(() => { });
  B.onclick = e => { const cp = e.target.closest('[data-copy]'); if (cp) { navigator.clipboard && navigator.clipboard.writeText(cp.dataset.copy); toast('contract address copied'); } };
  if (mine) consoleFor(c); else if (!WALLET) $('#console').innerHTML = `<p class="dim" style="font-size:12px;margin-top:16px">Are you this coin's creator? <a href="#" id="cConn" style="text-decoration:underline">connect</a> to run its position.</p>`, $('#cConn').onclick = ev => { ev.preventDefault(); connect(); }; }
async function consoleFor(c) { const box = $('#console'), w = WALLET, p = c.pos || {}; box.innerHTML = '<div class="console"><p class="dim">checking your Phoenix access and fees…</p></div>';
  const [acc, fee] = await Promise.all([api('access', { w }).catch(() => ({ ready: false })), api('fees', { w }).catch(() => ({ sol: 0 }))]);
  box.innerHTML = `<div class="console" style="margin-top:18px"><h3>Your console</h3>
    ${acc.ready ? '<p class="g" style="font-size:12px">Phoenix: this wallet can trade.</p>' : `<p class="note err" style="text-align:left">Phoenix asks new wallets to activate before trading. Activate at <a href="https://phoenix.trade" target="_blank" rel="noopener" style="text-decoration:underline">phoenix.trade</a>${CONFIG.ref ? ' with the referral code <b>' + esc(CONFIG.ref) + '</b>' : ''}, then come back.</p>`}
    <div class="row2"><span style="flex:1;font-size:13px">creator fees waiting: <b>${nf(fee.sol, 4)} SOL</b></span><button class="btn sm ghost" id="cClaim"${fee.sol >= .0001 ? '' : ' disabled'}>claim</button></div>
    <div class="row2"><input id="cFund" type="number" min="0.05" step="0.05" placeholder="SOL to put into the position"><button class="btn sm" id="cFundGo"${acc.ready ? '' : ' disabled'}>fund ${c.side === 'S' ? 'short' : 'long'} ${esc(c.sym)} ${c.lev}x</button></div>
    <div class="row2"><span style="flex:1;font-size:13px">${p.open ? 'open: ' + (p.size < 0 ? 'short ' : 'long ') + nf(Math.abs(p.size), 3) + ' ' + esc(c.sym) + ' · ' + usd(p.upnl) : 'no open position'}</span><button class="btn sm red" id="cClose"${p.open ? '' : ' disabled'}>close</button></div>
    <div class="row2"><input id="cPay" type="number" min="0.01" step="0.01" placeholder="SOL to pay holders"><button class="btn sm" id="cPayGo">pay holders</button></div>
    <p class="note" id="cNote">every step is signed in your wallet and recorded on this page.</p></div>`;
  const note = $('#cNote'), run = async (label, fn) => { note.className = 'note'; note.textContent = label; try { await fn(); note.className = 'note ok'; note.textContent = 'done. refreshing…'; setTimeout(() => showCoin(c.mint, true), 3500); } catch (e) { note.className = 'note err'; note.textContent = /reject|cancel|denied/i.test(e.message) ? 'you did not sign. nothing happened.' : e.message; } };
  const sendAll = async (txs, label) => { for (let i = 0; i < txs.length; i++) { note.textContent = `${label}: sign ${i + 1} of ${txs.length}`; await confirm(await signSend(txs[i])); } };
  $('#cClaim').onclick = () => run('building the claim…', async () => sendAll((await api('claim', {}, { from: w, mint: c.mint })).txs, 'claim'));
  $('#cFundGo').onclick = () => run('building the round…', async () => { const r = await api('fund', {}, { from: w, mint: c.mint, sol: +$('#cFund').value }); note.textContent = `${r.plan.side === 'S' ? 'short' : 'long'} ${nf(r.plan.qty, 3)} ${r.plan.sym} ($${nf(r.plan.notional, 0)}) at ${r.plan.lev}x`; await sleep(900); await sendAll(r.txs, 'fund'); });
  $('#cClose').onclick = () => run('building the close…', async () => sendAll((await api('close', {}, { from: w, mint: c.mint })).txs, 'close'));
  $('#cPayGo').onclick = () => run('reading the holders…', async () => { const r = await api('pay', {}, { from: w, mint: c.mint, sol: +$('#cPay').value }); note.textContent = `${nf(r.sol, 4)} SOL to ${r.holders} holders`; await sleep(900); await sendAll(r.txs, 'pay'); }); }

// ---------------------------------------------------------------- start
function motion() { if (window.Lenis && !reduced) { lenis = new Lenis({ duration: 1.1, smoothWheel: true, prevent: n => !!n.closest('.page') }); if (window.gsap) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); } }
  const nav = $('#nav'), links = $$('.links a'); addEventListener('scroll', () => { document.body.classList.toggle('scrolled', scrollY > 40); let cur = -1; links.forEach((a, i) => { const s = document.getElementById(a.dataset.go); if (s && s.getBoundingClientRect().top < innerHeight * .45) cur = i; }); links.forEach((a, i) => a.classList.toggle('on', i === cur)); }, { passive: true });
  if (!window.gsap || reduced) return; gsap.registerPlugin(ScrollTrigger);
  gsap.from(['.hero .pill', '.hero h1', '.hero .sub', '.hero .row', '.hero .stack'], { y: 30, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .09, delay: .15 });
  gsap.from('.pl', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: .07, scrollTrigger: { trigger: '.pulse', start: 'top 92%' } });
  gsap.from('.ticker-card', { y: 40, opacity: 0, scale: .97, duration: 1.3, ease: 'expo.out', delay: .2 });
  gsap.set('.rv', { opacity: 0 }); ScrollTrigger.batch('.rv', { start: 'top 88%', onEnter: b => gsap.fromTo(b, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: .08, overwrite: true }) });
  gsap.from('.orbit', { scale: .5, opacity: 0, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: '.close', start: 'top 75%' } }); }
api('config').then(c => { CONFIG = c; const L = []; if (c.ca) L.push(`<button class="btn ghost" id="ca">CA ${short(c.ca)}</button>`, `<a class="btn ghost" href="https://pump.fun/coin/${esc(c.ca)}" target="_blank" rel="noopener">buy $MINT</a>`); if (c.x) L.push(`<a class="btn ghost" href="${esc(c.x)}" target="_blank" rel="noopener">𝕏</a>`); $('#links').innerHTML = L.join(''); const ca = $('#ca'); if (ca) ca.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(c.ca); toast('contract address copied'); }; }).catch(() => { });
preview(); calc(); loadNvda(); loadStocks(); loadCoins(); route();
// the world: the intro flies over the market and throws you into the site; then the same field lives behind it
(function world() { const box = $('#intro'), cv = $('#world'); let shown = false;
  const reveal = () => { if (shown) return; shown = true; try { sessionStorage.setItem('mintIntro', '1'); } catch { } document.body.classList.remove('intro-on'); box.classList.add('gone'); motion(); setTimeout(() => box.remove(), 1200); };
  const flat = () => { cv.remove(); startBg2d(); reveal(); };
  let seen = false; try { seen = !!sessionStorage.getItem('mintIntro'); } catch { }
  const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  if (reduced || !webgl) return flat();
  const introOn = !(seen || /^#\/[cs]\//.test(location.hash) || /[?&]nointro/.test(location.search)); if (!introOn) reveal(); else { document.body.classList.add('flying'); try { history.scrollRestoration = 'manual'; } catch { } scrollTo(0, 0); }
  import('./world.js?v=1').then(m => { const w = WORLD = m.createWorld(cv, { intro: introOn, onReveal: reveal, onEnd: () => document.body.classList.remove('flying') });
    if (STK.length) w.setBias((STK.filter(x => x.ch24 > 0).length / STK.length - .5) * 2);
    const sc = () => w.setScroll(scrollY); addEventListener('scroll', sc, { passive: true }); sc();
    addEventListener('pointermove', e => w.setPointer(e.clientX / innerWidth - .5, e.clientY / innerHeight - .5), { passive: true });
    const skip = () => { w.skip(); }; $('#skip').onclick = skip; addEventListener('keydown', e => { if (!shown && (e.key === 'Escape' || e.key === 'Enter')) skip(); });
    if (introOn) setTimeout(reveal, (m.END + 2) * 1000); }).catch(flat); })();
// a soft light follows the pointer across the glass cards
document.addEventListener('pointermove', e => { const c = e.target.closest && e.target.closest('.spot'); if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }, { passive: true });
// launch helpers: a name idea, quick first buys, open the stock
$('#lDice').onclick = () => { const st = stkOf(L.stock), nm = (st && st.name && st.name !== L.stock ? st.name : L.stock).split(/[ ,.]/)[0].toLowerCase(), S = L.side === 'S';
  const ideas = S ? [[nm + ' hedge', 'HEDGE'], [nm + ' puts', 'PUTS'], ['short ' + nm, 'S' + L.stock], [nm + ' insurance', 'INSURE'], [nm + ' crash', 'CRASH'], ['bear ' + nm, 'BEAR']] : [[nm + ' moon', 'MOON'], [nm + ' calls', 'CALLS'], ['long ' + nm, 'L' + L.stock], [nm + ' send', 'SEND'], ['bull ' + nm, 'BULL'], [nm + ' ' + L.lev + 'x', L.stock + L.lev + 'X']];
  const k = ideas[Math.floor(Math.random() * ideas.length)]; $('#lName').value = k[0].slice(0, 32); $('#lSym').value = k[1].slice(0, 10); preview(); };
chipGroup('#lBuyQ', d => { $('#lBuy').value = d.v; }); $('#lOpen').onclick = () => { location.hash = '/s/' + L.stock; };
setInterval(() => { if (!document.hidden) loadStocks(); }, 30000); setInterval(() => { if (!document.hidden) loadNvda(); }, 10000); setInterval(() => { if (!document.hidden && !PAGE) loadCoins(); }, 30000);
})();
