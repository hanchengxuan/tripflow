create table public.booking_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  storage_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz not null default now(),
  unique (user_id, trip_id, fingerprint),
  check (storage_path = user_id::text || '/' || trip_id::text || '/' || fingerprint)
);
create index booking_documents_trip_id_idx on public.booking_documents(trip_id);
alter table public.booking_documents enable row level security;
revoke all on public.booking_documents from anon, authenticated;
grant select, delete on public.booking_documents to authenticated;
create policy booking_documents_read on public.booking_documents for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and deleted_at is null));
create policy booking_documents_delete on public.booking_documents for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.itinerary_items add column booking_item_key text;
create unique index itinerary_booking_item_key_idx on public.itinerary_items(trip_id, booking_item_key) where booking_item_key is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-documents', 'booking-documents', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
create policy booking_file_read on storage.objects for select to authenticated
  using (bucket_id = 'booking-documents' and split_part(name, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.profiles where id = (select auth.uid()) and deleted_at is null));
create policy booking_file_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'booking-documents' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{64}$'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and public.can_edit_trip(split_part(name, '/', 2)::uuid)
    and exists (select 1 from public.profiles where id = (select auth.uid()) and deleted_at is null));
create policy booking_file_delete on storage.objects for delete to authenticated
  using (bucket_id = 'booking-documents' and split_part(name, '/', 1) = (select auth.uid())::text);

create function private.import_booking_document(requested_trip_id uuid, document_fingerprint text, document_name text, document_mime_type text, plans jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  trip public.trips;
  doc public.booking_documents;
  candidate jsonb;
  item_id uuid;
  item_start timestamptz;
  item_end timestamptz;
  item_title text;
  item_location text;
  item_kind public.itinerary_kind;
  inserted_count integer := 0;
  skipped_count integer := 0;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and deleted_at is null) then raise exception 'Authentication required'; end if;
  perform 1 from public.trip_members where trip_id = requested_trip_id and user_id = actor and role in ('owner', 'editor') for update;
  if not found then raise exception 'Only trip editors can import bookings'; end if;
  select * into trip from public.trips where id = requested_trip_id for update;
  if trip.id is null then raise exception 'Trip not found'; end if;
  if document_fingerprint is null or document_fingerprint !~ '^[0-9a-f]{64}$' or document_name is null or char_length(trim(document_name)) not between 1 and 180
    or document_mime_type is null or document_mime_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then raise exception 'Invalid document'; end if;
  select * into doc from public.booking_documents where trip_id = requested_trip_id and user_id = actor and fingerprint = document_fingerprint;
  if doc.id is not null then return jsonb_build_object('documentId', doc.id, 'added', 0, 'skipped', 0, 'alreadyImported', true); end if;
  if plans is null or jsonb_typeof(plans) <> 'array' then raise exception 'Invalid plans'; end if;
  if jsonb_array_length(plans) not between 1 and 12 then raise exception 'Import 1 to 12 plans'; end if;
  for candidate in select value from jsonb_array_elements(plans) loop
    item_title := trim(candidate->>'title');
    item_location := trim(candidate->>'locationLabel');
    if candidate->>'kind' is null or candidate->>'kind' not in ('transport', 'lodging') or item_title is null or char_length(item_title) not between 1 and 180
      or item_location is null or char_length(item_location) not between 1 and 500 then raise exception 'Complete the booking title and location'; end if;
    if coalesce(candidate->>'startsAt', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
      or coalesce(candidate->>'endsAt', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Dates need a time zone'; end if;
    item_start := (candidate->>'startsAt')::timestamptz;
    item_end := (candidate->>'endsAt')::timestamptz;
    if not isfinite(item_start) or not isfinite(item_end) or item_end <= item_start then raise exception 'Invalid booking interval'; end if;
    if (item_start at time zone trip.default_time_zone)::date < trip.starts_on or (item_end at time zone trip.default_time_zone)::date > trip.ends_on then raise exception 'Booking is outside trip dates'; end if;
    item_kind := (candidate->>'kind')::public.itinerary_kind;
    item_id := null;
    insert into public.itinerary_items (trip_id, created_by, kind, title, starts_at, ends_at, location_label, booking_item_key)
    values (requested_trip_id, actor, item_kind, item_title, item_start, item_end, item_location,
      md5(jsonb_build_array(item_kind, lower(item_title), extract(epoch from item_start), extract(epoch from item_end), lower(item_location))::text))
    on conflict (trip_id, booking_item_key) where booking_item_key is not null do nothing returning id into item_id;
    if item_id is null then skipped_count := skipped_count + 1; else inserted_count := inserted_count + 1; end if;
  end loop;
  insert into public.booking_documents (trip_id, user_id, fingerprint, storage_path, file_name, mime_type)
  values (requested_trip_id, actor, document_fingerprint, actor::text || '/' || requested_trip_id::text || '/' || document_fingerprint, trim(document_name), document_mime_type) returning * into doc;
  return jsonb_build_object('documentId', doc.id, 'added', inserted_count, 'skipped', skipped_count, 'alreadyImported', false);
end;
$$;
create function public.import_booking_document(requested_trip_id uuid, document_fingerprint text, document_name text, document_mime_type text, plans jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.import_booking_document(requested_trip_id, document_fingerprint, document_name, document_mime_type, plans);
$$;
revoke all on function private.import_booking_document(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.import_booking_document(uuid, text, text, text, jsonb) from public, anon;
grant execute on function private.import_booking_document(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.import_booking_document(uuid, text, text, text, jsonb) to authenticated;
