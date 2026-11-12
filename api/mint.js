// MINT engine. Launch a coin that bets on NVIDIA.
// Every coin is a pump.fun coin with one rule, locked in its metadata at launch: SHORT NVDA (the hedge) or LONG NVDA, at 2x, 5x or 10x.
// The coin's creator fees fund that position on Phoenix (Solana's on-chain perps, NVDA market, SOL as collateral). The creator runs it
// from MINT in their own wallet: claim fees, fund and open, close, pay holders in SOL. MINT never holds a key or a coin.
// Every step carries a memo and a 0-lamport touch of the TAG address, so the whole history is read back from the chain.
const { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, ComputeBudgetProgram, VersionedTransaction, Keypair } = require('@solana/web3.js');
const CFG = require('./mint-config.json');

const RPCS = [process.env.RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);
async function rpcFetch(url, opts) { let last = null; for (let round = 0; round < 2; round++) { for (const u of RPCS) { try { const r = await fetch(u, { ...opts, signal: AbortSignal.timeout(20000) }); if (r.status === 429 || r.status === 401 || r.status === 403 || r.status >= 500) { last = r; continue; } return r; } catch (e) { last = e; } } await new Promise(r => setTimeout(r, 600)); } if (last instanceof Error) throw last; return last; }
const conn = new Connection(RPCS[0], { commitment: 'confirmed', fetch: rpcFetch, disableRetryOnRateLimit: true });

const PHX = 'https://perp-api.phoenix.trade', SYM = CFG.symbol, LEVS = CFG.levs, STOCKS = CFG.stocks;
const okSym = s => { s = String(s || '').toUpperCase(); if (!STOCKS.includes(s)) throw new Error('pick a stock Phoenix lists'); return s; };
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', T22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const SOL = 'So11111111111111111111111111111111111111112', JUP = 'https://lite-api.jup.ag', DAY = 86400;
const TAG = new PublicKey(process.env.MINT_TAG || CFG.tag), TAG58 = TAG.toBase58(), MIN_LAMPORTS = Math.round(CFG.minSol * 1e9);

const out = (res, code, b, cache) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('access-control-allow-origin', '*'); res.setHeader('cache-control', cache || 'no-store'); res.end(JSON.stringify(b)); };
const body = req => new Promise(ok => { if (req.body) return ok(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); let d = ''; req.on('data', c => d += c); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const okKey = s => { try { return s ? new PublicKey(String(s).trim()).toBase58() : null; } catch { return null; } };
const pk = (s, what) => { try { return new PublicKey(String(s || '').trim()); } catch { throw new Error(what || 'that is not a Solana address'); } };
const k58 = k => (k && k.toBase58) ? k.toBase58() : String(k);
async function getJ(url, ms = 8000, opts = {}) { const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(ms), headers: { accept: 'application/json', ...(opts.body ? { 'content-type': 'application/json' } : {}) } }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { } if (!r.ok) throw new Error((j && (j.error || j.message)) || (r.status + ' ' + url.split('/')[2])); return j; }
const cache = new Map();
async function memo(key, ttl, fn) { const c = cache.get(key); if (c && c.v !== undefined && Date.now() - c.t < ttl) return c.v; if (c && c.p) return c.p; const p = fn().then(v => { cache.set(key, { t: Date.now(), v }); return v; }, e => { if (c && c.v !== undefined) cache.set(key, { t: c.t, v: c.v }); else cache.delete(key); throw e; }); cache.set(key, { ...(c || { t: 0 }), p }); return p; }
async function pool(items, n, fn) { const res = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); } })); return res; }
const memoIx = (text, signer) => new TransactionInstruction({ programId: MEMO, keys: [{ pubkey: signer, isSigner: true, isWritable: false }], data: Buffer.from(text) });
const tagIx = from => SystemProgram.transfer({ fromPubkey: from, toPubkey: TAG, lamports: 0 });
const b64 = t => t.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
const fits = t => { try { return t.serialize({ requireAllSignatures: false, verifySignatures: false }).length <= 1232; } catch { return false; } };
const bh = async () => (await conn.getLatestBlockhash('confirmed')).blockhash;

// ---------------------------------------------------------------- NVIDIA on Phoenix
const phx = (p, ms) => getJ(PHX + p, ms || 9000);
const market = (sym = SYM) => memo('mkt:' + sym, 3600e3, () => phx(`/v1/view/exchange/market/${sym}`));
const solUsd = () => memo('solusd', 20000, async () => { const j = await getJ(`${JUP}/price/v3?ids=${SOL}`); return +((j[SOL] || {}).usdPrice) || null; });
const stock = (sym = SYM) => memo('stock:' + sym, 10000, async () => { const now = Date.now(), [st, m, c, s] = await Promise.all([phx(`/v1/market/${sym}/stats/latest`), market(sym), phx(`/v1/candles_v2/${sym}?timeframe=1h&from=${now - 8 * 86400e3}&to=${now}&limit=240`).catch(() => ({ bars: [] })), solUsd().catch(() => null)]);
  const md = m.metadata || {}, tiers = m.leverageTiers || [];
  return { symbol: sym, name: md.name || sym, mark: st.mark_price, oracle: st.oracle_price, prev: st.prev_day_mark_price, ch24: st.prev_day_mark_price ? st.mark_price / st.prev_day_mark_price - 1 : null, oi: st.open_interest, volUsd: st.day_volume_usd,
    funding: st.current_funding_rate, earnings: (md.earningsDatesV2 || [])[0] || null, maxLev: tiers.length ? tiers[0].maxLeverage : null, status: m.marketStatus, afterHours: !!(m.commodityMetadata && m.commodityMetadata.isAfterHours), takerFee: m.takerFee, sol: s,
    bars: (c.bars || []).map(b => [b.time, +(b.markClose ?? b.close)]), at: Date.now() }; });
