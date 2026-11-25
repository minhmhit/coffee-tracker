---
name: Vietnamese Coffee Intelligence
colors:
  surface: '#fbf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#fbf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ef'
  surface-container: '#efeeea'
  surface-container-high: '#eae8e4'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c1a'
  on-surface-variant: '#47464b'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f0ed'
  outline: '#77767b'
  outline-variant: '#c8c5cb'
  surface-tint: '#5f5e61'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1e'
  on-primary-container: '#858387'
  inverse-primary: '#c8c5ca'
  secondary: '#3c674f'
  on-secondary: '#ffffff'
  secondary-container: '#bbebcc'
  on-secondary-container: '#406b53'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#410005'
  on-tertiary-container: '#d55f5b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e4e1e6'
  primary-fixed-dim: '#c8c5ca'
  on-primary-fixed: '#1b1b1e'
  on-primary-fixed-variant: '#47464a'
  secondary-fixed: '#beedcf'
  secondary-fixed-dim: '#a3d1b4'
  on-secondary-fixed: '#002112'
  on-secondary-fixed-variant: '#244f39'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842324'
  background: '#fbf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2de'
typography:
  display-lg:
    fontFamily: Newsreader
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
  display-lg-mobile:
    fontFamily: Newsreader
    fontSize: 30px
    fontWeight: '400'
    lineHeight: 36px
  headline-lg:
    fontFamily: Newsreader
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 34px
  headline-md:
    fontFamily: Newsreader
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 28px
  headline-sm:
    fontFamily: Newsreader
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  mono-metric:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 26px
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
This design system embodies an authoritative, academic-editorial market intelligence dashboard designed for commodity traders, agricultural analysts, and roasting executives monitoring the Vietnamese coffee sector (Robusta and Arabica origins across the Central Highlands). 

The emotional tone balances the analytical rigor of *The Economist* with the typographic grace of the *Financial Times* and the structured clarity of Stripe’s documentation. Visual clutter is eliminated: no neon indicators, no saturated alert banners, and no decorative gradients. The experience communicates stability, institutional credibility, and deep domain precision through restrained whitespace, hairline delineation, and high-legibility editorial contrast.

## Colors
The color architecture relies on a warm, paper-inspired foundation that reduces screen fatigue during prolonged data auditing.

- **Foundational Canvas (`#FDFBF7`)**: Warm Ivory White acts as the substrate, evoking archival newsprint and high-grade unbleached stock.
- **Card & Table Surfaces (`#FFFFFF`)**: Pure White creates sharp spatial isolation for modular metric cards and dense data views.
- **Text & Structure Hierarchy**:
  - Primary Ink (`#18181B`): Deep Charcoal for headlines, key market indicators, and structural hairline boundaries.
  - Secondary Ink (`#52525B`): Muted Slate Gray for sub-labels, metadata, and column headers.
  - Tertiary Ink (`#71717A`): Soft Slate Gray for timestamps, footnotes, and inactive states.
  - Hairline Border (`#E5E7EB`): Structural 1px division across all cards, table cells, and panel borders.
- **Semantic Accents**:
  - Muted Sage Green (`#3F6A52`, background tint `#ECF3EF`): Indicates positive yield variance, export price lift, and stock surplus.
  - Muted Terracotta Red (`#B94A48`, background tint `#F9EBEA`): Signals weather risk, drought warnings, export volume contraction, and downward price revisions.
  - Slate Blue (`#475569`, background tint `#F1F5F9`): Structural tertiary accent reserved for policy notes, benchmark references, and neutral multi-commodity comparisons.

## Typography
Typographic discipline underpins the authoritative editorial voice.

- **Display & Headlines (Newsreader)**: Evokes the academic prestige of classical financial journalism. Used strictly for dashboard section headers, executive briefings, regional dossier titles, and high-level macro commentary. It retains generous leading to preserve readability.
- **Interface & Narrative Body (Inter)**: Delivers neutral, objective legibility for methodology notes, tabular legends, filtering menus, and form inputs.
- **Figures & Data Tokens (JetBrains Mono)**: Used for commodity ticker quotes, metric units (e.g., USD/MT, VND/kg, metric tons), exchange differentials, and timestamps. Tabular figures ensure numerical alignment across financial ledgers and time-series comparisons.

## Layout & Spacing
The layout follows a modular 12-column fixed/fluid hybrid grid architecture inspired by financial broadsheets and institutional terminals.

