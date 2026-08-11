# Product
<!-- impeccable:product-schema 1 -->

## Platform
Adaptive Expo application for iOS, Android, and the web.

## Users
Small groups of friends or family travelling together across cities or regions. They need one shared source of truth while moving, often with limited attention and inconsistent connectivity.

## Product Purpose
TripFlow should answer four questions quickly: what happens next, where is it, who is involved, and who owes whom. It is a shared, executable trip plan and ledger—not a generic notes app.

## Positioning
The product combines a live itinerary, group membership and permissions, map-aware places, and precise multi-currency expense splitting. It should reduce coordination work before and during a trip.

## Operating Context
- Primarily used on phones while walking, waiting, or travelling.
- Shared by two to eight travellers.
- Opens external booking and mapping apps when those tools are better suited to the task.
- Must remain understandable on the web and in both Simplified Chinese and English.

## Capabilities and Constraints
- Expo SDK 57, React Native, TypeScript, Supabase, and Vercel.
- Supabase RLS is the authority for trip roles and shared data access.
- AI may prepare editable drafts but must never autonomously save itinerary or financial records.
- Secrets remain server-side; public client keys must be platform and API restricted.
- iOS App Store readiness is a first-class delivery requirement.

## Brand Commitments
- Name: TripFlow / 旅途流.
- Clear, generous, calm, and optimistic with a fresh coastal travel palette.
- Prefer strong hierarchy and useful timeline structure over stacks of decorative cards.
- Use native interaction conventions and plain, friendly language.

## Evidence on Hand
- `PROJECT_CONTEXT.md` and `planning.md` are the durable product and delivery record.
- The repository contains the original product icon and implemented MVP flows.
- Do not invent user quotes, adoption metrics, partnerships, or ratings.

## Product Principles
1. The next useful action comes before historical detail.
2. Shared truth beats private notes.
3. Financial and itinerary changes require an explicit confirmation.
4. Use native controls for dates, times, choices, and account settings.
5. Chinese and English have equal functional coverage.

## Accessibility & Inclusion
- Touch targets meet iOS and Android minimums.
- Text can expand without clipping and color is never the only state signal.
- Controls have explicit labels, focus states, loading states, and recovery copy.
- Date, time, and currency formatting follows the chosen language.
