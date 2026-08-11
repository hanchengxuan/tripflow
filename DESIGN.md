---
name: TripFlow
description: A clear, optimistic shared travel workspace.
colors:
  coastal-teal: "#087F6A"
  journey-blue: "#1B70A6"
  sunset-coral: "#D86E35"
  ink: "#15344A"
  mist: "#F4FAFA"
  white: "#FFFFFF"
  selected-mint: "#D9EEEA"
  secondary-text: "#526F7E"
  danger: "#B4413E"
typography:
  headline:
    fontFamily: "system-ui"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: "44px"
  title:
    fontFamily: "system-ui"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "26px"
  body:
    fontFamily: "system-ui"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
  label:
    fontFamily: "system-ui"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "20px"
rounded:
  field: "12px"
  control: "14px"
  surface: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.coastal-teal}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "48px"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "18px"
  input:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 14px"
    height: "48px"
---

# Design System: TripFlow

## Overview

**Creative North Star: "The Open Coast Itinerary"**

TripFlow should feel like opening a calm, well-prepared route beside clear water: spacious enough to think, structured enough to act, and bright without becoming playful decoration. The interface puts the next useful moment first, then lets the rest of the journey flow as a continuous timeline.

The system is native-first and bilingual. It uses familiar platform controls, direct labels, and restrained surfaces so the brand is carried by rhythm, coastal color, and useful travel context rather than ornament.

**Key Characteristics:**
- Airy, calm hierarchy with one clear action per section.
- Coastal teal for action, journey blue for navigation and information, sunset coral for planning moments.
- Timeline continuity instead of repeated same-size cards.
- Equal visual and functional coverage for Simplified Chinese and English.

## Colors

The palette combines cool travel-air neutrals with a small number of optimistic accents.

### Primary
- **Coastal Teal:** Primary actions, selected controls, active locations, and positive amounts.

### Secondary
- **Journey Blue:** Navigation, informational emphasis, and secondary timeline markers.

### Tertiary
- **Sunset Coral:** Planning and newly added travel moments; never used for errors.

### Neutral
- **Ink:** Primary text.
- **Mist:** Page and input background.
- **White:** Elevated content surfaces.
- **Selected Mint:** Selected and informational containers.
- **Secondary Text:** Supporting copy and metadata.

**The One Route Rule.** Teal marks the primary path through a screen; do not create competing primary accents.

## Typography

**Display Font:** Platform system sans
**Body Font:** Platform system sans
**Label/Mono Font:** Platform system sans; platform monospace only for technical identifiers

**Character:** Clear and contemporary, with weight and spacing doing the work. Native system type preserves trust, Dynamic Type behavior, and bilingual legibility.

### Hierarchy
- **Headline:** Top-level screen title.
- **Title:** Card title and primary itinerary item.
- **Body:** Instructions and normal content.
- **Label:** Controls, metadata, and compact navigation.

**The Native Voice Rule.** Keep body and controls in the platform system face; branding comes from composition and color, not a decorative UI font.

## Layout

Content is single-column on phones and capped at 760px on wide screens, with 20px horizontal padding and a 16px vertical rhythm. Fields stack by default and may share a row only when they form one conceptual unit, such as start and end time. The next itinerary item appears before the remaining timeline and creation form.

## Elevation & Depth

Most grouping comes from spacing and tonal surfaces. Cards use one low ambient shadow with a visible vertical offset; they do not combine a border and shadow. Timeline rows remain flat to preserve continuity.

**The Flat Journey Rule.** Reserve elevation for focused summaries and forms; ordinary itinerary history stays on the page plane.

## Shapes

Fields use gently rounded 12px corners, buttons 14px, and elevated surfaces 16px. Full pills belong only to compact selectable chips. Touch targets are at least 44pt on iOS and 48dp on Android.

## Components

### Buttons
- **Shape:** Confident rounded rectangle with a 48px minimum height.
- **Primary:** Coastal teal with white label text.
- **Secondary:** Selected mint with ink text.
- **Focus:** A visible journey-blue focus ring on web; native pressed and disabled feedback remains platform appropriate.

### Chips
- **Style:** Compact pill used for finite choices, never as a general container.
- **State:** Teal and white when selected; quiet mint and ink otherwise.

### Cards / Containers
- **Corner Style:** Soft 16px surface corners.
- **Background:** White in light mode and the themed elevated surface in dark mode.
- **Shadow Strategy:** One low ambient shadow; no simultaneous border.
- **Internal Padding:** 18px with a 10px content rhythm.

### Inputs / Fields
- **Style:** Full-width, 48px minimum height, 12px corners, one quiet selected-mint stroke.
- **Focus:** Explicit focus ring on web and native picker behavior on mobile.
- **Error / Disabled:** Error copy names recovery; disabled controls remain readable and visibly subdued.

### Navigation
- Use four top-level destinations: Today, Trips, Ledger, and Me. Native builds use platform tab navigation; web uses a compact responsive navigation surface with visible active state.

### Shared Timeline
- The first item is an elevated “Up next” summary with map action. Later items form a flat vertical rail with time, title, place, and type.

## Do's and Don'ts

### Do:
- **Do** lead with the next useful travel action.
- **Do** use native date/time pickers and explicit start–end ranges.
- **Do** let bilingual copy expand and wrap naturally.
- **Do** keep map and AI actions reversible and user-confirmed.

### Don't:
- **Don't** turn every piece of information into a card.
- **Don't** use emoji or arbitrary glyphs as the product icon system.
- **Don't** combine decorative borders, halos, and shadows on one surface.
- **Don't** use color as the only indication of state or permission.
