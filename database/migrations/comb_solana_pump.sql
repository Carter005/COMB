-- Forward-only COMB migration. Legacy Robinhood/Pons rows remain historical evidence.
insert into public.o8_sources(id, label, kind, truth, status, payload)
values ('solana-mainnet', 'Solana mainnet confirmed RPC', 'solana-json-rpc', 'CONNECTED', 'CONNECTING', '{"network":"Solana Mainnet","rpc":"https://api.mainnet-beta.solana.com","explorer":"https://solscan.io"}'::jsonb)
on conflict (id) do update set label = excluded.label, kind = excluded.kind, truth = excluded.truth;
insert into public.o8_system_bindings(id, label, status, truth, details)
values ('solana-chain', 'Solana mainnet', 'CONNECTING', 'CONNECTED', '{"network":"Solana Mainnet","nativeCurrency":"SOL","explorer":"https://solscan.io"}'::jsonb), ('pump-fun', 'Pump.fun target lifecycle', 'AWAITING_PUMP_CA', 'CONNECTED', '{"platform":"PUMP.FUN","verification":"TARGET_MINT_REQUIRED"}'::jsonb)
on conflict (id) do update set label = excluded.label;
update public.o8_token_targets set platform = 'PUMP.FUN', symbol = 'COMB', status = 'AWAITING_PUMP_CA', token_address = null, launch_tx_hash = null, launch_block = null, launched_at = null, metadata = '{"chain":"SOLANA","launchpad":"PUMP.FUN","verification":"TARGET_MINT_REQUIRED"}'::jsonb, updated_at = now() where id = 'o8';
