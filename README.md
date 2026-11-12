# MINT

Launch a coin that hedges against NVIDIA, or any other stock.

Every MINT coin is a pump.fun coin with one rule, locked in its metadata at launch: SHORT NVDA (the hedge) or LONG NVDA, at 2x, 5x or 10x.
The coin's creator fees fund that position on Phoenix (Solana's on-chain perps, NVDA market, SOL as collateral). The creator runs it from MINT in their own wallet: claim fees, fund and open, close, pay holders in SOL. MINT never holds a key or a coin.

Every launch, round and payout carries a memo (`mint:launch|fund|claim|close|pay:1:...`) and a 0-lamport touch of `E2uFaSMLLnYvR1QjeAgwLWTwmWoBh8kSMEiNvYJAAvtA`, so the history of every coin is read back from the chain. Positions are read from Phoenix's public trader state.

## Settings (Vercel environment variables, optional)
- `RPC_URL`: a paid Solana RPC (recommended)
- `PHOENIX_REF`: your Phoenix referral code, shown to creators who still need to activate
- `MINT_CA`, `MINT_X`: the $MINT mint and X profile

## Dry runs (simulated on mainnet, never signed)
- `/api/mint?a=sim&kind=launch&w=<wallet with SOL>`
- `/api/mint?a=sim&kind=order&w=<active Phoenix trader>&side=sell&qty=0.01`
- `/api/mint?a=sim&kind=deposit&w=<wallet>&lam=50000000`
- `/api/mint?a=sim&kind=pay&w=<wallet with SOL>`

Independent. Not affiliated with NVIDIA, pump.fun or Phoenix. Nothing here is financial advice.
