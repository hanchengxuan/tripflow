# Booking document import

Plans accepts one flight/hotel PDF, JPEG, PNG or WebP at a time (5 MB maximum). The traveller explicitly chooses **Send and recognize** after the processor disclosure. `parse-booking` validates the bearer with Auth and checks owner/editor membership before calling Gemini. Embedded document instructions are untrusted; parsing creates no records. Passenger names, payment details and booking references are excluded from the extraction contract.

Each flight leg is a draft; a hotel is one stay interval. Missing fields remain empty. Departure and arrival each have their own local date/time and IANA zone. The preview converts them deterministically to UTC, rejects nonexistent/ambiguous daylight-saving times, and requires bookings to fit the trip dates. Saved timeline times use the trip zone. There is no inferred transfer, activity, expense or automatic date extension.

Confirmation uploads the original into the private `booking-documents` bucket under `<user>/<trip>/<SHA256(base64)>`, then invokes `import_booking_document`. Each new client plan includes the captured uploader identity; the backward-compatible actor guard rejects a login switch before any import write. Its private implementation validates the active actor and locks their editor membership plus the trip; all selected plans commit atomically. A unique uploader/trip/file fingerprint makes retries idempotent. A trip/item content key skips exact duplicates from different documents. This is exact-content deduplication, not fuzzy reservation matching. A failed response retains the stable private upload so retry cannot delete an original belonging to an already-committed transaction.

Only the uploader can read original metadata or get a 60-second signed link. Confirmed itinerary fields use existing trip/segment permissions. Deleting an original preserves plans. Account deletion clears all private uploader files, including failed-import uploads, before deleting the account. Trip deletion gathers committed document paths and performs best-effort Storage cleanup after deleting the trip; its existing cleanupPending result covers booking cleanup too. Failed-import orphan files remain private and are cleared on account deletion.

## Acceptance

`docs/booking-import-acceptance.sql` runs synthetic data in one transaction and rolls everything back. It checks batch import, same-file retry, exact-content dedupe, invalid-range rollback, owner/editor writes, viewer/outsider rejection and original-metadata RLS. Unit tests cover cross-zone/date-line travel and daylight-saving boundaries.

Real browser acceptance must additionally cover PDF and image recognition, missing-field edits, selecting drafts, confirming once, refreshing, duplicate uploads, private original viewing, original deletion, errors and mobile/desktop layout. Use an explicitly supplied test account and a disposable trip. Native file-picker acceptance requires a device or build; an export is compatibility evidence only.

Two fictional Loom samples are under `output/pdf/`. Dates fit a 2026-10-20 to 2026-10-25 trip in Asia/Tokyo. They are clearly labelled synthetic and are not valid travel reservations.

## Deployment and rollback

Apply the additive `booking_document_import` and `guard_booking_import_actor` migrations, deploy `parse-booking` and the updated `delete-trip`, then deploy the client. `parse-booking` uses custom bearer validation (`verify_jwt=false`), matching existing authenticated functions. `GEMINI_API_KEY` remains server-side; `BOOKING_GEMINI_MODEL` is an optional server-only override. No secret belongs in public Expo variables.

To roll the client back, deploy the previous web commit; the additive table, nullable key column and bucket can remain. Do not drop populated booking tables or storage objects during rollback. Pause the importer separately if a provider issue requires it.

## Confirmed map destinations

In each selected preview, **Edit details → Destination (optional)** reuses the city picker. A selected city contributes country, city, coordinates, time zone and optional currency to the saved itinerary item. Typing without selecting a suggestion does not set a map destination. The choice never changes the booking's departure/check-in or arrival/check-out local times. The optional payload is validated atomically by `booking_import_destination`; older clients without it remain compatible. Existing imported plans can use the normal plan editor to choose a destination; there is no automatic backfill from private originals or address text.
## Progress and recovery

Recognition shows a live status and permits **Stop waiting** or closing the sheet. This aborts the client request and ignores late responses; it does not claim to stop processing already running at the provider. It creates no saved original or plan. A fresh request can begin immediately without an old completion clearing its busy state.

Confirmation validates every selected row before uploading. Missing fields, invalid/DST local times, invalid zones, reversed intervals and trip-date boundaries produce localized row errors. Saving shows a separate status and keeps dismissal locked until the result is known. An unconfirmed save preserves the preview for an idempotent retry and never exposes raw provider details.
