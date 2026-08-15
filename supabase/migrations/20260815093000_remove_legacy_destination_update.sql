-- PostgREST should see one unambiguous update_itinerary_item RPC.
drop function if exists public.update_itinerary_item(uuid, text, timestamptz, timestamptz, text, text);
drop function if exists private.update_itinerary_item(uuid, text, timestamptz, timestamptz, text, text);
