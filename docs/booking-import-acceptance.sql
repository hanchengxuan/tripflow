begin;
create temporary table booking_fixture (owner_id uuid, editor_id uuid, viewer_id uuid, outsider_id uuid, trip_id uuid);
insert into booking_fixture values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
insert into auth.users(id, raw_user_meta_data) select owner_id, '{"display_name":"Booking acceptance"}'::jsonb from booking_fixture union all select editor_id, '{}'::jsonb from booking_fixture union all select viewer_id, '{}'::jsonb from booking_fixture union all select outsider_id, '{}'::jsonb from booking_fixture;
insert into public.trips(id,created_by,name,starts_on,ends_on,home_currency,default_time_zone) select trip_id,owner_id,'Booking acceptance','2026-10-20','2026-10-25','JPY','Asia/Tokyo' from booking_fixture;
insert into public.trip_members(trip_id,user_id,role) select trip_id,owner_id,'owner'::public.trip_role from booking_fixture union all select trip_id,editor_id,'editor'::public.trip_role from booking_fixture union all select trip_id,viewer_id,'viewer'::public.trip_role from booking_fixture;
select set_config('request.jwt.claim.sub',(select owner_id::text from booking_fixture),true);
do $$
declare t uuid := (select trip_id from booking_fixture); result jsonb; payload jsonb := '[{"title":"QF25 SYD → HND","kind":"transport","startsAt":"2026-10-20T09:30:00Z","endsAt":"2026-10-20T20:30:00Z","locationLabel":"Haneda Airport"},{"title":"Demo Tokyo Hotel","kind":"lodging","startsAt":"2026-10-21T06:00:00Z","endsAt":"2026-10-24T02:00:00Z","locationLabel":"Tokyo hotel address"}]'; before_count integer;
begin
 result := public.import_booking_document(t,repeat('a',64),'synthetic.pdf','application/pdf',payload);
 if result->>'added' <> '2' then raise exception 'Batch failed'; end if;
 result := public.import_booking_document(t,repeat('a',64),'synthetic.pdf','application/pdf',payload);
 if result->>'alreadyImported' <> 'true' or result->>'added' <> '0' then raise exception 'Retry duplicated plans'; end if;
 result := public.import_booking_document(t,repeat('b',64),'synthetic-copy.pdf','application/pdf',payload);
 if result->>'skipped' <> '2' then raise exception 'Semantic duplicates were added'; end if;
 select count(*) into before_count from public.itinerary_items where trip_id=t;
 begin
  perform public.import_booking_document(t,repeat('c',64),'bad.pdf','application/pdf','[{"title":"Atomic test","kind":"transport","startsAt":"2026-10-22T01:00:00Z","endsAt":"2026-10-22T02:00:00Z","locationLabel":"Airport"},{"title":"Invalid","kind":"lodging","startsAt":"2026-10-26T01:00:00Z","endsAt":"2026-10-27T02:00:00Z","locationLabel":"Hotel"}]');
  raise exception 'Expected validation error';
 exception when others then
  if sqlerrm='Expected validation error' then raise; end if;
 end;
 if (select count(*) from public.itinerary_items where trip_id=t) <> before_count then raise exception 'Partial write escaped rollback'; end if;
 begin
  perform public.import_booking_document(t,repeat('9',64),'actor.pdf','application/pdf',jsonb_build_array((payload->0) || jsonb_build_object('createdBy',(select editor_id from booking_fixture))));
  raise exception 'Changed actor imported';
 exception when others then if sqlerrm <> 'Login changed; reopen the booking importer' then raise; end if; end;
 if exists (select 1 from public.booking_documents where fingerprint=repeat('9',64)) then raise exception 'Changed actor wrote metadata'; end if;
 perform set_config('request.jwt.claim.sub',(select viewer_id::text from booking_fixture),true);
 begin
  perform public.import_booking_document(t,repeat('d',64),'viewer.pdf','application/pdf',payload);
  raise exception 'Viewer imported';
 exception when others then if sqlerrm='Viewer imported' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',(select outsider_id::text from booking_fixture),true);
 begin
  perform public.import_booking_document(t,repeat('e',64),'outsider.pdf','application/pdf',payload);
  raise exception 'Outsider imported';
 exception when others then if sqlerrm='Outsider imported' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',(select editor_id::text from booking_fixture),true);
 result := public.import_booking_document(t,repeat('f',64),'editor.pdf','application/pdf','[{"title":"Editor hotel","kind":"lodging","startsAt":"2026-10-21T06:00:00Z","endsAt":"2026-10-24T02:00:00Z","locationLabel":"Editor address"}]');
 if result->>'added' <> '1' then raise exception 'Editor could not import'; end if;
end $$;
set local role authenticated;
do $$ begin
 if (select count(*) from public.booking_documents) <> 1 then raise exception 'Original metadata is not private'; end if;
end $$;
reset role;
do $$
declare
 t uuid := (select trip_id from booking_fixture);
 result jsonb;
 destination jsonb := '{"cityName":"Tokyo","countryName":"Japan","countryCode":"JP","timeZone":"Asia/Tokyo","currency":"JPY","latitude":35.68,"longitude":139.69}';
 payload jsonb := '{"title":"Mapped hotel","kind":"lodging","startsAt":"2026-10-21T06:00:00Z","endsAt":"2026-10-24T02:00:00Z","locationLabel":"Synthetic Tokyo hotel"}';
 before_count integer;
 invalid jsonb;
begin
 perform set_config('request.jwt.claim.sub',(select owner_id::text from booking_fixture),true);
 result := public.import_booking_document(t,repeat('8',64),'mapped.pdf','application/pdf',jsonb_build_array(payload || jsonb_build_object('destination',destination)));
 if result->>'added' <> '1' or not exists (select 1 from public.itinerary_items where trip_id=t and title='Mapped hotel' and destination_country_code='JP' and destination_city_name='Tokyo' and destination_time_zone='Asia/Tokyo' and destination_currency='JPY' and destination_latitude=35.68 and destination_longitude=139.69) then raise exception 'Map destination was lost'; end if;
 select count(*) into before_count from public.itinerary_items where trip_id=t;
 for invalid in select value from jsonb_array_elements(jsonb_build_array(
   destination || '{"latitude":91}', destination || '{"longitude":"139.69"}', destination || '{"timeZone":"Not/AZone"}',
   destination - 'countryCode', destination || '{"countryCode":"JPN"}', destination || '{"cityName":""}', destination || '{"currency":"yen"}'
 )) loop
  begin
   perform public.import_booking_document(t,repeat('7',64),'invalid-map.pdf','application/pdf',jsonb_build_array(
     payload || '{"title":"Atomic map first"}', payload || jsonb_build_object('destination',invalid)));
   raise exception 'Invalid destination was accepted';
  exception when others then
   if sqlerrm not like 'Invalid booking destination%' then raise; end if;
  end;
 end loop;
 if (select count(*) from public.itinerary_items where trip_id=t) <> before_count or exists (select 1 from public.booking_documents where trip_id=t and fingerprint=repeat('7',64)) then raise exception 'Invalid map batch escaped rollback'; end if;
end $$;
select 'passed: map persistence, invalid metadata atomic rejection, batch, idempotency, semantic dedupe, atomic rollback, dates, owner/editor authorization, viewer/outsider rejection, uploader-only RLS' as acceptance;
rollback;