// a wallet's NVDA position on Phoenix, read from Phoenix's public trader state
const lotsDec = async sym => (await market(sym)).baseLotsDecimals ?? 3;
// every listed stock with its live mark and 24h move, in one call
const meta = () => memo('meta', 3600e3, async () => { const j = await phx('/v1/view/exchange/markets'), L = Array.isArray(j) ? j : (j.markets || Object.values(j)), o = {};
  for (const m of L) { const md = m.metadata || {}; o[m.symbol] = { name: md.name || m.symbol, earnings: (md.earningsDatesV2 || [])[0] || null, maxLev: (m.leverageTiers || [])[0] ? m.leverageTiers[0].maxLeverage : null, status: m.marketStatus }; } return o; });
const stocks = () => memo('stocks', 20000, async () => { const [j, M] = await Promise.all([phx('/v1/markets/stats/latest'), meta().catch(() => ({}))]), L = Array.isArray(j) ? j : (j.markets || []), by = new Map(L.map(x => [x.symbol, x]));
  const o = STOCKS.filter(s => by.has(s)).map(s => { const x = by.get(s), m = M[s] || {}; return { symbol: s, name: m.name || s, mark: x.mark_price, ch24: x.prev_day_mark_price ? x.mark_price / x.prev_day_mark_price - 1 : null, volUsd: x.day_volume_usd, oi: x.open_interest, funding: x.current_funding_rate, earnings: m.earnings, maxLev: m.maxLev, status: m.status || 'active' }; });
  if (!o.length) throw new Error('Phoenix did not answer. try again in a minute'); return o; });
async function position(authority, sym = SYM) { return memo('pos:' + authority + ':' + sym, 12000, async () => { const [s, n, dec] = await Promise.all([phx(`/v1/trader/state/${authority}`).catch(() => null), stock(sym), lotsDec(sym)]);
  if (!s || !s.snapshot) return { state: 'unknown', open: false };
  const subs = s.snapshot.subaccounts || [], st = (s.snapshot.capabilities || {}).state || 'unknown'; let p = null, sub = null;
  for (const a of subs) for (const x of a.positions || []) if (x.symbol === sym && +x.basePositionLots) { p = x; sub = a; }
  const solIn = a => { let l = 0; for (const c of [].concat(a && a.spotCollaterals || [])) { const sym = String(c.symbol || c.asset || c.mint || ''); if (/SOL|So1111/.test(sym)) l += +(c.amount ?? c.lamports ?? c.balance ?? c.nativeAmount ?? 0) || 0; } return l; };
  if (!p) return { state: st, open: false, crossUsd: subs[0] ? +subs[0].collateral / 1e6 : 0, crossSol: subs[0] ? solIn(subs[0]) / 1e9 : 0 };
  const size = +p.basePositionLots / 10 ** dec, entry = +p.entryPriceUsd, mark = n.mark, upnl = size * (mark - entry), coll = +sub.collateral / 1e6, sol = solIn(sub) / 1e9, collUsd = coll + sol * (n.sol || 0), eq = collUsd + upnl;
  return { state: st, open: true, side: size < 0 ? 'S' : 'L', size, entry, mark, upnl, notional: Math.abs(size) * mark, collUsd, sol, lev: eq > 0 ? Math.abs(size) * mark / eq : null, sub: sub.subaccountIndex, ret: collUsd > 0 ? upnl / collUsd : null }; }); }
const access = w => memo('acc:' + w, 30000, async () => { const [c, s] = await Promise.all([phx(`/v1/invite/check/${w}`).catch(() => null), phx(`/v1/trader/state/${w}`).catch(() => null)]); const state = s && s.snapshot && (s.snapshot.capabilities || {}).state || 'unknown';
  return { whitelisted: !!(c && c.whitelisted), state, ready: !!(c && c.whitelisted) || (state !== 'uninitialized' && state !== 'unknown'), ref: process.env.PHOENIX_REF || null }; });

