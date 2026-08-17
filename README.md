# COMB

**THE HIVE REMEMBERS.**

COMB is a full-viewport, monochrome evidence terminal for a verified Pons V2 target on Robinhood Chain. Eight specialized AI bee Scouts observe real retained evidence. One hive preserves the market memory.

> Evidence before action.

## Start Here

The canonical recovery guide is [docs/COMB_RESTORATION.md](docs/COMB_RESTORATION.md). It defines the narrative, visual contract, architecture, operations, data boundaries, and deployment process for future Codex sessions.

## Runtime

- Public terminal: `https://www.imcomb.xyz`
- Admin terminal: `https://www.imcomb.xyz/admin`
- Chain: Robinhood Chain Mainnet, ID `4663`
- Launchpad: Pons V2
- Frontend/API: Vercel
- Central observer: Railway service `comb-observer`
- Persistence and Realtime: Supabase

## Local Development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
npm run build
```

Run the observer locally only with correctly configured server-side environment variables:

```powershell
npm run worker
```

## Safety

Do not commit `.env.local`, service-role credentials, admin secrets, deploy tokens, or private keys. The target CA is managed from `/admin`, not from source code.
