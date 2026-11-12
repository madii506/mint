// MINT. Launch a coin that bets on NVIDIA.
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
let CONFIG = {}, WALLET = null, NV = null, lenis = null, CUR = 'NVDA', STK = [];
const FEATURED = ['NVDA', 'TSLA', 'AAPL', 'META', 'GOOGL', 'MSFT', 'AMZN', 'AMD', 'PLTR', 'COIN', 'MSTR', 'SPY', 'QQQ'];
const stkPx = sym => { const x = STK.find(s => s.symbol === sym); return x ? x.mark : (NV && NV.symbol === sym ? NV.mark : null); };

// ---------------------------------------------------------------- background: faint circuit traces with pulses running along them
(function bg() { const c = $('#bg'), x = c.getContext('2d'); let W, H, traces = [], pulses = [];
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); traces = [];
    for (let i = 0; i < 26; i++) { const y = Math.round(Math.random() * H / 24) * 24, x0 = Math.random() * W, len = 120 + Math.random() * 380, turn = Math.random() < .5 ? 1 : -1, dy = (40 + Math.random() * 140) * turn;
      traces.push([[x0, y], [x0 + len * .6, y], [x0 + len * .6 + Math.abs(dy) * .6, y + dy], [x0 + len + Math.abs(dy), y + dy]]); } pulses = traces.map(() => ({ t: Math.random(), v: .04 + Math.random() * .08 })); };
  size(); addEventListener('resize', size);
  const at = (p, t) => { const L = []; let tot = 0; for (let i = 1; i < p.length; i++) { const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); L.push(l); tot += l; } let d = t * tot; for (let i = 1; i < p.length; i++) { if (d <= L[i - 1]) { const k = d / L[i - 1]; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k]; } d -= L[i - 1]; } return p[p.length - 1]; };
  let last = performance.now(); (function f(now) { requestAnimationFrame(f); const dt = Math.min(.05, (now - last) / 1000); last = now; x.clearRect(0, 0, W, H);
    x.lineWidth = 1; x.strokeStyle = 'rgba(92,242,184,.055)'; traces.forEach(p => { x.beginPath(); p.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.stroke(); x.fillStyle = 'rgba(92,242,184,.12)'; x.beginPath(); x.arc(p[3][0], p[3][1], 2, 0, 7); x.fill(); });
    if (!reduced) pulses.forEach((u, i) => { u.t += u.v * dt; if (u.t > 1) u.t = 0; const [px, py] = at(traces[i], u.t); x.fillStyle = 'rgba(92,242,184,.5)'; x.beginPath(); x.arc(px, py, 1.6, 0, 7); x.fill(); }); })(last); })();

