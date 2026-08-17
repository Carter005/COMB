const t=process.env.SUPABASE_ACCESS_TOKEN,u='https://api.supabase.com/v1/projects/sucbbwhejdcojlnpvokv/database/query';
const query=`
create or replace function public.o8_story_self_test() returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; dummy text := '0x0000000000000000000000000000000000000008';
begin
  begin
    insert into public.o8_token_targets(id,platform,status,symbol,token_address,deployer_address,pool_address,graduation_progress,paired_principal_wei,graduation_threshold_wei,graduated,metadata)
    values('story-test','PONS','GRADUATED','O8',dummy,'0x0000000000000000000000000000000000000001','0x0000000000000000000000000000000000000002',100,4200000000000000000,4200000000000000000,true,'{"observedBlock":21640000}'::jsonb);
    select jsonb_build_object(
      'phases',(select count(*) from public.o8_lifecycle_events where target_address=dummy),
      'dissent',(select count(*) from public.o8_dissent_records where target_address=dummy),
      'ceremonies',(select count(*) from public.o8_lifecycle_events where target_address=dummy and phase_code='05' and ceremony is not null)
    ) into result;
    raise exception using errcode='P0001', message='rollback test';
  exception when sqlstate 'P0001' then return result;
  end;
end $$;
select public.o8_story_self_test() as result;
drop function public.o8_story_self_test();`;
let r; for(let i=0;i<3;i++){r=await fetch(u,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({query})}); if(r.ok)break; await new Promise(x=>setTimeout(x,700));} console.log(r.status,await r.text());
