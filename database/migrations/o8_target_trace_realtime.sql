do $$ begin
  begin alter publication supabase_realtime add table public.o8_target_block_snapshots; exception when duplicate_object then null; end;
end $$;
