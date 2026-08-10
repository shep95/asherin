delete from public.organism_events where dedupe_key like 'sim:%' or evidence->>'sim' = 'true';
delete from public.organism_findings f
 where not exists (select 1 from public.organism_events e where e.user_id = f.user_id);
delete from public.organism_entities where entity_key like 'sim-%';