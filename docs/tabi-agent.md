# Tabi agent runtime

Tabi can choose tools, inspect their results, and continue before answering. It prepares itinerary and expense suggestions. The traveller remains responsible for confirming each plan card or saving the expense in Ledger.

## Request flow

The `ask-trip` handler authenticates the traveller and reads the active trip with their token. RLS controls visible rows. The handler loads a request snapshot of up to 150 plans, the trip roster, and 60 recent expenses. Queries fetch one extra row to distinguish complete and limited coverage. An expense read failure remains unavailable rather than becoming an empty ledger.

The first model request contains trip metadata and the conversation. It does not contain the full snapshot. Model-selected tools reveal relevant snapshot records. Each function call receives a matching function response. The model can use those results to make another call, correct an argument, ask a question, or finish its answer.

The runtime preserves the complete model content, ordered parts, function IDs, and opaque thought signatures. The first generation can use the existing Gemini fallback chain. Continuations stay on the first successful model. A continuation failure returns an incomplete result rather than moving signed history to another model. This follows Google's [function-calling](https://ai.google.dev/gemini-api/docs/generate-content/function-calling) and [thought-signature](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures) contracts.

## Tools

| Tool | Behavior |
| --- | --- |
| `get_itinerary` | Searches visible plans by text or local date and returns pages of 25 records with coverage. |
| `get_members` | Returns trip members, roles, and the current traveller marker. |
| `get_recent_expenses` | Returns recent original-currency expenses. It provides neither balances nor settlement calculations. |
| `search_places` | Calls the existing Places endpoint with a bounded query. Results are place suggestions, without opening hours or availability. |
| `estimate_route` | Calls the existing Routes endpoint using Place IDs from visible plans or place-search results. Estimates describe current conditions and do not guarantee travel time on the itinerary date. |
| `update_plan` | Validates and stages an existing plan change. Success means pending confirmation. |
| `add_plan` | Validates and stages a new plan. Success means pending confirmation. |
| `add_expense` | Validates and stages an expense draft for Ledger. Opening that draft does not save it. |

Tools accept no trip override, SQL, arbitrary URL, or arbitrary endpoint. The handler binds external requests to the authenticated scope. The runtime has no database writer. Existing save RPCs remain the write and final authorization boundary.

Owner and editor roles can prepare plan changes. Other members can ask questions and prepare expense drafts. Supplied plan and member IDs must exist in the snapshot. Explicit unknown people are rejected rather than replaced by defaults.

## Suggestions and confirmation

Plan times use the selected plan's destination time zone, or the trip time zone for new plans. Validation checks real calendar dates, nonexistent local times, interval order, and trip bounds. Moving only the start retains duration. Hotels occupy a separate overlap lane from daytime plans. Only plans in the same branch are compared for overlaps.

Successive updates to one plan merge into one candidate before validation. A later field replaces that field while retaining earlier changes to other fields. Every tool response returns the complete current candidate. Identical proposals produce one card. Each update carries its server-read title, times, and time zone so the client can reject a visibly stale card.

Stale-card rejection is a client-visible safeguard. The existing update RPC has no atomic expected-version condition, so another edit arriving after the client check remains a concurrency limit. Multiple cards are confirmed separately and do not form an atomic batch.

Money stays a decimal string until normal Ledger validation and saving. Proposal validation uses integer minor units, supported currencies, positive safe amounts, and currency precision. The model cannot settle balances, make payments, book travel, delete records, or change membership.

## Bounds and failure

The policy limits are six model responses, eight provider HTTP attempts including initial fallbacks, twelve executed tool calls, five pending suggestions, and 48,000 serialized tool-result characters. Each result is limited to 12,000 characters. Model responses with more than 32 parts are rejected. Tool arguments are limited to 4,000 characters. The last model step disables tool calls.

The handler's 85-second deadline includes authentication, snapshot reads, model calls, retry waits, and external lookups. Provider attempts retain the existing 18-second timeout. These are configured limits, not measured latency promises. They fit below the hosted [Edge Function request timeout](https://supabase.com/docs/guides/functions/limits).

Repeated read calls reuse request-local results but still spend tool-call budget. Errors, truncated coverage, and exhausted budgets produce a limited status. A later provider failure retains already validated suggestions with host-written text explaining that nothing was saved. Cancellation publishes no late assistant response. Stop, sheet dismissal, and unmount abort the client request. The trip-keyed sheet isolates conversations when trips change.

Chat photos are not persisted or attached to later user messages. A photo remains in its originating turn during this request's bounded internal model continuations, so Gemini may receive it more than once. Dictation stays a separate transcription request that fills an editable message.

## Ownership

- `supabase/functions/ask-trip/index.ts` owns HTTP, identity, the RLS snapshot, the request deadline, and fixed external endpoints.
- `supabase/functions/ask-trip/agent.ts` owns the model conversation, tool-result loop, budgets, and final result.
- `supabase/functions/ask-trip/tools.ts` owns declarations, bounded snapshot access, proposal validation, and staging.
- `supabase/functions/_shared/gemini.ts` owns provider attempts and cancellation. Other AI endpoints retain their existing defaults.
- `src/features/ai/use-trip-chat.ts` owns client turns, request cancellation, and proposal status history.
- `src/components/chat-action-card.tsx` owns explicit confirmation through existing application save paths.

## Design decision

Two independent designs compared fresh per-tool database reads with tools over the existing RLS snapshot. The snapshot design was selected and independently reviewed. It keeps one data basis during a request and avoids another repository implementation. The design adopts strict argument validation, complete protocol replay, authoritative proposal before-state, and bounded external Places and Routes calls.

The shared time conversion functions live under `_shared/trip-time.ts` so both the function bundle and Expo client use the existing conversion algorithm.

The accepted tradeoff is capped coverage and possible staleness while the model runs. An empty search over limited coverage does not establish absence across the full trip. Fresh paginated database tools can replace the snapshot if larger-trip acceptance requires them. Durable chat storage, autonomous writes, arbitrary web browsing, and a generic plugin framework are outside this implementation.

## Acceptance and rollout

Deterministic tests exercise the actual HTTP handler, agent, tool executor, and client hook with synthetic provider responses. They cover signed multi-call replay, model pinning, Places-to-Routes chaining, proposal corrections, permissions, time and money validation, cap-plus-one reads, partial failures, budgets, cancellation, and confirmation state.

Those fixtures do not establish live Gemini compatibility, Google availability, or deployed cross-account RLS behavior. Release acceptance requires an authorized test session, a real multi-step provider request, and signed-in mobile and desktop checks of Stop, partial results, plan confirmation, and Ledger draft opening. No database migration is needed.

Deploy the `ask-trip` function and its imports together, including `_shared/gemini.ts` and `_shared/trip-time.ts`. The client tolerates replies from the previous function version; new pending suggestions preserve the existing action names. Production activation remains a separate maintainer-approved deployment step.
