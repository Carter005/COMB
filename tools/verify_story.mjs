const t=process.env.SUPABASE_ACCESS_TOKEN,u='https://api.supabase.com/v1/projects/sucbbwhejdcojlnpvokv/database/query';
const qs=[
"select to_regclass('public.o8_lifecycle_events') as lifecycle_table, to_regclass('public.o8_dissent_records') as dissent_table",
"select tgname from pg_trigger where tgname in ('o8_capture_target_story_trigger','o8_capture_adaptation_story_trigger') order by tgname",
"select count(*)::int as lifecycle_count from public.o8_lifecycle_events",
"select count(*)::int as dissent_count from public.o8_dissent_records"
];
for(const query of qs){let res; for(let i=0;i<3;i++){res=await fetch(u,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({query})}); if(res.ok)break; await new Promise(r=>setTimeout(r,700));} console.log(res.status,await res.text());}