// ---------------------------------------------------------------- coins
const coinRow = t => { const s = t.stats24h || {}; return { symbol: t.symbol, name: t.name, icon: t.icon || null, usd: t.usdPrice ?? null, mcap: t.mcap ?? t.fdv ?? null, holders: t.holderCount ?? null, ch24: s.priceChange ?? null, vol24: (s.buyVolume || 0) + (s.sellVolume || 0), graduated: !!t.graduatedPool }; };
async function jupInfo(mints) { const o = {}, L = [...new Set(mints)].filter(Boolean); for (let i = 0; i < L.length; i += 90) { try { const j = await memo('jup:' + L.slice(i, i + 90).join(','), 30000, () => getJ(`${JUP}/tokens/v2/search?query=${L.slice(i, i + 90).join(',')}`)); for (const t of j || []) o[t.id] = coinRow(t); } catch { } } return o; }
async function mintInfo(mint) { return memo('mint:' + mint, 3600e3, async () => { const a = await conn.getAccountInfo(new PublicKey(mint)); if (!a) throw new Error('that coin does not exist yet'); const owner = a.owner.toBase58(); if (owner !== TOKEN && owner !== T22) throw new Error('that is not a token'); return { program: owner, decimals: a.data[44], supply: a.data.readBigUInt64LE(36).toString() }; }); }

// ---------------------------------------------------------------- the record: every launch, round and payout, read from the chain
const TX = new Map();
async function txs(sigs) { const need = [...new Set(sigs)].filter(s => !TX.has(s)); for (let i = 0; i < need.length; i += 10) { const part = need.slice(i, i + 10), got = await conn.getParsedTransactions(part, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }); got.forEach((t, k) => { if (t) TX.set(part[k], t); }); } return sigs.map(s => TX.get(s) || null); }
function parseRite(t, s) { if (!t || (t.meta && t.meta.err)) return null; const msg = t.transaction.message, by = k58(msg.accountKeys[0].pubkey), at = t.blockTime || s.blockTime || 0;
  const m = msg.instructions.find(ix => ix.program === 'spl-memo' && typeof ix.parsed === 'string' && ix.parsed.startsWith('mint:')); if (!m) return null; const p = m.parsed.split(':'), mint = okKey(p[3]); if (p[2] !== '1' || !mint) return null;
  if (p[1] === 'launch' && STOCKS.includes(p[4]) && /^[SL]$/.test(p[5]) && LEVS.includes(+p[6])) return { kind: 'launch', sig: s.signature, at, w: by, mint, sym: p[4], side: p[5], lev: +p[6] };
  if (p[1] === 'fund' && /^\d{1,15}$/.test(p[4])) return { kind: 'fund', sig: s.signature, at, w: by, mint, lamports: +p[4] };
  if (p[1] === 'claim' && /^\d{1,15}$/.test(p[4])) return { kind: 'claim', sig: s.signature, at, w: by, mint, lamports: +p[4] };
  if (p[1] === 'close') return { kind: 'close', sig: s.signature, at, w: by, mint };
  if (p[1] === 'pay') { const to = []; for (const ix of msg.instructions) { const P = ix.parsed; if (ix.program === 'system' && P && P.type === 'transfer' && P.info.source === by && P.info.destination !== TAG58 && P.info.lamports > 0) to.push([P.info.destination, P.info.lamports]); }
    return { kind: 'pay', sig: s.signature, at, w: by, mint, id: clean(p[4], 16), part: clean(p[5], 9), to: to.length, lamports: to.reduce((a, x) => a + x[1], 0) }; }
  return null; }
const IDX = { rows: new Map(), newest: null };
const rites = fresh => memo('rites', fresh ? 0 : 15000, async () => { let before, got = [];
  for (let page = 0; page < 6; page++) { const L = await conn.getSignaturesForAddress(TAG, { limit: 1000, before, until: IDX.newest || undefined }); got.push(...L); if (L.length < 1000) break; before = L[L.length - 1].signature; }
  const ok = got.filter(s => !s.err); if (ok.length) { const T = await txs(ok.map(s => s.signature)); let all = true; T.forEach((t, k) => { if (!t) { all = false; return; } const r = parseRite(t, ok[k]); if (r) IDX.rows.set(r.sig, r); }); if (all) IDX.newest = got[0].signature; }
  return [...IDX.rows.values()].sort((a, b) => b.at - a.at); });
// a launch counts only once its coin exists and only the creator's own rounds count for it
const creatorOfCoin = mint => memo('cr:' + mint, 86400e3, async () => { const SDK = require('@pump-fun/pump-sdk'), bc = await new SDK.OnlinePumpSdk(conn).fetchBondingCurve(new PublicKey(mint)); return bc && bc.creator ? bc.creator.toBase58() : null; });
async function launches(fresh) { const R = await rites(fresh), L = R.filter(r => r.kind === 'launch').sort((a, b) => a.at - b.at), seen = new Set(), cand = [];
  for (const l of L) if (!seen.has(l.mint + l.w)) { seen.add(l.mint + l.w); cand.push(l); }
  const ok = await pool(cand, 6, async l => { try { return (await creatorOfCoin(l.mint)) === l.w; } catch { return false; } }), took = new Set(), o = [];
  cand.forEach((l, i) => { if (ok[i] && !took.has(l.mint)) { took.add(l.mint); o.push(l); } }); return { R, L: o }; }
