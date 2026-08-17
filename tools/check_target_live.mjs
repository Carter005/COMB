const t=process.env.SUPABASE_ACCESS_TOKEN,u='https://api.supabase.com/v1/projects/sucbbwhejdcojlnpvokv/database/query';
const q=`select
 (select count(*) from public.o8_target_block_snapshots where target_address='0x79182adbf8b791eb07c1bf3a0b975249819c18f2')::int as target_snapshots,
 (select max(block_number) from public.o8_target_block_snapshots where target_address='0x79182adbf8b791eb07c1bf3a0b975249819c18f2') as latest_target_block,
 (select count(*) from public.o8_events where lower(coalesce(metadata->>'tokenAddress',''))='0x79182adbf8b791eb07c1bf3a0b975249819c18f2' and type like 'target_%')::int as target_events,
 (select count(*) from public.o8_token_lifecycle_snapshots where target_id='o8')::int as lifecycle_snapshots`;
let r;for(let i=0;i<3;i++){r=await fetch(u,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({query:q})});if(r.ok)break;await new Promise(x=>setTimeout(x,600));}console.log(r.status,await r.text());
