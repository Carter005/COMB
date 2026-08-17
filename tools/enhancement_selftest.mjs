const t=process.env.SUPABASE_ACCESS_TOKEN,u='https://api.supabase.com/v1/projects/sucbbwhejdcojlnpvokv/database/query';
const query=`
create or replace function public.o8_enhancement_self_test() returns jsonb language plpgsql security definer set search_path=public as $$
declare
 result jsonb; dummy text:='0x0000000000000000000000000000000000000088'; i int; base_block bigint:=22000000;
begin
 begin
  update public.o8_token_targets set token_address=dummy,status='GRADUATED',token_name='STORY TEST',symbol='TEST',
   factory_address='0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb',deployer_address='0x0000000000000000000000000000000000000001',
   pool_address='0x0000000000000000000000000000000000000002',graduation_progress=100,
   paired_principal_wei=4200000000000000000,graduation_threshold_wei=4200000000000000000,graduated=true,
   metadata=jsonb_build_object('observedBlock',base_block) where id='o8';

  insert into public.o8_token_lifecycle_snapshots(target_id,status,graduation_progress,paired_principal_wei,graduation_threshold_wei,pool_address,observed_block,payload)
  select 'o8','CURVE_ACTIVE',p,p*42000000000000000,4200000000000000000,'0x0000000000000000000000000000000000000002',base_block+p,'{}'::jsonb
  from unnest(array[12,26,51,76,91,96,88]) p;

  for i in 0..100 loop
   insert into public.o8_target_block_snapshots(target_address,block_number,pool_address,target_status,metrics,observed_at)
   values(dummy,base_block+i,'0x0000000000000000000000000000000000000002','GRADUATED',
    case when i=0 then jsonb_build_object('transactionCount',2,'poolSwapCount',1,'uniqueParticipantCount',2,'tokenTransferCount',3,'poolEventCount',2)
         when i=100 then jsonb_build_object('transactionCount',12,'poolSwapCount',5,'uniqueParticipantCount',8,'tokenTransferCount',16,'poolEventCount',5)
         else jsonb_build_object('transactionCount',0,'poolSwapCount',0,'uniqueParticipantCount',0,'tokenTransferCount',0,'poolEventCount',0) end,
    now()-interval '20 minutes'+make_interval(secs=>i));
  end loop;

  update public.o8_story_state set last_activity_at=now()-interval '20 minutes',created_at=now()-interval '30 minutes',silence_state='ACTIVE' where target_address=dummy;
  perform public.o8_evaluate_story_state();
  update public.o8_system_bindings set status='DEGRADED' where id='railway-observer';
  perform public.o8_evaluate_story_state();

  select jsonb_build_object(
   'curveCheckpoints',(select count(*) from public.o8_story_milestones where target_address=dummy and event_type='curve_checkpoint'),
   'firstEvents',(select count(*) from public.o8_story_milestones where target_address=dummy and category='FIRST'),
   'curveHigh',(select count(*) from public.o8_story_milestones where target_address=dummy and event_type='curve_new_high'),
   'curveRetreat',(select count(*) from public.o8_story_milestones where target_address=dummy and event_type='curve_retreat'),
   'silence',(select count(*) from public.o8_story_milestones where target_address=dummy and event_type='target_silence'),
   'observerGap',(select count(*) from public.o8_story_milestones where target_address=dummy and event_type='observer_gap'),
   'postGrad',(select count(*) from public.o8_story_milestones where target_address=dummy and category='POST_GRAD'),
   'baseline',(select count(*) from public.o8_story_milestones where target_address=dummy and event_type='behavior_baseline_ready'),
   'deviation',(select count(*) from public.o8_story_milestones where target_address=dummy and event_type='behavior_deviation'),
   'adapting',(select count(*) from public.o8_lifecycle_events where target_address=dummy and phase_code='06')
  ) into result;
  raise exception using errcode='P0001',message='rollback test';
 exception when sqlstate 'P0001' then return result;
 end;
end $$;
select public.o8_enhancement_self_test() as result;
drop function public.o8_enhancement_self_test();`;
let r;for(let i=0;i<3;i++){r=await fetch(u,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({query})});if(r.ok)break;await new Promise(x=>setTimeout(x,700));}console.log(r.status,await r.text());
