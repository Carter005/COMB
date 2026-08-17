# Operations and deployment

## Vercel

The Vite frontend and `/api/o8/*` routes deploy with `npm run build` and `vercel.json`. Production alias is `https://www.o8alive.com`. Configure server env vars in the Vercel project; never commit them.

## Railway

Deploy `railway/worker.js` with `npm run worker`. Health endpoints:

```text
/health
/ready
```

Healthy means the worker is connected and its latest poll is fresh. `railway-observer` in `o8_system_bindings` is the public status row.

## Quick checks

```powershell
npm run build
curl https://www.o8alive.com/api/o8/state
curl "https://www.o8alive.com/api/o8/feed?limit=40"
```

Then check that `robinhood-mainnet`, `railway-observer`, `pons-launchpad`, `o8-token`, and `target-monitor` bindings have the expected status.

## Test CA workflow

1. Register a test CA in the admin UI or protected endpoint.
2. Confirm Pons origin, token, factory, pool, and launch block.
3. Wait for target backfill and live block updates.
4. Verify first transaction/swap/participant, curve milestones, high/retreat, silence/gap distinction, graduation checks, and ADAPTING baseline if applicable.
5. Exercise ASK and inspect truth labels.
6. Clear the target through the admin flow after the test. Do not manually delete global source history.

## Common diagnosis

- Block changes but target trace is flat: verified zero target-scoped activity, not a dead observer.
- `CONNECTED` instead of `LIVE`: check frontend bundle/Reatime subscription; REST still works, but the UI should preserve `LIVE` after subscription.
- `SYSTEM LAYER QUIET`: select `ALL`, `CHAIN`, or `RULE`; no system event is not a chain outage.
- Data age grows: check Railway `/health`, `railway-observer`, RPC response, then Supabase Realtime.
- Stale browser: hard refresh once after a deployment to invalidate an old Vite asset.