- **Desktop (1280px+)**: 12-column grid, max-width 1440px centered, 2.5rem (`margin-lg`) canvas margin, 1.5rem (`gutter-lg`) gutters between analytical panels.
- **Tablet (768px - 1279px)**: 8-column layout, 1.5rem (`margin-md`) canvas margins, 1rem (`gutter`) gutters. Key metric ribbons reflow into 2x2 modular blocks.
- **Mobile (<768px)**: 4-column single-column stack, 1rem (`margin`) canvas margins, 1rem gutters. Numerical tables shift into horizontally scrollable tabular cards with frozen origin identifiers.

Component internal padding maintains disciplined mathematical rhythm: compact controls use `space-sm` (8px), table cells and content cards scale from `space-md` (16px) to `space-lg` (24px). Macro analytical breakdowns are partitioned with `space-xl` (40px) vertical clearances.

## Elevation & Depth
Elevation is rendered strictly through flat architectural layering and 1px hairline boundaries rather than drop shadows.

- **Surface Tiers**:
  - Level 0 (Canvas Base): Warm Ivory `#FDFBF7`.
  - Level 1 (Analytical Cards & Tables): Pure White `#FFFFFF` encapsulated by a crisp 1px `#E5E7EB` border.
  - Level 2 (Flyouts, Select Dropdowns, Contextual Popovers): Pure White `#FFFFFF` bordered by `#D4D4D8` with a subtle, non-intrusive ambient diffusion: `0 4px 12px -2px rgba(24, 24, 27, 0.05)`.
- **Dividers & Grid Lines**: All interior structural splits utilize 1px solid `#E5E7EB`. Heavy lines or raised bevels are prohibited. Active selection states replace the border with a 1px solid `#18181B` or `#3F6A52` ring, preserving absolute structural flatness.

## Shapes
To reinforce an academic and utilitarian terminal identity, shapes are kept disciplined and minimally softened.

- Base elements (cards, containers, tables, charts) adopt a subtle `0.25rem` (4px) corner radius, preserving an architectural grid discipline while avoiding raw, unstyled corners.
- Interactive controls, buttons, status chips, and table search fields employ `0.25rem` (4px) consistently.
- Circular elements are strictly reserved for origin status dots and user profile monograms. Avoid large, bubbly pill containers or highly rounded floating elements.

## Components

- **Buttons**:
  - *Primary*: Deep Charcoal background (`#18181B`), crisp white text (`#FFFFFF`), 4px radius, 8px 16px padding. Active hover state softens slightly to `#27272A`.
  - *Secondary / Outline*: Pure white surface (`#FFFFFF`), 1px border (`#E5E7EB`), text `#18181B`. Hover state applies `#F4F4F5` fill.
  - *Text Utility*: Transparent background, `#52525B` text, underlines on hover; used for audit reports and raw data export actions.

- **Data Tables (Ledgers)**:
  - Header rows feature a faint `#FBF9F5` tint, 1px bottom border (`#E5E7EB`), with sub-labels set in uppercase `Inter` (11px, weight 600, letter spacing +0.05em).
  - Numeric cells are right-aligned, formatted with `JetBrains Mono` tabular figures. Row hover triggers a subtle `#FDFCFB` tint.

- **Metric Cards (KPI Tiles)**:
  - White background (`#FFFFFF`), 1px border (`#E5E7EB`), 16px internal padding.
  - Top slot contains the metric label in `Inter` 12px uppercase slate gray, followed by the primary metric value in `Newsreader` (24px) or `JetBrains Mono` (20px).
  - Trend deltas utilize quiet badge chips (+1.8% in `#ECF3EF` with `#3F6A52` text; -2.4% in `#F9EBEA` with `#B94A48` text).

- **Status Chips & Origin Badges**:
  - Scaled down (height 22px), 4px radius, subtle border.
  - Examples: "Dak Lak • Robusta Grade 1" set in `#F4F4F5` with `#27272A` text; "Harvest Warning" set in `#F9EBEA` with `#B94A48` text.

- **Form Controls & Inputs**:
  - Input boxes feature a 1px border (`#E5E7EB`), 8px 12px padding, `#FFFFFF` background, and text in `Inter` 14px.
  - Focus state swaps border color to `#18181B` with zero offset glow.

- **Checkboxes & Radios**:
  - Precision square inputs (16x16px) with a 1px `#D4D4D8` border, filling with `#18181B` upon selection. Checkmarks rendered with razor-sharp 1.5px white paths.

- **Specialized Domain Components**:
  - *Regional Moisture Gauge*: Minimalist 4px high horizontal bar charts showing soil saturation against seasonal targets.
  - *Terminal Differential Index*: Comparative side-by-side terminal price comparison (London Robusta vs. Local Dak Lak farmgate pricing) using monospace alignment and clean reference rule dividers.