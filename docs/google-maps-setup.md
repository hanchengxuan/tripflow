# Google Places setup for TripFlow

TripFlow uses Google Places Autocomplete through the authenticated Supabase Edge Function `places-autocomplete`. The API key stays server-side and must not use the `EXPO_PUBLIC_` prefix.

## One-time Google Cloud setup

1. Open Google Cloud Console and select the project created for TripFlow.
2. Attach a billing account to the project. Google Maps Platform requires billing even when usage remains within a no-cost allowance.
3. Open **APIs & Services → Library**, search for **Places API (New)**, and enable it.
4. Open **APIs & Services → Credentials → Create credentials → API key**.
5. Edit the key:
   - Give it a specific name such as `TripFlow Places Edge`.
   - Under **API restrictions**, select **Restrict key** and allow only **Places API (New)**.
   - Do not add the Gemini API to this key and do not reuse `GEMINI_API_KEY`.
   - Supabase Edge Functions use dynamic cloud egress, so a fixed IP application restriction is generally impractical. The key remains hidden behind an authenticated proxy; compensate with the narrow API restriction, conservative quota, billing alerts, and usage monitoring.
6. In **APIs & Services → Quotas & System Limits**, set a conservative initial Autocomplete request quota and create budget alerts. Raise the quota only after observing real beta usage.

## Store the secret in Supabase

1. Open Supabase Dashboard → **TripFlow**.
2. Open **Edge Functions → Secrets**.
3. Add key `GOOGLE_MAPS_API_KEY` and paste the new Google Places key as its value.
4. Save. Supabase makes the secret available to deployed Edge Functions immediately; no Vercel variable and no app rebuild is required.
5. Never paste the key into Discord or commit it to Git.

## Acceptance check

1. Sign in to TripFlow.
2. Open **Today** and start adding an itinerary item.
3. Type at least three characters in **Where? / 在哪里？**.
4. Confirm that up to five canonical Google place suggestions appear and selecting one fills the field.
5. Save the item and use **Open in Google Maps / 在 Google 地图中打开**.

Official references:

- Google Places setup: https://developers.google.com/maps/documentation/places/web-service/get-api-key
- Autocomplete (New): https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
- Google API security guidance: https://developers.google.com/maps/api-security-best-practices
- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