function ledger(R, c) { const mine = R.filter(r => r.mint === c.mint && r.w === c.w); return { funded: mine.filter(r => r.kind === 'fund').reduce((s, r) => s + r.lamports, 0) / 1e9, claimed: mine.filter(r => r.kind === 'claim').reduce((s, r) => s + r.lamports, 0) / 1e9,
  paid: mine.filter(r => r.kind === 'pay').reduce((s, r) => s + r.lamports, 0) / 1e9, payouts: new Set(mine.filter(r => r.kind === 'pay').map(r => r.id)).size, rounds: mine.filter(r => r.kind === 'fund').length, closes: mine.filter(r => r.kind === 'close').length,
  last: mine.length ? Math.max(...mine.map(r => r.at)) : c.at, history: mine.map(r => ({ kind: r.kind, at: r.at, sig: r.sig, sol: r.lamports != null ? r.lamports / 1e9 : null, to: r.to ?? null, part: r.part ?? null })) }; }
async function coins(fresh) { const { R, L } = await launches(fresh), info = await jupInfo(L.map(l => l.mint)), list = await pool(L, 6, async l => { const pos = await position(l.w, l.sym).catch(() => ({ state: 'unknown', open: false })), lg = ledger(R, l); delete lg.history;
    return { mint: l.mint, creator: l.w, sym: l.sym, side: l.side, lev: l.lev, at: l.at, sig: l.sig, coin: info[l.mint] || null, pos, ...lg }; });
  return { at: Date.now(), coins: list.filter(c => c.coin || Date.now() / 1000 - c.at < 600).sort((a, b) => ((b.coin && b.coin.mcap) || 0) - ((a.coin && a.coin.mcap) || 0) || b.at - a.at) }; }
async function coin(m, fresh) { const mint = pk(m, 'that is not a coin address').toBase58(), { R, L } = await launches(fresh), l = L.find(x => x.mint === mint); if (!l) throw new Error('that coin was not launched on MINT');
  const [info, pos] = await Promise.all([jupInfo([mint]), position(l.w, l.sym).catch(() => ({ state: 'unknown', open: false }))]);
  return { mint, creator: l.w, sym: l.sym, side: l.side, lev: l.lev, at: l.at, sig: l.sig, coin: info[mint] || null, pos, ...ledger(R, l), at2: Date.now() }; }
