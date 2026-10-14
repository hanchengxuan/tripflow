create or replace function private.import_booking_document(requested_trip_id uuid, document_fingerprint text, document_name text, document_mime_type text, plans jsonb)
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
  destination jsonb;
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
  if exists (select 1 from jsonb_array_elements(plans) value where value ? 'createdBy' and value->>'createdBy' is distinct from actor::text) then
    raise exception 'Login changed; reopen the booking importer';
  end if;
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
    destination := candidate->'destination';
    if destination is not null and destination <> 'null'::jsonb then
      if jsonb_typeof(destination) <> 'object'
        or coalesce(destination->>'countryCode', '') !~ '^[A-Z]{2}$'
        or coalesce(char_length(trim(destination->>'countryName')), 0) not between 1 and 120
        or coalesce(char_length(trim(destination->>'cityName')), 0) not between 1 and 120
        or not exists (select 1 from pg_catalog.pg_timezone_names where name = destination->>'timeZone')
        or (nullif(destination->>'currency', '') is not null and destination->>'currency' !~ '^[A-Z]{3}$')
        or jsonb_typeof(destination->'latitude') is distinct from 'number'
        or jsonb_typeof(destination->'longitude') is distinct from 'number' then raise exception 'Invalid booking destination'; end if;
      if (destination->>'latitude')::double precision not between -90 and 90
        or (destination->>'longitude')::double precision not between -180 and 180 then raise exception 'Invalid booking destination coordinates'; end if;
    end if;
    item_id := null;
    insert into public.itinerary_items (trip_id, created_by, kind, title, starts_at, ends_at, location_label, booking_item_key,
      destination_country_code, destination_country_name, destination_city_name, destination_time_zone, destination_currency, destination_latitude, destination_longitude)
    values (requested_trip_id, actor, item_kind, item_title, item_start, item_end, item_location,
      md5(jsonb_build_array(item_kind, lower(item_title), extract(epoch from item_start), extract(epoch from item_end), lower(item_location))::text),
      destination->>'countryCode', trim(destination->>'countryName'), trim(destination->>'cityName'), destination->>'timeZone', nullif(destination->>'currency', ''),
      (destination->>'latitude')::double precision, (destination->>'longitude')::double precision)
    on conflict (trip_id, booking_item_key) where booking_item_key is not null do nothing returning id into item_id;
    if item_id is null then skipped_count := skipped_count + 1; else inserted_count := inserted_count + 1; end if;
  end loop;
  insert into public.booking_documents (trip_id, user_id, fingerprint, storage_path, file_name, mime_type)
  values (requested_trip_id, actor, document_fingerprint, actor::text || '/' || requested_trip_id::text || '/' || document_fingerprint, trim(document_name), document_mime_type) returning * into doc;
  return jsonb_build_object('documentId', doc.id, 'added', inserted_count, 'skipped', skipped_count, 'alreadyImported', false);
end;
$$;