// ---------------------------------------------------------------- NVIDIA, live from Phoenix
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
async function loadNvda() { try { const n = NV = await api('stock', { s: CUR }), px = $('#px'); $('#tcSym').textContent = n.symbol; $('#tcName').textContent = (n.name && n.name !== n.symbol ? n.name + ' · ' : '') + 'perp on Phoenix'; const old = px.dataset.v ? +px.dataset.v : null; px.textContent = '$' + nf(n.mark, 2); px.dataset.v = n.mark;
    if (old != null && old !== n.mark && window.gsap) gsap.fromTo(px, { color: n.mark > old ? '#5cf2b8' : '#ff6b6b' }, { color: '#eef3f1', duration: 1.2 });
    $('#ch').innerHTML = `<span class="${n.ch24 >= 0 ? 'g' : 'r'}">${pct(n.ch24)}</span> 24h`; $('#vol').textContent = usd(n.volUsd); $('#oi').textContent = nf(n.oi, 0) + ' sh'; $('#fund').textContent = n.funding == null ? '—' : nf(n.funding * 100, 4) + '%';
    $('#earn').textContent = n.earnings ? new Date(n.earnings.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (n.earnings.time === 'amc' ? ' · after close' : '') : '—';
    $('#mktState').textContent = n.status === 'active' ? (n.afterHours ? n.symbol + ' · after hours on Phoenix' : 'stocks · live on Phoenix') : n.symbol + ' · ' + n.status; $('.pill .dot').classList.toggle('off', n.status !== 'active');
    if (!chartDrawn && window.gsap && !reduced) { chartDrawn = true; const o = { p: 0 }; gsap.to(o, { p: 1, duration: 1.6, ease: 'power3.out', onUpdate: () => drawChart($('#chart'), n.bars, { progress: o.p }) }); } else drawChart($('#chart'), n.bars);
    preview(); calc(); } catch (e) { $('#mktState').textContent = CUR + ' · ' + e.message; } }
// every stock Phoenix lists, live; the hero card switches between them and the launch form picks from them
async function loadStocks() { try { STK = await api('stocks'); } catch { STK = []; } const list = STK.length ? STK : FEATURED.map(symbol => ({ symbol }));
  const chip = (x, cls) => `<button type="button" data-s="${esc(x.symbol)}"${x.symbol === cls ? ' class="on"' : ''}>${esc(x.symbol)}${x.ch24 != null ? `<small class="${x.ch24 >= 0 ? 'g' : 'r'}">${pct(x.ch24, 1)}</small>` : ''}</button>`;
  const feat = FEATURED.map(f => list.find(x => x.symbol === f)).filter(Boolean); $('#stk').innerHTML = feat.map(x => chip(x, CUR)).join('');
  const sorted = [...feat, ...list.filter(x => !FEATURED.includes(x.symbol))]; $('#lStock').innerHTML = sorted.map(x => chip(x, L.stock)).join(''); preview(); board(); tape(); heat(); if (!radarDone) { radarDone = true; radar(); } }
let radarDone = false;
// the stock board: every stock Phoenix lists, searchable, each one a button that fills the mint form
const earn = e => { if (!e) return '<span class="dim">—</span>'; const d = new Date(e.date + 'T12:00:00Z'), days = Math.round((d - Date.now()) / 864e5); return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${e.time === 'amc' ? ' · after close' : e.time === 'bmo' ? ' · before open' : ''}${days >= 0 && days <= 14 ? ` <span class="soon">in ${days}d</span>` : ''}`; };
// the tape: every stock, scrolling
function tape() { if (!STK.length) return; const h = STK.map(x => `<span data-pick="${esc(x.symbol)}"><b>${esc(x.symbol)}</b>$${nf(x.mark, 2)} <i class="${x.ch24 >= 0 ? 'g' : 'r'}" style="font-style:normal">${pct(x.ch24, 2)}</i></span>`).join(''); $('.tape-in').innerHTML = h + h; }
// the heatmap: sized by today's volume, coloured by today's move
let heatDone = false;
function heat() { const H = $('#heat'); if (!STK.length) { H.innerHTML = '<p class="dim">Phoenix is not answering right now.</p>'; return; } const L = STK.slice().sort((a, b) => (b.volUsd || 0) - (a.volUsd || 0)), mx = Math.max(...L.map(x => Math.abs(x.ch24 || 0)), .02);
  H.innerHTML = L.map((x, i) => { const k = Math.min(1, Math.abs(x.ch24 || 0) / mx), up = (x.ch24 || 0) >= 0, bg = up ? `rgba(92,242,184,${.08 + k * .5})` : `rgba(255,107,107,${.08 + k * .5})`, w = i < 2 ? 'w4' : i < 6 ? 'w3' : i < 14 ? 'w2' : 'w1';
    return `<div class="ht ${w}" data-pick="${esc(x.symbol)}" style="background:${bg}"><div><b>${esc(x.symbol)}</b><br><small>${esc(x.name || '')}</small></div><span>${pct(x.ch24, 2)} · $${nf(x.mark, 2)}</span></div>`; }).join('');
  if (!heatDone && window.gsap && !reduced) { heatDone = true; gsap.from($$('.ht', H), { scale: .85, opacity: 0, duration: .8, ease: 'expo.out', stagger: .015, scrollTrigger: { trigger: H, start: 'top 85%' } }); } }
// the earnings radar: who reports in the next 45 days, on one line
function radar() { const B = $('#radarBox'), now = Date.now(), span = 45 * 864e5, L = STK.filter(x => x.earnings && x.earnings.date).map(x => ({ ...x, t: new Date(x.earnings.date + 'T21:00:00Z').getTime() })).filter(x => x.t >= now - 864e5 && x.t <= now + span).sort((a, b) => a.t - b.t);
  const pos = t => `calc(24px + (100% - 48px) * ${Math.max(0, Math.min(1, (t - now) / span)).toFixed(4)})`; let ticks = ''; for (let d = 0; d <= 45; d += 15) ticks += `<span class="rd-tick" style="left:${pos(now + d * 864e5)}">${d ? '+' + d + 'd' : 'today'}</span>`;
  const days = []; L.forEach(x => { const d = days.find(g => g.date === x.earnings.date); d ? d.L.push(x) : days.push({ date: x.earnings.date, t: x.t, L: [x] }); });
  B.innerHTML = '<div class="rd-axis"></div><div class="rd-now"></div>' + ticks + (days.length ? days.map((g, i) => `<div class="rd-dot${g.t - now < 7 * 864e5 ? ' hot' : ''}" data-pick="${esc(g.L[0].symbol)}" style="left:${pos(g.t)}"><b style="bottom:${18 + (i % 3) * 40}px">${g.L.slice(0, 4).map(x => esc(x.symbol)).join(' · ')}${g.L.length > 4 ? ' +' + (g.L.length - 4) : ''} <span class="dim">${new Date(g.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></b><i></i></div>`).join('') : '<p class="dim" style="padding:24px">No earnings in the next 45 days.</p>');
  if (window.gsap && !reduced) gsap.from($$('.rd-dot', B), { y: 20, opacity: 0, duration: .9, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: B, start: 'top 85%' } }); }
document.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b) return; L.stock = b.dataset.pick; $$('#lStock button').forEach(x => x.classList.toggle('on', x.dataset.s === L.stock)); preview(); go('launch'); });
function board() { const B = $('#board'), q = ($('#sFind').value || '').trim().toUpperCase(), list = STK.filter(x => !q || x.symbol.includes(q) || String(x.name || '').toUpperCase().includes(q)).sort((a, b) => (b.volUsd || 0) - (a.volUsd || 0));
  $('#sCount').textContent = STK.length ? `${list.length} of ${STK.length} stocks` : '';
  B.innerHTML = '<div class="br th"><span>stock</span><span>price</span><span>24h</span><span>volume</span><span>next earnings</span><span></span></div>' + (STK.length ? list.map(x => `<div class="br"><span><b>${esc(x.symbol)}</b><small>${esc(x.name || '')}</small></span><span>$${nf(x.mark, 2)}</span><span class="${x.ch24 >= 0 ? 'g' : 'r'}">${pct(x.ch24, 2)}</span><span>${usd(x.volUsd)}</span><span>${earn(x.earnings)}</span><span><button class="btn sm" data-mint="${esc(x.symbol)}">mint a coin</button></span></div>`).join('') : '<div class="br"><span class="dim">Phoenix is not answering right now.</span></div>'); }
$('#sFind').addEventListener('input', board);
document.addEventListener('click', e => { const b = e.target.closest('[data-mint]'); if (!b) return; L.stock = b.dataset.mint; $$('#lStock button').forEach(x => x.classList.toggle('on', x.dataset.s === L.stock)); preview(); go('launch'); });
// hedge math: how much a short coin at Nx moves for a given drop, and how much collateral covers a holding
function calc() { const hold = Math.max(0, +$('#mHold').value || 0), drop = Math.min(90, Math.max(1, +$('#mDrop').value || 0)) / 100, lev = M.lev, sol = NV && NV.sol, need = hold / lev, wipe = Math.round(90 / lev);
  $('#mOut').innerHTML = `<span class="dim" style="font-size:12px">to cover a ${nf(drop * 100, 0)}% drop on $${nf(hold, 0)}</span><div class="big">$${nf(need, 0)} <span class="dim" style="font-size:18px">of collateral${sol ? ' · ' + nf(need / sol, 2) + ' SOL' : ''}</span></div>
    <div class="bar2"><i style="width:50%;background:var(--red)"></i><i style="width:50%;background:var(--g)"></i></div>
    <div class="kv"><span>your stock loses</span><b class="r">-$${nf(hold * drop, 0)}</b><span>a ${lev}x short on $${nf(need, 0)} gains</span><b class="g">+$${nf(need * lev * drop, 0)}</b><span>net</span><b>$${nf(need * lev * drop - hold * drop, 0)}</b><span>but if it rises about ${wipe}% first</span><b class="r">the short is wiped</b></div>`; }
const M = { lev: 5 }; ['#mHold', '#mDrop'].forEach(s => $(s).addEventListener('input', calc));
$('#mLev').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#mLev button').forEach(x => x.classList.toggle('on', x === b)); M.lev = +b.dataset.v; calc(); });
$('#stk').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; CUR = b.dataset.s; $$('#stk button').forEach(x => x.classList.toggle('on', x === b)); chartDrawn = false; loadNvda(); });
$('#lStock').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; L.stock = b.dataset.s; $$('#lStock button').forEach(x => x.classList.toggle('on', x === b)); preview(); });
addEventListener('resize', () => NV && drawChart($('#chart'), NV.bars));

// ---------------------------------------------------------------- the flow: trades → creator fees → NVDA position → SOL to holders
(function flow() { const c = $('#flow'), x = c.getContext('2d'); let W, H; const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = c.clientWidth; H = c.clientHeight; c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); }; size(); addEventListener('resize', size);
  const nodes = () => [[W * .1, H / 2, 'trades'], [W * .37, H / 2, 'creator fees'], [W * .63, H / 2, 'NVDA position'], [W * .9, H / 2, 'SOL to holders']];
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
  $('#lPrev').innerHTML = `<div class="cc-top"><img src="/assets/coins/${L.img}.png" alt=""><div><b>$${esc(sym)}</b><small>${esc(name)}</small></div><span class="rule ${L.side}">${ruleTxt(L.side, L.stock)} ${L.lev}x</span></div>
    <div class="cc-pos"><div><span>${esc(L.stock)} now</span><b>${px ? '$' + nf(px, 2) : '—'}</b></div><div><span>1 SOL buys</span><b>${NV && NV.sol ? '$' + nf(NV.sol * L.lev * .85, 0) : '—'}</b></div><div><span>exposure</span><b>${L.lev}x</b></div></div>
    <p class="dim" style="font-size:13px">${L.side === 'S' ? `Pays when ${esc(L.stock)} falls. Hold it next to your ${esc(L.stock)} as a hedge.` : `Pays when ${esc(L.stock)} rises. A leveraged bet on it.`}</p>`;
  $('#lLiq').textContent = `at ${L.lev}x, a move of about ${wipe}% ${L.side === 'S' ? 'up' : 'down'} in ${L.stock} can wipe the position.`; }
$('#launchForm').onsubmit = async e => { e.preventDefault(); const note = $('#lNote'), btn = $('#lGo'); if (!WALLET && !(await connect())) return;
  const name = $('#lName').value.trim(), symbol = $('#lSym').value.trim(); if (!name || !symbol) return toast('give the coin a name and a ticker');
  btn.disabled = true; note.className = 'note'; note.textContent = 'building the launch…';
  try { const S = await web3(), kp = S.Keypair.generate(), r = await api('launch', {}, { from: WALLET, mint: kp.publicKey.toBase58(), name, symbol, stock: L.stock, side: L.side, lev: L.lev, img: L.img, devBuy: +$('#lBuy').value });
    note.textContent = 'sign the launch in your wallet'; const sig = await signSend(r.txs[0], kp); note.textContent = 'launching…'; await confirm(sig);
    note.className = 'note ok'; note.innerHTML = `launched. <a href="https://pump.fun/coin/${esc(r.mint)}" target="_blank" rel="noopener" style="text-decoration:underline">see it on pump.fun</a> · <a href="#/c/${esc(r.mint)}" style="text-decoration:underline">open its page</a>`; toast('your coin is live'); setTimeout(() => loadCoins(1), 4000); }
  catch (err) { note.className = 'note err'; note.textContent = /reject|cancel|denied/i.test(err.message) ? 'you did not sign. nothing happened.' : err.message; } finally { btn.disabled = false; } };

// ---------------------------------------------------------------- coins
const coinImg = c => c.coin && c.coin.icon ? `<img src="${esc(c.coin.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph'}))">` : '<span class="ph"></span>';
const posCells = p => p && p.open ? `<div><span>position</span><b>${nf(Math.abs(p.size), 3)} sh</b></div><div><span>P&amp;L</span><b class="${p.upnl >= 0 ? 'g' : 'r'}">${usd(p.upnl)}</b></div><div><span>return</span><b class="${p.ret >= 0 ? 'g' : 'r'}">${pct(p.ret, 1)}</b></div>` : `<div><span>position</span><b class="dim">not open</b></div><div><span>P&amp;L</span><b>—</b></div><div><span>return</span><b>—</b></div>`;
function card(c) { const sym = c.coin && c.coin.symbol ? c.coin.symbol : short(c.mint);
  return `<div class="coin-card" data-coin="${esc(c.mint)}"><div class="cc-top">${coinImg(c)}<div><b>$${esc(sym)}</b><small>${c.coin ? usd(c.coin.mcap) + ' mcap · ' + nf(c.coin.holders, 0) + ' holders' : 'just launched'}</small></div><span class="rule ${c.side}">${ruleTxt(c.side, c.sym)} ${c.lev}x</span></div>
    <div class="cc-pos">${posCells(c.pos)}</div><div class="cc-foot"><span>funded ${nf(c.funded, 3)} SOL</span><span>paid ${nf(c.paid, 3)} SOL</span><span>${ago(c.last)}</span></div></div>`; }
async function loadCoins(fresh) { const G = $('#coinGrid'); try { const j = await api('coins', fresh ? { fresh: 1 } : {});
    if (!j.coins.length) { G.innerHTML = `<div class="empty"><img src="/favicon.png" alt=""><span>No MINT coin yet. The first one launched shows here, with its NVIDIA position live.</span><a class="btn sm" href="#launch" data-go="launch">launch the first</a></div>`; return; }
    G.innerHTML = j.coins.map(card).join(''); if (window.gsap && !reduced) gsap.from($$('.coin-card', G), { y: 30, opacity: 0, duration: .9, ease: 'expo.out', stagger: .05 }); }
  catch (e) { G.innerHTML = `<div class="empty">The chain is not answering right now. ${esc(e.message)}</div>`; } }
document.addEventListener('click', e => { const c = e.target.closest('[data-coin]'); if (c) location.hash = '/c/' + c.dataset.coin; const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); } });
function go(id) { const el = id === 'top' ? 0 : document.getElementById(id); if (el == null) return; if (lenis) lenis.scrollTo(el, { offset: id === 'top' ? 0 : -80, duration: 1.4 }); else (el === 0 ? scrollTo(0, 0) : el.scrollIntoView({ behavior: 'smooth' })); }

// ---------------------------------------------------------------- a coin's page and its creator's console
const page = $('#page'); let PAGE = null;
function route() { const m = /^#\/c\/([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(location.hash); if (m) showCoin(m[1]); else hidePage(); }
const routeRefresh = () => { if (PAGE) showCoin(PAGE, true); };
addEventListener('hashchange', route);
$('#pageClose').onclick = () => { history.pushState('', '', location.pathname + location.search); hidePage(); };
page.addEventListener('click', e => { if (e.target === page) $('#pageClose').click(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !page.hidden) $('#pageClose').click(); });
function hidePage() { PAGE = null; if (page.hidden) return; page.classList.remove('on'); if (lenis) lenis.start(); setTimeout(() => page.hidden = true, 300); document.documentElement.style.overflow = ''; }
async function showCoin(m, quiet) { PAGE = m; page.hidden = false; requestAnimationFrame(() => page.classList.add('on')); if (lenis) lenis.stop(); document.documentElement.style.overflow = 'hidden';
  const B = $('#pageBody'); if (!quiet) B.innerHTML = '<p class="dim" style="padding:60px 0;text-align:center">reading the coin, its position and its history…</p>';
  try { const c = await api('coin', { mint: m, fresh: quiet ? 1 : undefined }); if (PAGE !== m) return; renderCoin(c); } catch (e) { B.innerHTML = `<p class="note err" style="padding:60px 0">${esc(e.message)}</p>`; } }
function renderCoin(c) { const B = $('#pageBody'), p = c.pos || {}, sym = c.coin && c.coin.symbol ? c.coin.symbol : short(c.mint), mine = WALLET && WALLET === c.creator;
  B.innerHTML = `<div class="cc-top">${coinImg(c)}<div><b style="font-size:26px">$${esc(sym)}</b><small>${esc(c.coin ? c.coin.name : '')} · by ${short(c.creator)}</small></div><span class="rule ${c.side}">${ruleTxt(c.side, c.sym)} ${c.lev}x</span></div>
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
  const nav = $('#nav'), links = $$('.links a'); addEventListener('scroll', () => { let cur = -1; links.forEach((a, i) => { const s = document.getElementById(a.dataset.go); if (s && s.getBoundingClientRect().top < innerHeight * .45) cur = i; }); links.forEach((a, i) => a.classList.toggle('on', i === cur)); }, { passive: true });
  if (!window.gsap || reduced) return; gsap.registerPlugin(ScrollTrigger);
  gsap.from(['.hero .pill', '.hero h1', '.hero .sub', '.hero .row'], { y: 30, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .09 });
  gsap.from('.ticker-card', { y: 40, opacity: 0, scale: .97, duration: 1.3, ease: 'expo.out', delay: .2 });
  gsap.set('.rv', { opacity: 0 }); ScrollTrigger.batch('.rv', { start: 'top 88%', onEnter: b => gsap.fromTo(b, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: .08, overwrite: true }) });
  gsap.from('.close-mark', { scale: .6, opacity: 0, rotate: -20, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.close', start: 'top 75%' } }); }
api('config').then(c => { CONFIG = c; const L = []; if (c.ca) L.push(`<button class="btn ghost" id="ca">CA ${short(c.ca)}</button>`, `<a class="btn ghost" href="https://pump.fun/coin/${esc(c.ca)}" target="_blank" rel="noopener">buy $MINT</a>`); if (c.x) L.push(`<a class="btn ghost" href="${esc(c.x)}" target="_blank" rel="noopener">𝕏</a>`); $('#links').innerHTML = L.join(''); const ca = $('#ca'); if (ca) ca.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(c.ca); toast('contract address copied'); }; }).catch(() => { });
preview(); calc(); loadNvda(); loadStocks(); loadCoins(); route();
(function intro() { const box = $('#intro'); let gone = false; const leave = () => { if (gone) return; gone = true; try { sessionStorage.setItem('mintIntro', '1'); } catch { } box.classList.add('gone'); document.body.classList.remove('intro-on'); motion(); setTimeout(() => { if (box._it) box._it.dispose(); box.remove(); }, 1000); };
  let seen = false; try { seen = !!sessionStorage.getItem('mintIntro'); } catch { }
  const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  if (seen || reduced || !webgl || location.hash.startsWith('#/c/') || /[?&]nointro/.test(location.search)) return leave();
  $('#skip').onclick = leave; addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter') leave(); }, { once: true }); box.addEventListener('click', e => { if (e.target.closest('#skip')) return; });
  import('./intro.js?v=1').then(m => { box._it = m.createIntro($('#introCanvas'), { onEnd: leave }); requestAnimationFrame(() => box.classList.add('go')); setTimeout(leave, (m.END + 3) * 1000); }).catch(leave); })(); setInterval(() => { if (!document.hidden) loadStocks(); }, 30000); setInterval(() => { if (!document.hidden) loadNvda(); }, 10000); setInterval(() => { if (!document.hidden && !PAGE) loadCoins(); }, 30000);
})();