// company logos, by ticker: Parqet's square brand tiles first, FMP second; cached at the edge for a month
const LOGO_FIX = { SPCX: ['https://www.google.com/s2/favicons?domain=spacex.com&sz=128'], MRVL: ['https://financialmodelingprep.com/image-stock/MRVL.png'] };
const logo = sym => memo('logo:' + sym, 86400e3, async () => { for (const u of LOGO_FIX[sym] || [`https://assets.parqet.com/logos/symbol/${sym}?format=png`, `https://financialmodelingprep.com/image-stock/${sym}.png`]) { try { const r = await fetch(u, { signal: AbortSignal.timeout(7000), headers: { 'user-agent': 'Mozilla/5.0 (MINT logo cache)' } }), type = r.headers.get('content-type') || '';
    if (r.ok && /^image\//.test(type)) { const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 200 && buf.length < 2e6) return { type, buf }; } } catch { } } throw new Error('no logo'); });
// price history for the stock page: 1 day of 15m bars, 1 week of 1h, 1 month of 4h, 3 months of 1d
const TF = { '1d': ['15m', 1.1], '1w': ['1h', 8], '1m': ['4h', 31], '3m': ['1d', 92] };
const bars = (sym, tf) => memo(`bars:${sym}:${tf}`, tf === '1d' ? 30000 : 300000, async () => { const [t, days] = TF[tf], now = Date.now(), c = await phx(`/v1/candles_v2/${sym}?timeframe=${t}&from=${Math.round(now - days * 86400e3)}&to=${now}&limit=500`);
  return { symbol: sym, tf, bars: (c.bars || []).map(b => [b.time, +(b.markClose ?? b.close)]).filter(b => b[1] > 0) }; });
const ping = () => memo('ping', 4000, async () => { const t0 = Date.now(), slot = await conn.getSlot('confirmed'); return { slot, ms: Date.now() - t0, rpc: process.env.RPC_URL ? 'custom' : 'public', tag: TAG58, at: Date.now() }; });

// ---------------------------------------------------------------- holders, for payouts
async function holdersOf(mint) { const mi = await mintInfo(mint), filters = [{ memcmp: { offset: 0, bytes: mint } }]; if (mi.program === TOKEN) filters.push({ dataSize: 165 });
  const accs = await conn.getProgramAccounts(new PublicKey(mi.program), { filters, dataSlice: { offset: 32, length: 40 }, encoding: 'base64' }), map = new Map();
  for (const a of accs) { const d = a.account.data, b = Buffer.isBuffer(d) ? d : Array.isArray(d) ? Buffer.from(d[0], 'base64') : Buffer.from(d); if (b.length < 40) continue; const amt = b.readBigUInt64LE(32); if (amt === 0n) continue; const ob = b.subarray(0, 32); if (!PublicKey.isOnCurve(ob)) continue; const o = new PublicKey(ob).toBase58(); map.set(o, (map.get(o) || 0n) + amt); }
  return { ...mi, map }; }

// ---------------------------------------------------------------- the transactions the creator signs
// the SDK's instruction flows need Phoenix's program addresses and a way to read accounts: ours, over our own RPC
let RISE = null; const rise = () => RISE || (RISE = (async () => { const R = await import('@ellipsis-labs/rise');
  const ix = { addresses: R.resolvePhoenixBuilderAddresses(), fetchAccount: async a => { const i = await conn.getAccountInfo(new PublicKey(String(a))); if (!i) throw new Error('Phoenix account not found: ' + a); return { data: new Uint8Array(i.data) }; } };
  return { R, client: ix }; })().catch(e => { RISE = null; throw e; }));
// Phoenix returns web3-style instructions; the SDK returns @solana/kit ones (role 0 read, 1 write, 2 read+sign, 3 write+sign)
const toIx = ix => ix.programId && ix.keys ? new TransactionInstruction({ programId: new PublicKey(ix.programId), keys: ix.keys.map(k => ({ pubkey: new PublicKey(k.pubkey), isSigner: !!k.isSigner, isWritable: !!k.isWritable })), data: Buffer.from(ix.data) })
  : new TransactionInstruction({ programId: new PublicKey(ix.programAddress || ix.programId), keys: (ix.accounts || []).map(a => ({ pubkey: new PublicKey(a.address), isSigner: a.role >= 2, isWritable: a.role === 1 || a.role === 3 })), data: Buffer.from(ix.data || []) });
async function creatorOf(mint, from) { const { L } = await launches(true), l = L.find(x => x.mint === mint); if (!l) throw new Error('that coin was not launched on MINT'); if (l.w !== from) throw new Error('only the coin\'s creator can run its position'); return l; }
const host = req => { const h = String(req.headers && (req.headers['x-forwarded-host'] || req.headers.host) || '').replace(/[^a-z0-9.:-]/gi, ''); return h ? 'https://' + h : ''; };
async function buildLaunch(b, req) { const from = pk(b.from, 'connect a wallet first'), mint = pk(b.mint, 'the coin address is missing'), side = b.side === 'S' ? 'S' : b.side === 'L' ? 'L' : null, lev = +b.lev, img = Math.max(1, Math.min(CFG.images, +b.img || 1)), sym = okSym(b.stock || SYM);
  if (!side) throw new Error('pick a side: short or long'); if (!LEVS.includes(lev)) throw new Error('pick 2x, 5x or 10x');
  const name = clean(b.name, 32), symbol = clean(b.symbol, 10).replace(/^\$/, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!name || !symbol) throw new Error('a coin needs a name and a ticker');
  const dev = +b.devBuy; if (!(dev >= .01 && dev <= 20)) throw new Error('the first buy must be between 0.01 and 20 SOL');
  if (await conn.getAccountInfo(mint)) throw new Error('that coin address is taken. try again');
  const { L } = await launches(true); if (L.some(l => l.w === from.toBase58())) throw new Error('this wallet already runs a MINT coin. one coin per wallet, so each position belongs to one coin');
  const uri = `${host(req)}/api/mint?a=t&n=${encodeURIComponent(name)}&s=${symbol}&d=${sym}-${side}${lev}&i=${img}`; if (uri.length > 200) throw new Error('that name is too long for the metadata link. shorten it');
  // pump.fun's create and the rule go in one transaction; the first buy follows in its own (create and buy together are over Solana's size limit)
  const SDK = require('@pump-fun/pump-sdk'), ix = await SDK.PUMP_SDK.createV2Instruction({ mint, name, symbol, uri, creator: from, user: from, mayhemMode: false });
  const hash = b.bh || await bh(), rule = memoIx(`mint:launch:1:${mint.toBase58()}:${sym}:${side}:${lev}`, from); let t = new Transaction({ feePayer: from, recentBlockhash: hash }); t.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }), ix, rule, tagIx(from));
  if (!fits(t)) throw new Error('the launch transaction is too large. shorten the name');
  return { t, mint: mint.toBase58(), uri, dev }; }
// the first buy, built once the coin exists, from its live bonding curve
async function buildBuy(b) { const from = pk(b.from, 'connect a wallet first'), mint = pk(b.mint, 'that is not a coin address'), sol = +b.sol; if (!(sol >= .01 && sol <= 20)) throw new Error('the first buy must be between 0.01 and 20 SOL');
  const SDK = require('@pump-fun/pump-sdk'), BN = require('bn.js'), online = new SDK.OnlinePumpSdk(conn), [global, feeConfig, state] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig().catch(() => null), online.fetchBuyState(mint, from)]);
  const solAmount = new BN(Math.round(sol * 1e9)), amount = SDK.getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply: state.bondingCurve.tokenTotalSupply, bondingCurve: state.bondingCurve, amount: solAmount });
  const mi = await mintInfo(mint.toBase58()), ixs = await SDK.PUMP_SDK.buyInstructions({ global, ...state, mint, user: from, amount, solAmount, slippage: 2, tokenProgram: new PublicKey(mi.program) });
  const t = new Transaction({ feePayer: from, recentBlockhash: await bh() }); t.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }), ...ixs); return { txs: [b64(t)], tokens: amount.toString() }; }
