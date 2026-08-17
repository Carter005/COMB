# COMB Agent Instructions

Read `README.md` and `docs/COMB_RESTORATION.md` before editing.

## Product Contract

COMB is a black-and-white, full-viewport terminal for eight AI bee Scouts observing one verified Pons V2 target on Robinhood Chain. The hive retains evidence, disagreement, community memory, and observer incidents. It is not a landing page, trading bot, price-prediction product, or generic chat app.

## Non-Negotiables

- Never fabricate transactions, holders, liquidity, milestones, Scout activity, or lifecycle transitions.
- Keep `CHAIN`, `CONNECTED`, `RULE`, `SYSTEM`, `AI`, and `VISUAL` visibly distinct.
- AI is on request only. Eight Scout positions are not eight simultaneous model calls.
- Railway performs RPC polling and writes Supabase. Browsers read persisted state and Realtime only.
- Preserve the single-viewport terminal, monochrome palette, square rules, and monospace typography.
- CA binding and reset remain admin-only. Never bake a target CA into frontend source.
- Never commit service-role keys, admin secrets, Vercel tokens, Railway tokens, or `.env.local`.

## Required Verification

1. Run `npm run build`.
2. Check `/api/o8/state` and `/api/o8/feed` in production.
3. For UI changes, test desktop and a narrow `650px` viewport.
4. Deploy Vercel for API/frontend changes and Railway for `railway/worker.js` changes.