// the coin's pump.fun metadata: name, ticker, image and the rule, served from the link inside the coin itself
function metadata(q, req) { const name = clean(q.n, 32), symbol = clean(q.s, 10), d = /^([A-Z]{1,6})-([SL])(\d{1,2})$/.exec(String(q.d || '')) || [], sym = d[1], side = d[2], lev = +d[3], img = Math.max(1, Math.min(CFG.images, +q.i || 1)), h = host(req);
  return { name, symbol, description: side ? `${side === 'S' ? 'Shorts' : 'Longs'} ${sym} at ${lev}x: ${side === 'S' ? 'a hedge against' : 'a bet on'} ${sym}. The creator fees fund the position on Phoenix and profits are paid to holders in SOL. Launched on MINT. Not affiliated with any company it tracks.` : 'Launched on MINT.', image: `${h}/assets/coins/${img}.png`, showName: true, createdOn: h, website: h }; }
// one round: claim the coin's creator fees, put SOL into Phoenix, open or add to the NVDA position at the coin's side and leverage
async function buildFund(b) { const from = pk(b.from, 'connect a wallet first'), w = from.toBase58(), mint = pk(b.mint).toBase58(), l = await creatorOf(mint, w), sol = +b.sol; if (!(sol >= 0.05 && sol <= 1000)) throw new Error('fund with 0.05 to 1000 SOL');
  const acc = await access(w); if (!acc.ready) throw new Error('activate this wallet on Phoenix first');
  const [n, { R, client }, hash] = await Promise.all([stock(l.sym), rise(), bh()]), lamports = Math.round(sol * 1e9), usd = sol * (n.sol || 0); if (!n.sol || !n.mark) throw new Error('prices are not available right now. try again in a minute');
  const qty = Math.floor(usd * l.lev * 0.85 / n.mark * 1000) / 1000; if (qty < 0.001) throw new Error(`that is too little SOL for a thousandth of a ${l.sym} share. fund more`);
  const flow = await R.buildNativeSolDepositFlow({ authority: w, lamports: BigInt(lamports) }, client);
  const t1 = new Transaction({ feePayer: from, recentBlockhash: hash }); t1.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }), ...flow.instructions.map(toIx), memoIx(`mint:fund:1:${mint}:${lamports}`, from), tagIx(from));
  const order = await getJ(`${PHX}/v1/ix/place-isolated-market-order`, 15000, { method: 'POST', body: JSON.stringify({ authority: w, symbol: l.sym, side: l.side === 'S' ? 'sell' : 'buy', quantity: qty, allowCrossAndIsolatedForAsset: true, transferSpotCollateralAmounts: { SOL: lamports }, targetLeverage: l.lev }) });
  const t2 = new Transaction({ feePayer: from, recentBlockhash: hash }); t2.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }), ...order.map(toIx));
  return { txs: [b64(t1), b64(t2)], plan: { sol, usd, sym: l.sym, side: l.side, lev: l.lev, qty, notional: qty * n.mark, mark: n.mark } }; }
async function buildClose(b) { const from = pk(b.from, 'connect a wallet first'), w = from.toBase58(), mint = pk(b.mint).toBase58(), l = await creatorOf(mint, w); cache.delete('pos:' + w + ':' + l.sym); const p = await position(w, l.sym); if (!p.open) throw new Error(`there is no open ${l.sym} position to close`);
  const order = await getJ(`${PHX}/v1/ix/place-isolated-market-order`, 15000, { method: 'POST', body: JSON.stringify({ authority: w, symbol: l.sym, allowCrossAndIsolatedForAsset: true, side: p.size < 0 ? 'buy' : 'sell', quantity: Math.abs(p.size), isReduceOnly: true }) });
  const t = new Transaction({ feePayer: from, recentBlockhash: await bh() }); t.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }), ...order.map(toIx), memoIx(`mint:close:1:${mint}`, from), tagIx(from));
  return { txs: [b64(t)], plan: { size: p.size, upnl: p.upnl } }; }
async function buildClaim(b) { const from = pk(b.from, 'connect a wallet first'), w = from.toBase58(), mint = pk(b.mint).toBase58(); await creatorOf(mint, w); const SDK = require('@pump-fun/pump-sdk'), online = new SDK.OnlinePumpSdk(conn);
  const bal = await online.getCreatorVaultBalanceBothPrograms(from).catch(() => null), lam = bal ? +bal.toString() : 0; if (lam < 100000) throw new Error('there are no creator fees to claim yet');
  const ixs = await online.collectCoinCreatorFeeInstructions(from, from), t = new Transaction({ feePayer: from, recentBlockhash: await bh() }); t.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }), ...ixs, memoIx(`mint:claim:1:${mint}:${lam}`, from), tagIx(from));
  return { sol: lam / 1e9, txs: [b64(t)] }; }
const fees = w => memo('fees:' + w, 20000, async () => { const SDK = require('@pump-fun/pump-sdk'), online = new SDK.OnlinePumpSdk(conn); const bal = await online.getCreatorVaultBalanceBothPrograms(new PublicKey(w)).catch(() => null); return { sol: bal ? +bal.toString() / 1e9 : 0 }; });
// paying holders in SOL, pro rata by balance; slices under the minimum are dropped and the rest re-split
function split(lamports, L) { L = L.slice().sort((a, b) => (b[1] > a[1] ? 1 : -1)); for (;;) { if (!L.length) return []; const tot = L.reduce((s, x) => s + Number(x[1]), 0), S = L.map(([w, v]) => [w, Math.floor(lamports * Number(v) / tot)]); if (S[S.length - 1][1] >= MIN_LAMPORTS) return S; L = L.slice(0, -1); } }
function payBatches(from, mint, S, id, hash) { const make = (part, k, n) => { const t = new Transaction({ feePayer: from, recentBlockhash: hash }); t.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 110000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20000 }), memoIx(`mint:pay:1:${mint}:${id}:${k}/${n}`, from)); for (const [w, l] of part) t.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(w), lamports: l })); t.add(tagIx(from)); return t; };
  const B = []; let cur = []; for (const s of S) { const next = [...cur, s]; if (cur.length && (next.length > CFG.perTx || !fits(make(next, 99, 99)))) { B.push(cur); cur = [s]; } else cur = next; } if (cur.length) B.push(cur); return B.map((p, k) => ({ part: p, t: make(p, k + 1, B.length) })); }
async function buildPay(b) { const from = pk(b.from, 'connect a wallet first'), w = from.toBase58(), mint = pk(b.mint).toBase58(); await creatorOf(mint, w); const sol = +b.sol; if (!(sol >= 0.01 && sol <= 5000)) throw new Error('pay 0.01 to 5000 SOL');
  const h = await holdersOf(mint); h.map.delete(w); const S = split(Math.floor(sol * 1e9), [...h.map]); if (!S.length) throw new Error('nobody holds this coin yet');
  const bal = await conn.getBalance(from), need = S.reduce((s, x) => s + x[1], 0); if (bal < need + 50000) throw new Error(`this wallet has ${(bal / 1e9).toFixed(4)} SOL. the payout needs ${(need / 1e9).toFixed(4)} plus fees`);
  const id = Date.now().toString(36), B = payBatches(from, mint, S, id, await bh()); return { id, sol: need / 1e9, holders: S.length, left: h.map.size - S.length, txs: B.map(x => b64(x.t)), list: S.slice(0, 30).map(([w, l]) => ({ w, sol: l / 1e9 })) }; }
// dry runs on mainnet, never signed: a launch from any wallet with SOL, an NVDA order for any Phoenix trader, a payout batch to brand-new wallets
async function sim(q, req) { const kind = String(q.kind || ''), w = pk(q.w, 'add a wallet to dry-run from (w=)'), runs = [];
  const run = async (t, what) => { const t0 = Date.now(), v = (await conn.simulateTransaction(new VersionedTransaction(t.compileMessage()), { sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed' })).value;
    runs.push({ what, err: v.err ? JSON.stringify(v.err) : null, units: v.unitsConsumed ?? null, ms: Date.now() - t0, bytes: t.serialize({ requireAllSignatures: false, verifySignatures: false }).length, logs: (v.logs || []).filter(l => /Memo|invoke \[1\]|success$|failed|rror|Program log: (Instruction|Error)/.test(l)).slice(-14) }); };
  const hash = '11111111111111111111111111111111';
  if (kind === 'launch') { const x = await buildLaunch({ from: w.toBase58(), mint: Keypair.generate().publicKey.toBase58(), name: 'dry run', symbol: 'TEST', stock: q.s || SYM, side: q.side || 'S', lev: +q.lev || 5, img: 1, devBuy: 0.01, bh: hash }, req).catch(e => { if (/already runs/.test(e.message)) throw e; throw e; }); await run(x.t, 'pump.fun create + rule'); }
  else if (kind === 'order') { const order = await getJ(`${PHX}/v1/ix/place-isolated-market-order`, 15000, { method: 'POST', body: JSON.stringify({ authority: w.toBase58(), symbol: okSym(q.s || SYM), allowCrossAndIsolatedForAsset: true, side: q.side === 'buy' ? 'buy' : 'sell', quantity: +q.qty || 0.01, transferSpotCollateralAmounts: q.lam ? { SOL: +q.lam } : undefined, transferAmount: q.usd ? Math.round(+q.usd * 1e6) : undefined, targetLeverage: +q.lev || undefined }) });
    const t = new Transaction({ feePayer: w, recentBlockhash: hash }); t.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 }), ...order.map(toIx)); await run(t, `${q.s || SYM} ${q.side === 'buy' ? 'long' : 'short'} ${+q.qty || 0.01}`); }
  else if (kind === 'deposit') { const { R, client } = await rise(), lamports = BigInt(+q.lam || 50000000); const flow = await R.buildNativeSolDepositFlow({ authority: w.toBase58(), lamports }, client);
    const t = new Transaction({ feePayer: w, recentBlockhash: hash }); t.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }), ...flow.instructions.map(toIx)); await run(t, `deposit ${Number(lamports) / 1e9} SOL to Phoenix`); }
  else if (kind === 'pay') { const fresh = Array.from({ length: CFG.perTx }, () => [Keypair.generate().publicKey.toBase58(), MIN_LAMPORTS]); for (const x of payBatches(w, q.mint ? pk(q.mint).toBase58() : SOL, fresh, 'selftest', hash)) await run(x.t, `pay ${x.part.length} new wallets`); }
  else throw new Error('kind is launch, order, deposit or pay');
  return { kind, w: w.toBase58(), at: Date.now(), runs }; }

module.exports = async (req, res) => {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams), a = String(q.a || 'ping'), fresh = q.fresh === '1';
  try {
    if (req.method === 'GET') {
      if (a === 'ping') return out(res, 200, await ping(), 'public, max-age=3, s-maxage=4');
      if (a === 'config') return out(res, 200, { name: CFG.name, tag: TAG58, symbol: SYM, stocks: STOCKS, levs: LEVS, ca: okKey(process.env.MINT_CA) || okKey(CFG.ca), x: process.env.MINT_X || CFG.x || null, ref: process.env.PHOENIX_REF || null, images: CFG.images, minSol: CFG.minSol }, 'public, max-age=60, s-maxage=300');
      if (a === 'nvda' || a === 'stock') return out(res, 200, await stock(okSym(q.s || SYM)), 'public, max-age=8, s-maxage=10, stale-while-revalidate=60');
      if (a === 'stocks') return out(res, 200, await stocks(), 'public, max-age=15, s-maxage=20, stale-while-revalidate=120');
      if (a === 'coins') return out(res, 200, await coins(fresh), fresh ? 'no-store' : 'public, max-age=8, s-maxage=12, stale-while-revalidate=60');
      if (a === 'coin') return out(res, 200, await coin(q.mint, fresh), fresh ? 'no-store' : 'public, max-age=8, s-maxage=10, stale-while-revalidate=60');
      if (a === 'position') return out(res, 200, await position(pk(q.w).toBase58(), okSym(q.s || SYM)), 'no-store');
      if (a === 'access') return out(res, 200, await access(pk(q.w).toBase58()), 'no-store');
      if (a === 'bars') { const tf = TF[q.tf] ? q.tf : '1w'; return out(res, 200, await bars(okSym(q.s || SYM), tf), tf === '1d' ? 'public, max-age=20, s-maxage=30, stale-while-revalidate=120' : 'public, max-age=120, s-maxage=300, stale-while-revalidate=900'); }
      if (a === 'logo') { const im = await logo(okSym(q.s)); res.statusCode = 200; res.setHeader('content-type', im.type); res.setHeader('cache-control', 'public, max-age=604800, s-maxage=2592000, immutable'); return res.end(im.buf); }
      if (a === 'status') { const v = (await conn.getSignatureStatuses([String(q.sig || '')], { searchTransactionHistory: false })).value[0]; return out(res, 200, { status: v ? (v.err ? 'failed' : v.confirmationStatus) : null, err: v && v.err ? JSON.stringify(v.err) : null }); }
      if (a === 'fees') return out(res, 200, await fees(pk(q.w).toBase58()), 'no-store');
      if (a === 't') return out(res, 200, metadata(q, req), 'public, max-age=86400, s-maxage=31536000, immutable');
      if (a === 'sim') return out(res, 200, await sim(q, req), 'public, max-age=15, s-maxage=30');
      return out(res, 400, { error: 'unknown action' });
    }
    const b = await body(req);
    if (a === 'launch') { const x = await buildLaunch(b, req); return out(res, 200, { mint: x.mint, uri: x.uri, txs: [b64(x.t)] }); }
    if (a === 'buy') return out(res, 200, await buildBuy(b));
    if (a === 'fund') return out(res, 200, await buildFund(b));
    if (a === 'close') return out(res, 200, await buildClose(b));
    if (a === 'claim') return out(res, 200, await buildClaim(b));
    if (a === 'pay') return out(res, 200, await buildPay(b));
    if (a === 'send') { const sig = await conn.sendRawTransaction(Buffer.from(String(b.tx || ''), 'base64'), { skipPreflight: false, maxRetries: 4 }); return out(res, 200, { sig }); }
    return out(res, 400, { error: 'unknown action' });
  } catch (e) { return out(res, 400, { error: String(e && e.message || e).slice(0, 300) }); }
};
module.exports._t = { parseRite, split, payBatches, metadata, toIx, ledger };
